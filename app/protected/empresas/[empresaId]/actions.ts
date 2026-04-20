"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inflateRawSync } from "node:zlib";

import { transcribePdfWithOcrSpace } from "@/lib/ocr-space";
import { createClient } from "@/lib/supabase/server";

function sanitizeStoredText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function xmlToText(xml: string) {
  return xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function readZipEntries(buffer: Uint8Array): ZipEntry[] {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const eocdSig = 0x06054b50;
  const cdfhSig = 0x02014b50;
  const lfhSig = 0x04034b50;

  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (dv.getUint32(i, true) === eocdSig) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    return [];
  }

  const totalEntries = dv.getUint16(eocdOffset + 10, true);
  const centralDirOffset = dv.getUint32(eocdOffset + 16, true);

  const entries: ZipEntry[] = [];
  let ptr = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (dv.getUint32(ptr, true) !== cdfhSig) break;

    const compressionMethod = dv.getUint16(ptr + 10, true);
    const compressedSize = dv.getUint32(ptr + 20, true);
    const fileNameLength = dv.getUint16(ptr + 28, true);
    const extraLength = dv.getUint16(ptr + 30, true);
    const commentLength = dv.getUint16(ptr + 32, true);
    const localHeaderOffset = dv.getUint32(ptr + 42, true);

    const fileNameBytes = buffer.slice(ptr + 46, ptr + 46 + fileNameLength);
    const name = decodeUtf8(fileNameBytes);

    if (dv.getUint32(localHeaderOffset, true) === lfhSig) {
      entries.push({
        name,
        compressionMethod,
        compressedSize,
        localHeaderOffset,
      });
    }

    ptr += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function extractZipEntry(buffer: Uint8Array, entry: ZipEntry): Uint8Array | null {
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const local = entry.localHeaderOffset;
  const fileNameLength = dv.getUint16(local + 26, true);
  const extraLength = dv.getUint16(local + 28, true);
  const dataOffset = local + 30 + fileNameLength + extraLength;
  const compressed = buffer.slice(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return inflateRawSync(compressed);
  return null;
}

function extractDocxText(bytes: Uint8Array) {
  const entries = readZipEntries(bytes);
  const doc = entries.find((entry) => entry.name === "word/document.xml");
  if (!doc) return "";
  const data = extractZipEntry(bytes, doc);
  if (!data) return "";
  return xmlToText(decodeUtf8(data));
}

function extractPptxText(bytes: Uint8Array) {
  const entries = readZipEntries(bytes);
  const slideEntries = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const slides: string[] = [];
  for (const entry of slideEntries) {
    const data = extractZipEntry(bytes, entry);
    if (!data) continue;

    const xml = decodeUtf8(data);
    const matches = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) ?? [];
    const texts = matches
      .map((match) => match.replace(/<\/?a:t>/g, "").trim())
      .filter(Boolean);

    if (texts.length > 0) {
      slides.push(texts.join(" "));
    }
  }

  return slides.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

function extractXlsxText(bytes: Uint8Array) {
  const entries = readZipEntries(bytes);
  const sharedEntry = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
  const sheetEntries = entries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name));

  const sharedStrings: string[] = [];
  if (sharedEntry) {
    const sharedData = extractZipEntry(bytes, sharedEntry);
    if (sharedData) {
      const xml = decodeUtf8(sharedData);
      const matches = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
      for (const match of matches) {
        sharedStrings.push(match.replace(/<[^>]+>/g, "").trim());
      }
    }
  }

  const rows: string[] = [];
  for (const entry of sheetEntries) {
    const sheetData = extractZipEntry(bytes, entry);
    if (!sheetData) continue;
    const xml = decodeUtf8(sheetData);
    const rowMatches = xml.match(/<row[\s\S]*?<\/row>/g) ?? [];

    for (const rowXml of rowMatches) {
      const cellMatches = rowXml.match(/<c[\s\S]*?<\/c>/g) ?? [];
      const cellValues: string[] = [];

      for (const cell of cellMatches) {
        const isShared = / t=\"s\"/.test(cell);
        const isInline = / t=\"inlineStr\"/.test(cell);

        let value = "";
        if (isInline) {
          const inlineMatch = cell.match(/<t[^>]*>([\s\S]*?)<\/t>/);
          value = inlineMatch?.[1]?.trim() ?? "";
        } else {
          const valueMatch = cell.match(/<v>([\s\S]*?)<\/v>/);
          const raw = valueMatch?.[1]?.trim() ?? "";
          if (!raw) continue;
          if (isShared) {
            const idx = Number(raw);
            value = sharedStrings[idx] ?? raw;
          } else {
            value = raw;
          }
        }

        if (value) {
          cellValues.push(value);
        }
      }

      if (cellValues.length > 0) {
        rows.push(cellValues.join(" | "));
      }
    }
  }

  return rows.join("\n").replace(/[ \t]+/g, " ").trim();
}

