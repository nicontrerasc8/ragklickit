import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PlanPdfExportButton from "@/app/protected/empresas/[empresaId]/plan-trabajo/PlanPdfExportButton";
import { createClient } from "@/lib/supabase/server";
import PlanTrabajoEditor from "@/app/protected/empresas/[empresaId]/plan-trabajo/PlanTrabajoEditor";

type PageProps = {
  params: Promise<{ empresaId: string; planId: string }>;
};

export default async function PlanTrabajoDetailPage({ params }: PageProps) {
  const { empresaId, planId } = await params;
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

  const [{ data: empresa }, { data: plan }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase
      .from("rag_artifacts")
      .select("id, title, status, version, content_json, updated_at")
      .eq("id", planId)
      .eq("artifact_type", "plan_trabajo")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
  ]);

  if (!empresa || !plan) {
    notFound();
  }

  const updatedLabel = new Date(plan.updated_at).toLocaleString("es-PE");

  return (
    <div
      className="min-h-screen bg-[#0c0c0f] px-5 py-10 text-white"
      style={{
        backgroundImage: [
          "radial-gradient(ellipse 85% 55% at 50% -15%, rgba(139,92,246,0.16) 0%, transparent 70%)",
          "radial-gradient(ellipse 50% 45% at 100% 70%, rgba(79,70,229,0.12) 0%, transparent 65%)",
          "radial-gradient(ellipse 40% 30% at 0% 100%, rgba(56,189,248,0.08) 0%, transparent 60%)",
        ].join(", "),
      }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/25 sm:p-7">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.18),transparent_58%)] xl:block" />
          <nav className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/30">
            <Link href="/protected/empresas" className="hover:text-white/65 transition-colors">
              Empresas
            </Link>
            <span>/</span>
            <Link
              href={`/protected/empresas/${empresaId}`}
              className="hover:text-white/65 transition-colors"
            >
              {empresa.nombre}
            </Link>
            <span>/</span>
            <Link
              href={`/protected/empresas/${empresaId}/plan-trabajo`}
              className="hover:text-white/65 transition-colors"
            >
              Plan de trabajo
            </Link>
            <span>/</span>
            <span className="text-white/60">Editar</span>
          </nav>

          <div className="relative mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div className="space-y-4">
              <span className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                Editor de plan
              </span>
              <div className="space-y-2">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  {plan.title || "Plan de trabajo"}
                </h1>
                <p className="text-sm text-white/50 sm:text-base">{empresa.nombre}</p>
                <p className="max-w-2xl text-sm leading-6 text-white/38">
                  Ajusta el plan mensual, distribuye contenidos y define lineamientos operativos desde un solo workspace.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Acciones del documento
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <PlanPdfExportButton
                  empresaNombre={empresa.nombre}
                  title={plan.title || "Plan de trabajo"}
                  estado={plan.status}
                  version={plan.version}
                  updatedLabel={updatedLabel}
                  data={plan.content_json}
                  className="rounded-xl border border-violet-300/35 bg-violet-300/10 px-3 py-2 font-medium text-violet-100 transition-colors hover:bg-violet-300/20"
                />
                <Link
                  href={`/protected/empresas/${empresaId}/plan-trabajo`}
                  className="rounded-xl border border-white/10 px-3 py-2 text-white/65 transition-colors hover:text-white"
                >
                  Volver a planes
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-white/10 px-3 py-2 text-xs uppercase text-white/65">
                  {plan.status}
                </span>
                <span className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65">
                  v{plan.version}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Tipo" value="Plan de trabajo" />
            <MetricCard label="Estado" value={plan.status} capitalize />
            <MetricCard label="Ultima actualizacion" value={updatedLabel} />
            <MetricCard label="Artefacto" value="RAG editable" />
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-black/20 p-4 shadow-2xl shadow-black/20 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 border-b border-white/8 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Workspace del plan
              </p>
              <p className="mt-1 text-sm text-white/45">
                Edita estructura, distribucion de contenidos y lineamientos operativos del mes.
              </p>
            </div>
          </div>
          <PlanTrabajoEditor
            empresaId={empresaId}
            planId={plan.id}
            initialTitle={plan.title || "Plan de trabajo"}
            initialStatus={plan.status || "plan"}
            initialContent={plan.content_json}
          />
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1.5 text-sm font-medium text-white/85 ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
    </div>
  );
}
