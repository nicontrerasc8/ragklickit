import { loadBECState } from "@/lib/bec/schema";
import { BRIEF_OBJECTIVE_GROUPS, BRIEF_TEXT_FIELDS, loadBriefForm } from "@/lib/brief/schema";
import type { RagScoreInsert } from "@/lib/rag/scoring";

type Severity = "low" | "medium" | "high";
type EvalStatus = "valid" | "valid_with_warnings" | "blocked";

export type BriefEvaluationContent = {
  brief_evaluation: {
    brief_id: string;
    bec_version: number | null;
    status: EvalStatus;
    summary: string;
    conflicts: Array<{
      conflict_id: string;
      type: string;
      severity: Severity;
      description: string;
      evidence: string[];
      recommended_action: string;
    }>;
    opportunities: Array<{
      opportunity_id: string;
      description: string;
      expected_impact: "low" | "medium" | "high";
    }>;
    data_gaps: Array<{
      field: string;
      impact: Severity;
      resolution: string;
    }>;
    assumptions: string[];
    global_risk_score: number;
    global_confidence_score: number;
    requires_human_review: boolean;
  };
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
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

function includesAny(haystack: string, needles: string[]) {
  const normalized = haystack.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function hasExplicitPendingValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("pendiente de validar") ||
    normalized.includes("pendiente por validar") ||
    normalized.includes("por confirmar con cliente") ||
    normalized.includes("por definir con cliente")
  );
}

function isAvoidanceContext(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("evitar") ||
    normalized.includes("no usar") ||
    normalized.includes("prohibid") ||
    normalized.includes("no decir") ||
    normalized.includes("no incluir")
  );
}

function selectedObjectives(brief: ReturnType<typeof loadBriefForm>) {
  return BRIEF_OBJECTIVE_GROUPS.flatMap((group) =>
    group.options.filter((option) => brief.objectives[group.id]?.[option]),
  );
}

