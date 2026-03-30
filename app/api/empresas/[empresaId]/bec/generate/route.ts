import { NextResponse } from "next/server";

import {
  buildPromptBEC,
  CompanyForm,
  DEFAULT_COMPANY,
  deriveMonthlyDeliverablesFromMetadata,
  loadBECState,
  mapAnswerToBec,
} from "@/lib/bec/schema";
import { aiChat } from "@/lib/ollama/client";
import { createClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ empresaId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { empresaId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    company?: Partial<CompanyForm>;
    bec?: unknown;
    prompt?: string;
  };

  const { data: appUser } = await supabase
    .from("app_user")
    .select("agencia_id")
    .eq("id", user.id)
    .maybeSingle();
  const agenciaId = appUser?.agencia_id ?? null;

  const [{ data: empresa }, { data: companyDocs }, { data: agencyDocs }, { data: becPrompt }] =
    await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre, industria, pais, metadata_json")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase
      .from("kb_documents")
      .select("title, raw_text, created_at")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("kb_documents")
      .select("title, raw_text, created_at")
      .eq("agencia_id", agenciaId)
      .is("empresa_id", null)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("agencia_prompt")
      .select("prompt_text, version")
      .eq("agencia_id", agenciaId)
      .eq("prompt_type", "bec")
      .eq("activo", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ]);

  if (!empresa) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const metadata =
    empresa.metadata_json && typeof empresa.metadata_json === "object"
      ? (empresa.metadata_json as Record<string, unknown>)
      : {};

  const company: CompanyForm = {
    negocio: body.company?.negocio?.trim() || (empresa.nombre || "").trim(),
    marca:
      body.company?.marca?.trim() ||
      (typeof metadata.marca === "string" ? metadata.marca : empresa.nombre || "").trim(),
    industria: body.company?.industria?.trim() || (empresa.industria || "").trim(),
    pais: body.company?.pais?.trim() || (empresa.pais || DEFAULT_COMPANY.pais).trim(),
    objetivo:
      body.company?.objetivo?.trim() ||
      (typeof metadata.objetivo === "string" ? metadata.objetivo : "").trim(),
    problema:
      body.company?.problema?.trim() ||
      (typeof metadata.problema === "string" ? metadata.problema : "").trim(),
  };

  const companyDocContext = (companyDocs ?? [])
    .map(
      (doc, idx) =>
        `Documento empresa ${idx + 1}: ${doc.title}\n${(doc.raw_text || "").slice(0, 1400)}`,
    )
    .join("\n\n");

  const agencyDocContext = (agencyDocs ?? [])
    .map(
      (doc, idx) =>
        `Documento agencia ${idx + 1}: ${doc.title}\n${(doc.raw_text || "").slice(0, 1200)}`,
    )
    .join("\n\n");

  const docContext = [
    "CONOCIMIENTO DE EMPRESA:",
    companyDocContext || "Sin documentos de empresa",
    "",
    "CONOCIMIENTO DE AGENCIA:",
    agencyDocContext || "Sin documentos de agencia",
  ].join("\n");

  const metadataContext = JSON.stringify(metadata, null, 2).slice(0, 8000);
  const monthlyDeliverables = deriveMonthlyDeliverablesFromMetadata(metadata);
  const current = loadBECState(body.bec);
  const prompt = buildPromptBEC(
    company,
    docContext,
    metadataContext,
    monthlyDeliverables,
    current,
    body.prompt,
  );
  const systemPrompt = [
    "Eres estratega senior de marketing para agencias. Responde siguiendo exactamente el formato solicitado.",
    'Para "Objetivo SMART 1", "Objetivo SMART 2", "KPI Primario", "KPI Secundario" y "Métrica de Éxito / ROI Esperado": no inventes metas, porcentajes, umbrales, ROI ni KPIs. Si no hay evidencia suficiente, escribe exactamente: "Pendiente de validar con cliente segun metadata_json y contexto actual."',
    'En "Pilares de Comunicacion", "Canales Principales" y "Formatos Clave" deben salir solo de la marca, del contexto documental conocido, del BEC actual y de "Entregables Mensuales" / cuantificacion estandar. No inventes canales, formatos, piezas ni mixes nuevos. Si no hay evidencia suficiente para un canal o formato, escribe exactamente: "Pendiente de validar con cliente segun metadata_json y contexto actual."',
    becPrompt?.prompt_text?.trim()
      ? `PROMPT_BEC_AGENCIA (v${becPrompt.version ?? 1}):\n${becPrompt.prompt_text.trim()}`
      : "No hay prompt BEC personalizado de agencia.",
  ].join("\n\n");

  const strictMetricRule = [
    systemPrompt,
    'Regla adicional: "Métrica de Éxito / ROI Esperado" debe definirse segun el "KPI Primario" y no como porcentaje por defecto, salvo que la evidencia lo exija explicitamente.',
  ].join("\n\n");

  const answer = await aiChat({
    systemPrompt: strictMetricRule,
    userPrompt: prompt,
    temperature: 0.25,
  });

  const generated = mapAnswerToBec(answer, current);

  if (monthlyDeliverables) {
    generated.fields["Entregables Mensuales"] = monthlyDeliverables;
  }

  return NextResponse.json({
    bec: generated,
    answer,
  });
}
