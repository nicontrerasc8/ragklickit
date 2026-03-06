import { notFound, redirect } from "next/navigation";

import CalendarioClient, {
  CalendarioArtifact,
  PlanArtifact,
} from "@/app/protected/empresas/[empresaId]/calendario/CalendarioClient";
import { createClient } from "@/lib/supabase/server";

type CalendarioPageProps = {
  params: Promise<{ empresaId: string }>;
};

export default async function EmpresaCalendarioPage({ params }: CalendarioPageProps) {
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

  const [{ data: empresa }, { data: planes }, { data: calendarios }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase
      .from("rag_artifacts")
      .select("id, title, status, version, content_json, inputs_json, updated_at")
      .eq("artifact_type", "plan_trabajo")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("rag_artifacts")
      .select("id, title, status, version, content_json, inputs_json, updated_at")
      .eq("artifact_type", "calendario")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .order("updated_at", { ascending: false }),
  ]);

  if (!empresa) {
    notFound();
  }

  return (
    <CalendarioClient
      empresaId={empresaId}
      empresaNombre={empresa.nombre}
      planes={(planes ?? []) as PlanArtifact[]}
      calendarios={(calendarios ?? []) as CalendarioArtifact[]}
    />
  );
}