export function buildBriefEvaluation(params: {
  briefId: string;
  briefContent: unknown;
  becContent: unknown;
  becVersion?: number | null;
}) {
  const brief = loadBriefForm(params.briefContent);
  const bec = loadBECState(params.becContent);
  const conflicts: BriefEvaluationContent["brief_evaluation"]["conflicts"] = [];
  const opportunities: BriefEvaluationContent["brief_evaluation"]["opportunities"] = [];
  const dataGaps: BriefEvaluationContent["brief_evaluation"]["data_gaps"] = [];
  const assumptions: string[] = [];

  const objectives = selectedObjectives(brief);
  const filledFields = BRIEF_TEXT_FIELDS.filter((field) => brief.fields[field]?.trim()).length;
  const mediaBudgetField =
    brief.fields["3. Pauta y Presupuesto - Presupuesto total de pauta asignado para este mes (Monto en USD)"] ??
    "";
  const distributionField = brief.fields["Distribucion de la inversion (por canal o campana)"] ?? "";
  const sensitiveField = brief.fields["Hay algun mensaje sensible o tema que debamos evitar este mes?"] ?? "";
  const dependenciesField =
    brief.fields["Existen dependencias internas o de cliente que puedan afectar los tiempos de publicacion?"] ??
    "";
  const launchesField =
    brief.fields["Hay algun lanzamiento, campana o promocion que debamos incluir? (Incluir fechas especificas)"] ??
    "";
  const prioritiesField = brief.fields["Productos, servicios o lineas que tienen prioridad este mes"] ?? "";
  const scopeField = `${bec.fields["Alcance General"]} ${bec.fields["Entregables Mensuales"]}`.toLowerCase();
  const outOfScopeField = bec.fields["Fuera de Alcance"].toLowerCase();
  const kpiContext = `${bec.fields["KPI Primario"]} ${bec.fields["KPI Secundario"]} ${bec.fields["Métrica de Éxito / ROI Esperado"]}`;
  const ctaContext = bec.fields["CTA Recomendadas"];

  if (filledFields < Math.ceil(BRIEF_TEXT_FIELDS.length * 0.6)) {
    dataGaps.push({
      field: "brief_fields",
      impact: "high",
      resolution: "Completar preguntas clave del brief antes de operarlo.",
    });
  }

  if (hasExplicitPendingValue(mediaBudgetField)) {
    dataGaps.push({
      field: "media_budget",
      impact: "high",
      resolution: "Definir presupuesto de pauta mensual para validar viabilidad.",
    });
  }

  if (!hasExplicitPendingValue(mediaBudgetField) && hasExplicitPendingValue(distributionField)) {
    dataGaps.push({
      field: "budget_distribution",
      impact: "medium",
      resolution: "Aclarar distribucion de inversion por canal o campaña.",
    });
  }

  if (hasExplicitPendingValue(prioritiesField)) {
    dataGaps.push({
      field: "priorities",
      impact: "medium",
      resolution: "Declarar productos o lineas prioritarias del mes.",
    });
  }

  if (!kpiContext.trim()) {
    dataGaps.push({
      field: "bec_kpis",
      impact: "high",
      resolution: "Completar KPIs del BEC para vincular el brief a resultados medibles.",
    });
  }

  const riskyKeywords = ["garantizado", "garantizar", "sin riesgo", "inmediato", "asegurado"];
  const riskyClaimsInDemand = includesAny(`${launchesField} ${prioritiesField}`, riskyKeywords);
  const riskyClaimsInSensitiveField = includesAny(sensitiveField, riskyKeywords) && !isAvoidanceContext(sensitiveField);
  if (riskyClaimsInDemand || riskyClaimsInSensitiveField) {
    conflicts.push({
      conflict_id: "legal-risk",
      type: "legal_or_brand_risk",
      severity: "high",
      description: "El brief contiene mensajes o claims potencialmente sensibles para marca o compliance.",
      evidence: [sensitiveField || "No se declararon temas sensibles", bec.fields["Restricciones Legales"] || "Sin restricciones legales declaradas"],
      recommended_action: "Revisar claims y dejar version aprobable antes de generar contenido sensible.",
    });
  }

  const outOfScopeKeywords = outOfScopeField
    .split(/[,\n;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (outOfScopeKeywords.length > 0 && includesAny(`${launchesField} ${prioritiesField} ${distributionField}`.toLowerCase(), outOfScopeKeywords)) {
    conflicts.push({
      conflict_id: "scope-conflict",
      type: "scope_conflict",
      severity: "high",
      description: "El brief pide acciones que parecen caer fuera del alcance declarado en el BEC.",
      evidence: [bec.fields["Fuera de Alcance"] || "Sin fuera de alcance definido", launchesField || prioritiesField || distributionField],
      recommended_action: "Reducir el pedido a entregables dentro de alcance o escalar ajuste comercial.",
    });
  }

  if (scopeField && objectives.some((objective) => includesAny(objective.toLowerCase(), ["lead ads", "remarketing", "conversion"])) && !includesAny(scopeField, ["pauta", "ads", "media", "campana"])) {
    conflicts.push({
      conflict_id: "paid-media-mismatch",
      type: "capability_mismatch",
      severity: "medium",
      description: "El brief prioriza performance pagada sin evidencia clara de que pauta este incluida en alcance.",
      evidence: [objectives.join(", ") || "Sin objetivos seleccionados", bec.fields["Alcance General"] || "Sin alcance general"],
      recommended_action: "Confirmar si pauta o performance estan cubiertos antes de armar el plan operativo.",
    });
  }

  if (brief.strategicChanges === "si") {
    opportunities.push({
      opportunity_id: "strategic-refresh",
      description: "El brief declara cambios estrategicos; conviene revisar BEC y ajustar el plan con esa nueva realidad.",
      expected_impact: "high",
    });
  }

  if (ctaContext.trim() && !includesAny(`${launchesField} ${prioritiesField}`.toLowerCase(), ctaContext.toLowerCase().split(/[,\n;]+/).map((value) => value.trim()).filter(Boolean))) {
    opportunities.push({
      opportunity_id: "cta-alignment",
      description: "Se puede alinear el brief con los CTA recomendados del BEC para mejorar coherencia comercial.",
      expected_impact: "medium",
    });
  }

  if (dependenciesField.trim()) {
    assumptions.push("La ejecucion del mes depende de aprobaciones o insumos externos declarados por el KAM.");
  }
  if (!sensitiveField.trim()) {
    assumptions.push("Se asume que no hay mensajes sensibles adicionales fuera de los declarados en el BEC.");
  }

  const confidence =
    0.35 * clamp(filledFields / BRIEF_TEXT_FIELDS.length) +
    0.2 * Number(objectives.length > 0) +
    0.15 * Number(mediaBudgetField.trim().length > 0) +
    0.15 * Number(prioritiesField.trim().length > 0) +
    0.15 * Number(kpiContext.trim().length > 0);
  const risk =
    0.35 * clamp(conflicts.filter((item) => item.severity === "high").length / 2) +
    0.25 * clamp(dataGaps.filter((item) => item.impact === "high").length / 3) +
    0.2 * Number(brief.strategicChanges === "si") +
    0.2 * Number(dependenciesField.trim().length > 0);

  const status: EvalStatus =
    conflicts.some((item) => item.severity === "high") || dataGaps.some((item) => item.impact === "high")
      ? "blocked"
      : conflicts.length > 0 || dataGaps.length > 0
        ? "valid_with_warnings"
        : "valid";

  const summary =
    status === "valid"
      ? "El brief es consistente con el BEC y tiene señal suficiente para planificar."
      : status === "valid_with_warnings"
        ? "El brief es utilizable, pero requiere revisar advertencias antes de ejecutarlo."
        : "El brief tiene bloqueos o vacios que deben resolverse antes de convertirlo en plan operativo.";

  return {
    brief_evaluation: {
      brief_id: params.briefId,
      bec_version: params.becVersion ?? null,
      status,
      summary,
      conflicts,
      opportunities,
      data_gaps: dataGaps,
      assumptions,
      global_risk_score: Number(clamp(risk).toFixed(4)),
      global_confidence_score: Number(clamp(confidence).toFixed(4)),
      requires_human_review: status !== "valid" || confidence < 0.75 || risk >= 0.4,
    },
  } satisfies BriefEvaluationContent;
}

export function buildBriefEvaluationArtifactScores(params: {
  agenciaId: string;
  empresaId: string;
  artifactId: string;
  content: BriefEvaluationContent;
}) {
  const evaluation = params.content.brief_evaluation;
  const conflictCount = evaluation.conflicts.length;
  const dataGapCount = evaluation.data_gaps.length;
  const opportunityCount = evaluation.opportunities.length;
  const confidence = clamp(evaluation.global_confidence_score);
  const risk = clamp(evaluation.global_risk_score);
  const impact = clamp(0.45 * Number(opportunityCount > 0) + 0.35 * Number(conflictCount === 0) + 0.2 * Number(dataGapCount < 2));
  const effort = clamp(0.5 * Number(dataGapCount > 0) + 0.3 * Number(conflictCount > 0) + 0.2 * Number(evaluation.requires_human_review));
  const successProbability = clamp(0.5 * confidence + 0.3 * impact + 0.2 * (1 - risk));
  const priority = clamp((impact * successProbability * confidence * (1 - risk)) / Math.max(effort, 0.1));
  const evidence = [
    `${conflictCount} conflictos detectados`,
    `${dataGapCount} vacios de informacion`,
    `${opportunityCount} oportunidades sugeridas`,
  ];

  return [
    {
      agencia_id: params.agenciaId,
      empresa_id: params.empresaId,
      artifact_id: params.artifactId,
      score_type: "confidence",
      entity_level: "global",
      entity_key: null,
      score_value: Number(confidence.toFixed(4)),
      score_label: confidence >= 0.75 ? "high" : confidence >= 0.4 ? "medium" : "low",
      rationale: "Confianza global de la evaluacion del brief respecto al BEC.",
      evidence_json: evidence,
      metadata_json: { status: evaluation.status, requires_human_review: evaluation.requires_human_review },
      model_used: null,
      prompt_version: "brief_evaluation_v1",
    } satisfies RagScoreInsert,
    {
      agencia_id: params.agenciaId,
      empresa_id: params.empresaId,
      artifact_id: params.artifactId,
      score_type: "risk",
      entity_level: "global",
      entity_key: null,
      score_value: Number(risk.toFixed(4)),
      score_label: risk >= 0.75 ? "high" : risk >= 0.4 ? "medium" : "low",
      rationale: "Riesgo global del brief por conflictos, vacios o dependencias.",
      evidence_json: evidence,
      metadata_json: { status: evaluation.status, requires_human_review: evaluation.requires_human_review },
      model_used: null,
      prompt_version: "brief_evaluation_v1",
    } satisfies RagScoreInsert,
    {
      agencia_id: params.agenciaId,
      empresa_id: params.empresaId,
      artifact_id: params.artifactId,
      score_type: "impact",
      entity_level: "global",
      entity_key: null,
      score_value: Number(impact.toFixed(4)),
      score_label: impact >= 0.75 ? "high" : impact >= 0.4 ? "medium" : "low",
      rationale: "Impacto esperado de resolver la evaluacion y convertirla en plan.",
      evidence_json: evidence,
      metadata_json: { opportunityCount },
      model_used: null,
      prompt_version: "brief_evaluation_v1",
    } satisfies RagScoreInsert,
    {
      agencia_id: params.agenciaId,
      empresa_id: params.empresaId,
      artifact_id: params.artifactId,
      score_type: "priority",
      entity_level: "global",
      entity_key: null,
      score_value: Number(priority.toFixed(4)),
      score_label: priority >= 0.75 ? "high" : priority >= 0.4 ? "medium" : "low",
      rationale: "Prioridad de atencion del brief antes de planificar.",
      evidence_json: evidence,
      metadata_json: { conflictCount, dataGapCount },
      model_used: null,
      prompt_version: "brief_evaluation_v1",
    } satisfies RagScoreInsert,
  ];
}

export function briefEvaluationArtifactTitle(periodo: string) {
  return `Evaluacion brief ${periodo}`;
}

export function briefEvaluationSummaryKey(periodo: string) {
  return slugify(periodo);
}
