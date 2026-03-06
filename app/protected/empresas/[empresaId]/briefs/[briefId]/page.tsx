import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BRIEF_OBJECTIVE_GROUPS, BRIEF_TEXT_FIELDS, loadBriefForm } from "@/lib/brief/schema";
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
      .select("id, periodo, estado, version, contenido_json, created_at")
      .eq("id", briefId)
      .eq("empresa_id", empresaId)
      .maybeSingle(),
  ]);

  if (!empresa || !brief) {
    notFound();
  }

  const parsed = loadBriefForm(brief.contenido_json);
  const monthFmt = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
  const periodoLabel = monthFmt.format(new Date(`${brief.periodo}T00:00:00.000Z`));

  return (
    <div className="min-h-screen bg-[#0c0c0f] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <nav className="flex items-center gap-1.5 text-[11px] text-white/25">
          <Link href="/protected/empresas" className="hover:text-white/50 transition-colors">Empresas</Link>
          <span>/</span>
          <Link href={`/protected/empresas/${empresaId}`} className="hover:text-white/50 transition-colors">{empresa.nombre}</Link>
          <span>/</span>
          <Link href={`/protected/empresas/${empresaId}/briefs`} className="hover:text-white/50 transition-colors">Briefs</Link>
          <span>/</span>
          <span className="text-white/55">Detalle</span>
        </nav>

        <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Brief mensual</h1>
              <p className="mt-1 text-sm text-white/45">{empresa.nombre}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded border border-white/10 px-2 py-1 capitalize text-white/60">{brief.estado}</span>
              <span className="rounded border border-white/10 px-2 py-1 text-white/60">v{brief.version}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/35">Periodo: {periodoLabel}</p>
          <p className="text-xs text-white/35">Creado: {new Date(brief.created_at).toLocaleString("es-PE")}</p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Objetivos seleccionados</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {BRIEF_OBJECTIVE_GROUPS.map((group) => {
              const selected = group.options.filter((o) => parsed.objectives[group.id]?.[o]);
              return (
                <div key={group.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-xs font-semibold text-white/55">{group.title}</p>
                  {selected.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-white/70">
                      {selected.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm italic text-white/30">Sin objetivos</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Respuestas</h2>
          <div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.02]">
            {BRIEF_TEXT_FIELDS.map((field, i) => (
              <div key={field} className="px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/40">{i + 1}. {field}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/75">
                  {parsed.fields[field]?.trim() || <span className="italic text-white/30">Sin respuesta</span>}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Cambios estrategicos</h2>
          <p className="mt-2 text-sm text-white/75">
            {parsed.strategicChanges === "si" ? "Si" : parsed.strategicChanges === "no" ? "No" : "Sin definir"}
          </p>
        </section>
      </div>
    </div>
  );
}
