"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { createBrief, generateBriefDraft } from "@/app/protected/actions";
import {
  BRIEF_OBJECTIVE_GROUPS,
  BRIEF_TEXT_FIELDS,
  BriefFormState,
  makeDefaultBriefForm,
} from "@/lib/brief/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type BriefEditorProps = {
  empresaId: string;
  initialPeriodo?: string;
  initialEstado?: string;
  initialFormState: BriefFormState;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMonthInput(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GenerateAiButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white/90 disabled:opacity-50"
      >
        {pending ? (
          <>
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/25 border-t-white/70 animate-spin" />
            Generando…
          </>
        ) : (
          <>
            <span className="text-emerald-400/80">✦</span>
            Generar brief con IA
          </>
        )}
      </button>
      {pending ? (
        <span className="text-[11px] text-white/30 italic">Procesando BEC + RAG…</span>
      ) : null}
    </div>
  );
}

function SaveBriefButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/25 disabled:opacity-50"
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Guardando…
        </>
      ) : (
        <>
          <span className="text-white/70">↑</span>
          Guardar brief del mes
        </>
      )}
    </button>
  );
}

const BRIEF_STATUS_OPTIONS = [
  {
    value: "plan",
    label: "Plan",
    hint: "Listo para trabajar",
    tone: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    dot: "bg-sky-300",
  },
  {
    value: "revision",
    label: "Revision",
    hint: "Requiere ajustes",
    tone: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    dot: "bg-amber-300",
  },
  {
    value: "aprobado",
    label: "Aprobado",
    hint: "Validado para operar",
    tone: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    dot: "bg-emerald-300",
  },
  {
    value: "exception",
    label: "Excepcion",
    hint: "Fuera del flujo normal",
    tone: "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200",
    dot: "bg-fuchsia-300",
  },
] as const;

// ─── Objective Group Card ─────────────────────────────────────────────────────

function ObjectiveGroupCard({
  group,
  formState,
  setFormState,
}: {
  group: (typeof BRIEF_OBJECTIVE_GROUPS)[number];
  formState: BriefFormState;
  setFormState: React.Dispatch<React.SetStateAction<BriefFormState>>;
}) {
  const selected = group.options.filter((o) => formState.objectives[group.id]?.[o]);
  const count = selected.length;

  return (
    <section className="rounded-2xl border border-white/7 bg-white/[0.018] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <h3 className="text-[13px] font-semibold text-white/80">{group.title}</h3>
        <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 border ${
          count > 0
            ? "text-emerald-300 bg-emerald-300/10 border-emerald-300/20"
            : "text-white/25 bg-white/5 border-white/8"
        }`}>
          {count} sel.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 2xl:grid-cols-3">
        {group.options.map((option) => {
          const checked = !!formState.objectives[group.id]?.[option];
          return (
            <label
              key={option}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-all duration-150 ${
                checked
                  ? "border-emerald-400/30 bg-emerald-400/8 text-emerald-200"
                  : "border-white/7 bg-white/[0.025] text-white/45 hover:border-white/14 hover:text-white/65"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-all ${
                  checked
                    ? "border-emerald-400/60 bg-emerald-500/30 text-emerald-300"
                    : "border-white/15 bg-white/5"
                }`}
              >
                {checked ? "✓" : ""}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    objectives: {
                      ...prev.objectives,
                      [group.id]: {
                        ...prev.objectives[group.id],
                        [option]: e.target.checked,
                      },
                    },
                  }))
                }
              />
              <span className="text-[12px] font-medium leading-snug">{option}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

// ─── Text Field Card ──────────────────────────────────────────────────────────

