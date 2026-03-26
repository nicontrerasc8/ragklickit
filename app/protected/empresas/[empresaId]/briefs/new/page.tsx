import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import BriefEditor from "@/app/protected/empresas/[empresaId]/briefs/BriefEditor";
import { makeDefaultBriefForm } from "@/lib/brief/schema";
import { createClient } from "@/lib/supabase/server";

type NewBriefPageProps = {
  params: Promise<{ empresaId: string }>;
};

export default async function NewBriefPage({ params }: NewBriefPageProps) {
  const { empresaId } = await params;
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

  const { data: empresa } = await supabase
    .from("empresa")
    .select("id, nombre")
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  if (!empresa) {
    notFound();
  }

  const baseDate = new Date();
  const nextMonthDate = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1),
  );
  const initialPeriodo = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "UTC",
  }).format(nextMonthDate);

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
          <span className="text-white/55">Nuevo</span>
        </nav>

        <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
                Brief mensual
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Nuevo brief mensual</h1>
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
              <Link
                href={`/protected/empresas/${empresaId}`}
                className="rounded-xl border border-white/10 px-3 py-2 text-white/60 transition-colors hover:text-white"
              >
                Volver a empresa
              </Link>
              <span className="rounded-xl border border-white/10 px-3 py-2 text-white/60">
                Nuevo
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
              <p className="mt-1 text-sm text-white/75">Nuevo</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">Version</p>
              <p className="mt-1 text-sm text-white/75">v1</p>
            </div>
          </div>
        </header>

        <BriefEditor
          empresaId={empresaId}
          initialPeriodo={initialPeriodo}
          initialEstado="plan"
          initialFormState={makeDefaultBriefForm()}
        />
      </div>
    </div>
  );
}
