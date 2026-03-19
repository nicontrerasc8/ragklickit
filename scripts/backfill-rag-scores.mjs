import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function ratio(numerator, denominator) {
  if (denominator <= 0) return 0;
  return clamp(numerator / denominator);
}

function scoreLabel(score) {
  if (score >= 0.75) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function riskLabel(score) {
  if (score >= 0.75) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function scorePriority({ impact, successProbability, confidence, risk, effort }) {
  const numerator = clamp(impact) * clamp(successProbability) * clamp(confidence) * (1 - clamp(risk));
  const denominator = Math.max(clamp(effort), 0.1);
  return clamp(numerator / denominator);
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function normalizePlan(content) {
  const root = normalizeObject(content);
  const plan = normalizeObject(root.plan_trabajo ?? content);
  return {
    resumen_actualizaciones: normalizeObject(plan.resumen_actualizaciones),
    comunidad: normalizeArray(plan.comunidad),
    cantidad_contenidos: normalizeArray(plan.cantidad_contenidos),
    pilares_comunicacion: normalizeArray(plan.pilares_comunicacion),
    contenido_sugerido: normalizeArray(plan.contenido_sugerido),
    productos_servicios_destacar: normalizeArray(plan.productos_servicios_destacar),
    mensajes_destacados: normalizeArray(plan.mensajes_destacados),
    fechas_importantes: normalizeArray(plan.fechas_importantes),
    eventos: normalizeArray(plan.eventos),
    pendientes_cliente: normalizeArray(plan.pendientes_cliente),
    alcance_calendario: normalizeObject(plan.alcance_calendario),
  };
}

function planSummary(plan) {
  const alcanceTotal = Object.values(plan.alcance_calendario).reduce(
    (acc, value) => acc + (Number.isFinite(value) ? value : 0),
    0,
  );
  const totalCanales = plan.cantidad_contenidos.length;
  const formatosCompletos = plan.cantidad_contenidos.filter((item) => {
    const cantidad = Number(item?.cantidad ?? 0);
    const formatos = normalizeArray(item?.formatos);
    return cantidad <= 0 || formatos.length > 0;
  }).length;
  const ideasTotales = plan.contenido_sugerido.reduce(
    (acc, item) => acc + normalizeArray(item?.ideas).length,
    0,
  );
  const pilaresTotales = plan.pilares_comunicacion.length;
  const gestionRedes = typeof plan.resumen_actualizaciones.gestion_redes === "string"
    ? plan.resumen_actualizaciones.gestion_redes.trim()
    : "";

  const completeness =
    0.2 * Number(gestionRedes.length > 0) +
    0.15 * Number(plan.productos_servicios_destacar.length > 0) +
    0.15 * Number(plan.mensajes_destacados.length > 0) +
    0.15 * Number(pilaresTotales > 0) +
    0.2 * Number(ideasTotales > 0) +
    0.15 * Number(alcanceTotal > 0);

  const dataQuality =
    0.5 * completeness +
    0.2 * ratio(formatosCompletos, Math.max(totalCanales, 1)) +
    0.15 * ratio(plan.fechas_importantes.length, 4) +
    0.15 * ratio(plan.comunidad.length, 3);

  const impact =
    0.35 * ratio(alcanceTotal, 12) +
    0.25 * ratio(totalCanales, 4) +
    0.2 * ratio(ideasTotales, 8) +
    0.2 * Number(plan.mensajes_destacados.length > 0);

  const effort =
    0.45 * ratio(alcanceTotal, 16) +
    0.25 * ratio(totalCanales, 6) +
    0.15 * ratio(plan.pendientes_cliente.length, 4) +
    0.15 * Number(plan.eventos.length > 0);

  const risk =
    0.3 * Number(alcanceTotal === 0) +
    0.2 * Number(plan.mensajes_destacados.length === 0) +
    0.2 * ratio(plan.pendientes_cliente.length, 4) +
    0.15 * Number(plan.fechas_importantes.length === 0) +
    0.15 * Number(ideasTotales === 0);

  const confidence =
    0.45 * dataQuality +
    0.25 * Number(pilaresTotales > 0) +
    0.15 * Number(totalCanales > 0) +
    0.15 * Number(ideasTotales > 0);

  const successProbability = clamp(0.45 * confidence + 0.35 * impact + 0.2 * (1 - risk) - 0.1 * effort);
  const priority = scorePriority({ impact, successProbability, confidence, risk, effort });
  const roi = clamp(impact * successProbability * (1 - risk));

  return { alcanceTotal, totalCanales, ideasTotales, confidence, risk, impact, effort, successProbability, priority, roi, dataQuality };
}

function normalizeCalendario(content) {
  const root = normalizeObject(content);
  const calendario = normalizeObject(root.calendario);
  return {
    riesgos: normalizeArray(root.riesgos),
    supuestos: normalizeArray(root.supuestos),
    alcance_calendario: normalizeObject(root.alcance_calendario),
    calendario: {
      items: normalizeArray(calendario.items),
    },
  };
}

function calendarioSummary(cal) {
  const items = cal.calendario.items;
  const itemsWithDate = items.filter((item) => typeof item?.fecha === "string" && item.fecha.trim()).length;
  const itemsWithCTA = items.filter((item) => typeof item?.CTA === "string" && item.CTA.trim()).length;
  const itemsWithMessage = items.filter((item) => typeof item?.mensaje_clave === "string" && item.mensaje_clave.trim()).length;
  const itemsWithRestrictions = items.filter((item) => {
    const restricciones = normalizeObject(item?.restricciones_aplicadas);
    return normalizeArray(restricciones.frases_prohibidas).length > 0 || normalizeArray(restricciones.disclaimers).length > 0;
  }).length;
  const channels = new Set(
    items
      .map((item) => (typeof item?.canal === "string" ? item.canal.trim() : ""))
      .filter(Boolean),
  );
  let duplicateCount = 0;
  const seen = new Set();
  for (const item of items) {
    const key = `${item?.fecha ?? ""}|${item?.canal ?? ""}|${item?.titulo_base ?? ""}`.toLowerCase();
    if (seen.has(key)) duplicateCount += 1;
    seen.add(key);
  }

  const dataQuality =
    0.35 * ratio(itemsWithDate, Math.max(items.length, 1)) +
    0.2 * ratio(itemsWithCTA, Math.max(items.length, 1)) +
    0.2 * ratio(itemsWithMessage, Math.max(items.length, 1)) +
    0.15 * ratio(channels.size, 4) +
    0.1 * Number(Object.keys(cal.alcance_calendario).length > 0);

  const confidence =
    0.5 * dataQuality +
    0.2 * ratio(itemsWithRestrictions, Math.max(items.length, 1)) +
    0.15 * Number(cal.riesgos.length > 0 || items.length > 0) +
    0.15;

  const impact =
    0.4 * ratio(items.length, 16) +
    0.3 * ratio(channels.size, 4) +
    0.15 * ratio(itemsWithCTA, Math.max(items.length, 1)) +
    0.15 * ratio(itemsWithMessage, Math.max(items.length, 1));

  const effort = clamp(
    0.6 * ratio(items.length, 20) +
    0.25 * ratio(channels.size, 5) +
    0.15 * ratio(itemsWithRestrictions, Math.max(items.length, 1)),
  );

  const risk =
    0.35 * ratio(duplicateCount, Math.max(items.length, 1)) +
    0.25 * (1 - ratio(itemsWithDate, Math.max(items.length, 1))) +
    0.2 * (1 - ratio(itemsWithCTA, Math.max(items.length, 1))) +
    0.2 * (1 - ratio(itemsWithRestrictions, Math.max(items.length, 1)));

  const successProbability = clamp(0.45 * confidence + 0.35 * impact + 0.2 * (1 - risk) - 0.08 * effort);
  const priority = scorePriority({ impact, successProbability, confidence, risk, effort });
  const roi = clamp(impact * successProbability * (1 - risk));

  return { totalItems: items.length, channelCount: channels.size, duplicateCount, confidence, risk, impact, effort, successProbability, priority, roi, dataQuality };
}

function buildRow({ artifact, scoreType, entityLevel = "global", entityKey = null, scoreValue, rationale, evidence, metadata = {} }) {
  const normalizedValue = Number(clamp(scoreValue).toFixed(4));
  return {
    agencia_id: artifact.agencia_id,
    empresa_id: artifact.empresa_id,
    artifact_id: artifact.id,
    score_type: scoreType,
    entity_level: entityLevel,
    entity_key: entityKey,
    score_value: normalizedValue,
    score_label: scoreType === "risk" ? riskLabel(normalizedValue) : scoreLabel(normalizedValue),
    rationale,
    evidence_json: evidence,
    metadata_json: metadata,
    model_used: artifact.model_used ?? null,
    prompt_version: artifact.prompt_version ?? null,
  };
}

function buildPlanRows(artifact) {
  const plan = normalizePlan(artifact.content_json);
  const summary = planSummary(plan);
  const evidence = [
    `${summary.alcanceTotal} piezas planificadas por alcance`,
    `${summary.totalCanales} canales con plan operativo`,
    `${summary.ideasTotales} ideas sugeridas`,
  ];
  const rows = [
    buildRow({ artifact, scoreType: "data_quality", scoreValue: summary.dataQuality, rationale: "Calidad estructural del plan.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "confidence", scoreValue: summary.confidence, rationale: "Confianza global del plan.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "risk", scoreValue: summary.risk, rationale: "Riesgo global del plan.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "impact", scoreValue: summary.impact, rationale: "Impacto esperado del plan.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "effort", scoreValue: summary.effort, rationale: "Esfuerzo operativo estimado.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "success_probability", scoreValue: summary.successProbability, rationale: "Probabilidad de exito del plan.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "roi", scoreValue: summary.roi, rationale: "ROI esperado simplificado.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "priority", scoreValue: summary.priority, rationale: "Prioridad global del plan.", evidence, metadata: summary }),
  ];

  for (const item of plan.cantidad_contenidos) {
    const quantity = Math.max(0, Number(item?.cantidad ?? 0));
    const formatos = normalizeArray(item?.formatos);
    const channel = typeof item?.red === "string" ? item.red : "";
    const entityKey = slugify(channel || "canal");
    const itemEffort = clamp(0.55 * ratio(quantity, 8) + 0.45 * Number(formatos.length === 0 && quantity > 0));
    const itemConfidence = clamp(
      0.5 * Number(channel.trim().length > 0) +
      0.3 * Number(quantity > 0) +
      0.2 * Number(formatos.length > 0 || quantity === 0),
    );
    const itemImpact = clamp(0.7 * ratio(quantity, Math.max(summary.alcanceTotal, 1)) + 0.3 * ratio(formatos.length, 3));
    const itemRisk = clamp(0.6 * Number(quantity > 0 && formatos.length === 0) + 0.4 * Number(quantity === 0));
    const itemSuccess = clamp(0.45 * itemConfidence + 0.35 * itemImpact + 0.2 * (1 - itemRisk));
    const itemPriority = scorePriority({
      impact: itemImpact,
      successProbability: itemSuccess,
      confidence: itemConfidence,
      risk: itemRisk,
      effort: itemEffort,
    });
    const itemEvidence = [
      `Canal: ${channel || "Sin canal"}`,
      `Cantidad planificada: ${quantity}`,
      `Formatos definidos: ${formatos.length}`,
    ];

    rows.push(
      buildRow({
        artifact,
        scoreType: "confidence",
        entityLevel: "initiative",
        entityKey,
        scoreValue: itemConfidence,
        rationale: `Confianza operativa del bloque ${channel || "sin canal"}.`,
        evidence: itemEvidence,
        metadata: { channel, quantity, formatos },
      }),
      buildRow({
        artifact,
        scoreType: "risk",
        entityLevel: "initiative",
        entityKey,
        scoreValue: itemRisk,
        rationale: `Riesgo operativo del bloque ${channel || "sin canal"}.`,
        evidence: itemEvidence,
        metadata: { channel, quantity, formatos },
      }),
      buildRow({
        artifact,
        scoreType: "priority",
        entityLevel: "initiative",
        entityKey,
        scoreValue: itemPriority,
        rationale: `Prioridad relativa del bloque ${channel || "sin canal"} dentro del plan.`,
        evidence: itemEvidence,
        metadata: { channel, quantity, formatos, impact: itemImpact, effort: itemEffort, successProbability: itemSuccess },
      }),
    );
  }

  return rows;
}

function buildCalendarioRows(artifact) {
  const cal = normalizeCalendario(artifact.content_json);
  const summary = calendarioSummary(cal);
  const evidence = [
    `${summary.totalItems} items en el calendario`,
    `${summary.channelCount} canales activos`,
    `${summary.duplicateCount} duplicados exactos`,
  ];
  const rows = [
    buildRow({ artifact, scoreType: "data_quality", scoreValue: summary.dataQuality, rationale: "Calidad estructural del calendario.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "confidence", scoreValue: summary.confidence, rationale: "Confianza global del calendario.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "risk", scoreValue: summary.risk, rationale: "Riesgo global del calendario.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "impact", scoreValue: summary.impact, rationale: "Impacto esperado del calendario.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "effort", scoreValue: summary.effort, rationale: "Esfuerzo operativo del calendario.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "success_probability", scoreValue: summary.successProbability, rationale: "Probabilidad de exito del calendario.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "roi", scoreValue: summary.roi, rationale: "ROI esperado simplificado.", evidence, metadata: summary }),
    buildRow({ artifact, scoreType: "priority", scoreValue: summary.priority, rationale: "Prioridad global del calendario.", evidence, metadata: summary }),
  ];

  for (const item of cal.calendario.items) {
    const restricciones = normalizeObject(item?.restricciones_aplicadas);
    const itemId = typeof item?.id === "string" && item.id.trim() ? item.id.trim() : slugify(`${item?.canal ?? "item"}-${item?.fecha ?? ""}`);
    const itemConfidence = clamp(
      0.3 * Number(typeof item?.fecha === "string" && item.fecha.trim().length > 0) +
      0.2 * Number(typeof item?.formato === "string" && item.formato.trim().length > 0) +
      0.2 * Number(typeof item?.CTA === "string" && item.CTA.trim().length > 0) +
      0.15 * Number(typeof item?.mensaje_clave === "string" && item.mensaje_clave.trim().length > 0) +
      0.15 * Number(normalizeArray(restricciones.disclaimers).length > 0 || normalizeArray(restricciones.frases_prohibidas).length > 0),
    );
    const itemRisk = clamp(
      0.35 * Number(!(typeof item?.fecha === "string" && item.fecha.trim().length > 0)) +
      0.25 * Number(!(typeof item?.CTA === "string" && item.CTA.trim().length > 0)) +
      0.2 * Number(!(typeof item?.formato === "string" && item.formato.trim().length > 0)) +
      0.2 * Number(normalizeArray(restricciones.disclaimers).length === 0 && normalizeArray(restricciones.frases_prohibidas).length === 0),
    );
    const itemEvidence = [
      `Canal: ${item?.canal ?? ""}`,
      `Fecha: ${item?.fecha || "sin fecha"}`,
      `Formato: ${item?.formato || "sin formato"}`,
    ];

    rows.push(
      buildRow({
        artifact,
        scoreType: "confidence",
        entityLevel: "calendar_item",
        entityKey: itemId,
        scoreValue: itemConfidence,
        rationale: `Confianza del item ${itemId} segun completitud editorial.`,
        evidence: itemEvidence,
        metadata: { channel: item?.canal ?? "", week: item?.semana ?? null, formato: item?.formato ?? "" },
      }),
      buildRow({
        artifact,
        scoreType: "risk",
        entityLevel: "calendar_item",
        entityKey: itemId,
        scoreValue: itemRisk,
        rationale: `Riesgo del item ${itemId} por vacios operativos o falta de guardrails.`,
        evidence: itemEvidence,
        metadata: { channel: item?.canal ?? "", week: item?.semana ?? null, formato: item?.formato ?? "" },
      }),
    );
  }

  return rows;
}

async function fetchArtifactsPage(from, to) {
  const { data, error } = await supabase
    .from("rag_artifacts")
    .select("id, artifact_type, agencia_id, empresa_id, content_json, model_used, prompt_version")
    .in("artifact_type", ["plan_trabajo", "calendario"])
    .not("agencia_id", "is", null)
    .not("empresa_id", "is", null)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(`No se pudieron leer artefactos: ${error.message}`);
  }

  return data ?? [];
}

async function replaceScoresForArtifact(artifact, rows) {
  const { error: deleteError } = await supabase.from("rag_scores").delete().eq("artifact_id", artifact.id);
  if (deleteError) {
    throw new Error(`No se pudieron borrar scores de ${artifact.id}: ${deleteError.message}`);
  }

  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("rag_scores").insert(rows);
  if (insertError) {
    throw new Error(`No se pudieron insertar scores de ${artifact.id}: ${insertError.message}`);
  }
}

async function main() {
  const pageSize = 200;
  let from = 0;
  let processed = 0;

  while (true) {
    const artifacts = await fetchArtifactsPage(from, from + pageSize - 1);
    if (artifacts.length === 0) break;

    for (const artifact of artifacts) {
      const rows =
        artifact.artifact_type === "plan_trabajo"
          ? buildPlanRows(artifact)
          : buildCalendarioRows(artifact);
      await replaceScoresForArtifact(artifact, rows);
      processed += 1;
      console.log(`OK ${artifact.artifact_type} ${artifact.id} -> ${rows.length} scores`);
    }

    from += pageSize;
  }

  console.log(`Backfill completado. Artefactos procesados: ${processed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
