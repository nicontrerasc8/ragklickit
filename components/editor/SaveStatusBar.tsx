"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SaveStatusBarProps = {
  dirty: boolean;
  saving?: boolean;
  savedMessage?: string;
  errorMessage?: string;
  meta?: ReactNode;
  children: ReactNode;
};

export function SaveStatusBar({
  dirty,
  saving = false,
  savedMessage,
  errorMessage,
  meta,
  children,
}: SaveStatusBarProps) {
  const statusLabel = errorMessage
    ? "Error al guardar"
    : saving
      ? "Guardando"
      : dirty
        ? "Cambios sin guardar"
        : savedMessage || "Todo guardado";
  const dotClass = errorMessage
    ? "bg-rose-300"
    : saving
      ? "bg-amber-300"
      : dirty
        ? "bg-sky-300"
        : "bg-emerald-300";
  const textClass = errorMessage
    ? "text-rose-200"
    : saving
      ? "text-amber-100"
      : dirty
        ? "text-sky-100"
        : "text-emerald-100";

  return (
    <div className="sticky bottom-4 z-30 rounded-2xl border border-white/10 bg-[#11131a]/95 p-3 shadow-2xl shadow-black/35 backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
            <p className={`text-sm font-semibold ${textClass}`}>{statusLabel}</p>
          </div>
          {errorMessage ? (
            <p className="text-xs leading-relaxed text-rose-200/70">{errorMessage}</p>
          ) : savedMessage && !dirty && !saving ? (
            <p className="text-xs leading-relaxed text-white/38">{savedMessage}</p>
          ) : meta ? (
            <div className="text-xs leading-relaxed text-white/38">{meta}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">{children}</div>
      </div>
    </div>
  );
}

export function SaveStatusSubmitButton({
  children,
  idleLabel = "Guardar cambios",
  pendingLabel = "Guardando...",
}: {
  children?: ReactNode;
  idleLabel?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {pendingLabel}
        </>
      ) : (
        children || idleLabel
      )}
    </button>
  );
}
