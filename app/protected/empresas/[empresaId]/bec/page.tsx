import { notFound, redirect } from "next/navigation";

import BecEditor from "@/app/protected/empresas/[empresaId]/bec/BecEditor";
import { CompanyForm, DEFAULT_COMPANY, loadBECState } from "@/lib/bec/schema";
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
  .d1 { animation-delay:80ms; }
  .d2 { animation-delay:160ms; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .animate-spin { animation:spin 0.75s linear infinite; }
  @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
  .animate-ping  { animation:ping 2s cubic-bezier(0,0,0.2,1) infinite; }
`;

type BecPageProps = {
  params: Promise<{ empresaId: string }>;
};

export default async function EmpresaBecPage({ params }: BecPageProps) {
  const { empresaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: appUser } = await supabase
    .from("app_user").select("agencia_id").eq("id", user.id).maybeSingle();
  const agenciaId = appUser?.agencia_id ?? null;

  const [{ data: empresa }, { data: bec }] = await Promise.all([
    supabase.from("empresa")
      .select("id, nombre, industria, pais, metadata_json")
      .eq("id", empresaId).eq("agencia_id", agenciaId).maybeSingle(),
    supabase.from("bec")
      .select("id, version, contenido_json, updated_at")
      .eq("empresa_id", empresaId).maybeSingle(),
  ]);

  if (!empresa) notFound();

  const metadata =
    empresa.metadata_json && typeof empresa.metadata_json === "object"
      ? (empresa.metadata_json as Record<string, unknown>)
      : {};

  const companyInitial: CompanyForm = {
    ...DEFAULT_COMPANY,
    negocio:   empresa.nombre ?? "",
    marca:     typeof metadata.marca    === "string" && (metadata.marca as string).trim()
                 ? (metadata.marca as string)
                 : empresa.nombre ?? "",
    industria: empresa.industria ?? "",
    pais:      empresa.pais ?? DEFAULT_COMPANY.pais,
    objetivo:  typeof metadata.objetivo === "string" ? (metadata.objetivo as string) : "",
    problema:  typeof metadata.problema === "string" ? (metadata.problema as string) : "",
  };
  const becInitial = loadBECState(bec?.contenido_json);

  const becVersion = bec?.version ?? 0;
  const lastUpdated = bec?.updated_at
    ? new Intl.DateTimeFormat("es-PE", {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
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
        <div className="mx-auto max-w-2xl px-5 pb-16 pt-10 space-y-7">

          {/* ── Header ─────────────────────────────────────────────── */}
          <header className="fu space-y-4">
            <nav className="flex items-center gap-1.5 text-[11px] text-white/25">
              <a href="/protected/empresas" className="hover:text-white/50 transition-colors">Empresas</a>
              <span>/</span>
              <a href={`/protected/empresas/${empresaId}`} className="hover:text-white/50 transition-colors">
                {empresa.nombre}
              </a>
              <span>/</span>
              <span className="text-white/50">BEC</span>
            </nav>

            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-white leading-none">
                  BEC
                </h1>
                <p className="mt-1.5 text-sm text-white/35">{empresa.nombre}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 pb-0.5">
                <a
                  href={`/protected/empresas/${empresaId}`}
                  className="rounded-lg border bd8 bg-w3 px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
                >
                  ← Empresa
                </a>
                <a
                  href={`/protected/empresas/${empresaId}/briefs`}
                  className="rounded-lg border bd8 bg-w3 px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
                >
                  Briefs
                </a>
              </div>
            </div>
          </header>

          {/* ── Stats ──────────────────────────────────────────────── */}
 

          {/* ── Editor ─────────────────────────────────────────────── */}
          <div className="fu d2">
            <BecEditor
              empresaId={empresaId}
              initialCompany={companyInitial}
              initialBec={becInitial}
              becVersion={becVersion}
            />
          </div>

        </div>
      </div>
    </>
  );
}