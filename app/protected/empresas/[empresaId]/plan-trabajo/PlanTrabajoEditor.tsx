"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { updatePlanTrabajoArtifact } from "@/app/protected/actions";
import { SaveStatusBar, SaveStatusSubmitButton } from "@/components/editor/SaveStatusBar";
import {
  type PlanTrabajo,
  makeDefaultPlanTrabajo,
  normalizePlanTrabajoContent,
} from "@/lib/plan-trabajo/schema";

type Props = {
  empresaId: string;
  planId: string;
  initialTitle: string;
  initialStatus: string;
  initialContent: unknown;
  initialInitiativeScores?: Record<string, Partial<Record<"confidence" | "risk" | "priority", number>>>;
};

function listToLines(list: string[]) {
  return list.join("\n");
}

function linesToList(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function comunidadToLines(plan: PlanTrabajo) {
  return plan.comunidad.map((item) => `${item.red} | ${item.mes_anterior} | ${item.meta}`).join("\n");
}

function linesToComunidad(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [red = "", mes_anterior = "", meta = ""] = line.split("|").map((part) => part.trim());
      return { red, mes_anterior, meta };
    })
    .filter((item) => item.red || item.mes_anterior || item.meta);
}

function pilaresToLines(plan: PlanTrabajo) {
  return plan.pilares_comunicacion
    .map((item) => `${item.pilar} | ${item.porcentaje}`)
    .join("\n");
}

function linesToPilares(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [pilar = "", porcentaje = ""] = line.split("|").map((part) => part.trim());
      return { pilar, porcentaje };
    })
    .filter((item) => item.pilar || item.porcentaje);
}

type IdeaChecklist = Array<{
  canal: string;
  ideas: Array<{
    id: string;
    text: string;
    selected: boolean;
  }>;
}>;

function buildSuggestedContentFallbackRows(plan: PlanTrabajo) {
  const quantityRows =
    plan.cantidad_contenidos.length > 0
      ? plan.cantidad_contenidos
      : Object.entries(plan.alcance_calendario)
          .filter(([red, cantidad]) => red.trim() && cantidad > 0)
          .map(([red, cantidad]) => ({
            red,
            cantidad,
            formatos: defaultFormatsForChannel(red),
          }));

  return quantityRows
    .filter((item) => item.red.trim().length > 0 && item.cantidad > 0)
    .map((item) => {
      const formatoBase = item.formatos[0]?.trim() || "contenido";
      return {
        canal: item.red,
        ideas: expandIdeaCandidates(item.red, [
          "Angulo educativo aterrizado al producto o servicio prioritario del mes",
          `Objecion frecuente del cliente convertida en pieza de ${formatoBase}`,
          "Caso, evidencia o prueba comercial con promesa clara",
        ]),
      };
    });
}

function defaultFormatsForChannel(channel: string) {
  const normalized = normalizeChannelKey(channel);
  if (normalized.includes("tiktok") || normalized.includes("youtube")) {
    return ["Video corto", "Storytelling", "Demo"];
  }
  if (normalized.includes("blog")) {
    return ["Articulo", "Guia", "Checklist"];
  }
  if (normalized.includes("email")) {
    return ["Newsletter", "Secuencia", "Comunicado"];
  }
  if (normalized.includes("whatsapp")) {
    return ["Mensaje directo", "Difusion", "Recordatorio"];
  }
  if (normalized.includes("linkedin")) {
    return ["Post", "Carrusel", "Documento"];
  }
  return ["Post", "Carrusel", "Reel"];
}

