import { aiChat } from "@/lib/ollama/client";
import {
  buildCalendarioFullRegenerationPrompt,
  buildCalendarioItemRegenerationPrompt,
  itemShapeFromAI,
} from "@/lib/calendario/prompts";
import {
  type CalendarioContent,
  type CalendarioItem,
  normalizeCalendarioContent,
} from "@/lib/calendario/schema";

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function regenerateCalendarioItem(params: {
  empresaNombre: string;
  calendarioTitulo: string;
  periodo: string;
  item: CalendarioItem;
  customPrompt?: string;
}) {
  const { empresaNombre, calendarioTitulo, periodo, item, customPrompt } = params;

  const raw = await aiChat({
    systemPrompt:
      "Eres content planner senior. Devuelves SOLO JSON valido, concreto, especifico y util para operar contenido real.",
    userPrompt: buildCalendarioItemRegenerationPrompt({
      empresaNombre,
      calendarioTitulo,
      periodo,
      item,
      customPrompt,
    }),
    temperature: 0.55,
  });

  const parsed = safeJsonParse(raw, itemShapeFromAI(item));

  return {
    ...item,
    canal: typeof parsed.canal === "string" && parsed.canal.trim() ? parsed.canal.trim() : item.canal,
    pilar: typeof parsed.pilar === "string" ? parsed.pilar : item.pilar,
    tema: typeof parsed.tema === "string" ? parsed.tema : item.tema,
    subtema: typeof parsed.subtema === "string" ? parsed.subtema : item.subtema,
    buyer_persona:
      typeof parsed.buyer_persona === "string" ? parsed.buyer_persona : item.buyer_persona,
    objetivo_contenido:
      typeof parsed.objetivo_contenido === "string"
        ? parsed.objetivo_contenido
        : item.objetivo_contenido,
    formato: typeof parsed.formato === "string" && parsed.formato.trim() ? parsed.formato.trim() : item.formato,
    titulo_base: typeof parsed.titulo_base === "string" ? parsed.titulo_base : item.titulo_base,
    CTA: typeof parsed.CTA === "string" ? parsed.CTA : item.CTA,
    mensaje_clave:
      typeof parsed.mensaje_clave === "string" ? parsed.mensaje_clave : item.mensaje_clave,
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((entry): entry is string => typeof entry === "string")
      : item.hashtags,
  } satisfies CalendarioItem;
}

export async function regenerateCalendarioContent(params: {
  empresaNombre: string;
  calendarioTitulo: string;
  content: unknown;
  customPrompt?: string;
}) {
  const { customPrompt } = params;
  const normalized = normalizeCalendarioContent(params.content);
  const fallback = normalized.calendario.items.map((item) => itemShapeFromAI(item));

  const raw = await aiChat({
    systemPrompt:
      "Eres content planner senior. Devuelves SOLO JSON valido, especifico, util para produccion y sin texto adicional.",
    userPrompt: buildCalendarioFullRegenerationPrompt({
      empresaNombre: params.empresaNombre,
      calendarioTitulo: params.calendarioTitulo,
      periodo: normalized.periodo,
      items: normalized.calendario.items,
      customPrompt,
    }),
    temperature: 0.55,
  });

  const parsed = safeJsonParse(raw, { items: fallback });
  const aiItems = Array.isArray(parsed.items) ? parsed.items : fallback;

  const nextItems = normalized.calendario.items.map((item, index) => {
    const aiItem = aiItems[index] && typeof aiItems[index] === "object"
      ? (aiItems[index] as Record<string, unknown>)
      : {};

    return {
      ...item,
      canal: typeof aiItem.canal === "string" && aiItem.canal.trim() ? aiItem.canal.trim() : item.canal,
      pilar: typeof aiItem.pilar === "string" ? aiItem.pilar : item.pilar,
      tema: typeof aiItem.tema === "string" ? aiItem.tema : item.tema,
      subtema: typeof aiItem.subtema === "string" ? aiItem.subtema : item.subtema,
      buyer_persona:
        typeof aiItem.buyer_persona === "string" ? aiItem.buyer_persona : item.buyer_persona,
      objetivo_contenido:
        typeof aiItem.objetivo_contenido === "string"
          ? aiItem.objetivo_contenido
          : item.objetivo_contenido,
      formato:
        typeof aiItem.formato === "string" && aiItem.formato.trim()
          ? aiItem.formato.trim()
          : item.formato,
      titulo_base:
        typeof aiItem.titulo_base === "string" ? aiItem.titulo_base : item.titulo_base,
      CTA: typeof aiItem.CTA === "string" ? aiItem.CTA : item.CTA,
      mensaje_clave:
        typeof aiItem.mensaje_clave === "string" ? aiItem.mensaje_clave : item.mensaje_clave,
      hashtags: Array.isArray(aiItem.hashtags)
        ? aiItem.hashtags.filter((entry): entry is string => typeof entry === "string")
        : item.hashtags,
    };
  });

  const nextContent: CalendarioContent = normalizeCalendarioContent(
    {
      ...normalized,
      calendario: {
        ...normalized.calendario,
        items: nextItems,
      },
    },
    normalized,
  );

  return nextContent;
}
