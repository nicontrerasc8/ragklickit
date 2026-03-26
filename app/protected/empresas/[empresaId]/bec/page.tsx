  import Link from "next/link";
  import { unstable_noStore as noStore } from "next/cache";
  import { notFound, redirect } from "next/navigation";

  import { updateBecApproval } from "@/app/protected/actions";
  import BecEditor from "@/app/protected/empresas/[empresaId]/bec/BecEditor";
  import {
    CompanyForm,
    DEFAULT_COMPANY,
    deriveMonthlyDeliverablesFromMetadata,
    loadBECState,
  } from "@/lib/bec/schema";
  import { pickGlobalScores } from "@/lib/rag/scoring";
  import { createClient } from "@/lib/supabase/server";

  const PAGE_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    .bec-root * { font-family:'Sora','Helvetica Neue',sans-serif; box-sizing:border-box; }
    .bec-root .mono { font-family:'JetBrains Mono',monospace; }

    .bg-w2  { background-color:rgba(255,255,255,0.02); }
    .bg-w3  { background-color:rgba(255,255,255,0.03); }
    .bg-w8  { background-color:rgba(255,255,255,0.08); }
    .bd7    { border-color:rgba(255,255,255,0.07); }
    .bd8    { border-color:rgba(255,255,255,0.08); }

    .grain-overlay::after {
      content:'';position:fixed;inset:0;pointer-events:none;opacity:0.025;
      background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size:256px;z-index:9999;
    }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .fu { animation:fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
    .d2 { animation-delay:160ms; }
  `;

  type BecPageProps = {
    params: Promise<{ empresaId: string }>;
  };

  export default async function EmpresaBecPage({ params }: BecPageProps) {
    noStore();
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

    const [{ data: empresa }, { data: bec }] = await Promise.all([
      supabase
        .from("empresa")
        .select("id, nombre, industria, pais, metadata_json")
        .eq("id", empresaId)
        .eq("agencia_id", agenciaId)
        .maybeSingle(),
      supabase
        .from("bec")
        .select("id, version, contenido_json, updated_at, is_locked")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
    ]);

    if (!empresa) notFound();

    const metadata =
      empresa.metadata_json && typeof empresa.metadata_json === "object"
        ? (empresa.metadata_json as Record<string, unknown>)
        : {};

    const companyInitial: CompanyForm = {
      ...DEFAULT_COMPANY,
      negocio: empresa.nombre ?? "",
      marca:
        typeof metadata.marca === "string" && (metadata.marca as string).trim()
          ? (metadata.marca as string)
          : empresa.nombre ?? "",
      industria: empresa.industria ?? "",
      pais: empresa.pais ?? DEFAULT_COMPANY.pais,
      objetivo: typeof metadata.objetivo === "string" ? (metadata.objetivo as string) : "",
      problema: typeof metadata.problema === "string" ? (metadata.problema as string) : "",
    };
    const becInitial = loadBECState(bec?.contenido_json);
    const monthlyDeliverables = deriveMonthlyDeliverablesFromMetadata(metadata);
    if (monthlyDeliverables) {
      becInitial.fields["Entregables Mensuales"] = monthlyDeliverables;
    }
    const { data: becScoreRows } = bec?.id
      ? await supabase
          .from("rag_scores")
          .select("score_type, entity_level, score_value, created_at")
          .eq("bec_id", bec.id)
          .order("created_at", { ascending: false })
      : {
          data: [] as Array<{
            score_type: string;
            entity_level: string;
            score_value: number;
            created_at: string;
          }>,
        };
    const becScores = pickGlobalScores(becScoreRows ?? []);
    const becVersion = bec?.version ?? 0;
    const lastUpdated = bec?.updated_at
      ? new Intl.DateTimeFormat("es-PE", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(bec.updated_at))
      : null;

    return (
      <>
        <style>{PAGE_STYLES}</style>

        <div
          className="bec-root grain-overlay min-h-screen bg-[#0c0c0f] text-white"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(14,165,233,0.09) 0%, transparent 65%)",
              "radial-gradient(ellipse 50% 40% at 100% 60%, rgba(99,102,241,0.05) 0%, transparent 55%)",
              "radial-gradient(ellipse 40% 30% at 0% 90%, rgba(6,182,212,0.06) 0%, transparent 50%)",
            ].join(", "),
          }}
        >
          <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 space-y-6">
            <header className="fu space-y-4">
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
                <span className="text-white/50">BEC</span>
              </nav>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="text-[22px] font-bold tracking-tight text-white leading-none">BEC</h1>
                  <p className="mt-1.5 text-sm text-white/35">{empresa.nombre}</p>
                  {lastUpdated ? (
                    <p className="mt-1 text-[11px] text-white/25">Actualizado: {lastUpdated}</p>
                  ) : null}
         
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 pb-0.5">
                  <Link
                    href={`/protected/empresas/${empresaId}`}
                    className="rounded-lg border bd8 bg-w3 px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
                  >
                    ← Empresa
                  </Link>
                  <Link
                    href={`/protected/empresas/${empresaId}/briefs`}
                    className="rounded-lg border bd8 bg-w3 px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
                  >
                    Briefs
                  </Link>
                </div>
              </div>
            </header>

            <div className="fu d2">
              {bec?.id ? (
                <section className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.025]">
                  <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            bec.is_locked
                              ? "border-emerald-400/25 bg-emerald-400/12 text-emerald-200"
                              : "border-amber-300/20 bg-amber-300/10 text-amber-200"
                          }`}
                        >
                          {bec.is_locked ? "BEC aprobado" : "BEC editable"}
                        </span>
                        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-white/45">
                          v{becVersion}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-white/78">Control de aprobación</p>
                      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-white/36">
                        {bec.is_locked
                          ? "El BEC está cerrado para edición operativa. Reábrelo si necesitas ajustar contenido antes de la siguiente versión."
                          : "El BEC sigue abierto. Apruébalo cuando el contenido y la estructura estén listos para operar."}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <form action={updateBecApproval}>
                        <input type="hidden" name="empresa_id" value={empresaId} />
                        <input type="hidden" name="bec_id" value={bec.id} />
                        <input
                          type="hidden"
                          name="approval_action"
                          value={bec.is_locked ? "reopen" : "approve"}
                        />
                        <button
                          className={
                            bec.is_locked
                              ? "rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-white/72 transition-all hover:border-white/16 hover:bg-white/[0.05] hover:text-white"
                              : "rounded-xl border border-emerald-400/25 bg-emerald-400/12 px-4 py-2.5 text-xs font-semibold text-emerald-100 transition-all hover:border-emerald-300/35 hover:bg-emerald-400/18"
                          }
                        >
                          {bec.is_locked ? "Reabrir BEC" : "Aprobar BEC"}
                        </button>
                      </form>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-4 text-[12px] text-white/38">
                  Guarda el BEC al menos una vez para habilitar las acciones de aprobación.
                </section>
              )}
            </div>

            <div className="fu d2">
              <BecEditor
                key={`${bec?.id ?? "bec"}-${becVersion}-${becScores.confidence ?? "na"}-${becScores.data_quality ?? "na"}-${becScores.risk ?? "na"}`}
                empresaId={empresaId}
                initialCompany={companyInitial}
                initialBec={becInitial}
                becVersion={becVersion}
                initialScores={{
                  confidence: becScores.confidence,
                  data_quality: becScores.data_quality,
                  risk: becScores.risk,
                }}
              />
            </div>
          </div>
        </div>
      </>
    );
  }
