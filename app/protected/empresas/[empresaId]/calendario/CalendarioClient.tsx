"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { generateCalendarioDraft } from "@/app/protected/actions";

type JsonObj = Record<string, unknown>;

export type PlanArtifact = {
  id: string;
  title: string;
  status: string;
  version: number;
  inputs_json: unknown;
  updated_at: string;
};

export type CalendarioArtifact = {
  id: string;
  title: string;
  status: string;
  version: number;
  inputs_json: unknown;
  content_json: unknown;
  updated_at: string;
};

type Props = {
  empresaId: string;
  empresaNombre: string;
  planes: PlanArtifact[];
  calendarios: CalendarioArtifact[];
};

type Pieza = {
  fecha?: string;
  canal?: string;
  formato?: string;
  tema?: string;
  objetivo?: string;
  cta?: string;
};

type Semana = {
  semana?: string;
  objetivo?: string;
  piezas?: Pieza[];
};

const monthFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function fmt(periodo: string) {
  try {
    return monthFormatter.format(new Date(`${periodo}T00:00:00.000Z`));
  } catch {
    return periodo;
  }
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  approved: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
  aprobado: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
  draft: { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
  borrador: { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
  revision: { bg: "bg-sky-500/15", text: "text-sky-400", dot: "bg-sky-400" },
};

function statusStyle(status: string) {
  return (
    STATUS_STYLES[status] ?? {
      bg: "bg-zinc-500/15",
      text: "text-zinc-400",
      dot: "bg-zinc-400",
    }
  );
}

function asObj(value: unknown): JsonObj {
  return value && typeof value === "object" ? (value as JsonObj) : {};
}

function asSemanas(value: unknown): Semana[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const obj = asObj(row);
    const piezasRaw = Array.isArray(obj.piezas) ? obj.piezas : [];
    const piezas: Pieza[] = piezasRaw.map((piece) => {
      const p = asObj(piece);
      return {
        fecha: typeof p.fecha === "string" ? p.fecha : "",
        canal: typeof p.canal === "string" ? p.canal : "",
        formato: typeof p.formato === "string" ? p.formato : "",
        tema: typeof p.tema === "string" ? p.tema : "",
        objetivo: typeof p.objetivo === "string" ? p.objetivo : "",
        cta: typeof p.cta === "string" ? p.cta : "",
      };
    });
    return {
      semana: typeof obj.semana === "string" ? obj.semana : "",
      objetivo: typeof obj.objetivo === "string" ? obj.objetivo : "",
      piezas,
    };
  });
}

function StatusBadge({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function CalendarioLinkButton({
  empresaId,
  item,
}: {
  empresaId: string;
  item: CalendarioArtifact;
}) {
  const content = asObj(item.content_json);
  const inputs = asObj(item.inputs_json);
  const weeks = asSemanas(content.semanas);
  const periodo = typeof inputs.periodo === "string" ? inputs.periodo : "";
  const label = periodo ? fmt(periodo) : item.title;
  const totalPiezas = weeks.reduce((acc, w) => acc + (Array.isArray(w.piezas) ? w.piezas.length : 0), 0);

  return (
    <Link
      href={`/protected/empresas/${empresaId}/calendario/${item.id}`}
      className="block rounded-2xl border border-white/8 bg-white/2 p-5 transition-all duration-300 hover:border-white/10 hover:bg-white/3"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-white capitalize">{label}</p>
            <StatusBadge status={item.status} />
            <span className="text-xs text-white/30">v{item.version}</span>
          </div>
          <div className="mt-1 flex items-center gap-4">
            <span className="text-xs text-white/40">{weeks.length} semanas</span>
            <span className="text-xs text-white/40">{totalPiezas} piezas</span>
          </div>
        </div>
        <span className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/55">
          Ver calendario
        </span>
      </div>
    </Link>
  );
}

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition-all duration-200 shadow-lg shadow-indigo-500/20"
    >
      {pending ? "Generando..." : "Generar con IA"}
    </button>
  );
}

