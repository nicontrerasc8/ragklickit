import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import PlanTrabajoClient from "./PlanTrabajoClient";
type PlanTrabajoPageProps = {
  params: Promise<{ empresaId: string }>;
};

export default async function EmpresaPlanTrabajoPage({ params }: PlanTrabajoPageProps) {
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

  const [{ data: empresa }, { data: briefs }, { data: planes }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase
      .from("brief")
      .select("id, periodo, estado, version, created_at")
      .eq("empresa_id", empresaId)
      .order("periodo",  { ascending: false })
      .order("version",  { ascending: false }),
    supabase
      .from("rag_artifacts")
      .select("id, title, status, version, content_json, inputs_json, created_at, updated_at")
      .eq("artifact_type", "plan_trabajo")
      .eq("empresa_id",    empresaId)
      .eq("agencia_id",    agenciaId)
      .order("updated_at", { ascending: false }),
  ]);

  if (!empresa) {
    notFound();
  }

  return (
    <PlanTrabajoClient
      empresaId={empresaId}
      empresaNombre={empresa.nombre}
      briefs={briefs ?? []}
      planes={planes ?? []}
    />
  );
}