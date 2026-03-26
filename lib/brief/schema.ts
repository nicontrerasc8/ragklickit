export const BRIEF_OBJECTIVE_GROUPS = [
  {
    id: "branding",
    title: "Objetivo BRANDING",
    rowLabel: "Branding",
    options: [
      "Reconocimiento de marca",
      "Alcance",
      "Crecimiento de la comunidad",
      "Vistas al perfil",
      "PR Digital / Menciones en medios",
    ],
  },
  {
    id: "consideracion",
    title: "Objetivo CONSIDERACION",
    rowLabel: "Consideracion",
    options: [
      "Trafico (Web/Landing Page)",
      "Interaccion (Engagement en posts)",
      "Reproducciones de video",
      "Lead Magnets",
      "Influencer Marketing",
    ],
  },
  {
    id: "performance",
    title: "Objetivo PERFORMANCE",
    rowLabel: "Performance",
    options: [
      "Lead Ads",
      "Mensajes (WhatsApp)",
      "Remarketing / Conversion",
      "Instalacion de APS",
    ],
  },
  {
    id: "fidelizacion",
    title: "Objetivo FIDELIZACION",
    rowLabel: "Fidelizacion",
    options: [
      "Nutricion",
      "Remarketing / Trafico",
      "Programas de Lealtad",
      "Captacion de Resenas",
      "UGC",
    ],
  },
] as const;

export const BRIEF_TEXT_FIELDS = [
  "Productos, servicios o lineas que tienen prioridad este mes",
  "Hay algun lanzamiento, campana o promocion que debamos incluir? (Incluir fechas especificas)",
  "Comunicacion y Mensaje - Pilar o mensaje de comunicacion principal este mes (segun el BEC)",
  "Temas o enfoques que el cliente quiere destacar en redes o blog",
  "Hay algun mensaje sensible o tema que debamos evitar este mes?",
  "Pauta y Presupuesto - Presupuesto total de pauta asignado para este mes (Monto en USD)",
  "Distribucion de la inversion (por canal o campana)",
  "Hay campanas nuevas o actuales que debamos activar o pausar?",
  "Operativo y Dependencias - Materiales o aprobaciones faltantes para poder producir o publicar",
  "Fechas clave o eventos a considerar en el calendario (feriados, activaciones, lanzamientos)",
  "Existen dependencias internas o de cliente que puedan afectar los tiempos de publicacion?",
  "Reportes y Retroalimentacion - Contenidos o campanas con mejor performance el mes anterior",
  "Aprendizajes o ajustes que deben aplicarse en este nuevo plan",
] as const;

export type BriefObjectiveGroupId = (typeof BRIEF_OBJECTIVE_GROUPS)[number]["id"];
export type BriefTextFieldKey = (typeof BRIEF_TEXT_FIELDS)[number];

export type BriefFormState = {
  objectives: Record<BriefObjectiveGroupId, Record<string, boolean>>;
  fields: Record<BriefTextFieldKey, string>;
  strategicChanges: "" | "si" | "no";
};

function normalizeBriefKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findMatchingKey<T extends string>(target: T, candidates: Record<string, unknown>) {
  const normalizedTarget = normalizeBriefKey(target);

  for (const key of Object.keys(candidates)) {
    if (normalizeBriefKey(key) === normalizedTarget) {
      return key;
    }
  }

  return null;
}

export function makeDefaultBriefForm(): BriefFormState {
  const objectives = {} as Record<BriefObjectiveGroupId, Record<string, boolean>>;
  for (const group of BRIEF_OBJECTIVE_GROUPS) {
    objectives[group.id] = {};
    for (const option of group.options) {
      objectives[group.id][option] = false;
    }
  }

  const fields = {} as Record<BriefTextFieldKey, string>;
  for (const field of BRIEF_TEXT_FIELDS) {
    fields[field] = "";
  }

  return {
    objectives,
    fields,
    strategicChanges: "",
  };
}

export function loadBriefForm(input: unknown): BriefFormState {
  const fallback = makeDefaultBriefForm();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const value = input as {
    objectives?: Record<string, Record<string, boolean>>;
    fields?: Record<string, unknown>;
    strategicChanges?: string;
    strategic_changes?: string;
    cambios_estrategicos?: string;
  };

  const next = makeDefaultBriefForm();
  const rawRecord = input as Record<string, unknown>;
  const rawObjectives =
    value.objectives && typeof value.objectives === "object" ? value.objectives : undefined;
  const rawFields =
    value.fields && typeof value.fields === "object"
      ? (value.fields as Record<string, unknown>)
      : rawRecord;

  if (rawObjectives) {
    for (const group of BRIEF_OBJECTIVE_GROUPS) {
      const sourceGroupKey =
        findMatchingKey(group.id, rawObjectives) ??
        findMatchingKey(group.title, rawObjectives) ??
        findMatchingKey(group.rowLabel, rawObjectives);
      const sourceGroup = sourceGroupKey ? rawObjectives[sourceGroupKey] : undefined;
      if (!sourceGroup || typeof sourceGroup !== "object") continue;
      const sourceGroupRecord = sourceGroup as Record<string, unknown>;

      for (const option of group.options) {
        const optionKey = findMatchingKey(option, sourceGroupRecord);
        if (optionKey) {
          next.objectives[group.id][option] = Boolean(sourceGroupRecord[optionKey]);
        }
      }
    }
  }

  if (rawFields && typeof rawFields === "object") {
    for (const field of BRIEF_TEXT_FIELDS) {
      const sourceKey = findMatchingKey(field, rawFields);
      const raw = sourceKey ? rawFields[sourceKey] : undefined;
      if (typeof raw === "string") {
        next.fields[field] = raw;
      }
    }
  }

  const strategicValue =
    value.strategicChanges ?? value.strategic_changes ?? value.cambios_estrategicos ?? "";

  if (strategicValue === "si" || strategicValue === "no") {
    next.strategicChanges = strategicValue;
  }

  return next;
}
