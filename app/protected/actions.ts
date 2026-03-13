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
import {
  makeDefaultPlanTrabajo,
  normalizePlanTrabajoContent,
} from "@/lib/plan-trabajo/schema";
import {
  makeDefaultCalendarioContent,
  normalizeCalendarioContent,
} from "@/lib/calendario/schema";
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

async function extractSupportedDocumentText(uploadedFile: File) {
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
      "Formato no soportado para lectura automatica. Usa txt, md, csv, json, html, xml, pdf, docx o xlsx.",
    );
  }

  const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
  let rawText = "";

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
    throw new Error("No se pudo extraer texto del archivo. Puedes probar con otro PDF o pegar el contenido como documento.");
  }

  return {
    fileName,
    extension,
    rawText,
  };
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
        status: "plan",
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
    status: "plan",
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
  alcanceCalendario?: Record<string, number>;
}) {
  const { empresaId, agenciaId, planArtifactId, periodo, contenidoJson, alcanceCalendario } =
    params;
  const supabase = await requireUser();
  const title = `Calendario ${periodo}`;
  const inputsPayload =
    alcanceCalendario && Object.keys(alcanceCalendario).length > 0
      ? { plan_artifact_id: planArtifactId, periodo, alcance_calendario: alcanceCalendario }
      : { plan_artifact_id: planArtifactId, periodo };

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
        status: "plan",
        version: (existing.version ?? 1) + 1,
        inputs_json: inputsPayload,
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
    status: "plan",
    inputs_json: inputsPayload,
    content_json: contenidoJson,
  });

  if (insertError) {
    throw new Error(`No se pudo crear calendario: ${insertError.message}`);
  }
}

