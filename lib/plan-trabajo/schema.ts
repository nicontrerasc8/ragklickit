export type ComunidadMetrica = {
  red: string;
  mes_anterior: string;
  meta: string;
};

export type CantidadContenido = {
  red: string;
  cantidad: number;
  formatos: string[];
};

export type PilarComunicacion = {
  pilar: string;
  porcentaje: string;
};

export type IdeaContenido = {
  canal: string;
  ideas: string[];
};

export type PlanTrabajo = {
  cliente: string;
  marca: string;
  pais: string;
  
  version: string;
  periodo: {
    inicio: string;

    fin: string;
    
  };

  comunidad: ComunidadMetrica[];
  resumen_actualizaciones: {
    gestion_redes: string;
    observaciones: string[];
  };
  cantidad_contenidos: CantidadContenido[];
  pilares_comunicacion: PilarComunicacion[];
  contenido_sugerido: IdeaContenido[];
  productos_servicios_destacar: string[];
  mensajes_destacados: string[];
  fechas_importantes: string[];
  promociones: string;
  plan_medios_link: string;
  eventos: string[];
  notas_adicionales: string;
  pendientes_cliente: string[];
  alcance_calendario: Record<string, number>;
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

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeComunidad(value: unknown): ComunidadMetrica[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = asObj(item);
      return {
        red: asString(row.red).trim(),
        mes_anterior: asString(row.mes_anterior).trim(),
        meta: asString(row.meta).trim(),
      };
    })
    .filter((item) => item.red || item.mes_anterior || item.meta);
}

function normalizeCantidadContenidos(value: unknown): CantidadContenido[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = asObj(item);
      return {
        red: asString(row.red).trim(),
        cantidad: Math.max(0, Math.trunc(toNumber(row.cantidad, 0))),
        formatos: asStringArray(row.formatos),
      };
    })
    .filter((item) => item.red || item.cantidad > 0 || item.formatos.length > 0);
}

function normalizePilares(value: unknown): PilarComunicacion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = asObj(item);
      return {
        pilar: asString(row.pilar).trim(),
        porcentaje: asString(row.porcentaje).trim(),
      };
    })
    .filter((item) => item.pilar || item.porcentaje);
}

function normalizeIdeas(value: unknown): IdeaContenido[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = asObj(item);
      const canal =
        asString(row.canal).trim() ||
        asString(row.red).trim() ||
        asString(row.canal_nombre).trim() ||
        asString(row.channel).trim();
      const ideas =
        asStringArray(row.ideas).length > 0
          ? asStringArray(row.ideas)
          : asStringArray(row.lineas_tematicas).length > 0
            ? asStringArray(row.lineas_tematicas)
            : asStringArray(row.temas).length > 0
              ? asStringArray(row.temas)
              : asStringArray(row.sugerencias).length > 0
                ? asStringArray(row.sugerencias)
                : [
                    asString(row.idea).trim(),
                    asString(row.tema).trim(),
                    asString(row.titulo).trim(),
                    asString(row.enfoque).trim(),
                  ].filter((entry) => entry.length > 0);

      return {
        canal,
        ideas,
      };
    })
    .filter((item) => item.canal || item.ideas.length > 0);
}

function filterRowsByScope<T extends { red: string } | { canal: string }>(
  rows: T[],
  alcance: Record<string, number>,
) {
  const allowedChannels = new Set(Object.keys(alcance));
  if (allowedChannels.size === 0) return rows;

  return rows.filter((row) => {
    const channel = "red" in row ? row.red : row.canal;
    return allowedChannels.has(channel);
  });
}

export function normalizeAlcanceCalendario(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, number>;

  const map: Record<string, number> = {};
  for (const [channel, countRaw] of Object.entries(value as Record<string, unknown>)) {
    const count =
      typeof countRaw === "number"
        ? countRaw
        : Number.parseInt(String(countRaw ?? "").trim(), 10);
    if (!channel.trim() || !Number.isFinite(count) || count <= 0) continue;
    map[channel.trim()] = Math.min(50, Math.trunc(count));
  }

  return map;
}

