import { notFound, redirect } from "next/navigation";

import {
  createEmpresaDocument,
} from "@/app/protected/actions";
import { createClient } from "@/lib/supabase/server";
import DocumentsManager from "./DocumentsManager";
import EmpresaAlcanceEditor from "./EmpresaAlcanceEditor";
import EmpresaDashboard from "./EmpresaDashboard";

type EmpresaPageProps = {
  params: Promise<{ empresaId: string }>;
};

export default async function EmpresaDetailPage({ params }: EmpresaPageProps) {
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

  const [{ data: empresa }, { data: bec }, { data: documents }] = await Promise.all([
    supabase
      .from("empresa")
      .select("id, nombre, industria, pais, metadata_json")
      .eq("id", empresaId)
      .eq("agencia_id", agenciaId)
      .maybeSingle(),
    supabase.from("bec").select("id, version").eq("empresa_id", empresaId).maybeSingle(),
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

  return (
    <div className="flex flex-col gap-8">
      <EmpresaDashboard empresa={empresa} bec={bec} docsCount={docsCount} />
      <EmpresaAlcanceEditor empresa={empresa} />

      <section className="rounded-lg border p-5 space-y-4">
        <h2 className="text-lg font-semibold">Documentos de la empresa</h2>
        <p className="text-sm text-muted-foreground">
          Sube archivos o pega texto manual para alimentar el RAG de esta empresa.
        </p>

        <form action={createEmpresaDocument} className="grid gap-3 rounded-md border p-4">
          <input type="hidden" name="empresa_id" value={empresaId} />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              name="title"
              placeholder="Titulo del documento"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              name="doc_type"
              defaultValue="manual"
              placeholder="Tipo (manual, brief, bec, etc)"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <input
            type="file"
            name="file"
            accept=".txt,.md,.csv,.json,.html,.xml,.pdf,.docx,.xlsx"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <textarea
            name="raw_text"
            rows={5}
            placeholder="Contenido del documento (opcional si subes archivo)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Guardar documento
            </button>
          </div>
        </form>

        <DocumentsManager empresaId={empresaId} documents={documents ?? []} />
      </section>

   
    </div>
  );
}