async function extractPdfText(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerModulePath: string = "pdfjs-dist/legacy/build/pdf.worker.mjs";
  const pdfjsWorker = (await import(workerModulePath)) as {
    WorkerMessageHandler: unknown;
  };
  if (!globalThis.pdfjsWorker) {
    globalThis.pdfjsWorker = pdfjsWorker;
  }

  const { getDocument } = pdfjs;
  const pdf = await getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const positioned = content.items
      .map((item) => {
        if (!("str" in item)) {
          return null;
        }

        const text = String(item.str ?? "").replace(/\s+/g, " ").trim();
        if (!text) {
          return null;
        }

        return {
          text,
          x: typeof item.transform?.[4] === "number" ? item.transform[4] : 0,
          y: typeof item.transform?.[5] === "number" ? item.transform[5] : 0,
          height: typeof item.height === "number" ? item.height : 0,
          hasEOL: Boolean(item.hasEOL),
        };
      })
      .filter((item): item is { text: string; x: number; y: number; height: number; hasEOL: boolean } => Boolean(item))
      .sort((a, b) => {
        if (Math.abs(b.y - a.y) > 3) {
          return b.y - a.y;
        }
        return a.x - b.x;
      });

    const lines: Array<{ y: number; items: typeof positioned }> = [];
    for (const item of positioned) {
      const lastLine = lines.at(-1);
      const tolerance = Math.max(4, item.height * 0.5);

      if (!lastLine || Math.abs(lastLine.y - item.y) > tolerance) {
        lines.push({ y: item.y, items: [item] });
        continue;
      }

      lastLine.items.push(item);
      if (item.hasEOL) {
        lastLine.y = item.y;
      }
    }

    const text = lines
      .map((line) =>
        line.items
          .sort((a, b) => a.x - b.x)
          .map((item) => item.text)
          .join(" ")
          .replace(/\s+([,.;:!?])/g, "$1")
          .trim(),
      )
      .filter(Boolean)
      .join("\n")
      .trim();

    if (text) {
      pages.push(text);
    }
  }

  return pages.join("\n\n").trim();
}

async function transcribePdfWithOpenAI(fileName: string, bytes: Uint8Array) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return "";
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_PDF_MODEL?.trim() || "gpt-4o-mini";

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: fileName,
              file_data: Buffer.from(bytes).toString("base64"),
            },
            {
              type: "input_text",
              text: [
                "Transcribe este PDF a texto plano fiel al original.",
                "Preserva encabezados, listas y saltos de seccion cuando sea posible.",
                "No resumas, no traduzcas, no expliques y no agregues comentarios.",
                "Devuelve solo la transcripcion.",
              ].join(" "),
            },
          ],
        },
      ],
      temperature: 0,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error al transcribir PDF con OpenAI (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  return (
    data.output_text?.trim() ??
    data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .join("\n")
      .trim() ??
    ""
  );
}

