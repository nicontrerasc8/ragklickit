import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BriefEditor from "@/app/protected/empresas/[empresaId]/briefs/BriefEditor";
import { loadBriefForm } from "@/lib/brief/schema";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: empresa }, { data: brief }] = await Promise.all([
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
  ]);

  if (!empresa || !brief) {
    notFound();
  }

  const initialPeriodo = brief.periodo.slice(0, 7);
  const initialFormState = loadBriefForm(brief.contenido_json);
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
          initialEstado={brief.estado}
          initialFormState={initialFormState}
        />

        {/* {evaluationRoot ? (
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
        ) : null} */}
      </div>
    </div>
  );
}
