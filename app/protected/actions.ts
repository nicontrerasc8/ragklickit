"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inflateRawSync } from "node:zlib";

import {
  BRIEF_OBJECTIVE_GROUPS,
  BRIEF_TEXT_FIELDS,
  loadBriefForm,
  makeDefaultBriefForm,
} from "@/lib/brief/schema";
import { ollamaChat } from "@/lib/ollama/client";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_PROMPT_TYPES = [
  "bec",
  "plan_trabajo",
  "calendario",
] as const;

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodeLatin1(bytes: Uint8Array) {
  return new TextDecoder("latin1", { fatal: false }).decode(bytes);
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
  const doc = entries.find((e) => e.name === "word/document.xml");
  if (!doc) return "";
  const data = extractZipEntry(bytes, doc);
  if (!data) return "";
  return xmlToText(decodeUtf8(data));
}

function extractXlsxText(bytes: Uint8Array) {
  const entries = readZipEntries(bytes);
  const sharedEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
  const sheetEntries = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));

  const sharedStrings: string[] = [];
  if (sharedEntry) {
    const sharedData = extractZipEntry(bytes, sharedEntry);
    if (sharedData) {
      const xml = decodeUtf8(sharedData);
      const matches = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
      for (const m of matches) {
        sharedStrings.push(m.replace(/<[^>]+>/g, "").trim());
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

function extractPdfText(bytes: Uint8Array) {
  const asLatin1 = decodeLatin1(bytes);
  const matches = asLatin1.match(/\(([^()]{2,500})\)/g) ?? [];
  const pieces = matches
    .map((m) => m.slice(1, -1))
    .filter((t) => /[A-Za-zÃÃ‰ÃÃ“ÃšÃ¡Ã©Ã­Ã³ÃºÃ‘Ã±0-9]/.test(t));
  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

async function maybeTranslateWithOllama(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const maxChars = 18000;
  const bounded = trimmed.slice(0, maxChars);
  const translated = await ollamaChat({
    systemPrompt:
      "Eres un asistente que limpia y traduce contenido documental al espanol neutro. Devuelve solo texto plano.",
    userPrompt: `Limpia ruido y traduce al espanol neutro sin resumir. Si ya esta en espanol, solo limpiarlo.\n\n${bounded}`,
    temperature: 0.1,
  });

  return translated.trim() || bounded;
}

async function summarizeForRagWithOllama(text: string, title: string, docType: string) {
  const bounded = text.slice(0, 22000);
  const summary = await ollamaChat({
    systemPrompt:
      "Eres un analista documental para RAG. Resumes en espanol neutro y devuelves texto plano.",
    userPrompt: [
      `Documento: ${title}`,
      `Tipo: ${docType}`,
      "",
      "Genera:",
      "1) Resumen ejecutivo (5-8 lineas)",
      "2) Datos y cifras clave",
      "3) Entidades clave",
      "4) Riesgos o pendientes",
      "",
      "Contenido:",
      bounded,
    ].join("\n"),
    temperature: 0.1,
  });

  return summary.trim();
}

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
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
    userId: user.id,
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

async function upsertBrief(
  empresaId: string,
  periodo: string,
  estado: string,
  contenidoJson: unknown,
) {
  const supabase = await requireUser();
  const { data: existing, error: existingError } = await supabase
    .from("brief")
    .select("id, version")
    .eq("empresa_id", empresaId)
    .eq("periodo", periodo)
    .maybeSingle();

  if (existingError) {
    throw new Error(`No se pudo consultar brief: ${existingError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("brief")
      .update({
        estado,
        contenido_json: contenidoJson,
        version: (existing.version ?? 1) + 1,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`No se pudo actualizar brief: ${updateError.message}`);
    }
    return;
  }

  const { error: insertError } = await supabase.from("brief").insert({
    empresa_id: empresaId,
    periodo,
    estado,
    contenido_json: contenidoJson,
  });

  if (insertError) {
    throw new Error(`No se pudo crear brief: ${insertError.message}`);
  }
}

async function upsertPlanTrabajoArtifact(params: {
  empresaId: string;
  agenciaId: string;
  briefId: string;
  periodo: string;
  contenidoJson: unknown;
}) {
  const { empresaId, agenciaId, briefId, periodo, contenidoJson } = params;
  const supabase = await requireUser();
  const title = `Plan de trabajo ${periodo}`;

  const { data: existing, error: existingError } = await supabase
    .from("rag_artifacts")
    .select("id, version")
    .eq("artifact_type", "plan_trabajo")
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId)
    .eq("title", title)
    .maybeSingle();

  if (existingError) {
    throw new Error(`No se pudo consultar plan de trabajo: ${existingError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("rag_artifacts")
      .update({
        content_json: contenidoJson,
        status: "draft",
        version: (existing.version ?? 1) + 1,
        inputs_json: { brief_id: briefId, periodo },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`No se pudo actualizar plan de trabajo: ${updateError.message}`);
    }
    return;
  }

  const { error: insertError } = await supabase.from("rag_artifacts").insert({
    artifact_type: "plan_trabajo",
    agencia_id: agenciaId,
    empresa_id: empresaId,
    title,
    status: "draft",
    inputs_json: { brief_id: briefId, periodo },
    content_json: contenidoJson,
  });

  if (insertError) {
    throw new Error(`No se pudo crear plan de trabajo: ${insertError.message}`);
  }
}

async function upsertCalendarioArtifact(params: {
  empresaId: string;
  agenciaId: string;
  planArtifactId: string;
  periodo: string;
  contenidoJson: unknown;
}) {
  const { empresaId, agenciaId, planArtifactId, periodo, contenidoJson } = params;
  const supabase = await requireUser();
  const title = `Calendario ${periodo}`;

  const { data: existing, error: existingError } = await supabase
    .from("rag_artifacts")
    .select("id, version")
    .eq("artifact_type", "calendario")
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId)
    .eq("title", title)
    .maybeSingle();

  if (existingError) {
    throw new Error(`No se pudo consultar calendario: ${existingError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("rag_artifacts")
      .update({
        content_json: contenidoJson,
        status: "draft",
        version: (existing.version ?? 1) + 1,
        inputs_json: { plan_artifact_id: planArtifactId, periodo },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`No se pudo actualizar calendario: ${updateError.message}`);
    }
    return;
  }

  const { error: insertError } = await supabase.from("rag_artifacts").insert({
    artifact_type: "calendario",
    agencia_id: agenciaId,
    empresa_id: empresaId,
    title,
    status: "draft",
    inputs_json: { plan_artifact_id: planArtifactId, periodo },
    content_json: contenidoJson,
  });

  if (insertError) {
    throw new Error(`No se pudo crear calendario: ${insertError.message}`);
  }
}

export async function createAgencia(formData: FormData) {
  const supabase = await requireUser();
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!nombre) {
    return;
  }

  const slug = toSlug(nombre);
  await supabase.from("agencia").insert({
    nombre,
    slug,
  });

  revalidatePath("/protected");
  revalidatePath("/protected/empresas");
}

export async function createEmpresa(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const industria = String(formData.get("industria") ?? "").trim();
  const pais = String(formData.get("pais") ?? "").trim();

  if (!nombre) {
    return;
  }

  await supabase.from("empresa").insert({
    agencia_id: agenciaId,
    nombre,
    industria: industria || null,
    pais: pais || null,
  });

  revalidatePath("/protected");
  revalidatePath("/protected/empresas");
}

export async function updateEmpresa(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const industria = String(formData.get("industria") ?? "").trim();
  const pais = String(formData.get("pais") ?? "").trim();

  if (!empresaId || !nombre) {
    return;
  }

  await supabase
    .from("empresa")
    .update({
      nombre,
      industria: industria || null,
      pais: pais || null,
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
  const title = String(formData.get("title") ?? "").trim();
  const rawTextInput = String(formData.get("raw_text") ?? "").trim();
  const docType = String(formData.get("doc_type") ?? "manual").trim() || "manual";
  const uploadedFile = formData.get("file");

  if (!empresaId || !title) {
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
  let empresaFileId: string | null = null;

  if (!rawText && uploadedFile instanceof File && uploadedFile.size > 0) {
    const fileName = uploadedFile.name || "documento";
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    const supportedExtensions = new Set([
      "txt",
      "md",
      "csv",
      "json",
      "html",
      "xml",
      "pdf",
      "docx",
      "xlsx",
    ]);

    if (!supportedExtensions.has(extension)) {
      throw new Error(
        "Formato no soportado para lectura automatica. Usa txt, md, csv, json, html, xml, pdf, docx o xlsx, o pega texto manual.",
      );
    }

    const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
    if (["txt", "md", "csv", "json", "html", "xml"].includes(extension)) {
      rawText = decodeUtf8(bytes).trim();
    } else if (extension === "docx") {
      rawText = extractDocxText(bytes);
    } else if (extension === "xlsx") {
      rawText = extractXlsxText(bytes);
    } else if (extension === "pdf") {
      rawText = extractPdfText(bytes);
    }

    rawText = rawText.trim();
    if (!rawText) {
      throw new Error("No se pudo extraer texto del archivo. Puedes pegar texto manual.");
    }

    rawText = await maybeTranslateWithOllama(rawText);

    const { data: empresaFile, error: fileError } = await supabase
      .from("empresa_file")
      .insert({
        agencia_id: agenciaId,
        empresa_id: empresaId,
        nombre: fileName,
        mime_type: uploadedFile.type || null,
        file_size_bytes: uploadedFile.size,
        estado: "procesado",
        texto_extraido: rawText,
      })
      .select("id")
      .single();

    if (fileError) {
      throw new Error(`No se pudo registrar archivo: ${fileError.message}`);
    }

    empresaFileId = empresaFile.id;
  }

  if (!rawText) {
    throw new Error("Debes subir un archivo o pegar contenido manual.");
  }

  let ragText = rawText;
  try {
    const summary = await summarizeForRagWithOllama(rawText, title, docType);
    if (summary) {
      ragText = `RESUMEN_IA\n${summary}\n\nCONTENIDO_ORIGINAL\n${rawText}`;
    }
  } catch {
    // Keep extracted text if summarization fails.
  }

  const { error } = await supabase.from("kb_documents").insert({
    agencia_id: agenciaId,
    empresa_id: empresaId,
    empresa_file_id: empresaFileId,
    scope: "org",
    doc_type: docType,
    title,
    raw_text: ragText,
  });

  if (error) {
    throw new Error(`No se pudo crear documento: ${error.message}`);
  }

  revalidateEmpresaRoutes(empresaId);
}

export async function createAgenciaDocument(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const title = String(formData.get("title") ?? "").trim();
  const rawTextInput = String(formData.get("raw_text") ?? "").trim();
  const docType = String(formData.get("doc_type") ?? "manual").trim() || "manual";
  const uploadedFile = formData.get("file");

  if (!title) {
    return;
  }

  let rawText = rawTextInput;

  if (!rawText && uploadedFile instanceof File && uploadedFile.size > 0) {
    const fileName = uploadedFile.name || "documento";
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    const supportedExtensions = new Set([
      "txt",
      "md",
      "csv",
      "json",
      "html",
      "xml",
      "pdf",
      "docx",
      "xlsx",
    ]);

    if (!supportedExtensions.has(extension)) {
      throw new Error(
        "Formato no soportado para lectura automatica. Usa txt, md, csv, json, html, xml, pdf, docx o xlsx, o pega texto manual.",
      );
    }

    const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
    if (["txt", "md", "csv", "json", "html", "xml"].includes(extension)) {
      rawText = decodeUtf8(bytes).trim();
    } else if (extension === "docx") {
      rawText = extractDocxText(bytes);
    } else if (extension === "xlsx") {
      rawText = extractXlsxText(bytes);
    } else if (extension === "pdf") {
      rawText = extractPdfText(bytes);
    }

    rawText = rawText.trim();
    if (!rawText) {
      throw new Error("No se pudo extraer texto del archivo. Puedes pegar texto manual.");
    }

    rawText = await maybeTranslateWithOllama(rawText);
  }

  if (!rawText) {
    throw new Error("Debes subir un archivo o pegar contenido manual.");
  }

  let ragText = rawText;
  try {
    const summary = await summarizeForRagWithOllama(rawText, title, docType);
    if (summary) {
      ragText = `RESUMEN_IA\n${summary}\n\nCONTENIDO_ORIGINAL\n${rawText}`;
    }
  } catch {
    // Keep extracted text if summarization fails.
  }

  const { error } = await supabase.from("kb_documents").insert({
    agencia_id: agenciaId,
    empresa_id: null,
    empresa_file_id: null,
    scope: "org",
    doc_type: docType,
    title,
    raw_text: ragText,
  });

  if (error) {
    throw new Error(`No se pudo crear documento de agencia: ${error.message}`);
  }

  revalidatePath("/protected");
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

export async function deleteAgenciaDocument(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const documentId = String(formData.get("document_id") ?? "").trim();

  if (!documentId) {
    return;
  }

  const { error } = await supabase
    .from("kb_documents")
    .delete()
    .eq("id", documentId)
    .eq("agencia_id", agenciaId)
    .is("empresa_id", null);

  if (error) {
    throw new Error(`No se pudo eliminar documento de agencia: ${error.message}`);
  }

  revalidatePath("/protected");
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

export async function updateAgenciaDocument(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const documentId = String(formData.get("document_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const docType = String(formData.get("doc_type") ?? "").trim();
  const rawText = String(formData.get("raw_text") ?? "").trim();

  if (!documentId || !title || !docType || !rawText) {
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
    .eq("agencia_id", agenciaId)
    .is("empresa_id", null);

  if (error) {
    throw new Error(`No se pudo actualizar documento de agencia: ${error.message}`);
  }

  revalidatePath("/protected");
}

export async function upsertAgenciaPrompt(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const promptId = String(formData.get("prompt_id") ?? "").trim();
  const promptType = String(formData.get("prompt_type") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const promptText = String(formData.get("prompt_text") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();

  if (!promptType || !titulo || !promptText) {
    return;
  }

  if (!ALLOWED_PROMPT_TYPES.includes(promptType as (typeof ALLOWED_PROMPT_TYPES)[number])) {
    throw new Error(`Tipo de prompt no permitido: ${promptType}`);
  }

  if (promptId) {
    const { error } = await supabase
      .from("agencia_prompt")
      .update({
        prompt_type: promptType,
        titulo,
        prompt_text: promptText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", promptId)
      .eq("agencia_id", agenciaId);

    if (error) {
      throw new Error(`No se pudo actualizar prompt: ${error.message}`);
    }
  } else {
    const { error } = await supabase.from("agencia_prompt").insert({
      agencia_id: agenciaId,
      prompt_type: promptType,
      titulo,
      prompt_text: promptText,
      activo: true,
    });

    if (error) {
      throw new Error(`No se pudo crear prompt: ${error.message}`);
    }
  }

  if (empresaId) {
    revalidateEmpresaRoutes(empresaId);
  } else {
    revalidatePath("/protected/empresas");
  }
}

export async function deleteAgenciaPrompt(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const promptId = String(formData.get("prompt_id") ?? "").trim();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();

  if (!promptId) {
    return;
  }

  const { error } = await supabase
    .from("agencia_prompt")
    .delete()
    .eq("id", promptId)
    .eq("agencia_id", agenciaId);

  if (error) {
    throw new Error(`No se pudo eliminar prompt: ${error.message}`);
  }

  if (empresaId) {
    revalidateEmpresaRoutes(empresaId);
  } else {
    revalidatePath("/protected/empresas");
  }
}

export async function saveBec(formData: FormData) {
  const supabase = await requireUser();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const content = String(formData.get("contenido") ?? "").trim();

  if (!empresaId || !content) {
    return;
  }

  let contenidoJson: unknown = { texto: content };
  try {
    contenidoJson = JSON.parse(content);
  } catch {
    // Keep plain text payload.
  }

  const { data: current, error: currentError } = await supabase
    .from("bec")
    .select("id, version")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (currentError) {
    throw new Error(`No se pudo leer BEC actual: ${currentError.message}`);
  }

  if (current?.id) {
    const { error: updateError } = await supabase
      .from("bec")
      .update({
        contenido_json: contenidoJson,
        version: (current.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id);

    if (updateError) {
      throw new Error(`No se pudo actualizar BEC: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase.from("bec").insert({
      empresa_id: empresaId,
      contenido_json: contenidoJson,
    });

    if (insertError) {
      throw new Error(`No se pudo crear BEC: ${insertError.message}`);
    }
  }

  revalidateEmpresaRoutes(empresaId);
}

export async function createBrief(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const periodo = String(formData.get("periodo") ?? "").trim();
  const estado = String(formData.get("estado") ?? "draft").trim() || "draft";
  const contenido = String(formData.get("contenido") ?? "").trim();

  if (!empresaId || !periodo || !contenido) {
    return;
  }

  const periodDate = new Date(periodo);
  periodDate.setUTCDate(1);
  const normalizedPeriodo = periodDate.toISOString().slice(0, 10);

  let contenidoJson: unknown = { texto: contenido };
  try {
    contenidoJson = JSON.parse(contenido);
  } catch {
    // Keep plain text payload.
  }

  await upsertBrief(empresaId, normalizedPeriodo, estado, contenidoJson);

  revalidateEmpresaRoutes(empresaId);
}

async function getEmpresaContext(empresaId: string) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();

  const { data: empresa } = await supabase
    .from("empresa")
    .select("id, nombre, industria, pais, metadata_json")
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId)
    .single();

  const { data: docs } = await supabase
    .from("kb_documents")
    .select("id, title, raw_text, created_at")
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId)
    .order("created_at", { ascending: false })
    .limit(8);

  return {
    empresa,
    docs: docs ?? [],
  };
}

export async function generateBecDraft(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  if (!empresaId) {
    return;
  }

  const { empresa, docs } = await getEmpresaContext(empresaId);
  if (!empresa) {
    return;
  }

  const context = docs
    .map(
      (doc, index) =>
        `Documento ${index + 1}: ${doc.title}\n${doc.raw_text.slice(0, 1800)}`,
    )
    .join("\n\n");

  const draft = await ollamaChat({
    systemPrompt:
      "Eres estratega de marketing. Responde en JSON vÃ¡lido para un BEC comercial.",
    userPrompt: `Genera un BEC para esta empresa:\n${JSON.stringify(empresa, null, 2)}\n\nContexto documental:\n${context}\n\nDevuelve SOLO JSON con esta estructura:\n{"resumen_ejecutivo":"","propuesta_valor":"","audiencias":[],"mensajes_clave":[],"canales_recomendados":[],"riesgos":[],"proximos_pasos":[]}`,
    temperature: 0.2,
  });

  const supabase = await requireUser();
  const { data: current } = await supabase
    .from("bec")
    .select("id, version")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  let contenidoJson: unknown = { texto: draft };
  try {
    contenidoJson = JSON.parse(draft);
  } catch {
    // Keep raw draft if model did not return valid JSON.
  }

  if (current?.id) {
    await supabase
      .from("bec")
      .update({
        contenido_json: contenidoJson,
        version: (current.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id);
  } else {
    await supabase.from("bec").insert({
      empresa_id: empresaId,
      contenido_json: contenidoJson,
    });
  }

  revalidateEmpresaRoutes(empresaId);
}

export async function generateBriefDraft(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const periodo = String(formData.get("periodo") ?? "").trim();

  if (!empresaId || !periodo) {
    return;
  }

  const periodDate = new Date(periodo);
  periodDate.setUTCDate(1);
  const normalizedPeriodo = periodDate.toISOString().slice(0, 10);

  const { empresa, docs } = await getEmpresaContext(empresaId);
  if (!empresa) {
    return;
  }

  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const { data: becActual } = await supabase
    .from("bec")
    .select("version, contenido_json, updated_at")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const [{ data: agencyDocs }, { data: promptRows }] = await Promise.all([
    supabase
      .from("kb_documents")
      .select("id, title, raw_text, created_at")
      .eq("agencia_id", agenciaId)
      .is("empresa_id", null)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("agencia_prompt")
      .select("prompt_type, prompt_text, activo, updated_at")
      .eq("agencia_id", agenciaId)
      .eq("activo", true)
      .in("prompt_type", ["bec", "plan_trabajo"])
      .order("updated_at", { ascending: false }),
  ]);

  const context = docs
    .map(
      (doc, index) =>
        `Documento ${index + 1}: ${doc.title}\n${doc.raw_text.slice(0, 1800)}`,
    )
    .join("\n\n");

  const agencyContext = (agencyDocs ?? [])
    .map(
      (doc, index) =>
        `Documento agencia ${index + 1}: ${doc.title}\n${doc.raw_text.slice(0, 1400)}`,
    )
    .join("\n\n");

  const becContext = becActual?.contenido_json
    ? JSON.stringify(becActual.contenido_json, null, 2).slice(0, 14000)
    : "Sin BEC previo";

  const promptsContext = (promptRows ?? [])
    .map(
      (row, index) =>
        `Prompt ${index + 1} (${row.prompt_type}):\n${row.prompt_text.slice(0, 3500)}`,
    )
    .join("\n\n");

  const objectivesTemplate = BRIEF_OBJECTIVE_GROUPS.map((group) => ({
    [group.id]: Object.fromEntries(group.options.map((option) => [option, false])),
  })).reduce((acc, item) => ({ ...acc, ...item }), {});
  const fieldsTemplate = Object.fromEntries(
    BRIEF_TEXT_FIELDS.map((field) => [field, ""]),
  );

  const draft = await ollamaChat({
    systemPrompt:
      "Eres planner de marketing senior para agencias. Responde en JSON valido para un brief mensual.",
    userPrompt: `Genera el brief mensual (${normalizedPeriodo}) para esta empresa:\n${JSON.stringify(empresa, null, 2)}\n\nBEC actual (fuente estrategica):\n${becContext}\n\nConocimiento documental de agencia (lineamientos globales):\n${agencyContext || "Sin documentos globales de agencia"}\n\nConocimiento documental de empresa (realidad operativa y comercial):\n${context || "Sin documentos de empresa"}\n\nPrompts activos de agencia:\n${promptsContext || "Sin prompts activos"}\n\nInstrucciones clave:\n1) Usa el BEC como base, no lo ignores.\n2) Contrasta el BEC contra evidencia reciente de documentos de empresa y agencia.\n3) Explicita que se mantiene del BEC y que debe ajustarse para este mes.\n4) En cada ajuste, cita evidencia documental concreta.\n5) Completa el formulario exactamente con las claves indicadas.\n\nDevuelve SOLO JSON con esta estructura exacta:\n{"objectives":${JSON.stringify(objectivesTemplate)},"fields":${JSON.stringify(fieldsTemplate)},"strategicChanges":"si|no","cambios_sobre_bec":[{"tema":"","se_mantiene":"","se_ajusta":"","razon":"","evidencia":""}]}\n\nRegla de formato:\n- En objectives, marca true solo donde aplique.\n- En fields, completa texto accionable y especifico por campo.\n- strategicChanges debe ser "si" o "no".`,
    temperature: 0.3,
  });

  let contenidoJson: Record<string, unknown> = makeDefaultBriefForm() as Record<
    string,
    unknown
  >;
  try {
    const parsed = JSON.parse(draft) as Record<string, unknown>;
    const normalizedForm = loadBriefForm(parsed);
    const cambiosSobreBec = Array.isArray(parsed.cambios_sobre_bec)
      ? parsed.cambios_sobre_bec
      : [];
    const missingFields = BRIEF_TEXT_FIELDS.filter(
      (field) => !normalizedForm.fields[field]?.trim(),
    );

    if (missingFields.length > 0) {
      try {
        const completionDraft = await ollamaChat({
          systemPrompt:
            "Eres planner de marketing. Completa campos faltantes de brief con texto concreto y accionable en espanol.",
          userPrompt: `Completa SOLO los campos faltantes del brief mensual (${normalizedPeriodo}) para esta empresa:\n${JSON.stringify(empresa, null, 2)}\n\nBEC:\n${becContext}\n\nContexto agencia:\n${agencyContext || "Sin documentos globales de agencia"}\n\nContexto empresa:\n${context || "Sin documentos de empresa"}\n\nPrompts activos:\n${promptsContext || "Sin prompts activos"}\n\nCampos faltantes:\n${JSON.stringify(missingFields, null, 2)}\n\nDevuelve SOLO JSON:\n{"fields":{"<campo>":"<texto>"}}`,
          temperature: 0.2,
        });

        const completionParsed = JSON.parse(completionDraft) as {
          fields?: Record<string, string>;
        };
        const completionFields = completionParsed.fields ?? {};

        for (const field of missingFields) {
          const value = completionFields[field];
          if (typeof value === "string" && value.trim()) {
            normalizedForm.fields[field] = value.trim();
          }
        }
      } catch {
        // Keep normalized form if completion step fails.
      }
    }

    for (const field of BRIEF_TEXT_FIELDS) {
      if (!normalizedForm.fields[field]?.trim()) {
        normalizedForm.fields[field] =
          "Pendiente de validar con cliente segun contexto actual.";
      }
    }

    if (normalizedForm.strategicChanges !== "si" && normalizedForm.strategicChanges !== "no") {
      normalizedForm.strategicChanges = cambiosSobreBec.length > 0 ? "si" : "no";
    }

    contenidoJson = {
      ...normalizedForm,
      cambios_sobre_bec: cambiosSobreBec,
    };
  } catch {
    contenidoJson = {
      ...makeDefaultBriefForm(),
      fields: {
        ...makeDefaultBriefForm().fields,
        [BRIEF_TEXT_FIELDS[0]]: draft.slice(0, 2000),
      },
      strategicChanges: "si",
      cambios_sobre_bec: [],
    };
  }

  await upsertBrief(empresaId, normalizedPeriodo, "draft", contenidoJson);

  revalidateEmpresaRoutes(empresaId);
}

export async function generatePlanTrabajoDraft(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const briefId = String(formData.get("brief_id") ?? "").trim();

  if (!empresaId || !briefId) {
    return;
  }

  const { supabase, agenciaId } = await requireUserAgenciaContext();

  const [{ data: empresa }, { data: brief }, { data: becActual }, { data: docsEmpresa }, { data: docsAgencia }, { data: prompts }, { data: agencia }] =
    await Promise.all([
      supabase
        .from("empresa")
        .select("id, nombre, industria, pais, metadata_json")
        .eq("id", empresaId)
        .eq("agencia_id", agenciaId)
        .maybeSingle(),
      supabase
        .from("brief")
        .select("id, periodo, estado, version, contenido_json")
        .eq("id", briefId)
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase
        .from("bec")
        .select("version, contenido_json, updated_at")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase
        .from("kb_documents")
        .select("id, title, raw_text, created_at")
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("kb_documents")
        .select("id, title, raw_text, created_at")
        .eq("agencia_id", agenciaId)
        .is("empresa_id", null)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("agencia_prompt")
        .select("prompt_type, prompt_text, activo, updated_at")
        .eq("agencia_id", agenciaId)
        .eq("activo", true)
        .in("prompt_type", ["bec", "plan_trabajo"])
        .order("updated_at", { ascending: false }),
      supabase.from("agencia").select("id, nombre, slug").eq("id", agenciaId).maybeSingle(),
    ]);

  if (!empresa || !brief) {
    return;
  }

  const briefForm = loadBriefForm(brief.contenido_json);
  const becContext = becActual?.contenido_json
    ? JSON.stringify(becActual.contenido_json, null, 2).slice(0, 14000)
    : "Sin BEC previo";
  const briefContext = JSON.stringify(briefForm, null, 2).slice(0, 14000);
  const empresaDocsContext = (docsEmpresa ?? [])
    .map(
      (doc, index) =>
        `Documento empresa ${index + 1}: ${doc.title}\n${doc.raw_text.slice(0, 1600)}`,
    )
    .join("\n\n");
  const agenciaDocsContext = (docsAgencia ?? [])
    .map(
      (doc, index) =>
        `Documento agencia ${index + 1}: ${doc.title}\n${doc.raw_text.slice(0, 1400)}`,
    )
    .join("\n\n");
  const promptContext = (prompts ?? [])
    .map(
      (row, index) =>
        `Prompt ${index + 1} (${row.prompt_type}):\n${row.prompt_text.slice(0, 3500)}`,
    )
    .join("\n\n");

  const draft = await ollamaChat({
    systemPrompt:
      "Eres PM de marketing para agencias. Creas planes de trabajo mensuales accionables. Responde SOLO JSON valido.",
    userPrompt: `Construye un plan de trabajo mensual para ${brief.periodo}.\n\nAgencia:\n${JSON.stringify(agencia ?? {}, null, 2)}\n\nEmpresa:\n${JSON.stringify(empresa, null, 2)}\n\nBEC:\n${becContext}\n\nBrief seleccionado:\n${briefContext}\n\nConocimiento de empresa:\n${empresaDocsContext || "Sin documentos de empresa"}\n\nConocimiento de agencia:\n${agenciaDocsContext || "Sin documentos globales de agencia"}\n\nPrompts activos:\n${promptContext || "Sin prompts activos"}\n\nReglas:\n1) El plan debe venir en varios puntos concretos y ejecutables.\n2) Incluir minimo 3 workstreams.\n3) Cada workstream debe incluir minimo 4 tareas.\n4) Las tareas deben indicar semana, responsable, prioridad y KPI asociado.\n5) Basar decisiones en BEC + BRIEF + evidencia documental.\n\nDevuelve SOLO JSON con esta estructura:\n{"periodo":"${brief.periodo}","resumen_ejecutivo":"","objetivos_del_mes":[],"workstreams":[{"nombre":"","objetivo":"","entregables":[],"tareas":[{"tarea":"","responsable":"agencia|cliente","semana":"S1|S2|S3|S4","fecha_limite":"","dependencias":[],"kpi_asociado":"","prioridad":"alta|media|baja"}],"riesgos":[],"mitigaciones":[]}],"cadencia_de_seguimiento":{"ritual_semanal":"","responsables":[],"insumos":[]},"aprobaciones_cliente":[],"alertas":[],"supuestos":[],"cambios_sobre_bec":[]}`,
    temperature: 0.25,
  });

  let contentJson: Record<string, unknown> = {
    periodo: brief.periodo,
    resumen_ejecutivo: "",
    objetivos_del_mes: [],
    workstreams: [],
    cadencia_de_seguimiento: {
      ritual_semanal: "",
      responsables: [],
      insumos: [],
    },
    aprobaciones_cliente: [],
    alertas: [],
    supuestos: [],
    cambios_sobre_bec: [],
  };
  try {
    const parsed = JSON.parse(draft) as Record<string, unknown>;
    const rawWorkstreams = Array.isArray(parsed.workstreams)
      ? (parsed.workstreams as Record<string, unknown>[])
      : [];

    const normalizedWorkstreams = rawWorkstreams
      .map((ws, idx) => {
        const tasks = Array.isArray(ws.tareas)
          ? (ws.tareas as Record<string, unknown>[])
          : [];
        const normalizedTasks = tasks
          .map((task, tIdx) => ({
            tarea:
              typeof task.tarea === "string" && task.tarea.trim()
                ? task.tarea
                : `Tarea ${tIdx + 1} del workstream ${idx + 1}`,
            responsable:
              task.responsable === "cliente" ? "cliente" : "agencia",
            semana:
              task.semana === "S2" || task.semana === "S3" || task.semana === "S4"
                ? task.semana
                : "S1",
            fecha_limite:
              typeof task.fecha_limite === "string" ? task.fecha_limite : "",
            dependencias: Array.isArray(task.dependencias) ? task.dependencias : [],
            kpi_asociado:
              typeof task.kpi_asociado === "string" ? task.kpi_asociado : "",
            prioridad:
              task.prioridad === "baja" || task.prioridad === "media"
                ? task.prioridad
                : "alta",
          }))
          .filter((task) => task.tarea.trim().length > 0);

        return {
          nombre:
            typeof ws.nombre === "string" && ws.nombre.trim()
              ? ws.nombre
              : `Workstream ${idx + 1}`,
          objetivo:
            typeof ws.objetivo === "string" ? ws.objetivo : "",
          entregables: Array.isArray(ws.entregables) ? ws.entregables : [],
          tareas: normalizedTasks,
          riesgos: Array.isArray(ws.riesgos) ? ws.riesgos : [],
          mitigaciones: Array.isArray(ws.mitigaciones) ? ws.mitigaciones : [],
        };
      })
      .filter((ws) => ws.nombre.trim().length > 0);

    while (normalizedWorkstreams.length < 3) {
      const n = normalizedWorkstreams.length + 1;
      normalizedWorkstreams.push({
        nombre: `Workstream ${n}`,
        objetivo: "Pendiente de definir con base en el BRIEF",
        entregables: [`Entregable principal ${n}`],
        tareas: [
          {
            tarea: `Definir alcance del workstream ${n}`,
            responsable: "agencia",
            semana: "S1",
            fecha_limite: "",
            dependencias: [],
            kpi_asociado: "Avance semanal",
            prioridad: "alta",
          },
          {
            tarea: `Producir activos del workstream ${n}`,
            responsable: "agencia",
            semana: "S2",
            fecha_limite: "",
            dependencias: [],
            kpi_asociado: "Entregables producidos",
            prioridad: "alta",
          },
          {
            tarea: `Validar con cliente el workstream ${n}`,
            responsable: "cliente",
            semana: "S3",
            fecha_limite: "",
            dependencias: [],
            kpi_asociado: "Tiempo de aprobacion",
            prioridad: "media",
          },
          {
            tarea: `Medir resultados del workstream ${n}`,
            responsable: "agencia",
            semana: "S4",
            fecha_limite: "",
            dependencias: [],
            kpi_asociado: "KPI del stream",
            prioridad: "media",
          },
        ],
        riesgos: [],
        mitigaciones: [],
      });
    }

    const completedWorkstreams = normalizedWorkstreams.map((ws) => {
      const tareas = [...ws.tareas];
      while (tareas.length < 4) {
        const n = tareas.length + 1;
        tareas.push({
          tarea: `Tarea operativa ${n} - ${ws.nombre}`,
          responsable: n % 2 === 0 ? "cliente" : "agencia",
          semana: n === 1 ? "S1" : n === 2 ? "S2" : n === 3 ? "S3" : "S4",
          fecha_limite: "",
          dependencias: [],
          kpi_asociado: "Seguimiento mensual",
          prioridad: n <= 2 ? "alta" : "media",
        });
      }
      return { ...ws, tareas };
    });

    contentJson = {
      periodo:
        typeof parsed.periodo === "string" && parsed.periodo
          ? parsed.periodo
          : brief.periodo,
      resumen_ejecutivo:
        typeof parsed.resumen_ejecutivo === "string"
          ? parsed.resumen_ejecutivo
          : "",
      objetivos_del_mes: Array.isArray(parsed.objetivos_del_mes)
        ? parsed.objetivos_del_mes
        : [],
      workstreams: completedWorkstreams,
      cadencia_de_seguimiento:
        parsed.cadencia_de_seguimiento && typeof parsed.cadencia_de_seguimiento === "object"
          ? parsed.cadencia_de_seguimiento
          : {
              ritual_semanal: "Reunion semanal de seguimiento",
              responsables: ["agencia", "cliente"],
              insumos: ["KPI semanal", "estado de tareas", "bloqueos"],
            },
      aprobaciones_cliente: Array.isArray(parsed.aprobaciones_cliente)
        ? parsed.aprobaciones_cliente
        : [],
      alertas: Array.isArray(parsed.alertas) ? parsed.alertas : [],
      supuestos: Array.isArray(parsed.supuestos) ? parsed.supuestos : [],
      cambios_sobre_bec: Array.isArray(parsed.cambios_sobre_bec)
        ? parsed.cambios_sobre_bec
        : [],
    };
  } catch {
    // Keep raw output if model returns invalid json.
    contentJson = {
      ...contentJson,
      resumen_ejecutivo: draft.slice(0, 2400),
      workstreams: [
        {
          nombre: "Operacion comercial mensual",
          objetivo: "Ejecutar iniciativas definidas en BRIEF con disciplina semanal.",
          entregables: ["Plan operativo", "Reporte de avance", "Ajustes de campana"],
          tareas: [
            {
              tarea: "Alinear objetivos y prioridades con el cliente",
              responsable: "agencia",
              semana: "S1",
              fecha_limite: "",
              dependencias: [],
              kpi_asociado: "Acta aprobada",
              prioridad: "alta",
            },
            {
              tarea: "Ejecutar produccion y lanzamientos del mes",
              responsable: "agencia",
              semana: "S2",
              fecha_limite: "",
              dependencias: [],
              kpi_asociado: "Entregables publicados",
              prioridad: "alta",
            },
            {
              tarea: "Validar ajustes y aprobaciones pendientes",
              responsable: "cliente",
              semana: "S3",
              fecha_limite: "",
              dependencias: [],
              kpi_asociado: "SLA de aprobacion",
              prioridad: "media",
            },
            {
              tarea: "Analizar KPIs y definir optimizaciones",
              responsable: "agencia",
              semana: "S4",
              fecha_limite: "",
              dependencias: [],
              kpi_asociado: "Cumplimiento de KPIs",
              prioridad: "media",
            },
          ],
          riesgos: [],
          mitigaciones: [],
        },
      ],
    };
  }

  await upsertPlanTrabajoArtifact({
    empresaId,
    agenciaId,
    briefId: brief.id,
    periodo: brief.periodo,
    contenidoJson: contentJson,
  });

  revalidateEmpresaRoutes(empresaId);
  redirect(`/protected/empresas/${empresaId}/plan-trabajo`);
}

export async function generateCalendarioDraft(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const planArtifactId = String(formData.get("plan_artifact_id") ?? "").trim();

  if (!empresaId || !planArtifactId) {
    return;
  }

  const { supabase, agenciaId } = await requireUserAgenciaContext();

  const [{ data: empresa }, { data: plan }, { data: becActual }, { data: docsEmpresa }, { data: docsAgencia }, { data: prompts }, { data: agencia }] =
    await Promise.all([
      supabase
        .from("empresa")
        .select("id, nombre, industria, pais, metadata_json")
        .eq("id", empresaId)
        .eq("agencia_id", agenciaId)
        .maybeSingle(),
      supabase
        .from("rag_artifacts")
        .select("id, title, status, version, content_json, inputs_json")
        .eq("id", planArtifactId)
        .eq("artifact_type", "plan_trabajo")
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId)
        .maybeSingle(),
      supabase
        .from("bec")
        .select("version, contenido_json, updated_at")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase
        .from("kb_documents")
        .select("id, title, raw_text, created_at")
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("kb_documents")
        .select("id, title, raw_text, created_at")
        .eq("agencia_id", agenciaId)
        .is("empresa_id", null)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("agencia_prompt")
        .select("prompt_type, prompt_text, activo, updated_at")
        .eq("agencia_id", agenciaId)
        .eq("activo", true)
        .in("prompt_type", ["bec", "plan_trabajo", "calendario"])
        .order("updated_at", { ascending: false }),
      supabase.from("agencia").select("id, nombre, slug").eq("id", agenciaId).maybeSingle(),
    ]);

  if (!empresa || !plan) {
    return;
  }

  const planContent =
    plan.content_json && typeof plan.content_json === "object"
      ? (plan.content_json as Record<string, unknown>)
      : {};
  const inputs =
    plan.inputs_json && typeof plan.inputs_json === "object"
      ? (plan.inputs_json as Record<string, unknown>)
      : {};
  const periodo =
    typeof inputs.periodo === "string" && inputs.periodo
      ? inputs.periodo
      : new Date().toISOString().slice(0, 10);

  const becContext = becActual?.contenido_json
    ? JSON.stringify(becActual.contenido_json, null, 2).slice(0, 14000)
    : "Sin BEC previo";
  const planContext = JSON.stringify(planContent, null, 2).slice(0, 16000);
  const empresaDocsContext = (docsEmpresa ?? [])
    .map(
      (doc, index) =>
        `Documento empresa ${index + 1}: ${doc.title}\n${doc.raw_text.slice(0, 1600)}`,
    )
    .join("\n\n");
  const agenciaDocsContext = (docsAgencia ?? [])
    .map(
      (doc, index) =>
        `Documento agencia ${index + 1}: ${doc.title}\n${doc.raw_text.slice(0, 1400)}`,
    )
    .join("\n\n");
  const promptContext = (prompts ?? [])
    .map(
      (row, index) =>
        `Prompt ${index + 1} (${row.prompt_type}):\n${row.prompt_text.slice(0, 3500)}`,
    )
    .join("\n\n");

  const draft = await ollamaChat({
    systemPrompt:
      "Eres content planner senior para agencias. Generas calendario mensual accionable. Responde SOLO JSON valido.",
    userPrompt: `Construye un calendario mensual para ${periodo}.\n\nAgencia:\n${JSON.stringify(agencia ?? {}, null, 2)}\n\nEmpresa:\n${JSON.stringify(empresa, null, 2)}\n\nBEC:\n${becContext}\n\nPlan de trabajo base:\n${planContext}\n\nConocimiento de empresa:\n${empresaDocsContext || "Sin documentos de empresa"}\n\nConocimiento de agencia:\n${agenciaDocsContext || "Sin documentos globales de agencia"}\n\nPrompts activos:\n${promptContext || "Sin prompts activos"}\n\nReglas:\n1) Entregar calendario en varios puntos concretos por semana.\n2) Incluir S1, S2, S3 y S4.\n3) Minimo 3 piezas por semana.\n4) Cada pieza debe tener fecha, canal, formato, tema, objetivo y CTA.\n5) Mantener consistencia con BEC + plan de trabajo.\n\nDevuelve SOLO JSON con esta estructura:\n{"periodo":"${periodo}","resumen":"","canales_prioritarios":[],"semanas":[{"semana":"S1","objetivo":"","piezas":[{"fecha":"","canal":"","formato":"","tema":"","objetivo":"","cta":"","responsable":"agencia|cliente","estado":"planificado"}]}],"hitos":[],"riesgos":[],"supuestos":[]}`,
    temperature: 0.25,
  });

  let contentJson: Record<string, unknown> = {
    periodo,
    resumen: "",
    canales_prioritarios: [],
    semanas: [],
    hitos: [],
    riesgos: [],
    supuestos: [],
  };
  try {
    const parsed = JSON.parse(draft) as Record<string, unknown>;
    const rawWeeks = Array.isArray(parsed.semanas)
      ? (parsed.semanas as Record<string, unknown>[])
      : [];

    const normalizedWeeks = rawWeeks.map((week, wIdx) => {
      const piezas = Array.isArray(week.piezas)
        ? (week.piezas as Record<string, unknown>[])
        : [];
      const normalizedPiezas = piezas.map((piece, pIdx) => ({
        fecha: typeof piece.fecha === "string" ? piece.fecha : "",
        canal: typeof piece.canal === "string" ? piece.canal : "Instagram",
        formato: typeof piece.formato === "string" ? piece.formato : "Post",
        tema:
          typeof piece.tema === "string" && piece.tema.trim()
            ? piece.tema
            : `Pieza ${pIdx + 1} de semana ${wIdx + 1}`,
        objetivo: typeof piece.objetivo === "string" ? piece.objetivo : "",
        cta: typeof piece.cta === "string" ? piece.cta : "",
        responsable: piece.responsable === "cliente" ? "cliente" : "agencia",
        estado: typeof piece.estado === "string" ? piece.estado : "planificado",
      }));

      return {
        semana:
          week.semana === "S2" || week.semana === "S3" || week.semana === "S4"
            ? week.semana
            : "S1",
        objetivo: typeof week.objetivo === "string" ? week.objetivo : "",
        piezas: normalizedPiezas,
      };
    });

    const weekKeys = ["S1", "S2", "S3", "S4"] as const;
    for (const key of weekKeys) {
      if (!normalizedWeeks.some((w) => w.semana === key)) {
        normalizedWeeks.push({
          semana: key,
          objetivo: `Objetivo operativo ${key}`,
          piezas: [],
        });
      }
    }

    const completedWeeks = normalizedWeeks
      .map((week) => {
        const piezas = [...week.piezas];
        while (piezas.length < 3) {
          const n = piezas.length + 1;
          piezas.push({
            fecha: "",
            canal: "Instagram",
            formato: n % 2 === 0 ? "Reel" : "Carrusel",
            tema: `Contenido ${n} ${week.semana}`,
            objetivo: "Alcance y consideracion",
            cta: "Mas informacion",
            responsable: "agencia",
            estado: "planificado",
          });
        }
        return { ...week, piezas };
      })
      .sort((a, b) => a.semana.localeCompare(b.semana));

    contentJson = {
      periodo:
        typeof parsed.periodo === "string" && parsed.periodo ? parsed.periodo : periodo,
      resumen: typeof parsed.resumen === "string" ? parsed.resumen : "",
      canales_prioritarios: Array.isArray(parsed.canales_prioritarios)
        ? parsed.canales_prioritarios
        : [],
      semanas: completedWeeks,
      hitos: Array.isArray(parsed.hitos) ? parsed.hitos : [],
      riesgos: Array.isArray(parsed.riesgos) ? parsed.riesgos : [],
      supuestos: Array.isArray(parsed.supuestos) ? parsed.supuestos : [],
    };
  } catch {
    contentJson = {
      ...contentJson,
      resumen: draft.slice(0, 2000),
      semanas: [
        {
          semana: "S1",
          objetivo: "Activacion inicial del mes",
          piezas: [
            { fecha: "", canal: "Instagram", formato: "Carrusel", tema: "Insight de industria", objetivo: "Awareness", cta: "Descubrir", responsable: "agencia", estado: "planificado" },
            { fecha: "", canal: "LinkedIn", formato: "Post", tema: "Caso de uso", objetivo: "Consideracion", cta: "Leer mas", responsable: "agencia", estado: "planificado" },
            { fecha: "", canal: "Email", formato: "Newsletter", tema: "Novedades del mes", objetivo: "Retencion", cta: "Visitar sitio", responsable: "agencia", estado: "planificado" },
          ],
        },
        {
          semana: "S2",
          objetivo: "Profundizar interes",
          piezas: [
            { fecha: "", canal: "Instagram", formato: "Reel", tema: "Behind the scenes", objetivo: "Engagement", cta: "Comentar", responsable: "agencia", estado: "planificado" },
            { fecha: "", canal: "LinkedIn", formato: "Articulo", tema: "Tendencias", objetivo: "Autoridad", cta: "Leer articulo", responsable: "agencia", estado: "planificado" },
            { fecha: "", canal: "Blog", formato: "Post", tema: "Guia practica", objetivo: "SEO", cta: "Descargar", responsable: "agencia", estado: "planificado" },
          ],
        },
        {
          semana: "S3",
          objetivo: "Empujar conversion",
          piezas: [
            { fecha: "", canal: "Instagram", formato: "Story", tema: "Oferta puntual", objetivo: "Conversion", cta: "Escribir DM", responsable: "agencia", estado: "planificado" },
            { fecha: "", canal: "WhatsApp", formato: "Broadcast", tema: "Recordatorio", objetivo: "Lead", cta: "Responder", responsable: "cliente", estado: "planificado" },
            { fecha: "", canal: "LinkedIn", formato: "Post", tema: "Testimonio cliente", objetivo: "Confianza", cta: "Solicitar demo", responsable: "agencia", estado: "planificado" },
          ],
        },
        {
          semana: "S4",
          objetivo: "Cierre y aprendizaje",
          piezas: [
            { fecha: "", canal: "Instagram", formato: "Carrusel", tema: "Resumen del mes", objetivo: "Retencion", cta: "Guardar", responsable: "agencia", estado: "planificado" },
            { fecha: "", canal: "LinkedIn", formato: "Post", tema: "Resultados obtenidos", objetivo: "Autoridad", cta: "Contactar", responsable: "agencia", estado: "planificado" },
            { fecha: "", canal: "Email", formato: "Newsletter", tema: "Proximos pasos", objetivo: "Continuidad", cta: "Agendar reunion", responsable: "cliente", estado: "planificado" },
          ],
        },
      ],
    };
  }

  await upsertCalendarioArtifact({
    empresaId,
    agenciaId,
    planArtifactId: plan.id,
    periodo,
    contenidoJson: contentJson,
  });

  revalidateEmpresaRoutes(empresaId);
  redirect(`/protected/empresas/${empresaId}/calendario`);
}

