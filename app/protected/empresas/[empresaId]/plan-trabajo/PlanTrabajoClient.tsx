"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { generatePlanTrabajoDraft } from "@/app/protected/actions";

type JsonObj = Record<string, unknown>;

export type BriefItem = {
  id: string;
  periodo: string;
  estado: string;
  version: number;
  created_at: string;
};

export type PlanItem = {
  id: string;
  title: string;
  status: string;
  version: number;
  inputs_json: unknown;
  content_json: unknown;
  created_at: string;
  updated_at: string;
};

type Props = {
  empresaId: string;
  empresaNombre: string;
  briefs: BriefItem[];
  planes: PlanItem[];
};

const monthFmt = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function fmtPeriodo(p: string) {
  try {
    return monthFmt.format(new Date(`${p}T00:00:00.000Z`));
  } catch {
    return p;
  }
}

function asObj(v: unknown): JsonObj {
  return v && typeof v === "object" ? (v as JsonObj) : {};
}

const STATUS_MAP: Record<string, string> = {
  aprobado: "text-teal-300 bg-teal-300/10 border-teal-300/20",
  approved: "text-teal-300 bg-teal-300/10 border-teal-300/20",
  plan: "text-cyan-300 bg-cyan-300/10 border-cyan-300/20",
  borrador: "text-amber-300 bg-amber-300/10 border-amber-300/20",
  revision: "text-sky-300 bg-sky-300/10 border-sky-300/20",
  needs_review: "text-amber-300 bg-amber-300/10 border-amber-300/20",
  blocked: "text-red-300 bg-red-300/10 border-red-300/20",
  exception: "text-fuchsia-300 bg-fuchsia-300/10 border-fuchsia-300/20",
};

