import { NextResponse } from "next/server";

import {
  buildPromptBEC,
  CompanyForm,
  DEFAULT_COMPANY,
  deriveMonthlyDeliverablesFromMetadata,
  loadBECState,
  mapAnswerToBec,
} from "@/lib/bec/schema";
import {
  extractUrlsFromText,
  getCompanyWebResearch,
  getReferenceLinksWebResearch,
} from "@/lib/company-web-research";
import { aiChat } from "@/lib/ollama/client";
import { createClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ empresaId: string }>;
};

function needsStrategicObjectiveFallback(value: string | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("pendiente") ||
    normalized.includes("supuesto:") ||
    normalized.includes("por validar") ||
    normalized.includes("por definir") ||
    normalized.includes("por confirmar")
  );
}

function applyStrategicObjectiveFallbacks(
  fields: Record<string, string>,
  company: CompanyForm,
) {
  const brand = company.marca || company.negocio || "la marca";
  const businessFocus =
    company.objetivo || company.problema || `fortalecer el crecimiento comercial de ${brand}`;
  const problemFocus =
    company.problema || company.objetivo || `mejorar la claridad comercial de ${brand}`;
  const industryFocus = company.industria ? ` en ${company.industria}` : "";

  const fallbacks: Record<string, string> = {
    "Objetivo SMART 1": `Convertir ${businessFocus} en una prioridad de marketing medible para ordenar contenido, pauta y seguimiento comercial${industryFocus}.`,
    "Objetivo SMART 2": `Reducir la friccion asociada a ${problemFocus} mediante mensajes, formatos y canales que mejoren la calidad de la demanda generada.`,
    "KPI Primario": "Leads calificados o consultas comerciales atribuibles a las acciones de marketing.",
    "KPI Secundario": "Calidad de interaccion, tasa de respuesta comercial y avance de prospectos hacia conversacion de venta.",
    "Métrica de Éxito / ROI Esperado":
      "Evolucion del KPI primario frente al esfuerzo mensual ejecutado, evaluando calidad de oportunidades generadas y aporte al pipeline comercial.",
  };

  for (const [key, fallback] of Object.entries(fallbacks)) {
    if (needsStrategicObjectiveFallback(fields[key])) {
      fields[key] = fallback;
    }
  }
}

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
    referenceLinks?: string;
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

  const referenceLinks = Array.from(
    new Set([
      ...extractUrlsFromText(body.referenceLinks ?? ""),
      ...extractUrlsFromText(body.prompt ?? ""),
      ...extractUrlsFromText(company.objetivo),
      ...extractUrlsFromText(company.problema),
    ]),
  ).slice(0, 8);

  const [webResearchContext, referenceLinksContext] = await Promise.all([
    getCompanyWebResearch({
      ...empresa,
      marca: company.marca,
    }),
    getReferenceLinksWebResearch({
      links: referenceLinks,
      purpose: "generar o regenerar el BEC estrategico de la empresa",
      userContext: [
        body.prompt,
        company.objetivo ? `Objetivo: ${company.objetivo}` : "",
        company.problema ? `Problema: ${company.problema}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      country: company.pais,
    }),
  ]);

  const docContext = [
    "INVESTIGACION WEB DE EMPRESA:",
    webResearchContext,
    "",
    "INVESTIGACION WEB DE LINKS DEL USUARIO:",
    referenceLinksContext || "Sin links adicionales investigados",
    "",
    "",
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
    'Para todo el bloque "3. Objetivos Estrategicos y KPIs" ("Objetivo SMART 1", "Objetivo SMART 2", "KPI Primario", "KPI Secundario" y "Métrica de Éxito / ROI Esperado"): no escribas "Pendiente de validar" ni "SUPUESTO:" como salida final. Lee metadata_json, BEC actual y contexto documental para proponer objetivos, indicadores y metrica de exito coherentes.',
    "En ese bloque 3 no inventes porcentajes, umbrales, ROI ni valores meta. Los objetivos deben tener accion, foco de negocio, resultado esperado y criterio de medicion; los KPIs deben derivarse del objetivo, industria, alcance, entregables y problema; la metrica de exito debe explicar como evaluar el KPI primario sin convertirlo en porcentaje por defecto.",
    'En "Pilares de Comunicacion", "Canales Principales" y "Formatos Clave" no inventes canales, formatos, piezas ni mixes nuevos. Canales solo pueden salir de metadata_json.alcance_calendario, Entregables Mensuales, BEC actual, documentos internos o investigacion web explicitamente verificable. Formatos solo pueden salir de Entregables Mensuales, alcance operativo, BEC actual, documentos internos o instrucciones del usuario. No agregues Anuncios LinkedIn, Encuestas LinkedIn, webinars, whitepapers, reels, newsletters u otros formatos si no aparecen como alcance, documento o instruccion. Si no hay evidencia suficiente para un canal o formato, escribe exactamente: "Pendiente de validar con cliente segun metadata_json y contexto actual."',
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
  applyStrategicObjectiveFallbacks(generated.fields, company);

  if (monthlyDeliverables) {
    generated.fields["Entregables Mensuales"] = monthlyDeliverables;
  }

  return NextResponse.json({
    bec: generated,
    answer,
  });
}
