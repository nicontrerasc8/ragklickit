import { aiChat } from "@/lib/ollama/client";
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

function itemShapeFromAI(item: CalendarioItem) {
  return {
    canal: item.canal,
    pilar: item.pilar,
    tema: item.tema,
    subtema: item.subtema,
    buyer_persona: item.buyer_persona,
    objetivo_contenido: item.objetivo_contenido,
    formato: item.formato,
    titulo_base: item.titulo_base,
    CTA: item.CTA,
    mensaje_clave: item.mensaje_clave,
    hashtags: item.hashtags,
  };
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
      "Eres content planner senior. Devuelves SOLO JSON valido, concreto y util para operar.",
    userPrompt: [
      `Empresa: ${empresaNombre}`,
      `Calendario: ${calendarioTitulo}`,
      `Periodo: ${periodo}`,
      "",
      "Item actual:",
      JSON.stringify(item, null, 2),
      "",
      "Tarea:",
      "Regenera este item del calendario manteniendo su fecha y su rol operativo, pero mejorando enfoque, gancho, claridad y utilidad editorial.",
      "Si el usuario da un prompt adicional, sigue esa direccion sin salirte del canal, formato y contexto.",
      "",
      "Reglas:",
      "1) Devuelve SOLO JSON.",
      "2) No cambies fecha, id, semana, orden_semana ni estado.",
      "3) Mantén coherencia con el canal y formato declarados.",
      "4) titulo_base, tema y subtema deben ser concretos y distintos entre si cuando aplique.",
      "5) CTA y mensaje_clave deben ser accionables, no genericos.",
      "6) hashtags debe ser un array de strings.",
      customPrompt?.trim() ? `7) Prompt adicional del usuario: ${customPrompt.trim()}` : "7) No hay prompt adicional del usuario.",
      "",
      `JSON exacto esperado: ${JSON.stringify(itemShapeFromAI(item))}`,
    ].join("\n"),
    temperature: 0.45,
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
  const normalized = normalizeCalendarioContent(params.content);
  const fallback = normalized.calendario.items.map((item) => itemShapeFromAI(item));

  const raw = await aiChat({
    systemPrompt:
      "Eres content planner senior. Devuelves SOLO JSON valido, especifico, util para produccion y sin texto adicional.",
    userPrompt: [
      `Empresa: ${params.empresaNombre}`,
      `Calendario: ${params.calendarioTitulo}`,
      `Periodo: ${normalized.periodo}`,
      "",
      "Items actuales del calendario:",
      JSON.stringify(
        normalized.calendario.items.map((item) => ({
          id: item.id,
          fecha: item.fecha,
          canal: item.canal,
          formato: item.formato,
          titulo_base: item.titulo_base,
          tema: item.tema,
          subtema: item.subtema,
          objetivo_contenido: item.objetivo_contenido,
          CTA: item.CTA,
          mensaje_clave: item.mensaje_clave,
          pilar: item.pilar,
          buyer_persona: item.buyer_persona,
        })),
        null,
        2,
      ),
      "",
      "Tarea:",
      "Regenera TODO el calendario manteniendo exactamente la misma cantidad de items y sin mover sus fechas.",
      "Debes mejorar angulos, hooks, CTAs, mensaje y claridad editorial item por item.",
      "",
      "Reglas:",
      "1) Devuelve SOLO JSON.",
      "2) Devuelve un objeto con clave items.",
      "3) items debe tener exactamente el mismo numero de elementos y en el mismo orden de entrada.",
      "4) No cambies fechas, ids, semanas, orden_semana ni estados. Solo regenera el contenido editorial de cada item.",
      "5) Conserva coherencia con canal y formato.",
      "6) Evita repetir la misma idea entre items.",
      customPrompt?.trim() ? `7) Prompt adicional del usuario: ${customPrompt.trim()}` : "7) No hay prompt adicional del usuario.",
      "",
      `JSON exacto esperado: ${JSON.stringify({ items: fallback })}`,
    ].join("\n"),
    temperature: 0.45,
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
