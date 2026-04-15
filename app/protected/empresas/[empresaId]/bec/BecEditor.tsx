"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBec } from "@/app/protected/actions";
import {
  BEC_TEMPLATE,
  BECFieldKey,
  BECState,
  CompanyForm,
  DEFAULT_COMPANY,
} from "@/lib/bec/schema";
import { Save, Sparkles } from "lucide-react";

type BecEditorProps = {
  empresaId: string;
  initialCompany: CompanyForm;
  initialBec: BECState;
  becVersion: number;
  initialScores?: {
    confidence?: number;
    data_quality?: number;
    risk?: number;
  };
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-PE").format(value);
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const filled = value.trim().length > 0;
  const base =
    "w-full rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-[13px] leading-relaxed text-white/80 placeholder:text-white/18 transition-all focus:border-white/16 focus:bg-white/[0.045] focus:outline-none resize-none";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="pl-0.5 text-[11px] font-medium text-white/40">{label}</label>
        {filled ? <span className="text-[10px] font-semibold text-sky-400/80">OK</span> : null}
      </div>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  );
}

function PilarRow({
  pilar,
  idx,
  onChange,
}: {
  pilar: { pilar: string; porcentaje: string; canales: string; formatos: string };
  idx: number;
  onChange: (field: string, val: string) => void;
}) {
  const accents = [
    "bg-sky-400",
    "bg-cyan-400",
    "bg-emerald-400",
    "bg-rose-400",
    "bg-amber-400",
    "bg-lime-400",
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
      <div className="grid gap-4 border-b border-white/7 p-5 lg:grid-cols-[minmax(0,1fr)_140px]">
        <div className="flex items-center gap-4">
        <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accents[idx % accents.length]} text-sm font-bold text-black/80`}
        >
          {idx + 1}
        </span>
          <div className="min-w-0 flex-1">
            <textarea
              rows={2}
              value={pilar.pilar}
              onChange={(e) => onChange("pilar", e.target.value)}
              placeholder={`Pilar ${idx + 1}`}
              className="w-full resize-none bg-transparent text-[15px] font-semibold leading-relaxed text-white/85 placeholder:text-white/25 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="pl-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/34">
            % Contenido
          </label>
          <input
            value={pilar.porcentaje}
            onChange={(e) => onChange("porcentaje", e.target.value)}
            placeholder="20%"
            className="h-[74px] w-full rounded-lg border border-white/10 bg-black/20 px-4 text-center text-[22px] font-bold tabular-nums text-white/85 placeholder:text-white/20 transition-all focus:border-sky-300/35 focus:bg-black/25 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="pl-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/34">
            Canales validados
          </label>
          <textarea
            rows={4}
            value={pilar.canales}
            onChange={(e) => onChange("canales", e.target.value)}
            placeholder="Ej: LinkedIn, Blog, Email Marketing. No agregues canales sin validar."
            className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-[14px] leading-relaxed text-white/78 placeholder:text-white/20 transition-all focus:border-sky-300/35 focus:bg-black/25 focus:outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="pl-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/34">
            Formatos validados
          </label>
          <textarea
            rows={4}
            value={pilar.formatos}
            onChange={(e) => onChange("formatos", e.target.value)}
            placeholder="Ej: articulos, entrevistas, newsletter. No agregues formatos sin evidencia."
            className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-[14px] leading-relaxed text-white/78 placeholder:text-white/20 transition-all focus:border-sky-300/35 focus:bg-black/25 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function BecSection({
  section,
  bec,
  setBec,
}: {
  section: (typeof BEC_TEMPLATE)[number];
  bec: BECState;
  setBec: React.Dispatch<React.SetStateAction<BECState>>;
}) {
  const [open, setOpen] = useState(section.title === BEC_TEMPLATE[0]?.title);
  const fieldRows = section.rows.filter(
    (r): r is { kind: "field"; key: BECFieldKey; desc: string; example: string } => r.kind === "field",
  );
  const hasPillars = section.rows.some((r) => r.kind === "pillars");
  const filledCount = fieldRows.filter((r) => bec.fields[r.key]?.trim()).length;
  const total = fieldRows.length;

  const getFieldLayout = (row: { key: BECFieldKey; desc: string; example: string }) => {
    const textWeight = `${row.desc} ${row.example}`.length;
    const isCompact = textWeight < 120;

    return {
      wrapperClass: isCompact ? "xl:col-span-1" : "xl:col-span-2",
      rows: isCompact ? 4 : 6,
    };
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-white/7 bg-white/[0.018]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.025]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white/85">{section.title}</p>
        </div>
        {total > 0 ? (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              filledCount === total
                ? "border-sky-300/20 bg-sky-300/10 text-sky-300"
                : filledCount > 0
                  ? "border-amber-300/20 bg-amber-300/10 text-amber-300"
                  : "border-white/8 bg-white/5 text-white/30"
            }`}
          >
            <span className="tabular-nums">
              {formatNumber(filledCount)}/{formatNumber(total)}
            </span>
          </span>
        ) : null}
        {hasPillars ? (
          <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/35">
            <span className="tabular-nums">{formatNumber(bec.pilares.length)}</span> pilares
          </span>
        ) : null}
        <span
          className="text-sm text-white/22 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-white/5 px-5 py-5">
          {fieldRows.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {fieldRows.map((row) => (
                <div
                  key={row.key}
                  className={`space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4 ${getFieldLayout(row).wrapperClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-white/68">{row.key}</p>
                    {bec.fields[row.key]?.trim() ? (
                      <span className="shrink-0 text-[10px] font-semibold text-sky-400/80">OK</span>
                    ) : null}
                  </div>
                  {row.desc ? <p className="text-[11px] leading-relaxed text-white/32">{row.desc}</p> : null}
                  <textarea
                    rows={getFieldLayout(row).rows}
                    value={bec.fields[row.key] ?? ""}
                    onChange={(e) =>
                      setBec((prev) => ({
                        ...prev,
                        fields: { ...prev.fields, [row.key]: e.target.value },
                      }))
                    }
                    placeholder={row.example}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-[12px] leading-relaxed text-white/70 placeholder:text-white/18 transition-all focus:border-white/16 focus:outline-none resize-none"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {hasPillars ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/35">
                    Pilares de contenido
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/32">
                    Edita cada pilar con suficiente espacio. Canales y formatos deben quedar validados por alcance, metadata o documentos.
                  </p>
                </div>
                <span className="rounded-lg border border-white/8 bg-white/[0.035] px-3 py-1.5 text-[12px] font-semibold text-white/50">
                  {formatNumber(bec.pilares.length)} pilares
                </span>
              </div>
              <div className="space-y-4">
                {bec.pilares.map((pilar, idx) => (
                  <PilarRow
                    key={`pilar-${idx}`}
                    pilar={pilar}
                    idx={idx}
                    onChange={(field, val) =>
                      setBec((prev) => {
                        const next = [...prev.pilares];
                        next[idx] = { ...next[idx], [field]: val };
                        return { ...prev, pilares: next };
                      })
                    }
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setBec((prev) => ({
                      ...prev,
                      pilares: [...prev.pilares, { pilar: "", porcentaje: "", canales: "", formatos: "" }],
                    }))
                  }
                  className="rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-2 text-[12px] font-medium text-white/55 transition-all hover:border-white/14 hover:text-white/75"
                >
                  + Agregar pilar
                </button>
                {bec.pilares.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setBec((prev) => ({
                        ...prev,
                        pilares: prev.pilares.slice(0, -1),
                      }))
                    }
                    className="rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-2 text-[12px] font-medium text-white/40 transition-all hover:border-red-400/20 hover:text-red-300/70"
                  >
                    - Quitar ultimo
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function BecEditor({
  empresaId,
  initialCompany,
  initialBec,
}: BecEditorProps) {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyForm>({
    ...DEFAULT_COMPANY,
    ...initialCompany,
  });
  const [bec, setBec] = useState<BECState>(initialBec);
  const [loadingBec, setLoadingBec] = useState(false);
  const [savingBec, setSavingBec] = useState(false);
  const [regenerationPrompt, setRegenerationPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const visibleSections = useMemo(
    () => BEC_TEMPLATE.filter((section) => section.title !== "1. Datos Generales"),
    [],
  );

  const serializedBec = useMemo(() => JSON.stringify(bec), [bec]);

  const allFields = visibleSections.flatMap((section) =>
    section.rows.filter(
      (row): row is { kind: "field"; key: BECFieldKey; desc: string; example: string } => row.kind === "field",
    ),
  );
  const filledFields = allFields.filter((row) => bec.fields[row.key]?.trim()).length;
  const progressPct = allFields.length > 0 ? Math.round((filledFields / allFields.length) * 100) : 0;

  async function generateBEC() {
    setLoadingBec(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`/api/empresas/${empresaId}/bec/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, bec, prompt: regenerationPrompt }),
      });
      const data = (await res.json()) as { error?: string; bec?: BECState };
      if (!res.ok || data.error || !data.bec) {
        throw new Error(data.error || "No se pudo generar BEC");
      }
      setBec(data.bec);
      setStatus(
        regenerationPrompt.trim()
          ? "BEC regenerado con IA usando tus instrucciones. Revisa el contenido y guarda si te sirve."
          : "BEC generado con IA. Revisa el contenido y guarda cuando este listo.",
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoadingBec(false);
    }
  }

  async function handleSaveBEC(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBec(true);
    setError("");
    setStatus("");
    try {
      const fd = new FormData();
      fd.set("empresa_id", empresaId);
      fd.set("contenido", serializedBec);
      fd.set("marca", company.marca);
      fd.set("industria", company.industria);
      fd.set("pais", company.pais);
      fd.set("objetivo", company.objetivo);
      fd.set("problema", company.problema);
      await saveBec(fd);
      setStatus("BEC guardado correctamente.");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar BEC");
    } finally {
      setSavingBec(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="space-y-5 rounded-3xl border border-white/8 bg-white/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-50"
                    style={{ animationDuration: "2s" }}
                  />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-300/75">
                  Contexto base
                </h2>
              </div>
              <p className="max-w-xs text-[12px] leading-relaxed text-white/38">
                Completa los datos clave para generar y editar el BEC con mas contexto.
              </p>
            </div>
            <div className="text-right">
              <p className="tabular-nums text-[24px] font-bold leading-none text-white">
                {formatNumber(progressPct)}%
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/25">completado</p>
            </div>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <Field label="Cliente" value={company.negocio} onChange={(v) => setCompany((p) => ({ ...p, negocio: v }))} />
            <Field label="Marca" value={company.marca} onChange={(v) => setCompany((p) => ({ ...p, marca: v }))} />
            <Field
              label="Industria del negocio"
              value={company.industria}
              onChange={(v) => setCompany((p) => ({ ...p, industria: v }))}
            />
            <Field label="Pais" value={company.pais} onChange={(v) => setCompany((p) => ({ ...p, pais: v }))} />
            <div className="xl:col-span-2">
              <Field
                label="Objetivo"
                value={company.objetivo}
                multiline
                rows={5}
                placeholder="Que quiere lograr la empresa?"
                onChange={(v) => setCompany((p) => ({ ...p, objetivo: v }))}
              />
            </div>
            <div className="xl:col-span-2">
              <Field
                label="Problema"
                value={company.problema}
                multiline
                rows={5}
                placeholder="Que problema queremos resolver?"
                onChange={(v) => setCompany((p) => ({ ...p, problema: v }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="pl-0.5 text-[11px] font-medium text-white/40">
              Instrucciones para regenerar
            </label>
            <textarea
              rows={4}
              value={regenerationPrompt}
              onChange={(e) => setRegenerationPrompt(e.target.value)}
              placeholder="Ej: hazlo mas orientado a conversion B2B, evita tono aspiracional y refuerza diferenciadores del servicio."
              className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-[13px] leading-relaxed text-white/80 placeholder:text-white/18 transition-all focus:border-white/16 focus:bg-white/[0.045] focus:outline-none resize-none"
            />
            <p className="text-[11px] leading-relaxed text-white/28">
              Si ya existe un BEC, la IA lo tomara como base y aplicara esta instruccion para regenerarlo.
            </p>
          </div>

          <button
            type="button"
            onClick={generateBEC}
            disabled={loadingBec}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-500 disabled:opacity-50"
          >
            {loadingBec ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generando BEC...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {regenerationPrompt.trim() ? "Regenerar BEC con instrucciones" : "Generar BEC con IA"}
              </>
            )}
          </button>
        </section>

      </aside>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/28">BEC - formato completo</p>
            <p className="mt-1 text-[12px] text-white/32">Secciones compactas para trabajar mejor en escritorio.</p>
          </div>
        </div>

        <div className="space-y-3">
          {visibleSections.map((section) => (
            <BecSection key={section.title} section={section} bec={bec} setBec={setBec} />
          ))}
        </div>

        {status || error ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-[12px] ${
              error
                ? "border-red-400/20 bg-red-400/8 text-red-300"
                : "border-emerald-400/20 bg-emerald-400/8 text-emerald-300"
            }`}
          >
            {error || status}
          </div>
        ) : null}

        <form onSubmit={handleSaveBEC} className="flex justify-end pt-2">
          <button
            disabled={savingBec}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 disabled:opacity-50"
          >
            {savingBec ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={14} />
                Guardar BEC
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