function TextFieldCard({
  field,
  value,
  onChange,
  index,
}: {
  field: string;
  value: string;
  onChange: (v: string) => void;
  index: number;
}) {
  const filled = value.trim().length > 0;
  return (
    <section className="rounded-2xl border border-white/7 bg-white/[0.018] overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-white/5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/8 text-[11px] font-bold text-white/40">
          {index + 1}
        </span>
        <p className="text-[13px] font-semibold text-white/75 leading-snug pt-0.5">{field}</p>
        {filled ? (
          <span className="ml-auto shrink-0 text-[10px] font-semibold text-emerald-400/70 pt-0.5">✓</span>
        ) : null}
      </div>
      <div className="p-4">
        <textarea
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe una respuesta concreta, accionable y con contexto del mes."
          className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[13px] text-white/70 leading-relaxed placeholder:text-white/20 focus:outline-none focus:border-white/16 focus:bg-white/[0.04] transition-all resize-none"
          style={{ fontFamily: "inherit" }}
        />
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BriefEditor({
  empresaId,
  initialPeriodo,
  initialEstado,
  initialFormState,
}: BriefEditorProps) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(initialPeriodo ?? toMonthInput());
  const [estado, setEstado] = useState(initialEstado ?? "plan");
  const [formState, setFormState] = useState<BriefFormState>(
    initialFormState ?? makeDefaultBriefForm(),
  );
  const [aiError, setAiError] = useState("");
  const [saveError, setSaveError] = useState("");
  const serialized = useMemo(() => JSON.stringify(formState), [formState]);

  // Progress calculation
  const totalObjectives = BRIEF_OBJECTIVE_GROUPS.reduce((a, g) => a + g.options.length, 0);
  const checkedObjectives = Object.values(formState.objectives).reduce(
    (a, group) => a + Object.values(group).filter(Boolean).length, 0
  );
  const filledFields = BRIEF_TEXT_FIELDS.filter((f) => formState.fields[f]?.trim()).length;
  const hasStrategicAnswer = formState.strategicChanges !== undefined && formState.strategicChanges !== "";
  const totalSteps = BRIEF_TEXT_FIELDS.length + 1; // fields + strategic
  const completedSteps = filledFields + (hasStrategicAnswer ? 1 : 0);
  const progressPct = Math.round((completedSteps / totalSteps) * 100);
  const saveBrief = async (fd: FormData) => {
    setSaveError("");
    setAiError("");
    try {
      const result = await createBrief(fd);
      if (result?.briefId) {
        router.push(`/protected/empresas/${empresaId}/briefs/${result.briefId}`);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el brief.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
      {/* ── Header card ──────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/8 bg-white/[0.018] p-5 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" style={{ animationDuration: "2s" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300/70">
                Brief mensual
              </h2>
            </div>
            <p className="text-[12px] text-white/35 leading-relaxed">
              Completa el formulario por mes y año. Si el periodo ya existe, se actualizará la versión.
            </p>
          </div>

          {/* Progress ring area */}
          <div className="shrink-0 text-right">
            <p className="text-[22px] font-bold text-white leading-none">{progressPct}%</p>
            <p className="text-[10px] text-white/25 uppercase tracking-wider mt-0.5">completado</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/6 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Period + AI action */}
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-white/30 pl-0.5">Periodo</label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white/75 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              style={{ fontFamily: "inherit", colorScheme: "dark" }}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-white/30 pl-0.5">Estado operativo</label>
            <div className="grid grid-cols-2 gap-2">
              {BRIEF_STATUS_OPTIONS.map((option) => {
                const active = estado === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEstado(option.value)}
                    className={`rounded-2xl border px-3.5 py-3 text-left transition-all ${
                      active
                        ? option.tone
                        : "border-white/8 bg-white/[0.025] text-white/55 hover:border-white/14 hover:bg-white/[0.04] hover:text-white/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${active ? option.dot : "bg-white/20"}`} />
                      <span className="text-sm font-semibold">{option.label}</span>
                    </div>
                    <p className={`mt-1 text-[11px] ${active ? "text-current/80" : "text-white/30"}`}>
                      {option.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <form
            action={async (fd) => {
              setAiError("");
              try {
                const result = await generateBriefDraft(fd);
                if (result?.briefId) {
                  router.push(`/protected/empresas/${empresaId}/briefs/${result.briefId}`);
                  router.refresh();
                  return;
                }
                router.refresh();
              } catch (error) {
                setAiError(error instanceof Error ? error.message : "No se pudo generar el brief con IA.");
              }
            }}
          >
            <input type="hidden" name="empresa_id" value={empresaId} />
            <input type="hidden" name="periodo" value={periodo} />
            <GenerateAiButton />
          </form>
          {aiError ? (
            <p className="text-[11px] text-rose-300/85">{aiError}</p>
          ) : null}
          <form action={saveBrief} className="pt-1">
            <input type="hidden" name="empresa_id" value={empresaId} />
            <input type="hidden" name="periodo" value={periodo} />
            <input type="hidden" name="estado" value={estado} />
            <input type="hidden" name="contenido" value={serialized} />
            <SaveBriefButton />
          </form>
          {saveError ? (
            <p className="text-[11px] text-rose-300/85">{saveError}</p>
          ) : null}
        </div>
      </section>
      </aside>

      <div className="space-y-4">

      {/* ── Objectives ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/25 px-1">
          Objetivos — {checkedObjectives}/{totalObjectives}
        </p>
        <div className="grid gap-3">
          {BRIEF_OBJECTIVE_GROUPS.map((group) => (
            <ObjectiveGroupCard
              key={group.id}
              group={group}
              formState={formState}
              setFormState={setFormState}
            />
          ))}
        </div>
      </div>

      {/* ── Text fields ──────────────────────────────────────────────── */}
      <div className="space-y-2 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/25 px-1">
          Preguntas — {filledFields}/{BRIEF_TEXT_FIELDS.length}
        </p>
        <div className="grid gap-3 2xl:grid-cols-2">
          {BRIEF_TEXT_FIELDS.map((field, i) => (
            <TextFieldCard
              key={field}
              field={field}
              value={formState.fields[field] ?? ""}
              onChange={(v) =>
                setFormState((prev) => ({
                  ...prev,
                  fields: { ...prev.fields, [field]: v },
                }))
              }
              index={i}
            />
          ))}
        </div>
      </div>

      {/* ── Strategic changes ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/7 bg-white/[0.018] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/8 text-[11px] font-bold text-white/40">
            {BRIEF_TEXT_FIELDS.length + 1}
          </span>
          <p className="text-[13px] font-semibold text-white/75 leading-snug">
            Cambios estratégicos — ¿Hubo algún cambio que afecte el BEC?
          </p>
          <p className="text-[11px] text-white/30 ml-1 mt-0.5 hidden sm:block">
            (objetivos, buyer persona, tono, pilares o KPIs)
          </p>
        </div>
        <div className="flex gap-3 p-4">
          {(["si", "no"] as const).map((val) => {
            const active = formState.strategicChanges === val;
            return (
              <label
                key={val}
                className={`flex items-center gap-2.5 rounded-xl border px-5 py-3 cursor-pointer transition-all duration-150 ${
                  active
                    ? val === "si"
                      ? "border-amber-400/30 bg-amber-400/8 text-amber-200"
                      : "border-teal-400/30 bg-teal-400/8 text-teal-200"
                    : "border-white/7 bg-white/[0.025] text-white/40 hover:border-white/14 hover:text-white/60"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                    active
                      ? val === "si"
                        ? "border-amber-400/60 bg-amber-500/30 text-amber-300"
                        : "border-teal-400/60 bg-teal-500/30 text-teal-300"
                      : "border-white/15 bg-white/5"
                  }`}
                >
                  {active ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
                </span>
                <input
                  type="radio"
                  name="strategicChanges"
                  className="sr-only"
                  checked={active}
                  onChange={() =>
                    setFormState((prev) => ({ ...prev, strategicChanges: val }))
                  }
                />
                <span className="text-sm font-semibold capitalize">{val === "si" ? "Sí" : "No"}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* ── Save ─────────────────────────────────────────────────────── */}
      <form
        action={saveBrief}
        className="pt-2 flex justify-end"
      >
        <input type="hidden" name="empresa_id" value={empresaId} />
        <input type="hidden" name="periodo" value={periodo} />
        <input type="hidden" name="estado" value={estado} />
        <input type="hidden" name="contenido" value={serialized} />
        <SaveBriefButton />
      </form>
      {saveError ? (
        <p className="text-right text-[11px] text-rose-300/85">{saveError}</p>
      ) : null}
      </div>
    </div>
  );
}
