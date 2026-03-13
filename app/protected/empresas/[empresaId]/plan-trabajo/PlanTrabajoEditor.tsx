"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { updatePlanTrabajoArtifact } from "@/app/protected/actions";
import {
  type PlanTrabajo,
  makeDefaultPlanTrabajo,
  normalizeAlcanceCalendario,
  normalizePlanTrabajoContent,
} from "@/lib/plan-trabajo/schema";

type Props = {
  empresaId: string;
  planId: string;
  initialTitle: string;
  initialStatus: string;
  initialContent: unknown;
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

function alcanceMapToLines(value: Record<string, number>) {
  return Object.entries(value)
    .map(([channel, count]) => `${channel}: ${count}`)
    .join("\n");
}

function linesToAlcanceMap(text: string) {
  const map: Record<string, number> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const sep = line.indexOf(":");
    if (sep <= 0) continue;
    const channel = line.slice(0, sep).trim();
    const count = Number.parseInt(line.slice(sep + 1).trim(), 10);
    if (!channel || !Number.isFinite(count) || count <= 0) continue;
    map[channel] = count;
  }
  return map;
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

function cantidadToLines(plan: PlanTrabajo) {
  return plan.cantidad_contenidos
    .map((item) => `${item.red} | ${item.cantidad} | ${item.formatos.join(", ")}`)
    .join("\n");
}

function linesToCantidad(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [red = "", cantidadRaw = "0", formatosRaw = ""] = line
        .split("|")
        .map((part) => part.trim());
      return {
        red,
        cantidad: Number.parseInt(cantidadRaw, 10) || 0,
        formatos: formatosRaw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
    })
    .filter((item) => item.red || item.cantidad > 0 || item.formatos.length > 0);
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

function ideasToLines(plan: PlanTrabajo) {
  return plan.contenido_sugerido
    .flatMap((item) => item.ideas.map((idea) => `${item.canal} | ${idea}`))
    .join("\n");
}

function linesToIdeas(text: string) {
  const grouped = new Map<string, string[]>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const [canal = "", idea = ""] = line.split("|").map((part) => part.trim());
    if (!canal || !idea) continue;
    const current = grouped.get(canal) ?? [];
    current.push(idea);
    grouped.set(canal, current);
  }

  return Array.from(grouped.entries()).map(([canal, ideas]) => ({ canal, ideas }));
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-sky-400/30 bg-sky-400/[0.08] px-5 py-2.5 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-400/[0.14] disabled:opacity-40"
    >
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
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

export default function PlanTrabajoEditor(props: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(props.initialTitle || "Plan de trabajo");
  const [status, setStatus] = useState(props.initialStatus || "plan");

  const [plan, setPlan] = useState<PlanTrabajo>(() => {
    const seed = makeDefaultPlanTrabajo();
    return normalizePlanTrabajoContent(props.initialContent, seed).plan_trabajo;
  });

  const serialized = useMemo(
    () => JSON.stringify(normalizePlanTrabajoContent({ plan_trabajo: plan }, plan)),
    [plan],
  );

  return (
    <form
      action={async (formData) => {
        await updatePlanTrabajoArtifact(formData);
        router.refresh();
      }}
      className="space-y-5"
    >
      <input type="hidden" name="empresa_id" value={props.empresaId} />
      <input type="hidden" name="plan_id" value={props.planId} />
      <input type="hidden" name="content" value={serialized} />

      <Section title="Metadatos del Documento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titulo">
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Estado">
            <select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={`${inputCls} appearance-none`}
              required
            >
              <option value="plan">Plan</option>
              <option value="revision">Revision</option>
              <option value="aprobado">Aprobado</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Cliente"
            value={plan.cliente}
            onChange={(value) => setPlan((current) => ({ ...current, cliente: value }))}
          />
          <TextField
            label="Marca"
            value={plan.marca}
            onChange={(value) => setPlan((current) => ({ ...current, marca: value }))}
          />
          <TextField
            label="Pais"
            value={plan.pais}
            onChange={(value) => setPlan((current) => ({ ...current, pais: value }))}
          />
          <TextField
            label="Version"
            value={plan.version}
            onChange={(value) => setPlan((current) => ({ ...current, version: value }))}
          />
          <TextField
            label="Periodo inicio"
            value={plan.periodo.inicio}
            onChange={(value) =>
              setPlan((current) => ({
                ...current,
                periodo: { ...current.periodo, inicio: value },
              }))
            }
          />
          <TextField
            label="Periodo fin"
            value={plan.periodo.fin}
            onChange={(value) =>
              setPlan((current) => ({
                ...current,
                periodo: { ...current.periodo, fin: value },
              }))
            }
          />
        </div>
      </Section>

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
        description="Usa una fila por linea con el formato Red | Cantidad | Formatos"
      >
        <AreaField
          label="Distribucion"
          rows={7}
          value={cantidadToLines(plan)}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              cantidad_contenidos: linesToCantidad(value),
            }))
          }
          hint="Ejemplo: FB / IG | 4 | 2 reels, 1 post estatico, 1 carrusel"
        />
        <AreaField
          label="Alcance calendario"
          rows={5}
          value={alcanceMapToLines(plan.alcance_calendario)}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              alcance_calendario: normalizeAlcanceCalendario(linesToAlcanceMap(value)),
            }))
          }
          hint="Formato Canal: cantidad"
        />
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
        description="Lluvia de ideas por canal. Solo ideas o lineas tematicas, no copies, captions, guiones ni textos finales."
      >
        <AreaField
          label="Ideas por canal"
          rows={12}
          value={ideasToLines(plan)}
          onChange={(value) =>
            setPlan((current) => ({
              ...current,
              contenido_sugerido: linesToIdeas(value),
            }))
          }
          hint="Formato: Canal | Idea general. Una linea por idea."
        />
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
          value={listToLines(plan.fechas_importantes)}
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

      <div className="flex items-center justify-between border-t border-white/[0.05] pt-6">
        <p className="text-xs text-white/30">Los cambios se guardan al presionar el boton.</p>
        <SaveButton />
      </div>
    </form>
  );
}
