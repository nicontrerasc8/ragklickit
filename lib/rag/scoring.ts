import { normalizeCalendarioContent, type CalendarioContent } from "@/lib/calendario/schema";
import { normalizePlanTrabajoContent, type PlanTrabajo } from "@/lib/plan-trabajo/schema";

type ScoreType =
  | "confidence"
  | "risk"
  | "priority"
  | "roi"
  | "effort"
  | "impact"
  | "success_probability"
  | "data_quality";

type EntityLevel = "global" | "initiative" | "calendar_item";

export type RagScoreInsert = {
  agencia_id: string;
  empresa_id: string;
  artifact_id: string;
  score_type: ScoreType;
  entity_level: EntityLevel;
  entity_key: string | null;
  score_value: number;
  score_label: string | null;
  rationale: string;
  evidence_json: string[];
  metadata_json: Record<string, unknown>;
  model_used?: string | null;
  prompt_version?: string | null;
};

type ScoreSummary = Partial<Record<ScoreType, number>>;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return clamp(numerator / denominator);
}

function safeArray<T>(value: T[] | undefined | null) {
  return Array.isArray(value) ? value : [];
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function scoreLabel(score: number) {
  if (score >= 0.75) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function riskLabel(score: number) {
  if (score >= 0.75) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function buildScoreRow(params: {
  agenciaId: string;
  empresaId: string;
  artifactId: string;
  scoreType: ScoreType;
  entityLevel: EntityLevel;
  entityKey?: string | null;
  scoreValue: number;
  rationale: string;
  evidence: string[];
  metadata?: Record<string, unknown>;
  modelUsed?: string | null;
  promptVersion?: string | null;
}) {
  const scoreValue = clamp(params.scoreValue);
  const label = params.scoreType === "risk" ? riskLabel(scoreValue) : scoreLabel(scoreValue);

  return {
    agencia_id: params.agenciaId,
    empresa_id: params.empresaId,
    artifact_id: params.artifactId,
    score_type: params.scoreType,
    entity_level: params.entityLevel,
    entity_key: params.entityKey ?? null,
    score_value: Number(scoreValue.toFixed(4)),
    score_label: label,
    rationale: params.rationale,
    evidence_json: params.evidence,
    metadata_json: params.metadata ?? {},
    model_used: params.modelUsed ?? null,
    prompt_version: params.promptVersion ?? null,
  } satisfies RagScoreInsert;
}

function scorePriority(input: {
  impact: number;
  successProbability: number;
  confidence: number;
  risk: number;
  effort: number;
}) {
  const numerator =
    clamp(input.impact) *
    clamp(input.successProbability) *
    clamp(input.confidence) *
    (1 - clamp(input.risk));
  const denominator = Math.max(clamp(input.effort), 0.1);
  return clamp(numerator / denominator);
}

function sumAlcance(alcance: Record<string, number>) {
  return Object.values(alcance).reduce((acc, value) => acc + value, 0);
}

function planSummary(plan: PlanTrabajo) {
  const alcanceTotal = sumAlcance(plan.alcance_calendario);
  const totalCanales = safeArray(plan.cantidad_contenidos).length;
  const formatosCompletos = safeArray(plan.cantidad_contenidos).filter(
    (item) => item.cantidad <= 0 || item.formatos.length > 0,
  ).length;
  const ideasTotales = safeArray(plan.contenido_sugerido).reduce((acc, item) => acc + item.ideas.length, 0);
  const pilaresTotales = safeArray(plan.pilares_comunicacion).length;

  const completeness =
    0.2 * Number(plan.resumen_actualizaciones.gestion_redes.trim().length > 0) +
    0.15 * Number(safeArray(plan.productos_servicios_destacar).length > 0) +
    0.15 * Number(safeArray(plan.mensajes_destacados).length > 0) +
    0.15 * Number(pilaresTotales > 0) +
    0.2 * Number(ideasTotales > 0) +
    0.15 * Number(alcanceTotal > 0);

  const dataQuality =
    0.5 * completeness +
    0.2 * ratio(formatosCompletos, Math.max(totalCanales, 1)) +
    0.15 * ratio(safeArray(plan.fechas_importantes).length, 4) +
    0.15 * ratio(safeArray(plan.comunidad).length, 3);

  const impact =
    0.35 * ratio(alcanceTotal, 12) +
    0.25 * ratio(totalCanales, 4) +
    0.2 * ratio(ideasTotales, 8) +
    0.2 * Number(safeArray(plan.mensajes_destacados).length > 0);

  const effort =
    0.45 * ratio(alcanceTotal, 16) +
    0.25 * ratio(totalCanales, 6) +
    0.15 * ratio(safeArray(plan.pendientes_cliente).length, 4) +
    0.15 * Number(safeArray(plan.eventos).length > 0);

  const risk =
    0.3 * Number(alcanceTotal === 0) +
    0.2 * Number(safeArray(plan.mensajes_destacados).length === 0) +
    0.2 * ratio(safeArray(plan.pendientes_cliente).length, 4) +
    0.15 * Number(safeArray(plan.fechas_importantes).length === 0) +
    0.15 * Number(ideasTotales === 0);

  const confidence =
    0.45 * dataQuality +
    0.25 * Number(pilaresTotales > 0) +
    0.15 * Number(totalCanales > 0) +
    0.15 * Number(ideasTotales > 0);

  const successProbability = clamp(0.45 * confidence + 0.35 * impact + 0.2 * (1 - risk) - 0.1 * effort);
  const priority = scorePriority({
    impact,
    successProbability,
    confidence,
    risk,
    effort,
  });
  const roi = clamp(impact * successProbability * (1 - risk));

  return {
    alcanceTotal,
    totalCanales,
    ideasTotales,
    pilaresTotales,
    confidence,
    risk,
    impact,
    effort,
    successProbability,
    priority,
    roi,
    dataQuality,
  };
}

export function buildPlanArtifactScores(params: {
  agenciaId: string;
  empresaId: string;
  artifactId: string;
  content: unknown;
  modelUsed?: string | null;
  promptVersion?: string | null;
}) {
  const plan = normalizePlanTrabajoContent(params.content).plan_trabajo;
  const summary = planSummary(plan);
  const evidence = [
    `${summary.alcanceTotal} piezas planificadas por alcance`,
    `${summary.totalCanales} canales con plan operativo`,
    `${summary.ideasTotales} ideas de contenido sugeridas`,
    `${safeArray(plan.fechas_importantes).length} fechas importantes declaradas`,
  ];

  const rows: RagScoreInsert[] = [
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "data_quality",
      entityLevel: "global",
      scoreValue: summary.dataQuality,
      rationale: "Mide cuan completo y util es el plan para operar sin vacios fuertes.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "confidence",
      entityLevel: "global",
      scoreValue: summary.confidence,
      rationale: "La confianza sube cuando el plan trae alcance, pilares, ideas y mensajes suficientes.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "risk",
      entityLevel: "global",
      scoreValue: summary.risk,
      rationale: "El riesgo sube si faltan mensajes, fechas, alcance o hay demasiadas dependencias pendientes.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "impact",
      entityLevel: "global",
      scoreValue: summary.impact,
      rationale: "El impacto crece con mayor cobertura de canales, volumen util y riqueza de ideas accionables.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "effort",
      entityLevel: "global",
      scoreValue: summary.effort,
      rationale: "El esfuerzo refleja volumen operativo, dispersion por canal y carga de pendientes del cliente.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "success_probability",
      entityLevel: "global",
      scoreValue: summary.successProbability,
      rationale: "La probabilidad de exito combina calidad del plan, impacto esperado y nivel de riesgo.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "roi",
      entityLevel: "global",
      scoreValue: summary.roi,
      rationale: "ROI esperado simplificado a partir de impacto, probabilidad de exito y riesgo.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "priority",
      entityLevel: "global",
      scoreValue: summary.priority,
      rationale: "La prioridad final pondera impacto, confianza, riesgo y esfuerzo operativo.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
  ];

  for (const item of safeArray(plan.cantidad_contenidos)) {
    const channelKey = slugify(item.red || "canal");
    const quantity = Math.max(0, item.cantidad);
    const itemEffort = clamp(0.55 * ratio(quantity, 8) + 0.45 * Number(item.formatos.length === 0 && quantity > 0));
    const itemConfidence = clamp(
      0.5 * Number(item.red.trim().length > 0) +
      0.3 * Number(quantity > 0) +
      0.2 * Number(item.formatos.length > 0 || quantity === 0),
    );
    const itemImpact = clamp(0.7 * ratio(quantity, Math.max(summary.alcanceTotal, 1)) + 0.3 * ratio(item.formatos.length, 3));
    const itemRisk = clamp(0.6 * Number(quantity > 0 && item.formatos.length === 0) + 0.4 * Number(quantity === 0));
    const itemSuccess = clamp(0.45 * itemConfidence + 0.35 * itemImpact + 0.2 * (1 - itemRisk));
    const itemPriority = scorePriority({
      impact: itemImpact,
      successProbability: itemSuccess,
      confidence: itemConfidence,
      risk: itemRisk,
      effort: itemEffort,
    });
    const itemEvidence = [
      `Canal: ${item.red || "Sin canal"}`,
      `Cantidad planificada: ${quantity}`,
      `Formatos definidos: ${item.formatos.length}`,
    ];

    rows.push(
      buildScoreRow({
        agenciaId: params.agenciaId,
        empresaId: params.empresaId,
        artifactId: params.artifactId,
        scoreType: "confidence",
        entityLevel: "initiative",
        entityKey: channelKey,
        scoreValue: itemConfidence,
        rationale: `Confianza operativa del bloque ${item.red || "sin canal"}.`,
        evidence: itemEvidence,
        metadata: { channel: item.red, quantity, formatos: item.formatos },
        modelUsed: params.modelUsed,
        promptVersion: params.promptVersion,
      }),
      buildScoreRow({
        agenciaId: params.agenciaId,
        empresaId: params.empresaId,
        artifactId: params.artifactId,
        scoreType: "risk",
        entityLevel: "initiative",
        entityKey: channelKey,
        scoreValue: itemRisk,
        rationale: `Riesgo operativo del bloque ${item.red || "sin canal"}.`,
        evidence: itemEvidence,
        metadata: { channel: item.red, quantity, formatos: item.formatos },
        modelUsed: params.modelUsed,
        promptVersion: params.promptVersion,
      }),
      buildScoreRow({
        agenciaId: params.agenciaId,
        empresaId: params.empresaId,
        artifactId: params.artifactId,
        scoreType: "priority",
        entityLevel: "initiative",
        entityKey: channelKey,
        scoreValue: itemPriority,
        rationale: `Prioridad relativa del bloque ${item.red || "sin canal"} dentro del plan.`,
        evidence: itemEvidence,
        metadata: {
          channel: item.red,
          quantity,
          impact: itemImpact,
          effort: itemEffort,
          successProbability: itemSuccess,
        },
        modelUsed: params.modelUsed,
        promptVersion: params.promptVersion,
      }),
    );
  }

  return rows;
}

function calendarioSummary(calendario: CalendarioContent) {
  const items = safeArray(calendario.calendario.items);
  const itemsWithDate = items.filter((item) => item.fecha).length;
  const itemsWithCTA = items.filter((item) => item.CTA.trim().length > 0).length;
  const itemsWithMessage = items.filter((item) => item.mensaje_clave.trim().length > 0).length;
  const itemsWithRestrictions = items.filter(
    (item) =>
      item.restricciones_aplicadas.frases_prohibidas.length > 0 ||
      item.restricciones_aplicadas.disclaimers.length > 0,
  ).length;
  const channels = new Set(items.map((item) => item.canal.trim()).filter(Boolean));
  const duplicates = new Set<string>();
  let duplicateCount = 0;

  for (const item of items) {
    const key = `${item.fecha}|${item.canal}|${item.titulo_base}`.toLowerCase();
    if (duplicates.has(key)) duplicateCount += 1;
    duplicates.add(key);
  }

  const dataQuality =
    0.35 * ratio(itemsWithDate, Math.max(items.length, 1)) +
    0.2 * ratio(itemsWithCTA, Math.max(items.length, 1)) +
    0.2 * ratio(itemsWithMessage, Math.max(items.length, 1)) +
    0.15 * ratio(channels.size, 4) +
    0.1 * Number(Object.keys(calendario.alcance_calendario).length > 0);

  const confidence =
    0.5 * dataQuality +
    0.2 * ratio(itemsWithRestrictions, Math.max(items.length, 1)) +
    0.15 * Number(safeArray(calendario.riesgos).length > 0 || items.length > 0) +
    0.15 * Number(safeArray(calendario.supuestos).length >= 0);

  const impact =
    0.4 * ratio(items.length, 16) +
    0.3 * ratio(channels.size, 4) +
    0.15 * ratio(itemsWithCTA, Math.max(items.length, 1)) +
    0.15 * ratio(itemsWithMessage, Math.max(items.length, 1));

  const effort = clamp(0.6 * ratio(items.length, 20) + 0.25 * ratio(channels.size, 5) + 0.15 * ratio(itemsWithRestrictions, Math.max(items.length, 1)));
  const risk =
    0.35 * ratio(duplicateCount, Math.max(items.length, 1)) +
    0.25 * (1 - ratio(itemsWithDate, Math.max(items.length, 1))) +
    0.2 * (1 - ratio(itemsWithCTA, Math.max(items.length, 1))) +
    0.2 * (1 - ratio(itemsWithRestrictions, Math.max(items.length, 1)));
  const successProbability = clamp(0.45 * confidence + 0.35 * impact + 0.2 * (1 - risk) - 0.08 * effort);
  const priority = scorePriority({ impact, successProbability, confidence, risk, effort });
  const roi = clamp(impact * successProbability * (1 - risk));

  return {
    totalItems: items.length,
    channelCount: channels.size,
    duplicateCount,
    confidence,
    risk,
    impact,
    effort,
    successProbability,
    priority,
    roi,
    dataQuality,
  };
}

export function buildCalendarioArtifactScores(params: {
  agenciaId: string;
  empresaId: string;
  artifactId: string;
  content: unknown;
  modelUsed?: string | null;
  promptVersion?: string | null;
}) {
  const calendario = normalizeCalendarioContent(params.content);
  const summary = calendarioSummary(calendario);
  const evidence = [
    `${summary.totalItems} items en el calendario`,
    `${summary.channelCount} canales con publicaciones`,
    `${summary.duplicateCount} duplicados exactos detectados`,
  ];

  const rows: RagScoreInsert[] = [
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "data_quality",
      entityLevel: "global",
      scoreValue: summary.dataQuality,
      rationale: "Mide cuan completo viene el calendario para producir y revisar.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "confidence",
      entityLevel: "global",
      scoreValue: summary.confidence,
      rationale: "La confianza del calendario depende de fechas, CTA, mensaje y restricciones aplicadas.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "risk",
      entityLevel: "global",
      scoreValue: summary.risk,
      rationale: "El riesgo sube con duplicados, piezas sin fecha o piezas sin CTA claro.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "impact",
      entityLevel: "global",
      scoreValue: summary.impact,
      rationale: "El impacto esperado mejora con cobertura de items, canales y llamados a la accion.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "effort",
      entityLevel: "global",
      scoreValue: summary.effort,
      rationale: "El esfuerzo refleja volumen de piezas, dispersion de canales y carga de compliance.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "success_probability",
      entityLevel: "global",
      scoreValue: summary.successProbability,
      rationale: "La probabilidad de exito del calendario combina orden operativo, impacto y riesgo.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "roi",
      entityLevel: "global",
      scoreValue: summary.roi,
      rationale: "ROI esperado simplificado del calendario en su estado actual.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
    buildScoreRow({
      agenciaId: params.agenciaId,
      empresaId: params.empresaId,
      artifactId: params.artifactId,
      scoreType: "priority",
      entityLevel: "global",
      scoreValue: summary.priority,
      rationale: "Prioridad final del calendario segun cobertura, calidad de señal, riesgo y esfuerzo.",
      evidence,
      metadata: summary,
      modelUsed: params.modelUsed,
      promptVersion: params.promptVersion,
    }),
  ];

  for (const item of safeArray(calendario.calendario.items)) {
    const itemConfidence = clamp(
      0.3 * Number(item.fecha.trim().length > 0) +
      0.2 * Number(item.formato.trim().length > 0) +
      0.2 * Number(item.CTA.trim().length > 0) +
      0.15 * Number(item.mensaje_clave.trim().length > 0) +
      0.15 *
        Number(
          item.restricciones_aplicadas.disclaimers.length > 0 ||
            item.restricciones_aplicadas.frases_prohibidas.length > 0,
        ),
    );
    const itemRisk = clamp(
      0.35 * Number(item.fecha.trim().length === 0) +
      0.25 * Number(item.CTA.trim().length === 0) +
      0.2 * Number(item.formato.trim().length === 0) +
      0.2 *
        Number(
          item.restricciones_aplicadas.disclaimers.length === 0 &&
            item.restricciones_aplicadas.frases_prohibidas.length === 0,
        ),
    );
    const itemEvidence = [
      `Canal: ${item.canal}`,
      `Fecha: ${item.fecha || "sin fecha"}`,
      `Formato: ${item.formato || "sin formato"}`,
    ];

    rows.push(
      buildScoreRow({
        agenciaId: params.agenciaId,
        empresaId: params.empresaId,
        artifactId: params.artifactId,
        scoreType: "confidence",
        entityLevel: "calendar_item",
        entityKey: item.id,
        scoreValue: itemConfidence,
        rationale: `Confianza del item ${item.id} segun completitud editorial.`,
        evidence: itemEvidence,
        metadata: { channel: item.canal, week: item.semana, formato: item.formato },
        modelUsed: params.modelUsed,
        promptVersion: params.promptVersion,
      }),
      buildScoreRow({
        agenciaId: params.agenciaId,
        empresaId: params.empresaId,
        artifactId: params.artifactId,
        scoreType: "risk",
        entityLevel: "calendar_item",
        entityKey: item.id,
        scoreValue: itemRisk,
        rationale: `Riesgo del item ${item.id} por vacios operativos o falta de guardrails.`,
        evidence: itemEvidence,
        metadata: { channel: item.canal, week: item.semana, formato: item.formato },
        modelUsed: params.modelUsed,
        promptVersion: params.promptVersion,
      }),
    );
  }

  return rows;
}

export async function replaceArtifactScores(params: {
  supabase: {
    from: (table: string) => unknown;
  };
  artifactId: string;
  rows: RagScoreInsert[];
}) {
  const table = params.supabase.from("rag_scores") as {
    delete: () => { eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }> };
    insert: (rows: RagScoreInsert[]) => PromiseLike<{ error: { message: string } | null }>;
  };

  const { error: deleteError } = await table.delete().eq("artifact_id", params.artifactId);
  if (deleteError) {
    throw new Error(`No se pudieron limpiar scores previos: ${deleteError.message}`);
  }

  if (params.rows.length === 0) return;

  const { error: insertError } = await table.insert(params.rows);
  if (insertError) {
    throw new Error(`No se pudieron guardar scores: ${insertError.message}`);
  }
}

export function pickGlobalScores(
  rows: Array<{ score_type: string; entity_level: string; score_value: number }>,
) {
  return rows.reduce((acc, row) => {
    if (row.entity_level !== "global") return acc;
    if (row.score_type in acc) return acc;
    acc[row.score_type as ScoreType] = row.score_value;
    return acc;
  }, {} as ScoreSummary);
}

export function groupEntityScores(
  rows: Array<{
    score_type: string;
    entity_level: string;
    entity_key: string | null;
    score_value: number;
  }>,
) {
  const grouped: Record<string, ScoreSummary> = {};

  for (const row of rows) {
    if (row.entity_level === "global" || !row.entity_key) continue;
    const current = grouped[row.entity_key] ?? {};
    if (row.score_type in current) {
      grouped[row.entity_key] = current;
      continue;
    }
    current[row.score_type as ScoreType] = row.score_value;
    grouped[row.entity_key] = current;
  }

  return grouped;
}