function statusCls(s: string) {
  return STATUS_MAP[s.toLowerCase()] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${statusCls(status)}`}
    >
      {status}
    </span>
  );
}

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all duration-200 hover:bg-violet-500 hover:shadow-violet-500/30 disabled:opacity-50"
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <span className="text-white/60">*</span>
          Generar con IA
        </>
      )}
    </button>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/7 bg-white/[0.018] px-4 py-3.5">
      <span className="text-[26px] font-bold leading-none tracking-tighter text-white">{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-white/35">{label}</span>
    </div>
  );
}

function PlanLinkButton({
  empresaId,
  plan,
}: {
  empresaId: string;
  plan: PlanItem;
}) {
  const inputs = asObj(plan.inputs_json);
  const periodo = typeof inputs.periodo === "string" ? inputs.periodo : "";
  const label = periodo ? fmtPeriodo(periodo) : plan.title;

  return (
    <Link
      href={`/protected/empresas/${empresaId}/plan-trabajo/${plan.id}`}
      className="block rounded-2xl border border-white/8 bg-white/[0.018] p-4 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.025]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white capitalize tracking-tight truncate">{label}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <StatusBadge status={plan.status} />
            <span className="font-mono text-[11px] text-white/25">v{plan.version}</span>
          </div>
        </div>
        <span className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/55">Ver plan</span>
      </div>
    </Link>
  );
}

export default function PlanTrabajoClient({ empresaId, empresaNombre, briefs, planes }: Props) {
  const [selectedBrief, setSelectedBrief] = useState(briefs[0]?.id ?? "");
  const [creativePrompt, setCreativePrompt] = useState("");
  const selectedBriefItem = briefs.find((brief) => brief.id === selectedBrief) ?? briefs[0] ?? null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .pt-root * { font-family: 'Sora', 'Helvetica Neue', sans-serif; box-sizing: border-box; }
        .pt-root .mono { font-family: 'JetBrains Mono', monospace; }

        .grain-overlay::after {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 256px;
          z-index: 9999;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fu  { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .d1  { animation-delay: 80ms; }
        .d2  { animation-delay: 160ms; }
        .d3  { animation-delay: 240ms; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 0.75s linear infinite; }
        @keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }
        .animate-ping { animation: ping 2s cubic-bezier(0,0,0.2,1) infinite; }
      `}</style>

      <div
        className="pt-root grain-overlay min-h-screen bg-[#0c0c0f] text-white"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(124,58,237,0.10) 0%, transparent 65%)",
            "radial-gradient(ellipse 50% 40% at 100% 60%, rgba(79,70,229,0.06) 0%, transparent 55%)",
            "radial-gradient(ellipse 40% 30% at 0% 90%, rgba(109,40,217,0.07) 0%, transparent 50%)",
          ].join(", "),
        }}
      >
        <div className="mx-auto max-w-2xl px-5 pb-16 pt-10 space-y-7">
          <header className="fu space-y-4">
            <nav className="flex items-center gap-1.5 text-[11px] text-white/25">
              <Link href="/protected/empresas" className="hover:text-white/50 transition-colors">Empresas</Link>
              <span>/</span>
              <Link href={`/protected/empresas/${empresaId}`} className="hover:text-white/50 transition-colors">{empresaNombre}</Link>
              <span>/</span>
              <span className="text-white/50">Plan de trabajo</span>
            </nav>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-white leading-none">Plan de trabajo</h1>
                <p className="mt-1.5 text-sm text-white/35">{empresaNombre}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 pb-0.5">
                <Link
                  href={`/protected/empresas/${empresaId}`}
                  className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
                >
                  {"<- Empresa"}
                </Link>
                <Link
                  href={`/protected/empresas/${empresaId}/calendario`}
                  className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-white/60 transition-all"
                >
                  Calendario
                </Link>
              </div>
            </div>
          </header>

          <div className="fu d1 grid grid-cols-2 gap-2.5">
            <StatTile value={planes.length} label="Planes" />
            <StatTile value={briefs.length} label="Briefs" />
          </div>

          <section className="fu d2 rounded-2xl border border-violet-500/18 bg-violet-950/25 p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
              </span>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-300/80">
                Generar plan mensual
              </h2>
            </div>
            <p className="mb-4 text-[12px] text-white/35 leading-relaxed pl-4.5">
              La IA usara el contexto de agencia, empresa, BEC, el BRIEF seleccionado y un PDF opcional de apoyo para armar el plan.
            </p>

            {briefs.length > 0 ? (
              <form action={generatePlanTrabajoDraft} className="space-y-3">
                <input type="hidden" name="empresa_id" value={empresaId} />
                <input type="hidden" name="redirect_to" value={`/protected/empresas/${empresaId}/plan-trabajo`} />
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-white/32">
                          Brief base
                        </label>
                        <p className="mt-1 text-[12px] leading-relaxed text-white/30">
                          Selecciona el brief que servira como base estrategica y operativa para el plan.
                        </p>
                      </div>
                      {selectedBriefItem ? (
                        <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-right">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-violet-200/70">
                            Seleccionado
                          </p>
                          <p className="mt-1 text-[12px] font-semibold capitalize text-violet-100">
                            {fmtPeriodo(selectedBriefItem.periodo)}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <select
                      name="brief_id"
                      value={selectedBrief}
                      onChange={(e) => setSelectedBrief(e.target.value)}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-[#14141b] px-3.5 py-3 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                      style={{ fontFamily: "inherit" }}
                      required
                    >
                      {briefs.map((b) => (
                        <option key={b.id} value={b.id} style={{ background: "#13131a" }}>
                          {fmtPeriodo(b.periodo)} - {b.estado} - v{b.version}
                        </option>
                      ))}
                    </select>
                    {selectedBriefItem ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium capitalize text-white/55">
                          {selectedBriefItem.estado}
                        </span>
                        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-white/45">
                          v{selectedBriefItem.version}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-white/32">
                      Documento de apoyo
                    </label>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/30">
                      Adjunta contexto adicional para afinar el plan: brief comercial, pauta, promos o lineamientos.
                    </p>
                    <input
                      type="file"
                      name="support_file"
                      accept=".txt,.md,.csv,.json,.html,.xml,.docx,.xlsx"
                      className="mt-3 w-full rounded-xl border border-white/10 bg-[#14141b] px-3 py-3 text-xs text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-100"
                    />
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {["PDF", "DOCX", "XLSX", "TXT", "MD"].map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-white/38"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-white/32">
                      Instrucciones creativas
                    </label>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/30">
                      Dale direccion adicional a la IA: enfoque narrativo, angulos, tono, prioridades comerciales o restricciones creativas para este plan.
                    </p>
                    <textarea
                      name="custom_prompt"
                      rows={5}
                      value={creativePrompt}
                      onChange={(e) => setCreativePrompt(e.target.value)}
                      placeholder="Ej: prioriza una narrativa mas aspiracional, con foco en prueba social, objeciones de compra y piezas que puedan escalarse a pauta."
                      className="mt-3 w-full rounded-xl border border-white/10 bg-[#14141b] px-3.5 py-3 text-sm leading-relaxed text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-violet-400/12 bg-violet-400/6 px-4 py-3 text-[11px] leading-relaxed text-white/40">
                  La IA combinara el brief seleccionado con el BEC, contexto documental de empresa/agencia, las instrucciones creativas y el archivo adjunto si existe.
                </div>

                <div className="sm:self-end">
                  <GenerateButton />
                </div>
              </form>
            ) : (
              <div className="rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3 text-[12px] text-white/35 italic">
                No hay BRIEFs disponibles. Crea uno antes de generar el plan.
              </div>
            )}
          </section>

          <section className="fu d3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/30">Planes generados</h2>
              <span className="mono text-[11px] text-white/20">{planes.length} planes</span>
            </div>

            {planes.length > 0 ? (
              <div className="space-y-2.5">
                {planes.map((p) => (
                  <PlanLinkButton key={p.id} empresaId={empresaId} plan={p} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/7 bg-white/[0.018] px-6 py-12 text-center">
                <p className="text-[13px] font-medium text-white/25">Sin planes generados</p>
                <p className="mt-1.5 text-[11px] text-white/15 leading-relaxed">
                  Usa el formulario de arriba para crear tu primer plan de trabajo con IA.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
