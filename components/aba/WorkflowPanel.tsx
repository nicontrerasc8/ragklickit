import type { ReactNode } from "react";

import type { WorkflowMeta } from "@/lib/workflow";

function labelTone(value: string) {
  switch (value) {
    case "approved":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
    case "blocked":
    case "critical":
      return "border-red-400/25 bg-red-400/10 text-red-100";
    case "needs_review":
    case "changes_requested":
    case "high":
      return "border-amber-400/25 bg-amber-400/10 text-amber-100";
    case "exception":
      return "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100";
    default:
      return "border-white/10 bg-white/[0.03] text-white/65";
  }
}

function titleize(value: string) {
  return value.replaceAll("_", " ");
}

export default function WorkflowPanel({
  title = "Workflow operativo",
  workflow,
  actions,
}: {
  title?: string;
  workflow: WorkflowMeta | null;
  actions?: ReactNode;
}) {
  if (!workflow) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/28">
            {title}
          </p>
          <p className="max-w-3xl text-sm text-white/70">{workflow.summary}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className={`rounded-xl border px-3 py-2 ${labelTone(workflow.status)}`}>
          Estado {titleize(workflow.status)}
        </span>
        <span className={`rounded-xl border px-3 py-2 ${labelTone(workflow.approval.state)}`}>
          Aprobacion {titleize(workflow.approval.state)}
        </span>
        <span className={`rounded-xl border px-3 py-2 ${labelTone(workflow.degradation_label)}`}>
          Degradacion {titleize(workflow.degradation_label)}
        </span>
        <span className="rounded-xl border border-white/10 px-3 py-2 text-white/65">
          Decision {titleize(workflow.decision)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">Alertas</p>
          <div className="mt-3 space-y-2.5">
            {workflow.alerts.length === 0 ? (
              <p className="text-sm text-white/35">Sin alertas abiertas.</p>
            ) : (
              workflow.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-xl border px-3 py-2.5 ${labelTone(alert.severity)}`}
                >
                  <p className="text-sm">{alert.title}</p>
                  <p className="mt-1 text-[12px] text-white/70">{alert.detail}</p>
                  <p className="mt-1.5 text-[11px] uppercase tracking-[0.08em] text-white/55">
                    {alert.action_required}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">Bloqueos</p>
          <div className="mt-3 space-y-2.5">
            {workflow.blockers.length === 0 ? (
              <p className="text-sm text-white/35">Sin bloqueos.</p>
            ) : (
              workflow.blockers.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-xl border border-red-400/20 bg-red-400/8 px-3 py-2.5 text-sm text-red-100">
                  {item}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">Aprobacion</p>
          <div className="mt-3 space-y-2.5 text-sm text-white/70">
            <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
              <p>{workflow.approval.state === "approved" ? "Aprobado" : "No aprobado"}</p>
            </div>
            {workflow.approval.note ? (
              <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.08em] text-white/35">Nota</p>
                <p className="mt-1">{workflow.approval.note}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {workflow.assumptions.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-white/28">Supuestos</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {workflow.assumptions.map((item, index) => (
              <span key={`${item}-${index}`} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/55">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
