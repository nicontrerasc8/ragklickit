"use client";

import Link from "next/link";
import { useRef } from "react";
import { updateEmpresa } from "@/app/protected/actions";
import {
  ArrowLeft,
  Pencil,
  X,
  FileText,
  CalendarDays,
  ClipboardList,
  BookOpen,
  Save,
} from "lucide-react";

type Empresa = {
  id: string;
  nombre: string;
  industria: string | null;
  pais: string | null;
};

type Bec = { id: string; version: number } | null;

type Props = {
  empresa: Empresa;
  bec: Bec;
  docsCount: number;
};

export default function EmpresaDashboard({ empresa, bec, docsCount }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openModal = () => {
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const displayName = empresa.nombre;
  const initial = displayName?.[0]?.toUpperCase() ?? "?";

  const navLinks = [
    {
      href: `/protected/empresas/${empresa.id}/bec`,
      label: "BEC",
      description: "Base estrategica de comunicacion",
      icon: BookOpen,
      color: "from-indigo-500/20 to-indigo-600/10 hover:from-indigo-500/30",
      iconColor: "text-indigo-400",
    },
    {
      href: `/protected/empresas/${empresa.id}/briefs`,
      label: "Brief",
      description: "Documentos de briefing",
      icon: FileText,
      color: "from-violet-500/20 to-violet-600/10 hover:from-violet-500/30",
      iconColor: "text-violet-400",
    },
    {
      href: `/protected/empresas/${empresa.id}/plan-trabajo`,
      label: "Plan de trabajo",
      description: "Planificacion y tareas",
      icon: ClipboardList,
      color: "from-sky-500/20 to-sky-600/10 hover:from-sky-500/30",
      iconColor: "text-sky-400",
    },
    {
      href: `/protected/empresas/${empresa.id}/calendario`,
      label: "Calendario",
      description: "Eventos y fechas clave",
      icon: CalendarDays,
      color: "from-emerald-500/20 to-emerald-600/10 hover:from-emerald-500/30",
      iconColor: "text-emerald-400",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-2xl font-bold text-indigo-300 ring-1 ring-indigo-500/20">
            {initial}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {empresa.industria && (
                <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {empresa.industria}
                </span>
              )}
              {empresa.pais && (
                <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {empresa.pais}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/protected/empresas"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <ArrowLeft size={14} />
            Empresas
          </Link>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            <Pencil size={13} />
            Editar
          </button>
        </div>
      </div>



      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {navLinks.map(({ href, label, description, icon: Icon, color, iconColor }) => (
          <Link
            key={href}
            href={href}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} border border-white/5 p-5 transition-all hover:shadow-lg hover:-translate-y-0.5`}
          >
            <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ${iconColor}`}>
              <Icon size={18} />
            </div>
            <p className="font-semibold">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl border bg-background p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:flex-col"
        onClose={closeModal}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Editar empresa</h2>
            <p className="text-xs text-muted-foreground">Actualiza los datos de {displayName}</p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <form
          action={async (fd) => {
            await updateEmpresa(fd);
            closeModal();
          }}
          className="flex flex-col gap-5 p-6"
        >
          <input type="hidden" name="empresa_id" value={empresa.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <input
                name="nombre"
                required
                defaultValue={empresa.nombre}
                className="w-full rounded-xl border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Industria</label>
              <input
                name="industria"
                defaultValue={empresa.industria ?? ""}
                className="w-full rounded-xl border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Pais</label>
              <input
                name="pais"
                defaultValue={empresa.pais ?? ""}
                className="w-full rounded-xl border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              <Save size={13} />
              Guardar cambios
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
