import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BRIEF_TEXT_FIELDS, loadBriefForm } from "@/lib/brief/schema";
import { createClient } from "@/lib/supabase/server";

const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  .briefs-root * { font-family: 'Sora','Helvetica Neue',sans-serif; box-sizing:border-box; }
  .briefs-root .mono { font-family:'JetBrains Mono',monospace; }

  .bg-w2  { background-color:rgba(255,255,255,0.02); }
  .bg-w3  { background-color:rgba(255,255,255,0.03); }
  .bd7    { border-color:rgba(255,255,255,0.07); }
  .bd8    { border-color:rgba(255,255,255,0.08); }

  .grain-overlay::after {
    content:'';position:fixed;inset:0;pointer-events:none;opacity:0.025;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size:256px;z-index:9999;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .fu  { animation:fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .d1  { animation-delay:80ms; }
  .d2  { animation-delay:160ms; }
  .d3  { animation-delay:240ms; }
`;

type BriefsPageProps = {
  params: Promise<{ empresaId: string }>;
};

export default async function EmpresaBriefsPage({ params }: BriefsPageProps) {
  const { empresaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: appUser } = await supabase
    .from("app_user")
    .select("agencia_id")
    .eq("id", user.id)
    .maybeSingle();
  const agenciaId = appUser?.agencia_id ?? null;

  const [{ data: empresa }, { data: briefs }] = await Promise.all([
    supabase.from("empresa").select("id, nombre").eq("id", empresaId).eq("agencia_id", agenciaId).maybeSingle(),
    supabase
      .from("brief")
      .select("id, periodo, estado, version, contenido_json, created_at")
      .eq("empresa_id", empresaId)
      .order("periodo", { ascending: false })
      .order("version", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!empresa) notFound();

  const briefsList = briefs ?? [];

  const monthFmt = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const STATUS_CLS: Record<string, string> = {
    aprobado: "text-teal-300 bg-teal-300/10 border-teal-300/20",
    plan: "text-cyan-300 bg-cyan-300/10 border-cyan-300/20",
    borrador: "text-amber-300 bg-amber-300/10 border-amber-300/20",
    revision: "text-sky-300 bg-sky-300/10 border-sky-300/20",
  };
  const statusCls = (s: string) => STATUS_CLS[s.toLowerCase()] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div
        className="briefs-root grain-overlay min-h-screen bg-[#0c0c0f] text-white"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(16,185,129,0.08) 0%, transparent 65%)",
            "radial-gradient(ellipse 50% 40% at 100% 60%, rgba(79,70,229,0.05) 0%, transparent 55%)",
            "radial-gradient(ellipse 40% 30% at 0% 90%, rgba(20,184,166,0.06) 0%, transparent 50%)",
          ].join(", "),
        }}
      >
        <div className="mx-auto max-w-2xl px-5 pb-16 pt-10 space-y-7">
          <header className="fu space-y-4">
            <nav className="flex items-center gap-1.5 text-[11px] text-white/25">
              <Link href="/protected/empresas" className="hover:text-white/50 transition-colors">Empresas</Link>
              <span>/</span>
              <Link href={`/protected/empresas/${empresaId}`} className="hover:text-white/50 transition-colors">{empresa.nombre}</Link>
              <span>/</span>
              <span className="text-white/50">Briefs</span>
            </nav>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-white leading-none">Brief mensual</h1>
                <p className="mt-1.5 text-sm text-white/35">{empresa.nombre}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 pb-0.5">
                <Link
                  href={`/protected/empresas/${empresaId}`}
                  className="rounded-lg border bd8 bg-w3 px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
                >
                  {"<- Empresa"}
                </Link>
                <Link
                  href={`/protected/empresas/${empresaId}/plan-trabajo`}
                  className="rounded-lg border bd8 bg-w3 px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
                >
                  Planes de trabajo
                </Link>
              </div>
            </div>
          </header>

          <div className="fu d1 grid grid-cols-3 gap-2.5">
            {[
              { value: briefsList.length, label: "Briefs" },
              { value: new Set(briefsList.map((b) => b.periodo.slice(0, 7))).size, label: "Meses" },
              { value: briefsList.filter((b) => b.estado === "aprobado").length, label: "Aprobados" },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col gap-1 rounded-xl border bd7 bg-w2 px-4 py-3.5">
                <span className="text-[26px] font-bold leading-none tracking-tighter text-white">{value}</span>
                <span className="text-[11px] uppercase tracking-wider text-white/35">{label}</span>
              </div>
            ))}
          </div>

          <section className="fu d2 space-y-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.018] p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/30">
                Acciones
              </h2>
              <p className="mt-2 text-[12px] text-white/35">
                Selecciona un brief para editarlo o crea uno nuevo.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/protected/empresas/${empresaId}/briefs/new`}
                  className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition-all hover:bg-emerald-300/20"
                >
                  + Nuevo brief
                </Link>
                {briefsList.slice(0, 6).map((brief) => {
                  const periodLabel = monthFmt.format(new Date(`${brief.periodo}T00:00:00.000Z`));
                  return (
                    <Link
                      key={brief.id}
                      href={`/protected/empresas/${empresaId}/briefs/${brief.id}`}
                      className="rounded-lg border bd8 bg-w3 px-3 py-1.5 text-[11px] font-medium text-white/60 transition-all hover:text-white/85"
                    >
                      {periodLabel} · v{brief.version}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="fu d3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/30">Briefs generados</h2>
              <span className="mono text-[11px] text-white/20">{briefsList.length} briefs</span>
            </div>

            {briefsList.length > 0 ? (
              <div className="space-y-2.5">
                {briefsList.map((brief) => {
                  const periodLabel = monthFmt.format(new Date(`${brief.periodo}T00:00:00.000Z`));
                  const parsed = loadBriefForm(brief.contenido_json);
                  const selectedObjectives = Object.values(parsed.objectives).reduce(
                    (acc, group) => acc + Object.values(group).filter(Boolean).length,
                    0,
                  );
                  const filledFields = BRIEF_TEXT_FIELDS.filter((f) => parsed.fields[f]?.trim()).length;

                  return (
                    <Link
                      key={brief.id}
                      href={`/protected/empresas/${empresaId}/briefs/${brief.id}`}
                      className="block rounded-2xl border border-white/8 bg-white/[0.018] p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.025]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-white capitalize tracking-tight truncate">{periodLabel}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${statusCls(brief.estado)}`}
                            >
                              {brief.estado}
                            </span>
                            <span className="mono text-[11px] text-white/20">v{brief.version}</span>
                            <span className="text-[11px] text-white/35">{selectedObjectives} objetivos</span>
                            <span className="text-[11px] text-white/35">{filledFields}/{BRIEF_TEXT_FIELDS.length} campos</span>
                          </div>
                        </div>
                        <span className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/55">
                          Ver brief
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border bd7 bg-w2 px-6 py-12 text-center">
                <p className="text-[13px] font-medium text-white/25">Sin briefs registrados</p>
                <p className="mt-1.5 text-[11px] text-white/15 leading-relaxed">
                  Crea tu primer brief con el boton &quot;Nuevo brief&quot;.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
