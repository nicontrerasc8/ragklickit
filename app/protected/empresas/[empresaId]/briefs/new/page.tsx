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

  return (
    <div className="min-h-screen bg-[#0c0c0f] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
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

        <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h1 className="text-xl font-semibold tracking-tight">Nuevo brief mensual</h1>
          <p className="mt-1 text-sm text-white/45">{empresa.nombre}</p>
        </header>

        <BriefEditor empresaId={empresaId} initialFormState={makeDefaultBriefForm()} />
      </div>
    </div>
  );
}
