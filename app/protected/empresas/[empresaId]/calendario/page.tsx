import { notFound, redirect } from "next/navigation";

import CalendarioClient, {
  CalendarioArtifact,
  PlanArtifact,
} from "@/app/protected/empresas/[empresaId]/calendario/CalendarioClient";
import { createClient } from "@/lib/supabase/server";

type CalendarioPageProps = {
  params: Promise<{ empresaId: string }>;
};

function alcanceToPromptText(value: unknown) {
  if (!value || typeof value !== "object") return "";
  return Object.entries(value as Record<string, unknown>)
    .map(([channel, countRaw]) => {
      const count =
        typeof countRaw === "number"
          ? countRaw
          : Number.parseInt(String(countRaw ?? "").trim(), 10);
      if (!channel.trim() || !Number.isFinite(count) || count <= 0) return "";
      return `${channel.trim()}: ${Math.min(10, Math.trunc(count))}`;
    })
    .filter(Boolean)
    .join("\n");
}

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
      .select("id, nombre, metadata_json")
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

  const metadata =
    empresa.metadata_json && typeof empresa.metadata_json === "object"
      ? (empresa.metadata_json as Record<string, unknown>)
      : {};
  const alcanceCalendario = alcanceToPromptText(metadata.alcance_calendario);

  return (
    <CalendarioClient
      empresaId={empresaId}
      empresaNombre={empresa.nombre}
      alcanceCalendario={alcanceCalendario}
      planes={(planes ?? []) as PlanArtifact[]}
      calendarios={(calendarios ?? []) as CalendarioArtifact[]}
    />
  );
}
