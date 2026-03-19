import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BriefEditor from "@/app/protected/empresas/[empresaId]/briefs/BriefEditor";
import BriefPdfExportButton from "@/app/protected/empresas/[empresaId]/briefs/BriefPdfExportButton";
import WorkflowPanel from "@/components/aba/WorkflowPanel";
import type { BriefEvaluationContent } from "@/lib/brief/evaluation";
import { loadBriefForm } from "@/lib/brief/schema";
import { pickGlobalScores } from "@/lib/rag/scoring";
import { createClient } from "@/lib/supabase/server";
import { readWorkflow } from "@/lib/workflow";

type PageProps = {
  params: Promise<{ empresaId: string; briefId: string }>;
};

export default async function BriefDetailPage({ params }: PageProps) {
  const { empresaId, briefId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: appUser } = await supabase
    .from("app_user")
    .select("agencia_id")
    .eq("id", user.id)
    .maybeSingle();

  const agenciaId = appUser?.agencia_id ?? null;
  if (!agenciaId) {
    notFound();
  }

  const [{ data: empresa }, { data: brief }, { data: evaluation }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre")
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
      .from("rag_artifacts")
      .select("id, status, content_json, updated_at")
      .eq("artifact_type", "brief_evaluation")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .contains("inputs_json", { brief_id: briefId })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!empresa || !brief) {
    notFound();
  }

  const initialPeriodo = brief.periodo.slice(0, 7);
  const initialFormState = loadBriefForm(brief.contenido_json);
  const { data: scoreRows } = evaluation?.id
    ? await supabase
        .from("rag_scores")
        .select("score_type, entity_level, score_value, created_at")
        .eq("artifact_id", evaluation.id)
        .order("created_at", { ascending: false })
    : { data: [] as Array<{ score_type: string; entity_level: string; score_value: number }> };
  const evaluationContent = (evaluation?.content_json ?? null) as BriefEvaluationContent | null;
  const evaluationRoot = evaluationContent?.brief_evaluation ?? null;
  const evaluationScores = pickGlobalScores(scoreRows ?? []);
  const workflow = readWorkflow(evaluation?.content_json);
  const scoreLabel = (value?: number) =>
    typeof value === "number" ? `${Math.round(value * 100)}%` : "Sin score";

  return (
    <div className="min-h-screen bg-[#0c0c0f] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <nav className="flex items-center gap-1.5 text-[11px] text-white/25">
          <Link href="/protected/empresas" className="hover:text-white/50 transition-colors">
            Empresas
          </Link>
          <span>/</span>
          <Link
            href={`/protected/empresas/${empresaId}`}
            className="hover:text-white/50 transition-colors"
          >
            {empresa.nombre}
          </Link>
          <span>/</span>
          <Link
            href={`/protected/empresas/${empresaId}/briefs`}
            className="hover:text-white/50 transition-colors"
          >
            Briefs
          </Link>
          <span>/</span>
          <span className="text-white/55">Editar</span>
        </nav>

        <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
                Brief mensual
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Editar brief mensual</h1>
                <p className="mt-1 text-sm text-white/45">{empresa.nombre}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <BriefPdfExportButton
                empresaNombre={empresa.nombre}
                periodo={initialPeriodo}
                estado={brief.estado}
                version={brief.version}
                data={initialFormState}
                className="rounded-xl border border-white/10 px-3 py-2 text-white/70 transition-colors hover:text-white"
              />
              <Link
                href={`/protected/empresas/${empresaId}/briefs`}
                className="rounded-xl border border-white/10 px-3 py-2 text-white/60 transition-colors hover:text-white"
              >
                Volver a briefs
              </Link>
              <span className="rounded-xl border border-white/10 px-3 py-2 capitalize text-white/60">
                {brief.estado}
              </span>
              <span className="rounded-xl border border-white/10 px-3 py-2 text-white/60">
                v{brief.version}
              </span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">Periodo</p>
              <p className="mt-1 text-sm text-white/75">{initialPeriodo}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">Estado</p>
              <p className="mt-1 text-sm capitalize text-white/75">{brief.estado}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">Version</p>
              <p className="mt-1 text-sm text-white/75">v{brief.version}</p>
            </div>
          </div>
        </header>

        <BriefEditor
          key={`${brief.id}-${brief.version}`}
          empresaId={empresaId}
          initialPeriodo={initialPeriodo}
          initialFormState={initialFormState}
        />

        {evaluationRoot ? (
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <span className="inline-flex items-center rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-sky-200">
                    Evaluacion Brief vs BEC
                  </span>
                  <p className="max-w-3xl text-sm text-white/70">{evaluationRoot.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-xl border border-white/10 px-3 py-2 text-white/65">
                    Confianza {scoreLabel(evaluationScores.confidence || evaluationRoot.global_confidence_score)}
                  </span>
                  <span className="rounded-xl border border-white/10 px-3 py-2 text-white/65">
                    Riesgo {scoreLabel(evaluationScores.risk || evaluationRoot.global_risk_score)}
                  </span>
                  <span className="rounded-xl border border-white/10 px-3 py-2 capitalize text-white/65">
                    {evaluationRoot.status.replaceAll("_", " ")}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <EvalList
                  title="Conflictos"
                  empty="Sin conflictos detectados."
                  items={evaluationRoot.conflicts.map((item) => ({
                    title: item.description,
                    meta: `${item.severity} Â· ${item.type}`,
                    body: item.recommended_action,
                  }))}
                />
                <EvalList
                  title="Vacios"
                  empty="Sin vacios criticos."
                  items={evaluationRoot.data_gaps.map((item) => ({
                    title: item.field,
                    meta: item.impact,
                    body: item.resolution,
                  }))}
                />
                <EvalList
                  title="Oportunidades"
                  empty="Sin oportunidades adicionales."
                  items={evaluationRoot.opportunities.map((item) => ({
                    title: item.description,
                    meta: item.expected_impact,
                    body: "",
                  }))}
                />
              </div>
            </div>
            <WorkflowPanel title="Workflow del brief" workflow={workflow} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function EvalList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ title: string; meta: string; body: string }>;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">{title}</p>
      <div className="mt-3 space-y-2.5">
        {items.length === 0 ? (
          <p className="text-sm text-white/35">{empty}</p>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5"
            >
              <p className="text-sm text-white/78">{item.title}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-white/28">
                {item.meta}
              </p>
              {item.body ? <p className="mt-1.5 text-[12px] text-white/45">{item.body}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
