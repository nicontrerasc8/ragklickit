import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarioContent } from "@/lib/calendario/schema";
import CalendarioContentStudio from "./CalendarioContentStudio";

type PageProps = {
  params: Promise<{ empresaId: string; calendarioId: string }>;
  searchParams?: Promise<{ item?: string }>;
};

export default async function CalendarioContentStudioPage({ params, searchParams }: PageProps) {
  const { empresaId, calendarioId } = await params;
  const selectedItemId = String((await searchParams)?.item ?? "").trim();
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
  if (!agenciaId) notFound();

  const [{ data: empresa }, { data: calendario }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase
      .from("rag_artifacts")
      .select("id, title, content_json")
      .eq("id", calendarioId)
      .eq("artifact_type", "calendario")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
  ]);

  if (!empresa || !calendario) notFound();

  const normalized = normalizeCalendarioContent(calendario.content_json);

  return (
    <main className="min-h-screen bg-[#080c12] px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <nav className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/30">
            <Link href="/protected/empresas" className="hover:text-white/60">Empresas</Link>
            <span>/</span>
            <Link href={`/protected/empresas/${empresaId}`} className="hover:text-white/60">{empresa.nombre}</Link>
            <span>/</span>
            <Link href={`/protected/empresas/${empresaId}/calendario`} className="hover:text-white/60">Calendario</Link>
            <span>/</span>
            <span className="text-white/60">Studio</span>
          </nav>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300/75">
                Content studio
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                Assets listos para publicar
              </h1>
              <p className="mt-1.5 text-sm text-white/45">
                Genera copies, articulos e imagenes por item del calendario y guardalos en el artefacto.
              </p>
            </div>
            <Link
              href={`/protected/empresas/${empresaId}/calendario/${calendarioId}`}
              className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              Volver al calendario
            </Link>
          </div>
        </header>

        <CalendarioContentStudio
          empresaId={empresaId}
          calendarioId={calendarioId}
          initialItems={normalized.calendario.items}
          initialSelectedId={selectedItemId}
        />
      </div>
    </main>
  );
}
