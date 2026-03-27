"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function sanitizeStoredText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
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
  const rawTextInput = sanitizeStoredText(String(formData.get("raw_text") ?? ""));
  const docType = String(formData.get("doc_type") ?? "manual").trim() || "manual";

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

  if (!rawTextInput) {
    throw new Error("Debes pegar el texto resumido que se guardara directamente en la base de datos.");
  }

  const { error } = await supabase.from("kb_documents").insert({
    agencia_id: agenciaId,
    empresa_id: empresaId,
    empresa_file_id: null,
    scope: "org",
    doc_type: docType,
    title,
    raw_text: rawTextInput,
  });

  if (error) {
    throw new Error(`No se pudo crear documento: ${error.message}`);
  }

  revalidateEmpresaRoutes(empresaId);
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
