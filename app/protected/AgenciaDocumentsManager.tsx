"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteAgenciaDocument,
  updateAgenciaDocument,
} from "@/app/protected/actions";

type DocumentItem = {
  id: string;
  doc_type: string;
  title: string;
  raw_text: string;
  created_at: string;
};

type Props = {
  documents: DocumentItem[];
};

export default function AgenciaDocumentsManager({ documents }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<DocumentItem | null>(null);

  const openEditor = (doc: DocumentItem) => {
    setSelected(doc);
    dialogRef.current?.showModal();
  };

  const closeEditor = () => {
    dialogRef.current?.close();
    setSelected(null);
  };

  return (
    <>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div>
              <p className="font-medium">{doc.title}</p>
              <p className="text-xs text-muted-foreground">
                {doc.doc_type} - {new Date(doc.created_at).toLocaleString("es-PE")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEditor(doc)}
                className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent"
              >
                Ver / Editar
              </button>
              <form action={deleteAgenciaDocument}>
                <input type="hidden" name="document_id" value={doc.id} />
                <button className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent">
                  Eliminar
                </button>
              </form>
            </div>
          </div>
        ))}
        {!documents.length ? (
          <p className="text-sm text-muted-foreground">No hay documentos globales cargados.</p>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        className="w-full max-w-3xl rounded-xl border bg-background p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        {selected ? (
          <form
            action={async (fd) => {
              await updateAgenciaDocument(fd);
              closeEditor();
              router.refresh();
            }}
            className="flex flex-col"
          >
            <div className="border-b px-6 py-4">
              <h3 className="text-base font-semibold">Contenido RAG del documento</h3>
              <p className="text-xs text-muted-foreground">
                Revisa y edita el contenido que usa el RAG global de la agencia.
              </p>
            </div>
            <div className="space-y-3 p-6">
              <input type="hidden" name="document_id" value={selected.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  name="title"
                  defaultValue={selected.title}
                  required
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <input
                  name="doc_type"
                  defaultValue={selected.doc_type}
                  required
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <textarea
                name="raw_text"
                rows={14}
                defaultValue={selected.raw_text}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Guardar cambios
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
