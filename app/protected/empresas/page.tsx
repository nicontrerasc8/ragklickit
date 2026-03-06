import { redirect } from "next/navigation";
import Link from "next/link";

import { createEmpresa } from "@/app/protected/actions";
import { createClient } from "@/lib/supabase/server";

const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  .emp-root * { font-family:'Sora','Helvetica Neue',sans-serif; box-sizing:border-box; }
  .emp-root .mono { font-family:'JetBrains Mono',monospace; }

  .grain-overlay::after {
    content:'';position:fixed;inset:0;pointer-events:none;opacity:0.025;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size:256px;z-index:9999;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .fu  { animation:fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .d1  { animation-delay:60ms; }
  .d2  { animation-delay:120ms; }
  .d3  { animation-delay:180ms; }

  .empresa-card { transition: border-color 0.15s, background-color 0.15s, transform 0.15s; }
  .empresa-card:hover { border-color:rgba(255,255,255,0.14); background-color:rgba(255,255,255,0.035); transform:translateY(-1px); }

  .input-field {
    width:100%;
    border-radius:0.75rem;
    border:1px solid rgba(255,255,255,0.08);
    background:rgba(255,255,255,0.03);
    padding:0.625rem 0.875rem;
    font-size:0.8125rem;
    color:rgba(255,255,255,0.75);
    font-family:inherit;
    transition:border-color 0.15s, background-color 0.15s;
    outline:none;
  }
  .input-field::placeholder { color:rgba(255,255,255,0.2); }
  .input-field:focus { border-color:rgba(255,255,255,0.16); background:rgba(255,255,255,0.045); }
`;

// Industry → accent color mapping
const INDUSTRY_COLORS: Record<string, string> = {
  tecnología:  "from-sky-400 to-blue-500",
  tecnologia:  "from-sky-400 to-blue-500",
  retail:      "from-rose-400 to-pink-500",
  salud:       "from-emerald-400 to-teal-500",
  educación:   "from-violet-400 to-indigo-500",
  educacion:   "from-violet-400 to-indigo-500",
  alimentos:   "from-amber-400 to-orange-500",
  finanzas:    "from-teal-400 to-cyan-500",
  moda:        "from-pink-400 to-rose-500",
};
function industryGradient(industria?: string | null) {
  if (!industria) return "from-zinc-500 to-zinc-600";
  const key = industria.toLowerCase();
  for (const [k, v] of Object.entries(INDUSTRY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "from-indigo-400 to-violet-500";
}

function initials(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function EmpresasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: appUser } = await supabase
    .from("app_user").select("agencia_id").eq("id", user.id).maybeSingle();
  const agenciaId = appUser?.agencia_id ?? null;

  if (!agenciaId) {
    return (
      <>
        <style>{PAGE_STYLES}</style>
        <div className="emp-root grain-overlay min-h-screen bg-[#0c0c0f] text-white flex items-center justify-center">
          <div className="rounded-2xl border border-white/8 bg-white/[0.018] px-8 py-10 text-center max-w-sm">
            <p className="text-[13px] font-semibold text-white/50">Sin agencia asignada</p>
            <p className="mt-1.5 text-[11px] text-white/25 leading-relaxed">
              Tu usuario no tiene una agencia vinculada en app_user.
            </p>
          </div>
        </div>
      </>
    );
  }

  const { data: empresas } = await supabase
    .from("empresa")
    .select("id, nombre, industria, pais, created_at")
    .eq("agencia_id", agenciaId)
    .order("created_at", { ascending: false });

  const count = empresas?.length ?? 0;

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div
        className="emp-root grain-overlay min-h-screen bg-[#0c0c0f] text-white"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(99,102,241,0.09) 0%, transparent 65%)",
            "radial-gradient(ellipse 50% 40% at 100% 55%, rgba(139,92,246,0.05) 0%, transparent 55%)",
            "radial-gradient(ellipse 40% 30% at 0% 90%,  rgba(79,70,229,0.06) 0%, transparent 50%)",
          ].join(", "),
        }}
      >
        <div className="mx-auto max-w-2xl px-5 pb-16 pt-10 space-y-8">

          {/* ── Header ─────────────────────────────────────────────── */}
          <header className="fu space-y-1">
            <h1 className="text-[22px] font-bold tracking-tight text-white leading-none">
              Gestor de empresas
            </h1>
            <p className="text-sm text-white/35">
              Gestiona las empresas de tu agencia y sus documentos.
            </p>
          </header>

          {/* ── Stats ──────────────────────────────────────────────── */}
          <div className="fu d1 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[
              { value: count, label: "Empresas" },
              {
                value: new Set(empresas?.map((e) => e.industria).filter(Boolean)).size || "—",
                label: "Industrias",
              },
              {
                value: new Set(empresas?.map((e) => e.pais).filter(Boolean)).size || "—",
                label: "Países",
              },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="flex flex-col gap-1 rounded-xl border border-white/7 px-4 py-3.5"
                style={{ background: "rgba(255,255,255,0.018)" }}
              >
                <span className="text-[26px] font-bold leading-none tracking-tighter text-white">
                  {value}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-white/35">{label}</span>
              </div>
            ))}
          </div>

          {/* ── Create form ────────────────────────────────────────── */}
          <section
            className="fu d2 rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}
          >
            <div
              className="flex items-center gap-2.5 px-5 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-50"
                  style={{ animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite" }}
                />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
              </span>
              <style>{`@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-300/70">
                Nueva empresa
              </h2>
            </div>

            <form action={createEmpresa} className="px-5 py-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-3 space-y-1.5">
                  <label className="block text-[11px] font-medium text-white/30 pl-0.5">
                    Nombre <span className="text-indigo-400/60">*</span>
                  </label>
                  <input
                    name="nombre"
                    placeholder="Nombre de la empresa"
                    required
                    className="input-field"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-white/30 pl-0.5">Industria</label>
                  <input name="industria" placeholder="Tecnología, Retail…" className="input-field" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-white/30 pl-0.5">País</label>
                  <input name="pais" placeholder="Perú, Chile…" className="input-field" />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-500"
                    style={{ boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }}
                  >
                    <span className="text-white/60">+</span>
                    Crear empresa
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* ── Empresas list ──────────────────────────────────────── */}
          <section className="fu d3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/30">
                Empresas registradas
              </h2>
              <span className="mono text-[11px] text-white/20">{count} registros</span>
            </div>

            {count > 0 ? (
              <div className="space-y-2">
                {(empresas ?? []).map((empresa) => {
                  const grad = industryGradient(empresa.industria);
                  const ini  = initials(empresa.nombre);
                  return (
                    <Link
                      key={empresa.id}
                      href={`/protected/empresas/${empresa.id}`}
                      className="empresa-card flex items-center gap-4 rounded-2xl px-5 py-4"
                      style={{
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: "rgba(255,255,255,0.018)",
                        textDecoration: "none",
                        display: "flex",
                      }}
                    >
                      {/* Avatar */}
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-[13px] font-bold text-white shadow-lg`}
                        style={{ opacity: 0.85 }}
                      >
                        {ini}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-white/85 truncate">
                          {empresa.nombre}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {empresa.industria ? (
                            <span className="text-[11px] text-white/35 truncate">{empresa.industria}</span>
                          ) : null}
                          {empresa.industria && empresa.pais ? (
                            <span className="text-[11px] text-white/20">·</span>
                          ) : null}
                          {empresa.pais ? (
                            <span className="text-[11px] text-white/35">{empresa.pais}</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Arrow */}
                      <span className="shrink-0 text-sm text-white/20">→</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div
                className="rounded-2xl px-6 py-12 text-center"
                style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.018)" }}
              >
                <p className="text-[13px] font-medium text-white/25">Sin empresas registradas</p>
                <p className="mt-1.5 text-[11px] text-white/15 leading-relaxed">
                  Crea tu primera empresa con el formulario de arriba.
                </p>
              </div>
            )}
          </section>

        </div>
      </div>
    </>
  );
}