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

// ─── Types ────────────────────────────────────────────────────────────────────

type BecEditorProps = {
  empresaId: string;
  initialCompany: CompanyForm;
  initialBec: BECState;
  becVersion: number;
};

// ─── Input primitives ────────────────────────────────────────────────────────

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
    "w-full rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white/75 leading-relaxed placeholder:text-white/18 focus:outline-none focus:border-white/16 focus:bg-white/[0.045] transition-all resize-none";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-white/35 pl-0.5">{label}</label>
        {filled && <span className="text-[10px] font-semibold text-sky-400/70">✓</span>}
      </div>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
          style={{ fontFamily: "inherit" }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
          style={{ fontFamily: "inherit" }}
        />
      )}
    </div>
  );
}

// ─── Pilar row ────────────────────────────────────────────────────────────────

function PilarRow({
  pilar,
  idx,
  onChange,
}: {
  pilar: { pilar: string; porcentaje: string; canales: string; formatos: string };
  idx: number;
  onChange: (field: string, val: string) => void;
}) {
  const ACCENT_COLORS = [
    "from-sky-400 to-blue-500",
    "from-violet-400 to-indigo-500",
    "from-teal-400 to-cyan-500",
    "from-rose-400 to-pink-500",
    "from-amber-400 to-orange-500",
    "from-emerald-400 to-green-500",
  ];
  const accent = ACCENT_COLORS[idx % ACCENT_COLORS.length];

  return (
    <div className="rounded-xl border border-white/7 bg-white/[0.018] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-[10px] font-bold text-white shadow opacity-80`}
        >
          {idx + 1}
        </span>
        <input
          value={pilar.pilar}
          onChange={(e) => onChange("pilar", e.target.value)}
          placeholder={`Pilar ${idx + 1}`}
          className="flex-1 bg-transparent text-[13px] font-semibold text-white/75 placeholder:text-white/25 focus:outline-none"
          style={{ fontFamily: "inherit" }}
        />
        {pilar.porcentaje && (
          <span className="shrink-0 font-mono text-[11px] text-white/35">{pilar.porcentaje}</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
        {(
          [
            { key: "porcentaje", label: "% Contenido", placeholder: "20%" },
            { key: "canales", label: "Canales", placeholder: "Instagram, Email…" },
            { key: "formatos", label: "Formatos", placeholder: "Reels, carruseles…" },
          ] as const
        ).map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="text-[10px] font-medium text-white/25 pl-0.5">{label}</label>
            <input
              value={(pilar as Record<string, string>)[key]}
              onChange={(e) => onChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-white/6 bg-white/[0.025] px-2.5 py-1.5 text-[12px] text-white/60 placeholder:text-white/18 focus:outline-none focus:border-white/14 transition-all"
              style={{ fontFamily: "inherit" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BEC Section ─────────────────────────────────────────────────────────────

function BecSection({
  section,
  bec,
  setBec,
}: {
  section: (typeof BEC_TEMPLATE)[number];
  bec: BECState;
  setBec: React.Dispatch<React.SetStateAction<BECState>>;
}) {
  const [open, setOpen] = useState(true);
  const fieldRows = section.rows.filter(
    (r): r is { kind: "field"; key: BECFieldKey; desc: string; example: string } =>
      r.kind === "field"
  );
  const hasPillars = section.rows.some((r) => r.kind === "pillars");

  const filledCount = fieldRows.filter((r) => bec.fields[r.key]?.trim()).length;
  const total = fieldRows.length;

  return (
    <div className="rounded-2xl border border-white/7 bg-white/[0.018] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.025] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white/80">{section.title}</p>
        </div>
        {total > 0 && (
          <span
            className={`shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-0.5 border ${
              filledCount === total
                ? "text-sky-300 bg-sky-300/10 border-sky-300/20"
                : filledCount > 0
                ? "text-amber-300 bg-amber-300/10 border-amber-300/20"
                : "text-white/25 bg-white/5 border-white/8"
            }`}
          >
            {filledCount}/{total}
          </span>
        )}
        {hasPillars && (
          <span className="shrink-0 text-[11px] text-white/25">{bec.pilares.length}p</span>
        )}
        <span
          className="shrink-0 text-sm text-white/20 transition-transform duration-200"
          style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-white/5 px-5 py-5 space-y-4">
          {/* Field rows */}
          {fieldRows.length > 0 && (
            <div className="space-y-4">
              {fieldRows.map((row) => (
                <div key={row.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-white/60">{row.key}</p>
                    {bec.fields[row.key]?.trim() && (
                      <span className="text-[10px] font-semibold text-sky-400/70 shrink-0">✓</span>
                    )}
                  </div>
                  {row.desc && (
                    <p className="text-[11px] text-white/30 leading-relaxed">{row.desc}</p>
                  )}
                  <textarea
                    rows={4}
                    value={bec.fields[row.key] ?? ""}
                    onChange={(e) =>
                      setBec((prev) => ({
                        ...prev,
                        fields: { ...prev.fields, [row.key]: e.target.value },
                      }))
                    }
                    placeholder={row.example}
                    className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-white/65 leading-relaxed placeholder:text-white/18 focus:outline-none focus:border-white/16 transition-all resize-none"
                    style={{ fontFamily: "inherit" }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pillar rows */}
          {hasPillars && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/25">
                Pilares de contenido
              </p>
              <div className="space-y-2">
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
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setBec((prev) => ({
                      ...prev,
                      pilares: [
                        ...prev.pilares,
                        { pilar: "", porcentaje: "", canales: "", formatos: "" },
                      ],
                    }))
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-2 text-[12px] font-medium text-white/45 hover:border-white/14 hover:text-white/65 transition-all"
                >
                  <span className="text-sky-400/80">+</span> Agregar pilar
                </button>
                {bec.pilares.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setBec((prev) => ({
                        ...prev,
                        pilares: prev.pilares.slice(0, -1),
                      }))
                    }
                    className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-2 text-[12px] font-medium text-white/35 hover:border-red-400/20 hover:text-red-300/60 transition-all"
                  >
                    <span>−</span> Quitar último
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BecEditor({
  empresaId,
  initialCompany,
  initialBec,
  becVersion,
}: BecEditorProps) {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyForm>({
    ...DEFAULT_COMPANY,
    ...initialCompany,
  });
  const [bec, setBec] = useState<BECState>(initialBec);
  const [loadingBec, setLoadingBec] = useState(false);
  const [savingBec, setSavingBec] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const serializedBec = useMemo(() => JSON.stringify(bec), [bec]);

  // Progress
  const allFields = BEC_TEMPLATE.flatMap((s) =>
    s.rows.filter((r): r is { kind: "field"; key: BECFieldKey; desc: string; example: string } => r.kind === "field")
  );
  const filledFields = allFields.filter((r) => bec.fields[r.key]?.trim()).length;
  const progressPct = allFields.length > 0 ? Math.round((filledFields / allFields.length) * 100) : 0;

  async function generateBEC() {
    setLoadingBec(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch(`/api/empresas/${empresaId}/bec/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, bec }),
      });
      const data = (await res.json()) as { error?: string; bec?: BECState };
      if (!res.ok || data.error || !data.bec) throw new Error(data.error || "No se pudo generar BEC");
      setBec(data.bec);
      setStatus("BEC generado con IA. Revisa los campos y guarda cuando estés listo.");
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
    <div className="space-y-4">

      {/* ── Context card ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/8 bg-white/[0.018] p-5 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-50 animate-ping" style={{ animationDuration: "2s" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
              </span>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-300/70">
                Contexto base
              </h2>
            </div>
            <p className="text-[12px] text-white/35 leading-relaxed">
              Completa el contexto y genera el BEC con IA, o edita los campos directamente.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[22px] font-bold text-white leading-none">{progressPct}%</p>
            <p className="text-[10px] text-white/25 uppercase tracking-wider mt-0.5">completado</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/6 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente" value={company.negocio}
            onChange={(v) => setCompany((p) => ({ ...p, negocio: v }))} />
          <Field label="Marca" value={company.marca}
            onChange={(v) => setCompany((p) => ({ ...p, marca: v }))} />
          <Field label="Industria del negocio" value={company.industria}
            onChange={(v) => setCompany((p) => ({ ...p, industria: v }))} />
          <Field label="País" value={company.pais}
            onChange={(v) => setCompany((p) => ({ ...p, pais: v }))} />
          <Field label="Objetivo" value={company.objetivo} multiline rows={5}
            placeholder="¿Qué quiere lograr la empresa?"
            onChange={(v) => setCompany((p) => ({ ...p, objetivo: v }))} />
          <Field label="Problema" value={company.problema} multiline rows={5}
            placeholder="¿Qué problema queremos resolver?"
            onChange={(v) => setCompany((p) => ({ ...p, problema: v }))} />
        </div>

        <button
          type="button"
          onClick={generateBEC}
          disabled={loadingBec}
          className="flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-500 hover:shadow-sky-500/25 disabled:opacity-50"
        >
          {loadingBec ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Generando BEC…
            </>
          ) : (
            <>
              <span className="text-white/60">✦</span>
              Generar BEC con IA
            </>
          )}
        </button>
      </section>

      {/* ── BEC sections ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/25">
            BEC — formato completo
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-white/20">v{becVersion}</span>
            <span className="text-[11px] text-white/20">·</span>
            <span className="text-[11px] text-white/30">{filledFields}/{allFields.length} campos</span>
          </div>
        </div>

        {BEC_TEMPLATE.map((section) => (
          <BecSection key={section.title} section={section} bec={bec} setBec={setBec} />
        ))}
      </div>

      {/* ── Feedback messages ─────────────────────────────────────── */}
      {(status || error) && (
        <div className={`rounded-xl border px-4 py-3 text-[12px] ${
          error
            ? "border-red-400/20 bg-red-400/8 text-red-300"
            : "border-emerald-400/20 bg-emerald-400/8 text-emerald-300"
        }`}>
          {error || status}
        </div>
      )}

      {/* ── Save ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSaveBEC} className="pt-2 flex justify-end">
        <button
          disabled={savingBec}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 disabled:opacity-50"
        >
          {savingBec ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <span className="text-white/70">↑</span>
              Guardar BEC
            </>
          )}
        </button>
      </form>
    </div>
  );
}