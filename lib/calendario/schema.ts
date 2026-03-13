export type CalendarioItem = {
  id: string;
  canal: string;
  semana: number;
  orden_semana: number;
  fecha: string;
  pilar: string;
  tema: string;
  subtema: string;
  buyer_persona: string;
  objetivo_contenido: string;
  formato: string;
  titulo_base: string;
  CTA: string;
  mensaje_clave: string;
  hashtags: string[];
  restricciones_aplicadas: {
    frases_prohibidas: string[];
    disclaimers: string[];
  };
  estado: string;
  asset_bundle?: CalendarioItemAssetBundle | null;
};

export type CalendarioGeneratedImage = {
  id: string;
  path: string;
  prompt: string;
  alt: string;
};

export type CalendarioItemAssetBundle = {
  generated_at: string;
  headline: string;
  caption: string;
  short_copy: string;
  blog_title: string;
  blog_body_markdown: string;
  cta: string;
  hashtags: string[];
  visual_direction: string;
  image_prompt_base: string;
  image_count: number;
  image_prompts: string[];
  images: CalendarioGeneratedImage[];
};

export type CalendarioContent = {
  periodo: string;
  resumen: string;
  canales_prioritarios: string[];
  semanas: Array<{
    semana: "S1" | "S2" | "S3" | "S4";
    objetivo: string;
    piezas: Array<{
      fecha: string;
      canal: string;
      formato: string;
      tema: string;
      objetivo: string;
      cta: string;
      responsable: string;
      estado: string;
    }>;
  }>;
  hitos: string[];
  riesgos: string[];
  supuestos: string[];
  alcance_calendario: Record<string, number>;
  calendario: {
    cliente: string;
    marca: string;
    pais: string;
    version: string;
    generado_desde: "plan_trabajo";
    resumen_por_canal: Record<string, number>;
    items: CalendarioItem[];
  };
};

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toInt(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWeek(week: unknown) {
  const raw = toInt(week, 1);
  if (raw < 1) return 1;
  if (raw > 4) return 4;
  return raw;
}

function normalizeDate(value: unknown, fallback = "") {
  const raw = asString(value, fallback).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function normalizeAlcance(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, number>;
  const out: Record<string, number> = {};
  for (const [channel, countRaw] of Object.entries(value as Record<string, unknown>)) {
    const count = toInt(countRaw, 0);
    if (!channel.trim() || count <= 0) continue;
    out[channel.trim()] = Math.min(10, Math.max(1, count));
  }
  return out;
}

function normalizeImage(value: unknown, index: number) {
  const row = asObj(value);
  return {
    id: asString(row.id, `img-${index + 1}`),
    path: asString(row.path, ""),
    prompt: asString(row.prompt, ""),
    alt: asString(row.alt, ""),
  };
}

function normalizeAssetBundle(value: unknown): CalendarioItemAssetBundle | null {
  if (!value || typeof value !== "object") return null;
  const row = asObj(value);

  return {
    generated_at: asString(row.generated_at, ""),
    headline: asString(row.headline, ""),
    caption: asString(row.caption, ""),
    short_copy: asString(row.short_copy, ""),
    blog_title: asString(row.blog_title, ""),
    blog_body_markdown: asString(row.blog_body_markdown, ""),
    cta: asString(row.cta, ""),
    hashtags: asStringArray(row.hashtags),
    visual_direction: asString(row.visual_direction, ""),
    image_prompt_base: asString(row.image_prompt_base, ""),
    image_count: toInt(row.image_count, 0),
    image_prompts: asStringArray(row.image_prompts),
    images: Array.isArray(row.images) ? row.images.map((item, index) => normalizeImage(item, index)) : [],
  };
}

function rangeForWeek(week: number, lastDay: number): [number, number] {
  if (week === 2) return [8, Math.min(14, lastDay)];
  if (week === 3) return [15, Math.min(21, lastDay)];
  if (week === 4) return [22, lastDay];
  return [1, Math.min(7, lastDay)];
}

function resolveItemDate(item: Partial<CalendarioItem>, periodo: string) {
  const explicit = normalizeDate(item.fecha, "");
  if (explicit) return explicit;

  const match = periodo.match(/^(\d{4})-(\d{2})/);
  if (!match) return "";
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return "";
  }

  const week = normalizeWeek(item.semana);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const [start, end] = rangeForWeek(week, lastDay);
  const span = Math.max(1, end - start + 1);
  const order = Math.max(1, toInt(item.orden_semana, 1));
  const day = Math.min(end, start + ((order - 1) % span));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeItem(value: unknown, index: number, periodo: string): CalendarioItem {
  const row = asObj(value);
  const restricciones = asObj(row.restricciones_aplicadas);
  const semana = normalizeWeek(row.semana);
  const orden = Math.max(1, toInt(row.orden_semana, 1));
  const canal = asString(row.canal, "Instagram") || "Instagram";

  const item: CalendarioItem = {
    id: asString(row.id, `${canal}-${semana}-${orden || index + 1}`),
    canal,
    semana,
    orden_semana: orden,
    fecha: "",
    pilar: asString(row.pilar, "General"),
    tema: asString(row.tema, ""),
    subtema: asString(row.subtema, ""),
    buyer_persona: asString(row.buyer_persona, "Buyer Persona General"),
    objetivo_contenido: asString(row.objetivo_contenido, ""),
    formato: asString(row.formato, "Post"),
    titulo_base: asString(row.titulo_base, asString(row.tema, "")),
    CTA: asString(row.CTA, ""),
    mensaje_clave: asString(row.mensaje_clave, ""),
    hashtags: asStringArray(row.hashtags),
    restricciones_aplicadas: {
      frases_prohibidas: asStringArray(restricciones.frases_prohibidas),
      disclaimers: asStringArray(restricciones.disclaimers),
    },
    estado: asString(row.estado, "planificado"),
    asset_bundle: normalizeAssetBundle(row.asset_bundle),
  };

  item.fecha = resolveItemDate(item, periodo);
  return item;
}

function legacySemanasToItems(value: unknown, periodo: string) {
  if (!Array.isArray(value)) return [] as CalendarioItem[];

  const items: CalendarioItem[] = [];
  for (const rawWeek of value) {
    const week = asObj(rawWeek);
    const weekLabel = asString(week.semana, "S1");
    const weekNum = weekLabel === "S2" ? 2 : weekLabel === "S3" ? 3 : weekLabel === "S4" ? 4 : 1;
    const pieces = Array.isArray(week.piezas) ? week.piezas : [];
    pieces.forEach((rawPiece, idx) => {
      const piece = asObj(rawPiece);
      items.push(
        normalizeItem(
          {
            id: `${asString(piece.canal, "Instagram")}-${weekNum}-${idx + 1}`,
            canal: asString(piece.canal, "Instagram"),
            semana: weekNum,
            orden_semana: idx + 1,
            fecha: asString(piece.fecha, ""),
            tema: asString(piece.tema, ""),
            titulo_base: asString(piece.tema, ""),
            objetivo_contenido: asString(piece.objetivo, ""),
            formato: asString(piece.formato, "Post"),
            CTA: asString(piece.cta, ""),
            estado: asString(piece.estado, "planificado"),
          },
          items.length,
          periodo,
        ),
      );
    });
  }

  return items;
}

export function calendarItemsToWeeks(items: CalendarioItem[]) {
  const byWeek = new Map<number, CalendarioItem[]>();
  items.forEach((item) => {
    const week = normalizeWeek(item.semana);
    const group = byWeek.get(week) ?? [];
    group.push(item);
    byWeek.set(week, group);
  });

  const weekLabel = (week: number): "S1" | "S2" | "S3" | "S4" =>
    week === 2 ? "S2" : week === 3 ? "S3" : week === 4 ? "S4" : "S1";

  return ([1, 2, 3, 4] as const).map((week) => ({
    semana: weekLabel(week),
    objetivo: `Objetivo operativo ${weekLabel(week)}`,
    piezas: (byWeek.get(week) ?? []).map((item) => ({
      fecha: item.fecha,
      canal: item.canal,
      formato: item.formato,
      tema: item.titulo_base || item.tema,
      objetivo: item.objetivo_contenido,
      cta: item.CTA,
      responsable: "agencia",
      estado: item.estado,
    })),
  }));
}

function summarizeByChannel(items: CalendarioItem[]) {
  const summary: Record<string, number> = {};
  items.forEach((item) => {
    if (!item.canal.trim()) return;
    summary[item.canal] = (summary[item.canal] ?? 0) + 1;
  });
  return summary;
}

export function makeDefaultCalendarioContent(seed?: Partial<CalendarioContent>): CalendarioContent {
  const safe = seed ?? {};
  const cal = safe.calendario ?? ({} as CalendarioContent["calendario"]);

  return {
    periodo: safe.periodo ?? "",
    resumen: safe.resumen ?? "",
    canales_prioritarios: safe.canales_prioritarios ?? [],
    semanas: safe.semanas ?? [],
    hitos: safe.hitos ?? [],
    riesgos: safe.riesgos ?? [],
    supuestos: safe.supuestos ?? [],
    alcance_calendario: normalizeAlcance(safe.alcance_calendario),
    calendario: {
      cliente: cal.cliente ?? "",
      marca: cal.marca ?? "",
      pais: cal.pais ?? "Peru",
      version: cal.version ?? "",
      generado_desde: "plan_trabajo",
      resumen_por_canal: cal.resumen_por_canal ?? {},
      items: cal.items ?? [],
    },
  };
}

export function normalizeCalendarioContent(
  input: unknown,
  fallback?: CalendarioContent,
): CalendarioContent {
  const base = makeDefaultCalendarioContent(fallback);
  const root = asObj(input);

  const periodo = asString(root.periodo, base.periodo);
  const calendarioRaw = asObj(root.calendario);
  const rawItems = Array.isArray(calendarioRaw.items) ? calendarioRaw.items : [];
  const itemsFromJson = rawItems.map((item, idx) => normalizeItem(item, idx, periodo));
  const items = itemsFromJson.length > 0 ? itemsFromJson : legacySemanasToItems(root.semanas, periodo);

  const resumenPorCanal = summarizeByChannel(items);

  return {
    periodo,
    resumen: asString(root.resumen, base.resumen),
    canales_prioritarios:
      asStringArray(root.canales_prioritarios).length > 0
        ? asStringArray(root.canales_prioritarios)
        : Object.keys(resumenPorCanal),
    semanas: calendarItemsToWeeks(items),
    hitos: asStringArray(root.hitos),
    riesgos: asStringArray(root.riesgos),
    supuestos: asStringArray(root.supuestos),
    alcance_calendario: (() => {
      const normalized = normalizeAlcance(root.alcance_calendario);
      return Object.keys(normalized).length > 0 ? normalized : base.alcance_calendario;
    })(),
    calendario: {
      cliente: asString(calendarioRaw.cliente, base.calendario.cliente),
      marca: asString(calendarioRaw.marca, base.calendario.marca),
      pais: asString(calendarioRaw.pais, base.calendario.pais),
      version: asString(calendarioRaw.version, base.calendario.version),
      generado_desde: "plan_trabajo",
      resumen_por_canal: resumenPorCanal,
      items,
    },
  };
}