export default function CalendarioClient({ empresaId, empresaNombre, planes, calendarios }: Props) {
  const [selectedPlan, setSelectedPlan] = useState(planes[0]?.id ?? "");

  return (
    <div
      className="min-h-screen bg-zinc-950 text-white"
      style={{
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 80% 80%, rgba(139,92,246,0.07) 0%, transparent 60%)",
      }}
    >
      <style>{`
        .bg-white\\/2 { background-color: rgba(255,255,255,0.02); }
        .bg-white\\/3 { background-color: rgba(255,255,255,0.03); }
        .bg-white\\/5 { background-color: rgba(255,255,255,0.05); }
        .border-white\\/5 { border-color: rgba(255,255,255,0.05); }
        .border-white\\/7 { border-color: rgba(255,255,255,0.07); }
        .border-white\\/8 { border-color: rgba(255,255,255,0.08); }
        .border-white\\/10 { border-color: rgba(255,255,255,0.10); }
      `}</style>

      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-white/30 mb-3">
              <span>Empresas</span>
              <span>/</span>
              <span>{empresaNombre}</span>
              <span>/</span>
              <span className="text-white/60">Calendario</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Calendario editorial</h1>
            <p className="mt-1 text-sm text-white/40">{empresaNombre}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <Link href={`/protected/empresas/${empresaId}`} className="rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white/70 transition-all">
              {"<-"} Empresa
            </Link>
        
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/7 bg-white/2 p-4">
            <p className="text-2xl font-bold text-white">{calendarios.length}</p>
            <p className="mt-0.5 text-xs text-white/35">Calendarios</p>
          </div>
          <div className="rounded-xl border border-white/7 bg-white/2 p-4">
            <p className="text-2xl font-bold text-white">
              {calendarios.reduce((a, c) => a + asSemanas(asObj(c.content_json).semanas).length, 0)}
            </p>
            <p className="mt-0.5 text-xs text-white/35">Semanas totales</p>
          </div>
          <div className="rounded-xl border border-white/7 bg-white/2 p-4">
            <p className="text-2xl font-bold text-white">{planes.length}</p>
            <p className="mt-0.5 text-xs text-white/35">Planes disponibles</p>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <h2 className="text-sm font-semibold text-indigo-300 uppercase tracking-widest">Generar calendario</h2>
          <p className="text-xs text-white/40 mb-4 mt-1">
            La IA creara un calendario semanal con piezas concretas basado en el plan seleccionado.
          </p>

          {planes.length > 0 ? (
            <form action={generateCalendarioDraft} className="flex flex-col sm:flex-row gap-3">
              <input type="hidden" name="empresa_id" value={empresaId} />
              <div className="flex-1">
                <label className="block text-xs text-white/30 mb-1.5 ml-0.5">Plan base</label>
                <select
                  name="plan_artifact_id"
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  required
                >
                  {planes.map((plan) => {
                    const inputs = asObj(plan.inputs_json);
                    const periodo = typeof inputs.periodo === "string" ? inputs.periodo : "";
                    const label = periodo ? fmt(periodo) : plan.title;
                    return (
                      <option key={plan.id} value={plan.id} style={{ background: "#18181b" }}>
                        {label} - {plan.status} - v{plan.version}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="sm:self-end">
                <GenerateButton />
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-white/5 bg-white/3 px-4 py-3 text-sm text-white/40">
              No hay planes de trabajo disponibles. Crea un plan primero.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Calendarios generados</h2>
            <span className="text-xs text-white/25">{calendarios.length} registros</span>
          </div>

          {calendarios.length > 0 ? (
            <div className="space-y-3">
              {calendarios.map((item) => (
                <CalendarioLinkButton key={item.id} empresaId={empresaId} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/7 bg-white/2 p-10 text-center">
              <p className="text-sm font-medium text-white/30">Sin calendarios generados</p>
              <p className="mt-1 text-xs text-white/20">Genera tu primer calendario con el formulario de arriba.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