function expandIdeaCandidates(canal: string, ideas: string[]) {
  const cleanIdeas = Array.from(new Set(ideas.map((idea) => idea.trim()).filter(Boolean)));
  const fallbackIdeas = [
    `Criterio de compra que el cliente deberia revisar antes de elegir una solucion en ${canal}`,
    `Error comun del mercado que la marca puede corregir con autoridad en ${canal}`,
    `Comparativa entre una decision promedio y una decision mejor informada para ${canal}`,
    `Mito del rubro convertido en una linea de contenido con punto de vista`,
    `Escena real de decision del comprador y la pregunta que deberia hacerse`,
    `Checklist editorial sobre senales de calidad, confianza o fit antes de comprar`,
    `Prueba social o evidencia observable que reduzca friccion comercial`,
    `Tension entre costo, riesgo y resultado esperable explicada con claridad`,
    `Insight cultural o de comportamiento que conecte con el momento del mercado`,
    `Pregunta provocadora para abrir conversacion con prospectos calificados`,
  ];

  for (const idea of fallbackIdeas) {
    if (cleanIdeas.length >= 9) break;
    if (!cleanIdeas.includes(idea)) {
      cleanIdeas.push(idea);
    }
  }

  return cleanIdeas.slice(0, 10);
}

function buildImportantDatesFallback(plan: PlanTrabajo) {
  const periodStart = (plan.periodo.inicio || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodStart);

  if (!match) {
    return "";
  }

  const [, year, month] = match;
  const monthNum = Number.parseInt(month, 10);
  const monthLabels = [
    "",
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const monthLabel = monthLabels[monthNum] ?? month;

  return [
    `Inicio de planificacion mensual - 01/${month}/${year}`,
    `Revision y aprobacion interna de piezas - primera semana de ${monthLabel}`,
    `Cierre operativo y consolidacion de aprendizajes - ultima semana de ${monthLabel}`,
  ].join("\n");
}

function planToIdeaChecklist(plan: PlanTrabajo): IdeaChecklist {
  const source =
    plan.contenido_sugerido.length > 0
      ? plan.contenido_sugerido.map((row) => ({
          canal: row.canal,
          ideas: expandIdeaCandidates(row.canal, row.ideas),
        }))
      : buildSuggestedContentFallbackRows(plan);

  return source
    .filter((row) => row.canal.trim() && row.ideas.length > 0)
    .map((row) => ({
      canal: row.canal,
      ideas: row.ideas.map((idea, index) => ({
        id: `${row.canal}-${index}-${idea.slice(0, 20)}`,
        text: idea,
        selected: index < (getChannelLimit(plan, row.canal) ?? row.ideas.length),
      })),
    }));
}

function ideaChecklistToPlanIdeas(checklist: IdeaChecklist) {
  return checklist
    .map((row) => ({
      canal: row.canal,
      ideas: row.ideas
        .filter((idea) => idea.selected)
        .map((idea) => idea.text.trim())
        .filter(Boolean),
    }))
    .filter((row) => row.canal.trim() && row.ideas.length > 0);
}

function countSelectedIdeas(checklist: IdeaChecklist) {
  return checklist.reduce(
    (acc, row) => acc + row.ideas.filter((idea) => idea.selected).length,
    0,
  );
}

function countTotalIdeas(checklist: IdeaChecklist) {
  return checklist.reduce((acc, row) => acc + row.ideas.length, 0);
}

function normalizeChannelKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getChannelLimit(plan: PlanTrabajo, canal: string) {
  const normalizedCanal = normalizeChannelKey(canal);
  const row = plan.cantidad_contenidos.find(
    (item) => normalizeChannelKey(item.red) === normalizedCanal,
  );
  if (row?.cantidad && row.cantidad > 0) {
    return row.cantidad;
  }
  const alcanceLimit = Object.entries(plan.alcance_calendario).find(
    ([channel]) => normalizeChannelKey(channel) === normalizedCanal,
  )?.[1];
  if (typeof alcanceLimit === "number" && alcanceLimit > 0) {
    return alcanceLimit;
  }
  return null;
}

function clampIdeaChecklistToLimits(checklist: IdeaChecklist, plan: PlanTrabajo): IdeaChecklist {
  return checklist.map((row) => {
    const limit = getChannelLimit(plan, row.canal);
    if (limit === null) return row;

    let selectedCount = 0;
    return {
      ...row,
      ideas: row.ideas.map((idea) => {
        if (!idea.selected) return idea;
        const keepSelected = selectedCount < limit;
        if (keepSelected) selectedCount += 1;
        return keepSelected ? idea : { ...idea, selected: false };
      }),
    };
  });
}

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/90 outline-none transition placeholder:text-white/20 focus:border-sky-400/35 focus:bg-white/[0.05]";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white/92">{title}</h2>
        {description ? <p className="mt-1 text-xs text-white/40">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/30">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-white/30">{hint}</p> : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </Field>
  );
}

