"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteEmpresaDocument,
  updateEmpresaDocument,
} from "./actions";

type DocumentItem = {
  id: string;
  doc_type: string;
  title: string;
  raw_text: string;
  created_at: string;
};

type Props = {
  empresaId: string;
  documents: DocumentItem[];
};

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const datePart = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);

  return `${datePart} ${timePart}`;
}

export default function DocumentsManager({ empresaId, documents }: Props) {
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
                {doc.doc_type} - {formatCreatedAt(doc.created_at)}
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
              <form action={deleteEmpresaDocument}>
                <input type="hidden" name="empresa_id" value={empresaId} />
                <input type="hidden" name="document_id" value={doc.id} />
                <button className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent">
                  Eliminar
                </button>
              </form>
            </div>
          </div>
        ))}
        {!documents.length ? (
          <p className="text-sm text-muted-foreground">No hay documentos cargados.</p>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        className="w-full max-w-3xl rounded-xl border bg-background p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        {selected ? (
          <form
            action={async (fd) => {
              await updateEmpresaDocument(fd);
              closeEditor();
              router.refresh();
            }}
            className="flex flex-col"
          >
            <div className="border-b px-6 py-4">
              <h3 className="text-base font-semibold">Contenido transcrito del documento</h3>
              <p className="text-xs text-muted-foreground">
                Revisa y edita la transcripcion literal que usa el conocimiento de esta empresa.
              </p>
            </div>
            <div className="space-y-3 p-6">
              <input type="hidden" name="empresa_id" value={empresaId} />
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