function parseAlcanceCalendario(raw: string) {
  const map: Record<string, number> = {};
  if (!raw.trim()) return map;

  const chunks = raw.split(/\r?\n|[,;]+/).map((c) => c.trim()).filter(Boolean);
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

function applyAlcanceToWeeks(
  weeks: Array<{
    semana: string;
    objetivo: string;
    piezas: Array<{
      fecha: string;
      canal: string;
      formato: string;
      tema: string;
      objetivo: string;
      cta: string;
      responsable: string;
      estado: string;
    }>;
  }>,
  alcance: Record<string, number>,
) {
  const channels = Object.keys(alcance);
  if (!channels.length) return weeks;

  const normalized = weeks.map((w) => ({ ...w, piezas: [...w.piezas] }));
  const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const isEmailChannel = (channel: string) => /email|mail/i.test(channel);

  const sourceByChannel = Object.fromEntries(
    channels.map((channel) => [
      channel,
      normalized.flatMap((week) => week.piezas.filter((piece) => eq(piece.canal, channel))),
    ]),
  ) as Record<string, Array<{
    fecha: string;
    canal: string;
    formato: string;
    tema: string;
    objetivo: string;
    cta: string;
    responsable: string;
    estado: string;
  }>>;

  for (const week of normalized) {
    week.piezas = [];
  }

  channels.forEach((channel, channelIdx) => {
    const target = Math.min(10, Math.max(0, alcance[channel] ?? 0));
    if (target <= 0) return;

    for (let i = 0; i < target; i++) {
      const weekIdx = (i + channelIdx) % normalized.length;
      const source = sourceByChannel[channel]?.[i];
      normalized[weekIdx].piezas.push({
        fecha: source?.fecha ?? "",
        canal: channel,
        formato: source?.formato ?? (isEmailChannel(channel) ? "Newsletter" : "Post"),
        tema: source?.tema ?? `Contenido ${i + 1} ${channel}`,
        objetivo: source?.objetivo ?? "Alcance y consideracion",
        cta: source?.cta ?? "Mas informacion",
        responsable: source?.responsable === "cliente" ? "cliente" : "agencia",
        estado: source?.estado ?? "planificado",
      });
    }
  });

  return normalized;
}

function buildCalendarWeeksFromPlanContent(
  planContent: Record<string, unknown>,
) {
  const rawSemanas = Array.isArray(planContent.semanas)
    ? (planContent.semanas as Record<string, unknown>[])
    : [];

  return rawSemanas
    .map((rawSemana, weekIdx) => {
      const semanaRaw = rawSemana.semana;
      const semana =
        semanaRaw === "S2" || semanaRaw === "S3" || semanaRaw === "S4"
          ? semanaRaw
          : "S1";
      const objetivo =
        typeof rawSemana.objetivo === "string" ? rawSemana.objetivo : "";
      const posts = Array.isArray(rawSemana.posts)
        ? rawSemana.posts
        : [];
      const piezas = posts
        .filter((post): post is string => typeof post === "string")
        .map((post, postIdx) => {
          const parts = post
            .split(" - ")
            .map((part) => part.trim())
            .filter(Boolean);
          const canal = parts[0] ?? "Instagram";
          const isEmailChannel = /email|mail/i.test(canal);
          const formato =
            parts[1] ?? (isEmailChannel ? "Newsletter" : "Post");
          const tema =
            parts.slice(2).join(" - ") ||
            `Pieza ${postIdx + 1} de semana ${weekIdx + 1}`;

          return {
            fecha: "",
            canal,
            formato,
            tema,
            objetivo: objetivo || "Alcance y consideracion",
            cta: "Mas informacion",
            responsable: "agencia",
            estado: "planificado",
          };
        });

      return { semana, objetivo, piezas };
    })
    .filter((week) => week.semana);
}

function assignCalendarDatesByMonth(
  weeks: Array<{
    semana: string;
    objetivo: string;
    piezas: Array<{
      fecha: string;
      canal: string;
      formato: string;
      tema: string;
      objetivo: string;
      cta: string;
      responsable: string;
      estado: string;
    }>;
  }>,
  periodo: string,
) {
  const match = periodo.match(/^(\d{4})-(\d{2})/);
  if (!match) return weeks;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return weeks;
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const ranges: Record<string, [number, number]> = {
    S1: [1, Math.min(7, lastDay)],
    S2: [8, Math.min(14, lastDay)],
    S3: [15, Math.min(21, lastDay)],
    S4: [22, lastDay],
  };

  const ym = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  return weeks.map((week) => {
    const [startDay, endDay] = ranges[week.semana] ?? [1, lastDay];
    const span = Math.max(1, endDay - startDay + 1);
    const total = Math.max(1, week.piezas.length);
    const piezas = week.piezas.map((piece, idx) => {
      const day = Math.min(
        endDay,
        startDay + Math.floor((idx * span) / total),
      );
      const fecha = `${ym}-${String(day).padStart(2, "0")}`;
      return { ...piece, fecha };
    });
    return { ...week, piezas };
  });
}

const CALENDAR_CHANNELS = [
  "Blog",
  "TikTok",
  "YouTube",
  "Facebook",
  "LinkedIn",
  "WhatsApp",
  "Instagram",
  "Marketing Email",
] as const;

type CalendarChannel = (typeof CALENDAR_CHANNELS)[number];

function toCalendarChannel(value: string): CalendarChannel | null {
  const found = CALENDAR_CHANNELS.find((channel) => channel === value);
  return found ?? null;
}

function distributeByPilar(
  pilares: Array<{ pilar: string; porcentaje: number; objetivo: string; formatos: string[] }>,
  totalPieces: number,
) {
  if (!pilares.length || totalPieces <= 0) return [] as Array<{
    pilar: string;
    porcentaje: number;
    objetivo: string;
    formatos: string[];
    cantidad: number;
  }>;

  const base = pilares.map((p) => {
    const exact = (p.porcentaje / 100) * totalPieces;
    return {
      ...p,
      exacto: exact,
      cantidad: Math.floor(exact),
    };
  });

  const assigned = base.reduce((acc, p) => acc + p.cantidad, 0);
  let remaining = totalPieces - assigned;

  const remainderOrder = [...base].sort(
    (a, b) => b.exacto - b.cantidad - (a.exacto - a.cantidad),
  );
  let idx = 0;
  while (remaining > 0 && remainderOrder.length > 0) {
    const target = remainderOrder[idx % remainderOrder.length];
    const original = base.find((item) => item.pilar === target.pilar);
    if (original) original.cantidad += 1;
    remaining -= 1;
    idx += 1;
  }

  return base.map((item) => ({
    pilar: item.pilar,
    porcentaje: item.porcentaje,
    objetivo: item.objetivo,
    formatos: item.formatos,
    cantidad: item.cantidad,
  }));
}

function expandPilarPool(
  pilares: Array<{ pilar: string; porcentaje: number; objetivo: string; formatos: string[]; cantidad: number }>,
) {
  const pool: Array<{ pilar: string; porcentaje: number; objetivo: string; formatos: string[] }> =
    [];
  for (const p of pilares) {
    for (let i = 0; i < p.cantidad; i += 1) {
      pool.push({
        pilar: p.pilar,
        porcentaje: p.porcentaje,
        objetivo: p.objetivo,
        formatos: p.formatos,
      });
    }
  }
  return pool;
}

function weekFromChannelIndex(indexInsideChannel: number, totalChannel: number) {
  if (totalChannel <= 1) return 1;
  const ratio = indexInsideChannel / totalChannel;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

function pickFormatForChannel(
  channel: CalendarChannel,
  pilarFormats: string[],
  index: number,
) {
  const defaults: Record<CalendarChannel, string[]> = {
    Blog: ["Articulo SEO"],
    TikTok: ["Video corto", "UGC-style", "Tip rapido"],
    YouTube: ["Video educativo", "Demo", "Caso de estudio"],
    Facebook: ["Post estatico", "Carrusel", "Video corto"],
    LinkedIn: ["Post experto", "Carrusel", "Documento", "Video"],
    WhatsApp: ["Mensaje directo", "Seguimiento", "Invitacion"],
    Instagram: ["Carrusel", "Reel", "Historia"],
    "Marketing Email": ["Newsletter", "Nurture", "Invitacion", "Caso de exito"],
  };

  const available = pilarFormats.length ? pilarFormats : defaults[channel];
  return available[index % available.length];
}

function buildBaseTitle(params: {
  channel: CalendarChannel;
  tema: string;
  subtema: string;
  pilar: string;
  mainMessage: string;
}) {
  const { channel, tema, subtema, pilar, mainMessage } = params;
  if (channel === "Blog") return `Guia sobre ${subtema} en ${tema}`;
  if (channel === "LinkedIn")
    return `${subtema}: enfoque practico para empresas en Peru`;
  if (channel === "Marketing Email") return `${mainMessage} | ${subtema}`;
  if (channel === "WhatsApp") return `Seguimiento: ${subtema}`;
  if (pilar.toLowerCase().includes("producto")) return `Como resolver ${subtema} con Laus`;
  return `${subtema} aplicado a ${tema}`;
}

function buildChannelItemId(channel: CalendarChannel, correlativo: number) {
  const prefixMap: Record<CalendarChannel, string> = {
    Blog: "BLOG",
    TikTok: "TT",
    YouTube: "YT",
    Facebook: "FB",
    LinkedIn: "LI",
    WhatsApp: "WA",
    Instagram: "IG",
    "Marketing Email": "EM",
  };
  return `${prefixMap[channel]}-${String(correlativo).padStart(2, "0")}`;
}

function buildCalendarFromPlanTrabajo(params: {
  planTrabajo: Record<string, unknown>;
  fallbackAlcance: Record<string, number>;
}) {
  const { planTrabajo, fallbackAlcance } = params;
  const productos = Array.isArray(planTrabajo.productos_servicios_destacar)
    ? (planTrabajo.productos_servicios_destacar as string[]).filter((item) => typeof item === "string")
    : [];
  const mensajes = Array.isArray(planTrabajo.mensajes_destacados)
    ? (planTrabajo.mensajes_destacados as string[]).filter((item) => typeof item === "string")
    : [];
  const contenidoSugerido = Array.isArray(planTrabajo.contenido_sugerido)
    ? (planTrabajo.contenido_sugerido as Record<string, unknown>[])
    : [];
  const lineas = contenidoSugerido
    .map((row) => {
      const tema = typeof row.canal === "string" && row.canal.trim() ? row.canal.trim() : "";
      const subtemas = Array.isArray(row.ideas)
        ? (row.ideas as string[]).filter((item) => typeof item === "string" && item.trim())
        : [];
      return { tema, subtemas };
    })
    .filter((row) => row.tema || row.subtemas.length > 0);
  const ctas = mensajes.length > 0 ? mensajes : ["Solicita una cita"];
  const hashtagsPermitidos: string[] = [];
  const frasesProhibidas: string[] = [];
  const disclaimers: string[] = [];
  const pilaresRaw = Array.isArray(planTrabajo.pilares_comunicacion)
    ? (planTrabajo.pilares_comunicacion as Record<string, unknown>[])
    : [];

  const pilares = pilaresRaw
    .map((row) => {
      const pilar = typeof row.pilar === "string" ? row.pilar : "";
      const porcentajeNum =
        typeof row.porcentaje === "number"
          ? row.porcentaje
          : Number.parseFloat(String(row.porcentaje ?? "0"));
      const objetivo = typeof row.objetivo === "string" ? row.objetivo : "";
      const formatos = Array.isArray(row.formatos)
        ? (row.formatos as string[]).filter((f) => typeof f === "string")
        : [];
      return {
        pilar,
        porcentaje: Number.isFinite(porcentajeNum) ? porcentajeNum : 0,
        objetivo: objetivo || `Impulsar ${pilar || "contenido estrategico"}`,
        formatos,
      };
    })
    .filter((p) => p.pilar);

  const alcanceObj = normalizeAlcanceMap(
    (planTrabajo as Record<string, unknown>).alcance_calendario,
  );
  const alcanceNormalized =
    Object.keys(alcanceObj).length > 0 ? alcanceObj : fallbackAlcance;
  const channels = Object.keys(alcanceNormalized)
    .map((value) => toCalendarChannel(value))
    .filter((value): value is CalendarChannel => Boolean(value));

  const totalPieces = channels.reduce(
    (acc, channel) => acc + (alcanceNormalized[channel] ?? 0),
    0,
  );
  const distributedPilares = distributeByPilar(pilares, totalPieces);
  const pilarPool = expandPilarPool(distributedPilares);

  const items: Array<Record<string, unknown>> = [];
  const countersByChannel: Record<string, number> = {};
  const weekCounters: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let globalIndex = 0;

  for (const channel of channels) {
    const amount = alcanceNormalized[channel] ?? 0;
    countersByChannel[channel] = 0;

    for (let i = 0; i < amount; i += 1) {
      const fallbackPilar = {
        pilar: "Captura de Leads",
        porcentaje: 100,
        objetivo: "Generar leads calificados",
        formatos: [] as string[],
      };
      const pilar =
        pilarPool[globalIndex % Math.max(pilarPool.length, 1)] ?? fallbackPilar;
      const fallbackLinea = {
        tema: productos[0] || "Contenido comercial",
        subtemas:
          productos.length > 0
            ? productos
            : mensajes.length > 0
              ? mensajes
              : ["Propuesta de valor"],
      };
      const linea =
        lineas[globalIndex % Math.max(lineas.length, 1)] ?? fallbackLinea;
      const tema = typeof linea.tema === "string" ? linea.tema : "Contenido comercial";
      const subtemas = Array.isArray(linea.subtemas)
        ? (linea.subtemas as string[])
        : [];
      const subtema =
        subtemas[globalIndex % Math.max(subtemas.length, 1)] || tema;
      const buyer = productos[globalIndex % Math.max(productos.length, 1)] || "Audiencia prioritaria";
      const cta = ctas[globalIndex % Math.max(ctas.length, 1)] || "Solicita informacion";
      const week = weekFromChannelIndex(i, amount);

      weekCounters[week] = (weekCounters[week] ?? 0) + 1;
      countersByChannel[channel] += 1;

      const format = pickFormatForChannel(channel, pilar.formatos, i);
      const baseTitle = buildBaseTitle({
        channel,
        tema,
        subtema,
        pilar: pilar.pilar,
        mainMessage: mensajes[0] || productos[0] || "",
      });

      items.push({
        id: buildChannelItemId(channel, countersByChannel[channel]),
        canal: channel,
        semana: week,
        orden_semana: weekCounters[week],
        pilar: pilar.pilar,
        tema,
        subtema,
        buyer_persona: buyer,
        objetivo_contenido: pilar.objetivo,
        formato: format,
        titulo_base: baseTitle,
        CTA: cta,
        mensaje_clave: mensajes[0] || cta,
        hashtags: hashtagsPermitidos,
        restricciones_aplicadas: {
          frases_prohibidas: frasesProhibidas,
          disclaimers,
        },
        estado: "planificado",
      });
      globalIndex += 1;
    }
  }

  const summaryByChannel = Object.fromEntries(
    channels.map((channel) => [channel, alcanceNormalized[channel] ?? 0]),
  ) as Record<CalendarChannel, number>;

  return {
    calendario: {
      cliente: typeof planTrabajo.cliente === "string" ? planTrabajo.cliente : "",
      marca: typeof planTrabajo.marca === "string" ? planTrabajo.marca : "",
      pais: typeof planTrabajo.pais === "string" ? planTrabajo.pais : "",
      version: typeof planTrabajo.version === "string" ? planTrabajo.version : "",
      generado_desde: "plan_trabajo",
      resumen_por_canal: summaryByChannel,
      items,
    },
  };
}

function calendarItemsToWeeks(
  items: Array<Record<string, unknown>>,
  periodo: string,
) {
  const weekMap = new Map<string, Array<Record<string, unknown>>>();
  for (const item of items) {
    const weekNumRaw = item.semana;
    const weekNum =
      typeof weekNumRaw === "number"
        ? weekNumRaw
        : Number.parseInt(String(weekNumRaw ?? ""), 10);
    const weekKey =
      weekNum === 2 ? "S2" : weekNum === 3 ? "S3" : weekNum === 4 ? "S4" : "S1";
    const list = weekMap.get(weekKey) ?? [];
    list.push(item);
    weekMap.set(weekKey, list);
  }

  const weeks = (["S1", "S2", "S3", "S4"] as const).map((weekKey) => {
    const weekItems = weekMap.get(weekKey) ?? [];
    const pieces = weekItems.map((item) => ({
      fecha: "",
      canal: typeof item.canal === "string" ? item.canal : "",
      formato: typeof item.formato === "string" ? item.formato : "Post",
      tema:
        (typeof item.titulo_base === "string" && item.titulo_base) ||
        (typeof item.tema === "string" ? item.tema : ""),
      objetivo:
        typeof item.objetivo_contenido === "string" ? item.objetivo_contenido : "",
      cta: typeof item.CTA === "string" ? item.CTA : "",
      responsable: "agencia",
      estado: typeof item.estado === "string" ? item.estado : "planificado",
    }));
    return {
      semana: weekKey,
      objetivo: `Objetivo operativo ${weekKey}`,
      piezas: pieces,
    };
  });

  return assignCalendarDatesByMonth(weeks, periodo);
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
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const content = String(formData.get("contenido") ?? "").trim();
  const marca = String(formData.get("marca") ?? "").trim();
  const industria = String(formData.get("industria") ?? "").trim();
  const pais = String(formData.get("pais") ?? "").trim();
  const objetivo = String(formData.get("objetivo") ?? "").trim();
  const problema = String(formData.get("problema") ?? "").trim();

  if (!empresaId || !content) {
    return;
  }

  let contenidoJson: unknown = { texto: content };
  try {
    contenidoJson = JSON.parse(content);
  } catch {
    // Keep plain text payload.
  }

  const { data: empresaCurrent, error: empresaError } = await supabase
    .from("empresa")
    .select("metadata_json")
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  if (empresaError) {
    throw new Error(`No se pudo leer empresa actual: ${empresaError.message}`);
  }

  const metadataJson =
    empresaCurrent?.metadata_json && typeof empresaCurrent.metadata_json === "object"
      ? ({ ...empresaCurrent.metadata_json } as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  metadataJson.marca = marca;
  metadataJson.objetivo = objetivo;
  metadataJson.problema = problema;

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

  const { error: empresaUpdateError } = await supabase
    .from("empresa")
    .update({
      industria: industria || null,
      pais: pais || null,
      metadata_json: metadataJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId);

  if (empresaUpdateError) {
    throw new Error(`No se pudo actualizar contexto de empresa: ${empresaUpdateError.message}`);
  }

  revalidateEmpresaRoutes(empresaId);
}

export async function createBrief(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const periodo = String(formData.get("periodo") ?? "").trim();
  const estado = String(formData.get("estado") ?? "plan").trim() || "plan";
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

export async function updatePlanTrabajoArtifact(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const planId = String(formData.get("plan_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "plan").trim() || "plan";
  const content = String(formData.get("content") ?? "").trim();

  if (!empresaId || !planId || !title || !content) {
    return;
  }

  let contentJson: Record<string, unknown> = {
    plan_trabajo: makeDefaultPlanTrabajo(),
  };
  try {
    const parsed = JSON.parse(content) as unknown;
    contentJson = normalizePlanTrabajoContent(parsed);
  } catch {
    throw new Error("El contenido del plan debe ser JSON valido.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("rag_artifacts")
    .select("id, version")
    .eq("id", planId)
    .eq("artifact_type", "plan_trabajo")
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`No se pudo consultar plan de trabajo: ${existingError.message}`);
  }

  if (!existing?.id) {
    throw new Error("Plan de trabajo no encontrado o sin acceso.");
  }

  const { error: updateError } = await supabase
    .from("rag_artifacts")
    .update({
      title,
      status,
      content_json: contentJson,
      version: (existing.version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (updateError) {
    throw new Error(`No se pudo actualizar plan de trabajo: ${updateError.message}`);
  }

  revalidateEmpresaRoutes(empresaId);
}

export async function updateCalendarioArtifact(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const calendarioId = String(formData.get("calendario_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "plan").trim() || "plan";
  const content = String(formData.get("content") ?? "").trim();

  if (!empresaId || !calendarioId || !title || !content) {
    return;
  }

  let contentJson: Record<string, unknown> = makeDefaultCalendarioContent();
  try {
    const parsed = JSON.parse(content) as unknown;
    contentJson = normalizeCalendarioContent(parsed);
  } catch {
    throw new Error("El contenido del calendario debe ser JSON valido.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("rag_artifacts")
    .select("id, version")
    .eq("id", calendarioId)
    .eq("artifact_type", "calendario")
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`No se pudo consultar calendario: ${existingError.message}`);
  }

  if (!existing?.id) {
    throw new Error("Calendario no encontrado o sin acceso.");
  }

  const { error: updateError } = await supabase
    .from("rag_artifacts")
    .update({
      title,
      status,
      content_json: contentJson,
      version: (existing.version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (updateError) {
    throw new Error(`No se pudo actualizar calendario: ${updateError.message}`);
  }

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

  const generatedBec = await ollamaChat({
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

  let contenidoJson: unknown = { texto: generatedBec };
  try {
    contenidoJson = JSON.parse(generatedBec);
  } catch {
    // Keep raw output if model did not return valid JSON.
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

  const generatedBrief = await ollamaChat({
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
    const parsed = JSON.parse(generatedBrief) as Record<string, unknown>;
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
        [BRIEF_TEXT_FIELDS[0]]: generatedBrief.slice(0, 2000),
      },
      strategicChanges: "si",
      cambios_sobre_bec: [],
    };
  }

  await upsertBrief(empresaId, normalizedPeriodo, "plan", contenidoJson);

  revalidateEmpresaRoutes(empresaId);
}

export async function generatePlanTrabajoDraft(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") ?? "").trim();
  const briefId = String(formData.get("brief_id") ?? "").trim();
  const supportFile = formData.get("support_file");

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
  let supportDocContext = "";
  if (supportFile instanceof File && supportFile.size > 0) {
    const extracted = await extractSupportedDocumentText(supportFile);
    const translated = await maybeTranslateWithOllama(extracted.rawText);
    let condensed = translated;

    try {
      const summary = await summarizeForRagWithOllama(
        translated,
        extracted.fileName,
        extracted.extension || "adjunto_plan",
      );
      if (summary) {
        condensed = `RESUMEN\n${summary}\n\nEXTRACTO\n${translated.slice(0, 12000)}`;
      }
    } catch {
      condensed = translated.slice(0, 14000);
    }

    supportDocContext = `Documento adjunto para este plan: ${extracted.fileName}\n${condensed.slice(0, 16000)}`;
  }
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
  const empresaMetadata =
    empresa.metadata_json && typeof empresa.metadata_json === "object"
      ? (empresa.metadata_json as Record<string, unknown>)
      : {};
  const alcanceCalendario = normalizeAlcanceMap(empresaMetadata.alcance_calendario);
  const defaultPlanTrabajo = makeDefaultPlanTrabajo({
    cliente: empresa.nombre,
    marca: empresa.nombre,
    pais: empresa.pais ?? "Peru",
    version: String(brief.periodo).slice(0, 7),
    periodo: {
      inicio: String(brief.periodo),
      fin: String(brief.periodo),
    },
    alcance_calendario: alcanceCalendario,
  });

  const generatedPlan = await ollamaChat({
    systemPrompt:
      "Eres PM y estratega senior de marketing para agencias. Respondes SOLO JSON valido y sin texto adicional.",
    userPrompt: `Construye un plan de trabajo mensual para ${brief.periodo} con la logica de una plantilla ejecutiva tipo cuadro, similar a esta estructura de secciones: comunidad, resumen de actualizaciones, cantidad de contenidos a desarrollar, pilares de comunicacion, contenido sugerido, productos/servicios a destacar, mensajes destacados, fechas importantes, promociones, plan de medios, eventos, notas adicionales y pendientes del cliente.\n\nAgencia:\n${JSON.stringify(agencia ?? {}, null, 2)}\n\nEmpresa:\n${JSON.stringify(empresa, null, 2)}\n\nBEC:\n${becContext}\n\nBrief seleccionado:\n${briefContext}\n\nDocumento adjunto para esta generacion:\n${supportDocContext || "Sin documento adjunto"}\n\nConocimiento de empresa:\n${empresaDocsContext || "Sin documentos de empresa"}\n\nConocimiento de agencia:\n${agenciaDocsContext || "Sin documentos globales de agencia"}\n\nPrompts activos:\n${promptContext || "Sin prompts activos"}\n\nReglas clave:\n1) Ajusta el contenido al contexto de Peru.\n2) Mantén coherencia total con BEC + BRIEF + evidencia documental.\n3) Si existe documento adjunto, usalo como insumo prioritario para completar y afinar el plan.\n4) Respeta restricciones legales/normativas y tono de voz.\n5) Incluye alcance_calendario exactamente como pauta operativa.\n6) En comunidad, usa metricas resumidas por red con campos red, mes_anterior y meta.\n7) En resumen_actualizaciones, redacta una sintesis ejecutiva y observaciones puntuales.\n8) En cantidad_contenidos, usa red, cantidad y formatos esperados.\n9) En cada item de cantidad_contenidos, sugiere SIEMPRE formatos concretos por red si la cantidad es mayor a 0. Ejemplos validos: reels, carruseles, post estaticos, historias, mails, blogs, banners, videos cortos, anuncios, piezas JPG o MP4. No dejes formatos vacio salvo que la cantidad sea 0.\n10) En pilares_comunicacion, reparte porcentajes y enfocalos en estrategia, no en copies.\n11) En contenido_sugerido genera una verdadera lluvia de ideas por canal. Para cada canal con cantidad > 0, entrega varias ideas generales, no una sola si el canal admite mas volumen. Como referencia, genera entre 3 y 8 ideas por canal segun el peso del canal, sin repetir enfoques. NO des contenidos concretos. SOLO devuelve ideas generales o lineas tematicas por canal. No escribas captions, guiones, copies, textos finales, hashtags, enlaces ni piezas ya redactadas. Cada idea debe ser breve, abstracta y util para que luego el equipo creativo la desarrolle.\n12) En fechas_importantes incluye fechas del mes realmente utiles para planificacion: feriados de Peru, efemerides comerciales, festividades, campañas estacionales y fechas relacionadas con la industria o negocio del cliente cuando apliquen. Si no hay una fecha exacta, puedes incluir hitos comerciales del mes claramente descritos.\n13) En promociones, si no aplica, usa exactamente \"NO APLICA\".\n14) En plan_medios_link, deja URL o texto corto si no existe link final.\n\nDevuelve SOLO JSON con esta estructura exacta de raiz:\n${JSON.stringify({ plan_trabajo: defaultPlanTrabajo })}`,
    temperature: 0.25,
  });

  let contentJson: Record<string, unknown> = { plan_trabajo: defaultPlanTrabajo };
  try {
    const parsed = JSON.parse(generatedPlan) as Record<string, unknown>;
    contentJson = normalizePlanTrabajoContent(parsed, defaultPlanTrabajo);
  } catch {
    contentJson = normalizePlanTrabajoContent(
      {
        plan_trabajo: {
          ...defaultPlanTrabajo,
          notas_adicionales: generatedPlan.slice(0, 2400),
        },
      },
      defaultPlanTrabajo,
    );
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
  const alcanceCalendarioRaw = String(formData.get("alcance_calendario") ?? "").trim();
  const alcanceFromForm = parseAlcanceCalendario(alcanceCalendarioRaw);

  if (!empresaId || !planArtifactId) {
    return;
  }

  const { supabase, agenciaId } = await requireUserAgenciaContext();

  const [{ data: empresa }, { data: plan }] =
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
    ]);

  if (!empresa || !plan) {
    return;
  }

  const empresaMetadata =
    empresa.metadata_json && typeof empresa.metadata_json === "object"
      ? (empresa.metadata_json as Record<string, unknown>)
      : {};
  const alcanceFromEmpresa = normalizeAlcanceMap(empresaMetadata.alcance_calendario);
  const alcanceCalendario =
    Object.keys(alcanceFromForm).length > 0 ? alcanceFromForm : alcanceFromEmpresa;

  const planContent =
    plan.content_json && typeof plan.content_json === "object"
      ? (plan.content_json as Record<string, unknown>)
      : {};
  const planSeedWeeks = buildCalendarWeeksFromPlanContent(planContent);
  const inputs =
    plan.inputs_json && typeof plan.inputs_json === "object"
      ? (plan.inputs_json as Record<string, unknown>)
      : {};
  const periodo =
    typeof inputs.periodo === "string" && inputs.periodo
      ? inputs.periodo
      : new Date().toISOString().slice(0, 10);
  const planRoot =
    planContent.plan_trabajo && typeof planContent.plan_trabajo === "object"
      ? (planContent.plan_trabajo as Record<string, unknown>)
      : ({
          cliente: empresa.nombre,
          marca: empresa.nombre,
          pais: empresa.pais ?? "Peru",
          version: String(periodo).slice(0, 7),
          productos_servicios_destacar: [],
          mensajes_destacados: [],
          pilares_comunicacion: [],
          contenido_sugerido: [],
          alcance_calendario: alcanceCalendario,
        } as Record<string, unknown>);

  const calendarPayload = buildCalendarFromPlanTrabajo({
    planTrabajo: planRoot,
    fallbackAlcance: alcanceCalendario,
  });
  const seedItems = Array.isArray(calendarPayload.calendario.items)
    ? (calendarPayload.calendario.items as Record<string, unknown>[])
    : [];
  const seedWeeks =
    planSeedWeeks.length > 0
      ? assignCalendarDatesByMonth(
          applyAlcanceToWeeks(planSeedWeeks, alcanceCalendario),
          periodo,
        )
      : calendarItemsToWeeks(seedItems, periodo);

  const defaultCalendario = makeDefaultCalendarioContent({
    periodo,
    resumen: `Calendario generado desde plan_trabajo (${String(periodo).slice(0, 7)}).`,
    canales_prioritarios: Object.keys(alcanceCalendario),
    semanas: seedWeeks,
    hitos: [],
    riesgos: [],
    supuestos: [],
    alcance_calendario: alcanceCalendario,
    calendario: {
      cliente: empresa.nombre,
      marca: empresa.nombre,
      pais: empresa.pais ?? "Peru",
      version: String(periodo).slice(0, 7),
      generado_desde: "plan_trabajo",
      resumen_por_canal:
        calendarPayload.calendario && typeof calendarPayload.calendario === "object"
          ? (calendarPayload.calendario.resumen_por_canal as Record<string, number>) ?? {}
          : {},
      items: seedItems as never[],
    },
  });

  const generatedCalendario = await ollamaChat({
    systemPrompt:
      "Eres content planner senior. Respondes SOLO JSON valido sin markdown ni texto adicional.",
    userPrompt: [
      `Genera un calendario editorial mensual para el periodo ${periodo}.`,
      "",
      "Contexto empresa:",
      JSON.stringify(empresa, null, 2),
      "",
      "Plan de trabajo base:",
      JSON.stringify(planRoot, null, 2),
      "",
      `Alcance operativo por canal: ${JSON.stringify(alcanceCalendario)}`,
      "",
      "Reglas estrictas:",
      "1) Devuelve SOLO JSON con la estructura exacta indicada.",
      "2) Usa fechas reales YYYY-MM-DD dentro del mes del periodo.",
      "3) Mantén coherencia con plan_trabajo, especialmente pilares, ideas sugeridas, mensajes destacados y productos/servicios.",
      "4) calendario.items debe contener todos los eventos editables.",
      "5) No agregues claves fuera de la estructura.",
      "",
      "Estructura exacta requerida:",
      JSON.stringify(defaultCalendario),
    ].join("\n"),
    temperature: 0.2,
  });

  let contentJson: Record<string, unknown> = defaultCalendario as unknown as Record<string, unknown>;
  try {
    const parsed = JSON.parse(generatedCalendario) as unknown;
    contentJson = normalizeCalendarioContent(parsed, defaultCalendario);
  } catch {
    contentJson = normalizeCalendarioContent(defaultCalendario, defaultCalendario);
  }

  await upsertCalendarioArtifact({
    empresaId,
    agenciaId,
    planArtifactId: plan.id,
    periodo,
    contenidoJson: contentJson,
    alcanceCalendario,
  });

  revalidateEmpresaRoutes(empresaId);
  redirect(`/protected/empresas/${empresaId}/calendario`);
}

