import { loadBECState } from "@/lib/bec/schema";

export type BecScoreInsert = {
  agencia_id: string;
  empresa_id: string;
  bec_id: string;
  score_type: "confidence" | "data_quality" | "risk";
  entity_level: "global";
  entity_key: null;
  score_value: number;
  score_label: string;
  rationale: string;
  evidence_json: string[];
  metadata_json: Record<string, unknown>;
  model_used?: string | null;
  prompt_version?: string | null;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function scoreLabel(value: number) {
  if (value >= 0.75) return "high";
  if (value >= 0.4) return "medium";
  return "low";
}

export function buildBecScores(params: {
  agenciaId: string;
  empresaId: string;
  becId: string;
  content: unknown;
}) {
  const bec = loadBECState(params.content);
  const fieldEntries = Object.entries(bec.fields);
  const filledFields = fieldEntries.filter(([, value]) => value.trim().length > 0).length;
  const totalFields = fieldEntries.length;
  const pillarsFilled = bec.pilares.filter(
    (row) => row.pilar.trim() || row.porcentaje.trim() || row.canales.trim() || row.formatos.trim(),
  ).length;

  const scopeReady = Number(
    bec.fields["Alcance General"].trim().length > 0 &&
      bec.fields["Entregables Mensuales"].trim().length > 0,
  );
  const kpiReady = Number(
    bec.fields["KPI Primario"].trim().length > 0 ||
      bec.fields["KPI Secundario"].trim().length > 0 ||
      bec.fields["Métrica de Éxito / ROI Esperado"].trim().length > 0,
  );
  const complianceReady = Number(
    bec.fields["Restricciones Legales"].trim().length > 0 ||
      bec.fields["Frases Prohibidas / No-Go Topics"].trim().length > 0,
  );

  const completeness = clamp(filledFields / Math.max(totalFields, 1));
  const pillarCoverage = clamp(pillarsFilled / Math.max(bec.pilares.length, 1));
  const icpReady = Number(bec.fields["ICP Principal (Ideal Customer Profile)"].trim().length > 0);
  const valuePropReady = Number(bec.fields["Propuesta de Valor"].trim().length > 0);
  const opsReady = Number(
    bec.fields["Dependencias Operativas"].trim().length > 0 || bec.fields["KAM"].trim().length > 0,
  );

  const rawDataQuality =
    0.4 * completeness +
    0.15 * pillarCoverage +
    0.15 * scopeReady +
    0.15 * kpiReady +
    0.15 * complianceReady;
  const dataQuality = clamp(0.18 + rawDataQuality * 0.72, 0.18, 0.9);

  const rawConfidence =
    0.3 * dataQuality +
    0.15 * icpReady +
    0.15 * valuePropReady +
    0.15 * scopeReady +
    0.15 * kpiReady +
    0.1 * opsReady;
  const confidence = clamp(0.12 + rawConfidence * 0.74, 0.12, 0.88);

  const rawRisk =
    0.28 * Number(!scopeReady) +
    0.24 * Number(!kpiReady) +
    0.16 * Number(!complianceReady) +
    0.12 * Number(pillarsFilled === 0) +
    0.1 * Number(!icpReady) +
    0.1 * Number(!valuePropReady);
  const risk = clamp(0.08 + rawRisk * 0.72, 0.08, 0.92);

  const evidence = [
    `${filledFields}/${totalFields} campos completos`,
    `${pillarsFilled}/${bec.pilares.length} pilares con contenido`,
    scopeReady ? "Alcance definido" : "Alcance incompleto",
    kpiReady ? "KPIs definidos" : "KPIs incompletos",
  ];

  return [
    {
      agencia_id: params.agenciaId,
      empresa_id: params.empresaId,
      bec_id: params.becId,
      score_type: "data_quality",
      entity_level: "global",
      entity_key: null,
      score_value: Number(clamp(dataQuality).toFixed(4)),
      score_label: scoreLabel(dataQuality),
      rationale: "Calidad estructural del BEC según completitud, alcance, pilares y KPIs.",
      evidence_json: evidence,
      metadata_json: {
        filledFields,
        totalFields,
        pillarsFilled,
        completeness,
        pillarCoverage,
        scopeReady,
        kpiReady,
        complianceReady,
      },
      model_used: null,
      prompt_version: "bec_scoring_v1",
    } satisfies BecScoreInsert,
    {
      agencia_id: params.agenciaId,
      empresa_id: params.empresaId,
      bec_id: params.becId,
      score_type: "confidence",
      entity_level: "global",
      entity_key: null,
      score_value: Number(clamp(confidence).toFixed(4)),
      score_label: scoreLabel(confidence),
      rationale: "Confianza de uso del BEC como fuente de verdad operativa.",
      evidence_json: evidence,
      metadata_json: {
        filledFields,
        totalFields,
        pillarsFilled,
        completeness,
        pillarCoverage,
        scopeReady,
        kpiReady,
        complianceReady,
        icpReady,
        valuePropReady,
        opsReady,
      },
      model_used: null,
      prompt_version: "bec_scoring_v1",
    } satisfies BecScoreInsert,
    {
      agencia_id: params.agenciaId,
      empresa_id: params.empresaId,
      bec_id: params.becId,
      score_type: "risk",
      entity_level: "global",
      entity_key: null,
      score_value: Number(clamp(risk).toFixed(4)),
      score_label: scoreLabel(risk),
      rationale: "Riesgo operativo del BEC si faltan alcance, KPIs, compliance o pilares.",
      evidence_json: evidence,
      metadata_json: {
        filledFields,
        totalFields,
        pillarsFilled,
        completeness,
        pillarCoverage,
        scopeReady,
        kpiReady,
        complianceReady,
        icpReady,
        valuePropReady,
        opsReady,
      },
      model_used: null,
      prompt_version: "bec_scoring_v1",
    } satisfies BecScoreInsert,
  ];
}

export async function replaceBecScores(params: {
  supabase: {
    from: (table: string) => unknown;
  };
  becId: string;
  rows: BecScoreInsert[];
}) {
  const table = params.supabase.from("rag_scores") as {
    delete: () => { eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }> };
    insert: (rows: BecScoreInsert[]) => PromiseLike<{ error: { message: string } | null }>;
  };

  const { error: deleteError } = await table.delete().eq("bec_id", params.becId);
  if (deleteError) {
    throw new Error(`No se pudieron limpiar scores del BEC: ${deleteError.message}`);
  }

  const { error: insertError } = await table.insert(params.rows);
  if (insertError) {
    throw new Error(`No se pudieron guardar scores del BEC: ${insertError.message}`);
  }
}
