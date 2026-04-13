import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

type ProtectedPageProps = {
  searchParams?: Promise<{ upload_error?: string }>;
};

export const maxDuration = 60;

function DashboardFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="h-36 animate-pulse rounded-2xl border bg-muted/30" />
      <div className="h-36 animate-pulse rounded-2xl border bg-muted/30" />
      <div className="h-36 animate-pulse rounded-2xl border bg-muted/30" />
    </div>
  );
}

async function ProtectedPageContent({ searchParams }: ProtectedPageProps) {
  const supabase = await createClient();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
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
    return (
      <div className="rounded-2xl border p-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu usuario no tiene agencia asignada en app_user.
        </p>
      </div>
    );
  }

  const { data: empresaIdsData } = await supabase
    .from("empresa")
    .select("id")
    .eq("agencia_id", agenciaId);
  const empresaIds = (empresaIdsData ?? []).map((row) => row.id);

  const [{ count: empresasCount }, { count: becCount }, { count: briefsCount }] =
    await Promise.all([
      supabase.from("empresa").select("*", { count: "exact", head: true }).eq("agencia_id", agenciaId),
      empresaIds.length
        ? supabase.from("bec").select("*", { count: "exact", head: true }).in("empresa_id", empresaIds)
        : Promise.resolve({ count: 0 } as { count: number | null }),
      empresaIds.length
        ? supabase.from("brief").select("*", { count: "exact", head: true }).in("empresa_id", empresaIds)
        : Promise.resolve({ count: 0 } as { count: number | null }),
    ]);

  const { data: recentEmpresas } = await supabase
    .from("empresa")
    .select("id, nombre, industria, created_at")
    .eq("agencia_id", agenciaId)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: agenciaPrompts } = await supabase
    .from("agencia_prompt")
    .select("id, prompt_type, titulo, prompt_text, version, activo, updated_at")
    .eq("agencia_id", agenciaId)
    .order("updated_at", { ascending: false });

  const { data: agenciaDocuments } = await supabase
    .from("kb_documents")
    .select("id, doc_type, title, raw_text, created_at")
    .eq("agencia_id", agenciaId)
    .is("empresa_id", null)
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <DashboardClient
      agenciaId={agenciaId}
      empresasCount={empresasCount ?? 0}
      becCount={becCount ?? 0}
      briefsCount={briefsCount ?? 0}
      recentEmpresas={recentEmpresas ?? []}
      agenciaPrompts={agenciaPrompts ?? []}
      agenciaDocuments={agenciaDocuments ?? []}
      uploadError={resolvedSearchParams?.upload_error ?? null}
    />
  );
}

export default function ProtectedPage(props: ProtectedPageProps) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <ProtectedPageContent {...props} />
    </Suspense>
  );
}
