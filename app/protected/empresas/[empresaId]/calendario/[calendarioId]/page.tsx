import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ empresaId: string; calendarioId: string }>;
};

type JsonObj = Record<string, unknown>;

function asObj(v: unknown): JsonObj {
  return v && typeof v === "object" ? (v as JsonObj) : {};
}

export default async function CalendarioDetailPage({ params }: PageProps) {
  const { empresaId, calendarioId } = await params;
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

  const [{ data: empresa }, { data: calendario }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase
      .from("rag_artifacts")
      .select("id, title, status, version, inputs_json, content_json, updated_at")
      .eq("id", calendarioId)
      .eq("artifact_type", "calendario")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
  ]);

  if (!empresa || !calendario) {
    notFound();
  }

  const inputs = asObj(calendario.inputs_json);
  const content = asObj(calendario.content_json);
  const periodo = typeof inputs.periodo === "string" ? inputs.periodo : "";
  const resumen = typeof content.resumen === "string" ? content.resumen : "";
  const semanas = Array.isArray(content.semanas) ? content.semanas : [];

  return (
    <div className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <nav className="flex items-center gap-1.5 text-[11px] text-white/25">
          <Link href="/protected/empresas" className="hover:text-white/50 transition-colors">Empresas</Link>
          <span>/</span>
          <Link href={`/protected/empresas/${empresaId}`} className="hover:text-white/50 transition-colors">{empresa.nombre}</Link>
          <span>/</span>
          <Link href={`/protected/empresas/${empresaId}/calendario`} className="hover:text-white/50 transition-colors">Calendario</Link>
          <span>/</span>
          <span className="text-white/55">Detalle</span>
        </nav>

        <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{calendario.title || "Calendario editorial"}</h1>
              <p className="mt-1 text-sm text-white/45">{empresa.nombre}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded border border-white/10 px-2 py-1 uppercase text-white/60">{calendario.status}</span>
              <span className="rounded border border-white/10 px-2 py-1 text-white/60">v{calendario.version}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/35">Periodo: {periodo || "-"}</p>
          <p className="text-xs text-white/35">Ultima actualizacion: {new Date(calendario.updated_at).toLocaleString("es-PE")}</p>
        </header>

        {resumen ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Resumen</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{resumen}</p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Semanas y piezas</h2>
          {semanas.length ? (
            <div className="mt-3 space-y-3">
              {semanas.map((semana, idx) => {
                const s = asObj(semana);
                const piezas = Array.isArray(s.piezas) ? s.piezas : [];
                return (
                  <article key={`sem-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="text-sm font-semibold text-white/80">{typeof s.semana === "string" ? s.semana : `Semana ${idx + 1}`}</h3>
                    {typeof s.objetivo === "string" && s.objetivo.trim() ? (
                      <p className="mt-1 text-sm text-white/50">{s.objetivo}</p>
                    ) : null}

                    {piezas.length ? (
                      <div className="mt-3 space-y-2">
                        {piezas.map((pieza, pi) => {
                          const p = asObj(pieza);
                          return (
                            <div key={`p-${idx}-${pi}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                              <p className="text-sm font-medium text-white/80">{typeof p.tema === "string" ? p.tema : `Pieza ${pi + 1}`}</p>
                              <p className="mt-1 text-xs text-white/45">
                                {typeof p.fecha === "string" && p.fecha ? p.fecha : "-"}
                                {" | "}
                                {typeof p.canal === "string" && p.canal ? p.canal : "-"}
                                {" | "}
                                {typeof p.formato === "string" && p.formato ? p.formato : "-"}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                Objetivo: {typeof p.objetivo === "string" && p.objetivo ? p.objetivo : "-"}
                                {" | CTA: "}
                                {typeof p.cta === "string" && p.cta ? p.cta : "-"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-white/40">Sin piezas en esta semana.</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/40">Este calendario no tiene semanas cargadas.</p>
          )}
        </section>
      </div>
    </div>
  );
}
