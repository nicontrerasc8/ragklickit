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
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function scoreLabel(value) {
  if (value >= 0.75) return "high";
  if (value >= 0.4) return "medium";
  return "low";
}

function normalizeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function buildBecScores(bec) {
  const content = normalizeObject(bec.contenido_json);
  const fields = normalizeObject(content.fields);
  const pilares = Array.isArray(content.pilares) ? content.pilares : [];
  const fieldEntries = Object.entries(fields).filter(([, value]) => typeof value === "string");
  const filledFields = fieldEntries.filter(([, value]) => value.trim().length > 0).length;
  const totalFields = fieldEntries.length;
  const pillarsFilled = pilares.filter((row) => {
    const item = normalizeObject(row);
    return String(item.pilar ?? "").trim() || String(item.porcentaje ?? "").trim() || String(item.canales ?? "").trim() || String(item.formatos ?? "").trim();
  }).length;
  const scopeReady = Number(
    String(fields["Alcance General"] ?? "").trim().length > 0 &&
      String(fields["Entregables Mensuales"] ?? "").trim().length > 0,
  );
  const kpiReady = Number(
    String(fields["KPI Primario"] ?? "").trim().length > 0 ||
      String(fields["KPI Secundario"] ?? "").trim().length > 0 ||
      String(fields["Métrica de Éxito / ROI Esperado"] ?? "").trim().length > 0 ||
      String(fields["MÃ©trica de Ã‰xito / ROI Esperado"] ?? "").trim().length > 0,
  );
  const complianceReady = Number(
    String(fields["Restricciones Legales"] ?? "").trim().length > 0 ||
      String(fields["Frases Prohibidas / No-Go Topics"] ?? "").trim().length > 0,
  );

  const completeness = clamp(filledFields / Math.max(totalFields, 1));
  const pillarCoverage = clamp(pillarsFilled / Math.max(pilares.length || 1, 1));
  const icpReady = Number(String(fields["ICP Principal (Ideal Customer Profile)"] ?? "").trim().length > 0);
  const valuePropReady = Number(String(fields["Propuesta de Valor"] ?? "").trim().length > 0);
  const opsReady = Number(
    String(fields["Dependencias Operativas"] ?? "").trim().length > 0 ||
      String(fields["KAM"] ?? "").trim().length > 0,
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
    `${pillarsFilled}/${pilares.length} pilares con contenido`,
    scopeReady ? "Alcance definido" : "Alcance incompleto",
    kpiReady ? "KPIs definidos" : "KPIs incompletos",
  ];

  return [
    {
      agencia_id: bec.agencia_id,
      empresa_id: bec.empresa_id,
      bec_id: bec.id,
      score_type: "data_quality",
      entity_level: "global",
      entity_key: null,
      score_value: Number(clamp(dataQuality).toFixed(4)),
      score_label: scoreLabel(dataQuality),
      rationale: "Calidad estructural del BEC.",
      evidence_json: evidence,
      metadata_json: { filledFields, totalFields, pillarsFilled, completeness, pillarCoverage, scopeReady, kpiReady, complianceReady },
      model_used: null,
      prompt_version: "bec_scoring_v1",
    },
    {
      agencia_id: bec.agencia_id,
      empresa_id: bec.empresa_id,
      bec_id: bec.id,
      score_type: "confidence",
      entity_level: "global",
      entity_key: null,
      score_value: Number(clamp(confidence).toFixed(4)),
      score_label: scoreLabel(confidence),
      rationale: "Confianza de uso del BEC.",
      evidence_json: evidence,
      metadata_json: { filledFields, totalFields, pillarsFilled, completeness, pillarCoverage, scopeReady, kpiReady, complianceReady, icpReady, valuePropReady, opsReady },
      model_used: null,
      prompt_version: "bec_scoring_v1",
    },
    {
      agencia_id: bec.agencia_id,
      empresa_id: bec.empresa_id,
      bec_id: bec.id,
      score_type: "risk",
      entity_level: "global",
      entity_key: null,
      score_value: Number(clamp(risk).toFixed(4)),
      score_label: scoreLabel(risk),
      rationale: "Riesgo operativo del BEC.",
      evidence_json: evidence,
      metadata_json: { filledFields, totalFields, pillarsFilled, completeness, pillarCoverage, scopeReady, kpiReady, complianceReady, icpReady, valuePropReady, opsReady },
      model_used: null,
      prompt_version: "bec_scoring_v1",
    },
  ];
}

async function main() {
  const { data: becs, error } = await supabase
    .from("bec")
    .select("id, empresa_id, contenido_json, empresa!inner(agencia_id)")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`No se pudieron leer BECs: ${error.message}`);
  }

  for (const raw of becs ?? []) {
    const bec = {
      id: raw.id,
      empresa_id: raw.empresa_id,
      contenido_json: raw.contenido_json,
      agencia_id: raw.empresa.agencia_id,
    };

    const { error: deleteError } = await supabase.from("rag_scores").delete().eq("bec_id", bec.id);
    if (deleteError) {
      throw new Error(`No se pudieron borrar scores de ${bec.id}: ${deleteError.message}`);
    }

    const rows = buildBecScores(bec);
    const { error: insertError } = await supabase.from("rag_scores").insert(rows);
    if (insertError) {
      throw new Error(`No se pudieron insertar scores de ${bec.id}: ${insertError.message}`);
    }

    console.log(`OK bec ${bec.id} -> ${rows.length} scores`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
