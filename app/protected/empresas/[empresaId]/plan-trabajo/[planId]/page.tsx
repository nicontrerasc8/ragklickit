import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ empresaId: string; planId: string }>;
};

type JsonObj = Record<string, unknown>;

function asObj(v: unknown): JsonObj {
  return v && typeof v === "object" ? (v as JsonObj) : {};
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

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
      .select("id, title, status, version, content_json, inputs_json, updated_at")
      .eq("id", planId)
      .eq("artifact_type", "plan_trabajo")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
  ]);

  if (!empresa || !plan) {
    notFound();
  }

  const content = asObj(plan.content_json);
  const resumen = typeof content.resumen_ejecutivo === "string" ? content.resumen_ejecutivo : "";
  const objetivos = asStringArray(content.objetivos_del_mes);
  const workstreams = Array.isArray(content.workstreams) ? content.workstreams : [];

  return (
    <div className="min-h-screen bg-[#0c0c0f] px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <nav className="flex items-center gap-1.5 text-[11px] text-white/25">
          <Link href="/protected/empresas" className="hover:text-white/50 transition-colors">Empresas</Link>
          <span>/</span>
          <Link href={`/protected/empresas/${empresaId}`} className="hover:text-white/50 transition-colors">{empresa.nombre}</Link>
          <span>/</span>
          <Link href={`/protected/empresas/${empresaId}/plan-trabajo`} className="hover:text-white/50 transition-colors">Plan de trabajo</Link>
          <span>/</span>
          <span className="text-white/55">Detalle</span>
        </nav>

        <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{plan.title || "Plan de trabajo"}</h1>
              <p className="mt-1 text-sm text-white/45">{empresa.nombre}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded border border-white/10 px-2 py-1 uppercase text-white/60">{plan.status}</span>
              <span className="rounded border border-white/10 px-2 py-1 text-white/60">v{plan.version}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/35">
            Ultima actualizacion: {new Date(plan.updated_at).toLocaleString("es-PE")}
          </p>
        </header>

        {resumen ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Resumen ejecutivo</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{resumen}</p>
          </section>
        ) : null}

        {objetivos.length ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Objetivos del mes</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-white/75">
              {objetivos.map((obj, idx) => (
                <li key={`obj-${idx}`} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400" />
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Workstreams</h2>
          {workstreams.length ? (
            <div className="mt-3 space-y-3">
              {workstreams.map((ws, idx) => {
                const w = asObj(ws);
                const tareas = Array.isArray(w.tareas) ? w.tareas : [];
                const entregables = Array.isArray(w.entregables) ? w.entregables : [];
                return (
                  <article key={`ws-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="text-sm font-semibold text-white/80">{typeof w.nombre === "string" ? w.nombre : `Workstream ${idx + 1}`}</h3>
                    {typeof w.objetivo === "string" && w.objetivo.trim() ? (
                      <p className="mt-1 text-sm text-white/50">{w.objetivo}</p>
                    ) : null}
                    {entregables.length ? (
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-wider text-white/40">Entregables</p>
                        <ul className="mt-1 space-y-1 text-sm text-white/70">
                          {entregables.map((it, i) => (
                            <li key={`ent-${idx}-${i}`}>- {typeof it === "string" ? it : JSON.stringify(it)}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {tareas.length ? (
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-wider text-white/40">Tareas</p>
                        <ul className="mt-1 space-y-1 text-sm text-white/70">
                          {tareas.map((tk, i) => {
                            const t = asObj(tk);
                            const nombre = typeof t.tarea === "string" ? t.tarea : `Tarea ${i + 1}`;
                            const semana = typeof t.semana === "string" ? t.semana : "";
                            const responsable = typeof t.responsable === "string" ? t.responsable : "";
                            return (
                              <li key={`task-${idx}-${i}`}>
                                - {nombre}
                                {semana ? ` | ${semana}` : ""}
                                {responsable ? ` | ${responsable}` : ""}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/40">Este plan no tiene workstreams.</p>
          )}
        </section>
      </div>
    </div>
  );
}