async function extractSupportedDocumentText(uploadedFile: File) {
  const fileName = uploadedFile.name || "documento";
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const supportedExtensions = new Set([
    "pdf",
    "txt",
    "md",
    "csv",
    "json",
    "html",
    "xml",
    "docx",
    "pptx",
    "xlsx",
  ]);

  if (!supportedExtensions.has(extension)) {
    throw new Error(
      "Formato no soportado para lectura automatica. Usa pdf, txt, md, csv, json, html, xml, docx, pptx o xlsx.",
    );
  }

  const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
  let rawText = "";

  if (extension === "pdf") {
    try {
      rawText = await extractPdfText(bytes);
    } catch (error) {
      console.error("[upload:extract] pdf text layer failed", {
        fileName,
        fileSize: uploadedFile.size,
        error: error instanceof Error ? error.message : String(error),
      });
      rawText = "";
    }
    console.info("[upload:extract] pdf text layer read", {
      fileName,
      fileSize: uploadedFile.size,
      textLength: rawText.replace(/\s+/g, "").length,
      hasOcrSpace: Boolean(process.env.OCR_SPACE_API_KEY?.trim()),
      hasOpenAi: Boolean(process.env.OPENAI_API_KEY?.trim()),
    });
    if (rawText.replace(/\s+/g, "").length < 80) {
      try {
        rawText = await transcribePdfWithOcrSpace(fileName, bytes);
      } catch (error) {
        console.error("[upload:extract] ocr-space failed", {
          fileName,
          fileSize: uploadedFile.size,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (rawText.replace(/\s+/g, "").length < 80) {
      rawText = await transcribePdfWithOpenAI(fileName, bytes);
      console.info("[upload:extract] openai pdf transcription finished", {
        fileName,
        fileSize: uploadedFile.size,
        textLength: rawText.replace(/\s+/g, "").length,
      });
    }
  } else if (["txt", "md", "csv", "json", "html", "xml"].includes(extension)) {
    rawText = decodeUtf8(bytes).trim();
  } else if (extension === "docx") {
    rawText = extractDocxText(bytes);
  } else if (extension === "pptx") {
    rawText = extractPptxText(bytes);
  } else if (extension === "xlsx") {
    rawText = extractXlsxText(bytes);
  }

  rawText = sanitizeStoredText(rawText);
  if (!rawText) {
    if (extension === "pdf") {
      throw new Error(
        process.env.OCR_SPACE_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
          ? `No se pudo extraer ni transcribir el PDF. hasOcrSpace=${Boolean(process.env.OCR_SPACE_API_KEY?.trim())} hasOpenAi=${Boolean(process.env.OPENAI_API_KEY?.trim())}.`
          : "No se pudo extraer texto del PDF. El archivo parece escaneado o basado en imagen. Falta OCR_SPACE_API_KEY u OPENAI_API_KEY en el entorno.",
      );
    }

    throw new Error("No se pudo extraer texto del archivo. Prueba con otro archivo.");
  }

  return {
    fileName,
    rawText,
  };
}

function parseAlcanceCalendario(raw: string) {
  const map: Record<string, number> = {};
  if (!raw.trim()) return map;

  const chunks = raw
    .split(/\r?\n|[,;]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const sep = chunk.indexOf(":");
    if (sep <= 0) continue;

    const canal = chunk.slice(0, sep).trim();
    const valueRaw = chunk.slice(sep + 1).trim();
    const count = Number.parseInt(valueRaw, 10);
    if (!canal || !Number.isFinite(count) || count <= 0) continue;
    map[canal] = Math.min(10, count);
  }

  return map;
}

function normalizeAlcanceMap(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, number>;

  const map: Record<string, number> = {};
  for (const [channel, countRaw] of Object.entries(value as Record<string, unknown>)) {
    const count =
      typeof countRaw === "number"
        ? countRaw
        : Number.parseInt(String(countRaw ?? "").trim(), 10);
    if (!channel.trim() || !Number.isFinite(count) || count <= 0) continue;
    map[channel.trim()] = Math.min(10, Math.trunc(count));
  }

  return map;
}

function parseAlcanceCalendarioJson(raw: string) {
  const text = raw.trim();
  if (!text) return {} as Record<string, number>;

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && "alcance_calendario" in (parsed as Record<string, unknown>)) {
      return normalizeAlcanceMap((parsed as Record<string, unknown>).alcance_calendario);
    }
    return normalizeAlcanceMap(parsed);
  } catch {
    return parseAlcanceCalendario(text);
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return supabase;
}

async function requireUserAgenciaContext() {
  const supabase = await requireUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: appUser, error } = await supabase
    .from("app_user")
    .select("agencia_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer perfil de usuario: ${error.message}`);
  }

  if (!appUser?.agencia_id) {
    throw new Error("El usuario no tiene agencia asignada en app_user.");
  }

  return {
    supabase,
    agenciaId: appUser.agencia_id as string,
  };
}

function revalidateEmpresaRoutes(empresaId: string) {
  revalidatePath(`/protected/empresas/${empresaId}`);
  revalidatePath(`/protected/empresas/${empresaId}/bec`);
  revalidatePath(`/protected/empresas/${empresaId}/briefs`);
  revalidatePath(`/protected/empresas/${empresaId}/plan-trabajo`);
  revalidatePath(`/protected/empresas/${empresaId}/calendario`);
}

function empresaUploadErrorPath(empresaId: string, code: string) {
  return `/protected/empresas/${empresaId}?upload_error=${encodeURIComponent(code)}`;
}

function logUploadFailure(context: string, error: unknown, meta: Record<string, unknown>) {
  console.error(`[upload:${context}] failed`, {
    ...meta,
    error: error instanceof Error ? error.message : String(error),
  });
}

export async function updateEmpresa(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const industria = String(formData.get("industria") ?? "").trim();
  const pais = String(formData.get("pais") ?? "").trim();
  const alcanceCalendarioJsonField = formData.get("alcance_calendario_json");

  if (!empresaId || !nombre) {
    return;
  }

  const { data: empresaCurrent } = await supabase
    .from("empresa")
    .select("metadata_json")
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  const metadataJson =
    empresaCurrent?.metadata_json && typeof empresaCurrent.metadata_json === "object"
      ? ({ ...empresaCurrent.metadata_json } as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  if (alcanceCalendarioJsonField !== null) {
    const alcanceCalendarioJsonRaw = String(alcanceCalendarioJsonField ?? "").trim();
    metadataJson.alcance_calendario = parseAlcanceCalendarioJson(alcanceCalendarioJsonRaw);
  }

  await supabase
    .from("empresa")
    .update({
      nombre,
      industria: industria || null,
      pais: pais || null,
      metadata_json: metadataJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId);

  revalidatePath("/protected");
  revalidatePath("/protected/empresas");
  revalidateEmpresaRoutes(empresaId);
}

export async function createEmpresaDocument(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawTextInput = sanitizeStoredText(String(formData.get("raw_text") ?? ""));
  const docType = String(formData.get("doc_type") ?? "archivo").trim() || "archivo";
  const uploadedFile = formData.get("file");

  if (!empresaId) {
    return;
  }

  const { data: empresa } = await supabase
    .from("empresa")
    .select("id")
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  if (!empresa) {
    throw new Error("Empresa no encontrada o sin acceso.");
  }

  let rawText = rawTextInput;
  let title = rawTitle;
  let uploadedFileName = "";
  let uploadedFileSize = 0;
  let extension = "";

  if (!rawText && uploadedFile instanceof File && uploadedFile.size > 0) {
    uploadedFileName = uploadedFile.name;
    uploadedFileSize = uploadedFile.size;
    extension = uploadedFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (!new Set(["pdf", "docx"]).has(extension)) {
      redirect(empresaUploadErrorPath(empresaId, "unsupported_file"));
    }

    console.info("[upload:empresa] started", {
      agenciaId,
      empresaId,
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      fileType: uploadedFile.type || null,
      extension,
    });

    let extracted: Awaited<ReturnType<typeof extractSupportedDocumentText>>;
    try {
      extracted = await extractSupportedDocumentText(uploadedFile);
    } catch (error) {
      logUploadFailure("empresa:extract", error, {
        agenciaId,
        empresaId,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type || null,
        extension,
      });
      redirect(empresaUploadErrorPath(empresaId, "transcribe_elsewhere"));
    }

    rawText = extracted.rawText;
    title = rawTitle || extracted.fileName.replace(/\.[^.]+$/, "").trim();
  }

  if (!rawText) {
    redirect(empresaUploadErrorPath(empresaId, "missing_content"));
  }

  title = title || "Documento de empresa";

  const { error } = await supabase.from("kb_documents").insert({
    agencia_id: agenciaId,
    empresa_id: empresaId,
    empresa_file_id: null,
    scope: "org",
    doc_type: docType,
    title,
    raw_text: rawText,
  });

  if (error) {
    logUploadFailure("empresa:insert", error, {
      agenciaId,
      empresaId,
      fileName: uploadedFileName || null,
      fileSize: uploadedFileSize || null,
      extension,
    });
    throw new Error(`No se pudo crear documento: ${error.message}`);
  }

  console.info("[upload:empresa] completed", {
    agenciaId,
    empresaId,
    fileName: uploadedFileName || null,
    rawTextLength: rawText.length,
  });

  revalidateEmpresaRoutes(empresaId);
  redirect(`/protected/empresas/${empresaId}`);
}

export async function deleteEmpresaDocument(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();

  if (!empresaId || !documentId) {
    return;
  }

  const { data: existing } = await supabase
    .from("kb_documents")
    .select("empresa_file_id")
    .eq("id", documentId)
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  const { error } = await supabase
    .from("kb_documents")
    .delete()
    .eq("id", documentId)
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId);

  if (error) {
    throw new Error(`No se pudo eliminar documento: ${error.message}`);
  }

  if (existing?.empresa_file_id) {
    await supabase
      .from("empresa_file")
      .delete()
      .eq("id", existing.empresa_file_id)
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId);
  }

  revalidateEmpresaRoutes(empresaId);
}

export async function updateEmpresaDocument(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const documentId = String(formData.get("document_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const docType = String(formData.get("doc_type") ?? "").trim();
  const rawText = String(formData.get("raw_text") ?? "").trim();

  if (!empresaId || !documentId || !title || !docType || !rawText) {
    return;
  }

  const { error } = await supabase
    .from("kb_documents")
    .update({
      title,
      doc_type: docType,
      raw_text: rawText,
    })
    .eq("id", documentId)
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId);

  if (error) {
    throw new Error(`No se pudo actualizar documento: ${error.message}`);
  }

  revalidateEmpresaRoutes(empresaId);
}
