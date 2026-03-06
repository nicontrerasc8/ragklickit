"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  upsertAgenciaPrompt,
  deleteAgenciaPrompt,
  createEmpresa,
  createAgenciaDocument,
} from "@/app/protected/actions";
import AgenciaDocumentsManager from "./AgenciaDocumentsManager";
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutGrid,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

type Empresa = {
  id: string;
  nombre: string;
  industria: string | null;
  created_at: string;
};

type AgenciaPrompt = {
  id: string;
  prompt_type: string;
  titulo: string;
  prompt_text: string;
  version: number;
  activo: boolean;
  updated_at: string;
};

type Props = {
  agenciaId: string;
  empresasCount: number;
  becCount: number;
  briefsCount: number;
  recentEmpresas: Empresa[];
  agenciaPrompts: AgenciaPrompt[];
  agenciaDocuments: {
    id: string;
    doc_type: string;
    title: string;
    raw_text: string;
    created_at: string;
  }[];
};

type PromptTypeCard = {
  key: "bec" | "plan_trabajo" | "calendario";
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
  ring: string;
  badge: string;
};

const PROMPT_TYPES: PromptTypeCard[] = [
  {
    key: "bec",
    label: "BEC",
    description: "Base estrategica de comunicacion",
    icon: BookOpen,
    color: "from-indigo-500/20 to-indigo-600/5",
    iconColor: "text-indigo-400",
    ring: "ring-indigo-500/20",
    badge: "bg-indigo-500/15 text-indigo-300",
  },
  {
    key: "plan_trabajo",
    label: "Plan de trabajo",
    description: "Planificacion y tareas del cliente",
    icon: ClipboardList,
    color: "from-violet-500/20 to-violet-600/5",
    iconColor: "text-violet-400",
    ring: "ring-violet-500/20",
    badge: "bg-violet-500/15 text-violet-300",
  },
  {
    key: "calendario",
    label: "Calendario",
    description: "Eventos y fechas clave",
    icon: CalendarDays,
    color: "from-sky-500/20 to-sky-600/5",
    iconColor: "text-sky-400",
    ring: "ring-sky-500/20",
    badge: "bg-sky-500/15 text-sky-300",
  },
];

function useDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();
  return { ref, open, close };
}

