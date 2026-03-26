"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return supabase;
}

async function requireUserAgenciaContext() {
  const supabase = await requireUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: appUser, error } = await supabase
    .from("app_user")
    .select("agencia_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo leer perfil de usuario: ${error.message}`);
  }

  if (!appUser?.agencia_id) {
    throw new Error("El usuario no tiene agencia asignada en app_user.");
  }

  return {
    supabase,
    agenciaId: appUser.agencia_id as string,
  };
}

function revalidateEmpresaRoutes(empresaId: string) {
  revalidatePath(`/protected/empresas/${empresaId}`);
  revalidatePath(`/protected/empresas/${empresaId}/bec`);
  revalidatePath(`/protected/empresas/${empresaId}/briefs`);
  revalidatePath(`/protected/empresas/${empresaId}/plan-trabajo`);
  revalidatePath(`/protected/empresas/${empresaId}/calendario`);
}

export async function createEmpresa(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const industria = String(formData.get("industria") ?? "").trim();
  const pais = String(formData.get("pais") ?? "").trim();

  if (!nombre) {
    return;
  }

  await supabase.from("empresa").insert({
    agencia_id: agenciaId,
    nombre,
    industria: industria || null,
    pais: pais || null,
  });

  revalidatePath("/protected");
  revalidatePath("/protected/empresas");
}

export async function deleteEmpresa(formData: FormData) {
  const { supabase, agenciaId } = await requireUserAgenciaContext();
  const empresaId = String(formData.get("empresa_id") ?? "").trim();

  if (!empresaId) {
    return;
  }

  const { data: empresa, error: empresaLookupError } = await supabase
    .from("empresa")
    .select("id")
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId)
    .maybeSingle();

  if (empresaLookupError) {
    throw new Error(`No se pudo validar empresa: ${empresaLookupError.message}`);
  }

  if (!empresa) {
    throw new Error("Empresa no encontrada o sin acceso.");
  }

  const { data: artifactRows, error: artifactLookupError } = await supabase
    .from("rag_artifacts")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("agencia_id", agenciaId);

  if (artifactLookupError) {
    throw new Error(`No se pudo consultar artifacts de la empresa: ${artifactLookupError.message}`);
  }

  const artifactIds = (artifactRows ?? []).map((row) => row.id);

  const deleteSteps = [
    async () => {
      const { error } = await supabase
        .from("app_user_empresa_access")
        .delete()
        .eq("empresa_id", empresaId);
      if (error) throw new Error(`app_user_empresa_access: ${error.message}`);
    },
    async () => {
      const { error } = await supabase
        .from("rag_scores")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId);
      if (error) throw new Error(`rag_scores: ${error.message}`);
    },
    async () => {
      const { error } = await supabase
        .from("kb_chunks")
        .delete()
        .eq("empresa_id", empresaId);
      if (error) throw new Error(`kb_chunks: ${error.message}`);
    },
    async () => {
      if (artifactIds.length === 0) return;

      const { error } = await supabase
        .from("rag_runs")
        .delete()
        .in("artifact_id", artifactIds);
      if (error) throw new Error(`rag_runs: ${error.message}`);
    },
    async () => {
      const { error } = await supabase
        .from("kb_documents")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId);
      if (error) throw new Error(`kb_documents: ${error.message}`);
    },
    async () => {
      const { error } = await supabase
        .from("empresa_file")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId);
      if (error) throw new Error(`empresa_file: ${error.message}`);
    },
    async () => {
      const { error } = await supabase
        .from("rag_artifacts")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId);
      if (error) throw new Error(`rag_artifacts: ${error.message}`);
    },
    async () => {
      const { error } = await supabase
        .from("brief")
        .delete()
        .eq("empresa_id", empresaId);
      if (error) throw new Error(`brief: ${error.message}`);
    },
    async () => {
      const { error } = await supabase
        .from("bec")
        .delete()
        .eq("empresa_id", empresaId);
      if (error) throw new Error(`bec: ${error.message}`);
    },
  ];

  for (const step of deleteSteps) {
    try {
      await step();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      throw new Error(`No se pudo eliminar contenido relacionado de la empresa. ${message}`);
    }
  }

  const { error: deleteEmpresaError } = await supabase
    .from("empresa")
    .delete()
    .eq("id", empresaId)
    .eq("agencia_id", agenciaId);

  if (deleteEmpresaError) {
    throw new Error(`No se pudo eliminar empresa: ${deleteEmpresaError.message}`);
  }

  revalidatePath("/protected");
  revalidatePath("/protected/empresas");
  revalidateEmpresaRoutes(empresaId);
}