export function makeDefaultPlanTrabajo(seed?: Partial<PlanTrabajo>): PlanTrabajo {
  const safeSeed = seed ?? {};
  const alcanceFromSeed = normalizeAlcanceCalendario(safeSeed.alcance_calendario);

  return {
    cliente: safeSeed.cliente ?? "",
    marca: safeSeed.marca ?? "",
    pais: safeSeed.pais ?? "Peru",
    version: safeSeed.version ?? "",
    periodo: {
      inicio: safeSeed.periodo?.inicio ?? "",
      fin: safeSeed.periodo?.fin ?? "",
    },
    comunidad: safeSeed.comunidad ?? [],
    resumen_actualizaciones: {
      gestion_redes: safeSeed.resumen_actualizaciones?.gestion_redes ?? "",
      observaciones: safeSeed.resumen_actualizaciones?.observaciones ?? [],
    },
    cantidad_contenidos: safeSeed.cantidad_contenidos ?? [],
    pilares_comunicacion: safeSeed.pilares_comunicacion ?? [],
    contenido_sugerido: safeSeed.contenido_sugerido ?? [],
    productos_servicios_destacar: safeSeed.productos_servicios_destacar ?? [],
    mensajes_destacados: safeSeed.mensajes_destacados ?? [],
    fechas_importantes: safeSeed.fechas_importantes ?? [],
    promociones: safeSeed.promociones ?? "NO APLICA",
    plan_medios_link: safeSeed.plan_medios_link ?? "",
    eventos: safeSeed.eventos ?? [],
    notas_adicionales: safeSeed.notas_adicionales ?? "",
    pendientes_cliente: safeSeed.pendientes_cliente ?? [],
    alcance_calendario: alcanceFromSeed,
  };
}

export function normalizePlanTrabajo(input: unknown, fallback?: PlanTrabajo): PlanTrabajo {
  const base = makeDefaultPlanTrabajo(fallback);
  const source = asObj(input);
  const periodo = asObj(source.periodo);
  const resumen = asObj(source.resumen_actualizaciones);
  const alcance_calendario = (() => {
    const normalized = normalizeAlcanceCalendario(source.alcance_calendario);
    return Object.keys(normalized).length > 0 ? normalized : base.alcance_calendario;
  })();
  const comunidad = (() => {
    const normalized = normalizeComunidad(source.comunidad);
    const safeRows = normalized.length > 0 ? normalized : base.comunidad;
    return filterRowsByScope(safeRows, alcance_calendario);
  })();
  const cantidad_contenidos = (() => {
    const normalized = normalizeCantidadContenidos(source.cantidad_contenidos);
    const safeRows = normalized.length > 0 ? normalized : base.cantidad_contenidos;
    return filterRowsByScope(safeRows, alcance_calendario);
  })();
  const contenido_sugerido = (() => {
    const normalized = normalizeIdeas(source.contenido_sugerido);
    const safeRows = normalized.length > 0 ? normalized : base.contenido_sugerido;
    return filterRowsByScope(safeRows, alcance_calendario);
  })();

  return {
    cliente: asString(source.cliente, base.cliente),
    marca: asString(source.marca, base.marca),
    pais: asString(source.pais, base.pais),
    version: asString(source.version, base.version),
    periodo: {
      inicio: asString(periodo.inicio, base.periodo.inicio),
      fin: asString(periodo.fin, base.periodo.fin),
    },
    comunidad,
    resumen_actualizaciones: {
      gestion_redes: asString(
        resumen.gestion_redes,
        base.resumen_actualizaciones.gestion_redes,
      ),
      observaciones: (() => {
        const normalized = asStringArray(resumen.observaciones);
        return normalized.length > 0 ? normalized : base.resumen_actualizaciones.observaciones;
      })(),
    },
    cantidad_contenidos,
    pilares_comunicacion: (() => {
      const normalized = normalizePilares(source.pilares_comunicacion);
      return normalized.length > 0 ? normalized : base.pilares_comunicacion;
    })(),
    contenido_sugerido,
    productos_servicios_destacar: (() => {
      const normalized = asStringArray(source.productos_servicios_destacar);
      return normalized.length > 0 ? normalized : base.productos_servicios_destacar;
    })(),
    mensajes_destacados: (() => {
      const normalized = asStringArray(source.mensajes_destacados);
      return normalized.length > 0 ? normalized : base.mensajes_destacados;
    })(),
    fechas_importantes: (() => {
      const normalized = asStringArray(source.fechas_importantes);
      return normalized.length > 0 ? normalized : base.fechas_importantes;
    })(),
    promociones: asString(source.promociones, base.promociones),
    plan_medios_link: asString(source.plan_medios_link, base.plan_medios_link),
    eventos: (() => {
      const normalized = asStringArray(source.eventos);
      return normalized.length > 0 ? normalized : base.eventos;
    })(),
    notas_adicionales: asString(source.notas_adicionales, base.notas_adicionales),
    pendientes_cliente: (() => {
      const normalized = asStringArray(source.pendientes_cliente);
      return normalized.length > 0 ? normalized : base.pendientes_cliente;
    })(),
    alcance_calendario,
  };
}

export function normalizePlanTrabajoContent(input: unknown, fallback?: PlanTrabajo) {
  const root = asObj(input);
  const source =
    root.plan_trabajo && typeof root.plan_trabajo === "object"
      ? root.plan_trabajo
      : input;

  return {
    plan_trabajo: normalizePlanTrabajo(source, fallback),
  };
}