export default function DashboardClient({
  agenciaId,
  empresasCount,
  becCount,
  briefsCount,
  recentEmpresas,
  agenciaPrompts,
  agenciaDocuments,
}: Props) {
  const empresaDialog = useDialog();
  const promptDialog = useDialog();
  const [activePromptType, setActivePromptType] = useState<PromptTypeCard["key"] | null>(null);

  const openPrompt = (key: PromptTypeCard["key"]) => {
    setActivePromptType(key);
    promptDialog.open();
  };

  const activeType = PROMPT_TYPES.find((t) => t.key === activePromptType) ?? null;
  const existingPrompt = activePromptType
    ? agenciaPrompts.find((p) => p.prompt_type === activePromptType)
    : undefined;

  return (
    <div className="flex-1 w-full flex flex-col gap-10 py-2">
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Empresas"
          count={empresasCount}
          from="from-indigo-950"
          to="to-indigo-900"
          ring="ring-indigo-700/40"
          textColor="text-indigo-300"
          blur="bg-indigo-500/10"
          icon={<Building2 size={11} />}
          sub="registradas"
        />
        <StatCard
          label="BEC"
          count={becCount}
          from="from-violet-950"
          to="to-violet-900"
          ring="ring-violet-700/40"
          textColor="text-violet-300"
          blur="bg-violet-500/10"
          icon={<LayoutGrid size={11} />}
          sub="documentos"
        />
        <StatCard
          label="Briefs"
          count={briefsCount}
          from="from-sky-950"
          to="to-sky-900"
          ring="ring-sky-700/40"
          textColor="text-sky-300"
          blur="bg-sky-500/10"
          icon={<FileText size={11} />}
          sub="activos"
        />
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Empresas recientes</h2>
            <p className="text-sm text-muted-foreground">Ultimas incorporadas al sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={empresaDialog.open}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              <Plus size={14} />
              Nueva empresa
            </button>
            <Link
              href="/protected/empresas"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Ir al panel
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentEmpresas.map((empresa) => (
            <Link
              key={empresa.id}
              href={`/protected/empresas/${empresa.id}`}
              className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md"
            >
              <div className="absolute right-0 top-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full bg-gradient-to-br from-indigo-500/10 to-violet-500/10 blur-xl transition-all group-hover:scale-150" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-base font-bold text-indigo-300">
                  {empresa.nombre?.[0]?.toUpperCase() ?? "?"}
                </div>
                <ArrowUpRight
                  size={16}
                  className="mt-0.5 shrink-0 text-muted-foreground/40 transition-all group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </div>
              <div className="mt-4">
                <p className="font-semibold leading-snug">{empresa.nombre}</p>
                {empresa.industria && (
                  <span className="mt-2 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {empresa.industria}
                  </span>
                )}
              </div>
            </Link>
          ))}

          {!recentEmpresas.length && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center">
              <Sparkles size={28} className="mb-3 text-muted-foreground/40" />
              <p className="font-medium">Aun no hay empresas</p>
              <p className="mt-1 text-sm text-muted-foreground">Crea la primera con el boton de arriba.</p>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-xl font-semibold tracking-tight">Cerebro estrategico de la agencia (RAG)</h2>
          <p className="text-sm text-muted-foreground">
            Sube conocimiento global de marketing para usarlo en BEC, briefs, plan de trabajo y calendario.
          </p>
        </div>

        <form action={createAgenciaDocument} className="grid gap-3 rounded-md border p-4">
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
              placeholder="Tipo (manual, metodologia, propuesta, etc)"
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

        <div className="mt-4">
          <AgenciaDocumentsManager documents={agenciaDocuments} />
        </div>
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-xl font-semibold tracking-tight">Prompts de la agencia</h2>
          <p className="text-sm text-muted-foreground">Configura los prompts base para cada flujo.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROMPT_TYPES.map((pt) => {
            const existing = agenciaPrompts.find((p) => p.prompt_type === pt.key);
            const Icon = pt.icon;
            return (
              <button
                key={pt.key}
                onClick={() => openPrompt(pt.key)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${pt.color} border border-white/5 ring-1 ${pt.ring} p-5 text-left transition-all hover:shadow-lg hover:-translate-y-0.5`}
              >
                <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ${pt.iconColor}`}>
                  <Icon size={18} />
                </div>
                <p className="font-semibold">{pt.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{pt.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  {existing ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${pt.badge}`}>
                      v{existing.version} - {existing.activo ? "activo" : "inactivo"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Sin configurar
                    </span>
                  )}
                  <ChevronRight size={14} className="text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <dialog
        ref={empresaDialog.ref}
        className="w-full max-w-md rounded-2xl border bg-background p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:flex-col"
        onClose={empresaDialog.close}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Nueva empresa</h2>
            <p className="text-xs text-muted-foreground">Agrega un nuevo cliente a tu agencia</p>
          </div>
          <button type="button" onClick={empresaDialog.close} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent text-muted-foreground">
            <X size={16} />
          </button>
        </div>
        <form
          action={async (fd) => {
            await createEmpresa(fd);
            empresaDialog.close();
          }}
          className="flex flex-col gap-5 p-6"
        >
          <input type="hidden" name="agencia_id" value={agenciaId} />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <input
                name="nombre"
                required
                placeholder="Ej: Acme Corp"
                className="w-full rounded-xl border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Industria</label>
                <input
                  name="industria"
                  placeholder="Ej: Tecnologia"
                  className="w-full rounded-xl border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Pais</label>
                <input
                  name="pais"
                  placeholder="Ej: Peru"
                  className="w-full rounded-xl border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <button type="button" onClick={empresaDialog.close} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
              <Plus size={13} />
              Crear empresa
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={promptDialog.ref}
        className="w-full max-w-2xl rounded-2xl border bg-background p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:flex-col"
        onClose={promptDialog.close}
      >
        {activeType && (
          <>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${activeType.color} ${activeType.iconColor}`}>
                  <activeType.icon size={16} />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Prompt - {activeType.label}</h2>
                  <p className="text-xs text-muted-foreground">{activeType.description}</p>
                </div>
              </div>
              <button type="button" onClick={promptDialog.close} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            <form
              action={async (fd) => {
                await upsertAgenciaPrompt(fd);
                promptDialog.close();
              }}
              className="flex flex-col gap-5 p-6"
            >
              <input type="hidden" name="prompt_type" value={activeType.key} />
              <input type="hidden" name="titulo" value={activeType.label} />
              {existingPrompt ? <input type="hidden" name="prompt_id" value={existingPrompt.id} /> : null}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Texto del prompt *</label>
                <textarea
                  name="prompt_text"
                  rows={10}
                  required
                  placeholder={`Escribe aqui el prompt del sistema para ${activeType.label}...`}
                  defaultValue={existingPrompt?.prompt_text ?? ""}
                  className="w-full rounded-xl border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none font-mono leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-2">
                  {existingPrompt ? (
                    <button
                      type="submit"
                      formAction={deleteAgenciaPrompt}
                      formNoValidate
                      onClick={promptDialog.close}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} />
                      Eliminar
                    </button>
                  ) : null}
                  {existingPrompt ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${activeType.badge}`}>
                      v{existingPrompt.version}
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={promptDialog.close} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
                    <Save size={13} />
                    {existingPrompt ? "Actualizar" : "Guardar"}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </dialog>
    </div>
  );
}

function StatCard({
  label,
  count,
  from,
  to,
  ring,
  textColor,
  blur,
  icon,
  sub,
}: {
  label: string;
  count: number;
  from: string;
  to: string;
  ring: string;
  textColor: string;
  blur: string;
  icon: ReactNode;
  sub: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${from} ${to} p-6 shadow-lg ring-1 ${ring} transition-all hover:shadow-xl`}>
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full ${blur} blur-2xl`} />
      <div className="mb-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ${textColor} ring-1 ring-white/10`}>
          {icon}
          {label}
        </span>
      </div>
      <p className="text-5xl font-bold tracking-tight text-white">{count}</p>
      <p className={`mt-1 text-sm ${textColor} opacity-60`}>{sub}</p>
    </div>
  );
}
