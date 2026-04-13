import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { readWorkflow, type WorkflowMeta } from "@/lib/workflow";
import { createEmpresaDocument } from "./actions";
import DocumentsManager from "./DocumentsManager";
import EmpresaAlcanceEditor from "./EmpresaAlcanceEditor";
import EmpresaDashboard from "./EmpresaDashboard";

type EmpresaPageProps = {
  params: Promise<{ empresaId: string }>;
  searchParams?: Promise<{ upload_error?: string }>;
};

export const maxDuration = 60;

function getUploadErrorMessage(code: string | null) {
  switch (code) {
    case "missing_file":
      return "Sube un archivo PDF o Word (.docx) para continuar.";
    case "unsupported_file":
      return "Solo se permiten archivos PDF o Word (.docx) en este formulario.";
    case "transcribe_elsewhere":
      return "No pudimos procesar el texto de este archivo de forma automatica. Si el PDF viene como imagen, escaneo o exportacion compleja, revisa el limite del plan OCR.space o sube un archivo con texto legible.";
    default:
      return null;
  }
}

export default async function EmpresaDetailPage({ params, searchParams }: EmpresaPageProps) {
  const { empresaId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const uploadErrorMessage = getUploadErrorMessage(resolvedSearchParams?.upload_error ?? null);
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

  const [{ data: empresa }, { data: bec }, { data: documents }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre, industria, pais, metadata_json")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase.from("bec").select("id, version, contenido_json, updated_at").eq("empresa_id", empresaId).maybeSingle(),
    supabase
      .from("kb_documents")
      .select("id, doc_type, title, raw_text, created_at")
      .eq("empresa_id", empresaId)
      .eq("agencia_id", agenciaId)
      .order("created_at", { ascending: false }),
  ]);

  if (!empresa) {
    notFound();
  }

  const docsCount = documents?.length ?? 0;
  const [{ data: latestBrief }, { data: latestBriefEvaluation }, { data: latestPlan }, { data: latestCalendario }] =
    await Promise.all([
      supabase
        .from("brief")
        .select("id, periodo, estado, version, contenido_json, updated_at")
        .eq("empresa_id", empresaId)
        .order("periodo", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("rag_artifacts")
        .select("id, title, status, version, content_json, updated_at, inputs_json")
        .eq("artifact_type", "brief_evaluation")
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("rag_artifacts")
        .select("id, title, status, version, content_json, updated_at, inputs_json")
        .eq("artifact_type", "plan_trabajo")
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("rag_artifacts")
        .select("id, title, status, version, content_json, updated_at, inputs_json")
        .eq("artifact_type", "calendario")
        .eq("empresa_id", empresaId)
        .eq("agencia_id", agenciaId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const abaSummary = {
    bec: bec
      ? {
          id: bec.id,
          version: bec.version,
          updated_at: (bec as { updated_at?: string | null }).updated_at ?? null,
          workflow: readWorkflow((bec as { contenido_json?: unknown }).contenido_json),
          href: `/protected/empresas/${empresaId}/bec`,
          label: "BEC",
        }
      : null,
    brief: latestBrief
      ? {
          id: latestBrief.id,
          version: latestBrief.version,
          updated_at: latestBrief.updated_at ?? null,
          workflow: readWorkflow(latestBriefEvaluation?.content_json),
          href: `/protected/empresas/${empresaId}/briefs/${latestBrief.id}`,
          label: "Brief",
          status: latestBrief.estado,
        }
      : null,
    plan: latestPlan
      ? {
          id: latestPlan.id,
          version: latestPlan.version,
          updated_at: latestPlan.updated_at ?? null,
          workflow: readWorkflow(latestPlan.content_json),
          href: `/protected/empresas/${empresaId}/plan-trabajo/${latestPlan.id}`,
          label: "Plan",
          status: latestPlan.status,
        }
      : null,
    calendario: latestCalendario
      ? {
          id: latestCalendario.id,
          version: latestCalendario.version,
          updated_at: latestCalendario.updated_at ?? null,
          workflow: readWorkflow(latestCalendario.content_json),
          href: `/protected/empresas/${empresaId}/calendario/${latestCalendario.id}`,
          label: "Calendario",
          status: latestCalendario.status,
        }
      : null,
  } satisfies Record<
    string,
    | {
        id: string;
        version: number;
        updated_at: string | null;
        workflow: WorkflowMeta | null;
        href: string;
        label: string;
        status?: string;
      }
    | null
  >;

  return (
    <div className="flex flex-col gap-8">
      <EmpresaDashboard empresa={empresa} bec={bec} docsCount={docsCount} abaSummary={abaSummary} />
      <EmpresaAlcanceEditor empresa={empresa} />

      <section className="rounded-lg border p-5 space-y-4">
        <h2 className="text-lg font-semibold">Documentos de la empresa</h2>
        <p className="text-sm text-muted-foreground">
          Sube un archivo y el sistema extraera el texto literalmente, sin IA ni reescritura.
        </p>

        {uploadErrorMessage && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {uploadErrorMessage}
          </div>
        )}

        <form action={createEmpresaDocument} className="grid gap-3 rounded-md border p-4">
          <input type="hidden" name="empresa_id" value={empresaId} />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="title"
              placeholder="Titulo opcional"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              name="doc_type"
              defaultValue="archivo"
              placeholder="Tipo (manual, brief, bec, etc)"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Formatos soportados: PDF y Word (.docx). Si no defines titulo, se usa el nombre del archivo.
          </p>
          <div>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Subir archivo
            </button>
          </div>
        </form>

        <DocumentsManager empresaId={empresaId} documents={documents ?? []} />
      </section>

   
    </div>
  );
}
