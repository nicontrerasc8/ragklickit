"use client";

import { useFormStatus } from "react-dom";

import { deleteEmpresa } from "@/app/protected/actions";

type Props = {
  empresaId: string;
  empresaNombre: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-xl border border-rose-400/15 bg-rose-500/8 px-3 py-2 text-[11px] font-semibold text-rose-200/85 transition hover:border-rose-300/30 hover:bg-rose-500/14 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}

export default function DeleteEmpresaButton({ empresaId, empresaNombre }: Props) {
  return (
    <form
      action={deleteEmpresa}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Se eliminará la empresa "${empresaNombre}" y su contenido relacionado. Esta acción no se puede deshacer.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="empresa_id" value={empresaId} />
      <SubmitButton />
    </form>
  );
}
