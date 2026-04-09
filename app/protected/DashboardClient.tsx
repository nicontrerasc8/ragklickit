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
  AlertTriangle,
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
  uploadError: string | null;
};

type PromptTypeCard = {
  key: "bec" | "plan_trabajo" | "calendario";
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  accentText: string;
  dot: string;
};

const PROMPT_TYPES: PromptTypeCard[] = [
  {
    key: "bec",
    label: "BEC",
    description: "Base estratégica de cliente",
    icon: BookOpen,
    accent: "border-amber-500/20 hover:border-amber-500/50",
    accentText: "text-amber-400",
    dot: "bg-amber-400",
  },
  {
    key: "plan_trabajo",
    label: "Plan de trabajo",
    description: "Planificación y tareas del cliente",
    icon: ClipboardList,
    accent: "border-emerald-500/20 hover:border-emerald-500/50",
    accentText: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  {
    key: "calendario",
    label: "Calendario",
    description: "Eventos y fechas clave",
    icon: CalendarDays,
    accent: "border-sky-500/20 hover:border-sky-500/50",
    accentText: "text-sky-400",
    dot: "bg-sky-400",
  },
];

function getUploadErrorMessage(code: string | null) {
  switch (code) {
    case "missing_file":
      return "Sube un archivo PDF o Word (.docx) para continuar.";
    case "unsupported_file":
      return "Solo se permiten archivos PDF o Word (.docx) en este formulario.";
    case "transcribe_elsewhere":
      return "No pudimos leer ese archivo automaticamente. Si es un PDF exportado raro o escaneado, transcribelo con IA en otro lado y vuelve a subir el texto limpio.";
    default:
      return null;
  }
}

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
  uploadError,
}: Props) {
  const empresaDialog = useDialog();
  const promptDialog = useDialog();
  const [activePromptType, setActivePromptType] = useState<PromptTypeCard["key"] | null>(null);
  const uploadErrorMessage = getUploadErrorMessage(uploadError);

  const openPrompt = (key: PromptTypeCard["key"]) => {
    setActivePromptType(key);
    promptDialog.open();
  };

  const activeType = PROMPT_TYPES.find((t) => t.key === activePromptType) ?? null;
  const existingPrompt = activePromptType
    ? agenciaPrompts.find((p) => p.prompt_type === activePromptType)
    : undefined;

  return (
    <div className="flex w-full flex-1 flex-col gap-6 py-2 font-[family-name:var(--font-geist-sans)]">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d0d] px-8 py-10 sm:px-12 sm:py-14">
        {/* Noise texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px 128px",
          }}
        />
        {/* Subtle radial accent */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-48 w-48 rounded-full bg-amber-500/5 blur-2xl" />

        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center gap-2">
              <span className="h-px w-8 bg-amber-500/70" />
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-500/80">
                Panel principal
              </span>
            </div>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-5xl">
              Todo el contexto operativo
              <br />
              <span className="text-white/30">en una sola vista.</span>
            </h1>
            <p className="text-sm leading-7 text-white/40 sm:text-base">
              Gestiona clientes, activa prompts y sube conocimiento reusable sin salir del flujo.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={empresaDialog.open}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-amber-400 hover:-translate-y-px active:scale-95"
              >
                <Plus size={14} />
                Nueva empresa
              </button>
              <Link
                href="/protected/empresas"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Ver panel
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="flex shrink-0 gap-3 sm:gap-4">
            <HeroStat label="Empresas" count={empresasCount} icon={<Building2 size={13} />} />
            <HeroStat label="BEC" count={becCount} icon={<LayoutGrid size={13} />} />
            <HeroStat label="Briefs" count={briefsCount} icon={<FileText size={13} />} />
          </div>
        </div>
      </section>

      {/* ── ROW 2: Empresas + Flujo ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">

        {/* Empresas recientes */}
        <Panel
          label="Clientes"
          title="Empresas recientes"
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={empresaDialog.open}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-black transition-all hover:bg-amber-400"
              >
                <Plus size={12} />
                Nueva
              </button>
              <Link
                href="/protected/empresas"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-white/50 transition-all hover:border-white/20 hover:text-white/80"
              >
                Ver todas
                <ArrowUpRight size={12} />
              </Link>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {recentEmpresas.map((empresa, i) => (
              <Link
                key={empresa.id}
                href={`/protected/empresas/${empresa.id}`}
                className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-all hover:border-white/[0.12] hover:bg-white/[0.06]"
              >
                {/* Index number watermark */}
                <span className="absolute right-4 top-3 font-mono text-4xl font-bold text-white/[0.04]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="relative flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-sm font-bold text-amber-400">
                    {empresa.nombre?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="text-white/20 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-amber-400"
                  />
                </div>
                <div className="relative mt-4">
                  <p className="font-semibold text-white/90 leading-snug">{empresa.nombre}</p>
                  {empresa.industria && (
                    <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/40">
                      {empresa.industria}
                    </span>
                  )}
                </div>
              </Link>
            ))}

            {!recentEmpresas.length && (
              <div className="col-span-full flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-center">
                <Sparkles size={22} className="mb-3 text-amber-500/40" />
                <p className="text-sm font-medium text-white/40">Sin empresas aún</p>
                <p className="mt-1 max-w-xs text-xs text-white/20">
                  Crea la primera para organizar briefs, documentos y planes.
                </p>
              </div>
            )}
          </div>
        </Panel>

        {/* Ritmo de trabajo */}
    
      </div>

      {/* ── ROW 3: Cerebro + Prompts ─────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">

        {/* Cerebro / documentos */}
        <Panel label="Conocimiento" title="Cerebro estratégico">
          {uploadErrorMessage && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/85">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
              <p className="leading-relaxed">{uploadErrorMessage}</p>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[0.65fr_1.35fr]">
            {/* What to upload */}
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                Qué archivos subir
              </p>
              <ul className="space-y-2">
                {["Briefs y manuales", "Metodologías internas", "Plantillas editables", "FAQs, criterios y reportes"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-white/40">
                      <span className="h-px w-3 bg-amber-500/40" />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Upload form */}
            <form
              action={createAgenciaDocument}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="title"
                  placeholder="Título opcional"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none transition focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                />
                <input
                  name="doc_type"
                  defaultValue="archivo"
                  placeholder="Tipo de documento"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none transition focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                />
              </div>

              <input
                type="file"
                name="file"
                required
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="w-full rounded-lg border border-dashed border-white/[0.12] bg-white/[0.03] px-3 py-3 text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black hover:border-amber-500/30"
              />
              <p className="text-[11px] leading-relaxed text-white/25">
                Formatos soportados: PDF y Word (.docx).
              </p>
              <div className="flex justify-end">
                <button className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 active:scale-95">
                  <Save size={12} />
                  Subir archivo
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4">
            <AgenciaDocumentsManager documents={agenciaDocuments} />
          </div>
        </Panel>

        {/* Prompts */}
        <Panel label="IA" title="Prompts de la agencia">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {PROMPT_TYPES.map((pt) => {
              const existing = agenciaPrompts.find((p) => p.prompt_type === pt.key);
              const Icon = pt.icon;
              return (
                <button
                  key={pt.key}
                  type="button"
                  onClick={() => openPrompt(pt.key)}
                  className={`group relative overflow-hidden rounded-xl border bg-white/[0.02] p-5 text-left transition-all hover:bg-white/[0.04] hover:-translate-y-0.5 ${pt.accent}`}
                >
                  <div className="mb-5 flex items-start justify-between gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 ${pt.accentText}`}>
                      <Icon size={16} />
                    </div>
                    <ChevronRight
                      size={14}
                      className="text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-white/50"
                    />
                  </div>
                  <p className="text-sm font-semibold text-white/90">{pt.label}</p>
                  <p className="mt-1 text-xs text-white/30">{pt.description}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${existing ? pt.dot : "bg-white/10"}`} />
                    <span className="text-[11px] text-white/30">
                      {existing ? `v${existing.version} · ${existing.activo ? "activo" : "inactivo"}` : "Sin configurar"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Usage hint */}
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/[0.12] bg-amber-500/[0.04] p-4">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-500/60" />
            <p className="text-xs leading-relaxed text-white/30">
              Los prompts de agencia se aplican globalmente a todos los clientes. Configúralos con tu metodología base para mantener consistencia.
            </p>
          </div>
        </Panel>
      </div>

      {/* ── MODAL: Nueva empresa ─────────────────────────────────── */}
      <dialog
        ref={empresaDialog.ref}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-0 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-md open:flex open:flex-col"
        onClose={empresaDialog.close}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white/90">Nueva empresa</h2>
            <p className="text-xs text-white/30">Agrega un nuevo cliente al workspace.</p>
          </div>
          <button
            type="button"
            onClick={empresaDialog.close}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] text-white/30 transition hover:border-white/20 hover:text-white/60"
          >
            <X size={13} />
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
          <div className="space-y-3">
            <ModalField label="Nombre *">
              <input
                name="nombre"
                required
                placeholder="Ej: Acme Corp"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none transition focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
              />
            </ModalField>
            <div className="grid gap-3 sm:grid-cols-2">
              <ModalField label="Industria">
                <input
                  name="industria"
                  placeholder="Ej: Tecnología"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none transition focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                />
              </ModalField>
              <ModalField label="País">
                <input
                  name="pais"
                  placeholder="Ej: Perú"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none transition focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                />
              </ModalField>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={empresaDialog.close}
              className="rounded-full border border-white/[0.08] px-4 py-2 text-xs font-medium text-white/40 transition hover:border-white/20 hover:text-white/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 active:scale-95"
            >
              <Plus size={12} />
              Crear empresa
            </button>
          </div>
        </form>
      </dialog>

      {/* ── MODAL: Prompt ────────────────────────────────────────── */}
      <dialog
        ref={promptDialog.ref}
        className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-0 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-md open:flex open:flex-col"
        onClose={promptDialog.close}
      >
        {activeType && (
          <>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 ${activeType.accentText}`}>
                  <activeType.icon size={15} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/90">Prompt · {activeType.label}</h2>
                  <p className="text-xs text-white/30">{activeType.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={promptDialog.close}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] text-white/30 transition hover:border-white/20 hover:text-white/60"
              >
                <X size={13} />
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
              {existingPrompt && <input type="hidden" name="prompt_id" value={existingPrompt.id} />}

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-white/20">
                  Texto del prompt *
                </label>
                <textarea
                  name="prompt_text"
                  rows={12}
                  required
                  placeholder={`Escribe aquí el prompt del sistema para ${activeType.label}...`}
                  defaultValue={existingPrompt?.prompt_text ?? ""}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#0d0d0d] px-4 py-3 font-mono text-sm leading-relaxed text-white/70 placeholder-white/15 outline-none transition focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/10"
                />
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                <div className="flex items-center gap-2">
                  {existingPrompt && (
                    <>
                      <button
                        type="submit"
                        formAction={deleteAgenciaPrompt}
                        formNoValidate
                        onClick={promptDialog.close}
                        className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400/70 transition hover:border-red-500/40 hover:text-red-400"
                      >
                        <Trash2 size={11} />
                        Eliminar
                      </button>
                      <span className={`rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium ${activeType.accentText}`}>
                        v{existingPrompt.version}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={promptDialog.close}
                    className="rounded-full border border-white/[0.08] px-4 py-2 text-xs font-medium text-white/40 transition hover:border-white/20 hover:text-white/70"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 active:scale-95"
                  >
                    <Save size={12} />
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

// ── Sub-components ──────────────────────────────────────────────────────────

function Panel({
  label,
  title,
  actions,
  children,
}: {
  label: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/60">
            {label}
          </span>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white/90">{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function HeroStat({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 text-center">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-white/25">
        {icon}
        {label}
      </div>
      <span className="text-3xl font-semibold tracking-tight text-white/90">{count}</span>
    </div>
  );
}

function ModalField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-widest text-white/25">{label}</label>
      {children}
    </div>
  );
}