function AreaField({
  label,
  value,
  onChange,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputCls} resize-y leading-relaxed`}
      />
    </Field>
  );
}

function IdeasChecklistField({
  value,
  plan,
  onChange,
}: {
  value: IdeaChecklist;
  plan: PlanTrabajo;
  onChange: (value: IdeaChecklist) => void;
}) {
  const boundedValue = useMemo(() => clampIdeaChecklistToLimits(value, plan), [plan, value]);
  const total = countTotalIdeas(boundedValue);
  const selected = countSelectedIdeas(boundedValue);

  function setChannelSelection(channelIndex: number, selectedValue: boolean) {
    onChange(
      boundedValue.map((row, rowIndex) => {
        if (rowIndex !== channelIndex) return row;
        const channelLimit = getChannelLimit(plan, row.canal);
        let selectedCount = 0;
        return {
          ...row,
          ideas: row.ideas.map((idea) => {
            if (!selectedValue) return { ...idea, selected: false };
            const shouldSelect = channelLimit === null || selectedCount < channelLimit;
            if (shouldSelect) selectedCount += 1;
            return { ...idea, selected: shouldSelect };
          }),
        };
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-300/15 bg-sky-300/[0.05] px-4 py-3">
        <p className="text-sm font-semibold text-sky-100">
          Selecciona las mejores ideas para llevar al calendario.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-sky-100/55">
          Hay {selected}/{total} ideas seleccionadas. Cada canal permite seleccionar exactamente el maximo definido en Cantidad de Contenidos.
        </p>
      </div>

      {boundedValue.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-5 text-sm text-white/35">
          No hay ideas sugeridas todavia.
        </div>
      ) : null}

      <div className="space-y-4">
        {boundedValue.map((row, channelIndex) => {
          const channelSelected = row.ideas.filter((idea) => idea.selected).length;
          const channelLimit = getChannelLimit(plan, row.canal);
          const isAtLimit = channelLimit !== null && channelSelected >= channelLimit;
          return (
            <div
              key={`${row.canal}-${channelIndex}`}
              className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white/85">{row.canal}</p>
                  <p className="mt-0.5 text-[11px] text-white/35">
                    {channelSelected}/{channelLimit ?? row.ideas.length} seleccionadas
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChannelSelection(channelIndex, true)}
                    disabled={channelLimit !== null && channelSelected >= channelLimit}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/50 transition-colors hover:text-white/80"
                  >
                    Seleccionar maximo
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelSelection(channelIndex, false)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/40 transition-colors hover:text-white/70"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="grid gap-2 p-4 lg:grid-cols-2">
                {row.ideas.map((idea, ideaIndex) => {
                  const disabledByLimit = !idea.selected && isAtLimit;
                  return (
                    <label
                      key={idea.id}
                      className={`flex gap-3 rounded-xl border px-3.5 py-3 transition-all ${
                        disabledByLimit
                          ? "cursor-not-allowed border-white/6 bg-black/10 text-white/25"
                          : idea.selected
                            ? "cursor-pointer border-emerald-300/25 bg-emerald-300/[0.07] text-white/85"
                            : "cursor-pointer border-white/8 bg-black/10 text-white/45 hover:border-white/14 hover:text-white/70"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={idea.selected}
                        disabled={disabledByLimit}
                        onChange={(event) =>
                          onChange(
                            boundedValue.map((currentRow, currentRowIndex) =>
                              currentRowIndex === channelIndex
                                ? {
                                    ...currentRow,
                                    ideas: currentRow.ideas.map((currentIdea, currentIdeaIndex) =>
                                      currentIdeaIndex === ideaIndex
                                        ? { ...currentIdea, selected: event.target.checked }
                                        : currentIdea,
                                    ),
                                  }
                                : currentRow,
                            ),
                          )
                        }
                        className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-emerald-500 disabled:opacity-30"
                      />
                      <span className="text-sm leading-relaxed">{idea.text}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlanTrabajoEditor(props: Props) {
  const router = useRouter();
  const title = props.initialTitle || "Plan de trabajo";
  const status = props.initialStatus || "plan";

  const [plan, setPlan] = useState<PlanTrabajo>(() => {
    const seed = makeDefaultPlanTrabajo();
    return normalizePlanTrabajoContent(props.initialContent, seed).plan_trabajo;
  });
  const [ideaChecklist, setIdeaChecklist] = useState<IdeaChecklist>(() => {
    const seed = makeDefaultPlanTrabajo();
    const initialPlan = normalizePlanTrabajoContent(props.initialContent, seed).plan_trabajo;
    return planToIdeaChecklist(initialPlan);
  });

  const serialized = useMemo(
    () =>
      JSON.stringify(
        normalizePlanTrabajoContent(
          {
            plan_trabajo: {
              ...plan,
              contenido_sugerido: ideaChecklistToPlanIdeas(
                clampIdeaChecklistToLimits(ideaChecklist, plan),
              ),
            },
          },
          plan,
        ),
      ),
    [ideaChecklist, plan],
  );
  const [lastSavedSerialized, setLastSavedSerialized] = useState(serialized);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const boundedChecklist = useMemo(
    () => clampIdeaChecklistToLimits(ideaChecklist, plan),
    [ideaChecklist, plan],
  );
  const selectedIdeas = countSelectedIdeas(boundedChecklist);
  const hasUnsavedChanges = serialized !== lastSavedSerialized;
  return (
    <form
      action={async (formData) => {
        setSavingPlan(true);
        setSaveError("");
        setSaveMessage("");
        try {
          await updatePlanTrabajoArtifact(formData);
          setLastSavedSerialized(String(formData.get("content") ?? serialized));
          setSaveMessage("Plan guardado correctamente.");
          router.refresh();
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : "No se pudo guardar el plan.");
        } finally {
          setSavingPlan(false);
        }
      }}
      className="space-y-5"
    >
      <input type="hidden" name="empresa_id" value={props.empresaId} />
      <input type="hidden" name="plan_id" value={props.planId} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="content" value={serialized} />

      <Section
        title="I. Comunidad"
        description="Usa una fila por linea con el formato Red | Mes anterior | Meta"
      >
        <AreaField
          label="Metricas"
          rows={6}
          value={comunidadToLines(plan)}
          onChange={(value) => setPlan((current) => ({ ...current, comunidad: linesToComunidad(value) }))}
          hint="Ejemplo: FB | 323 | 2%"
        />
      </Section>

      <Section title="II. Resumen de Actualizaciones">
        <AreaField
          label="Gestion en redes"
          rows={5}
          value={plan.resumen_actualizaciones.gestion_redes}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              resumen_actualizaciones: {
                ...current.resumen_actualizaciones,
                gestion_redes: value,
              },
            }))
          }
        />
        <AreaField
          label="Observaciones"
          rows={4}
          value={listToLines(plan.resumen_actualizaciones.observaciones)}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              resumen_actualizaciones: {
                ...current.resumen_actualizaciones,
                observaciones: linesToList(value),
              },
            }))
          }
          hint="Una observacion por linea"
        />
      </Section>

      <Section
        title="III. Cantidad de Contenidos a Desarrollar"
        description="Vista resumida por canal con volumen, formatos y señal operativa."
      >
        {plan.cantidad_contenidos.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {plan.cantidad_contenidos.map((item, index) => {
              return (
                <div
                  key={`${item.red}-${index}`}
                  className="group relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_38%)] opacity-80 transition-opacity group-hover:opacity-100" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold tracking-tight text-white/92">
                        {item.red || "Canal sin nombre"}
                      </p>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/56">
                        {item.cantidad} piezas · {item.formatos.join(", ") || "Sin formatos"}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/42">
                      Canal activo
                    </span>
                  </div>
                  <div className="relative mt-5 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/26">
                      Resumen
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/62">
                      Este canal aporta {item.cantidad} entregables dentro del plan mensual y ya incluye
                      los formatos definidos para ejecucion.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Section>

      <Section
        title="VI. Pilares de Comunicacion"
        description="Usa una fila por linea con el formato Pilar | Porcentaje"
      >
        <AreaField
          label="Pilares"
          rows={7}
          value={pilaresToLines(plan)}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              pilares_comunicacion: linesToPilares(value),
            }))
          }
          hint="Ejemplo: Transformacion digital | 20%"
        />
      </Section>

      <Section
        title="Contenido Sugerido"
        description="Checklist de ideas por canal. Selecciona solo las mejores para llevarlas al calendario."
      >
        <IdeasChecklistField value={ideaChecklist} plan={plan} onChange={setIdeaChecklist} />
      </Section>

      <Section title="VI. Producto o Servicios a Destacar">
        <AreaField
          label="Productos / servicios"
          rows={5}
          value={listToLines(plan.productos_servicios_destacar)}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              productos_servicios_destacar: linesToList(value),
            }))
          }
          hint="Un item por linea"
        />
      </Section>

      <Section title="VII. Mensajes Destacados">
        <AreaField
          label="Mensajes"
          rows={4}
          value={listToLines(plan.mensajes_destacados)}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              mensajes_destacados: linesToList(value),
            }))
          }
          hint="Un mensaje por linea"
        />
      </Section>

      <Section title="VIII. Fechas Importantes">
        <AreaField
          label="Fechas"
          rows={4}
          value={listToLines(plan.fechas_importantes) || buildImportantDatesFallback(plan)}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              fechas_importantes: linesToList(value),
            }))
          }
          hint="Incluye feriados, efemerides, campañas estacionales y fechas relevantes del negocio en ese mes"
        />
      </Section>

      <Section title="IX. Promociones">
        <AreaField
          label="Promociones"
          rows={4}
          value={plan.promociones}
          onChange={(value) => setPlan((current) => ({ ...current, promociones: value }))}
          hint='Usa "NO APLICA" cuando corresponda'
        />
      </Section>

      <Section title="X-XIII. Cierre del Plan">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Plan de medios link"
            value={plan.plan_medios_link}
            onChange={(value) => setPlan((current) => ({ ...current, plan_medios_link: value }))}
            placeholder="https://... o texto corto"
          />
          <AreaField
            label="Notas adicionales"
            rows={4}
            value={plan.notas_adicionales}
            onChange={(value) => setPlan((current) => ({ ...current, notas_adicionales: value }))}
          />
          <AreaField
            label="Eventos"
            rows={4}
            value={listToLines(plan.eventos)}
            onChange={(value) =>
              setPlan((current) => ({
                ...current,
                eventos: linesToList(value),
              }))
            }
            hint="Un evento por linea"
          />
          <AreaField
            label="Pendientes del cliente"
            rows={4}
            value={listToLines(plan.pendientes_cliente)}
            onChange={(value) =>
              setPlan((current) => ({
                ...current,
                pendientes_cliente: linesToList(value),
              }))
            }
            hint="Un pendiente por linea"
          />
        </div>
      </Section>

      <SaveStatusBar
        dirty={hasUnsavedChanges}
        saving={savingPlan}
        savedMessage={saveMessage}
        errorMessage={saveError}
        meta={
          <span>
            {plan.cantidad_contenidos.length} canales · {selectedIdeas} ideas seleccionadas para calendario
          </span>
        }
      >
        <SaveStatusSubmitButton idleLabel="Guardar plan" pendingLabel="Guardando plan..." />
      </SaveStatusBar>
    </form>
  );
}
