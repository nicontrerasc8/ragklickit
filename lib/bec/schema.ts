export type CompanyForm = {
  negocio: string;
  marca: string;
  industria: string;
  pais: string;
  objetivo: string;
  problema: string;
};

export type BECFieldKey =
  | "Cliente"
  | "Marca"
  | "País"
  | "Versión"
  | "Vigente desde"
  | "Vigente hasta"
  | "Propuesta de Valor"
  | "Posicionamiento"
  | "Claim Central"
  | "Tono de Voz"
  | "Atributos de Voz"
  | "Frases Prohibidas / No-Go Topics"
  | "Mensaje Clave / Storytelling Base"
  | "ICP Principal (Ideal Customer Profile)"
  | "ICP Secundario"
  | "Buyer Persona 1"
  | "Buyer Persona 2"
  | "Puntos de Dolor (Pain Points)"
  | "Objetivo SMART 1"
  | "Objetivo SMART 2"
  | "KPI Primario"
  | "KPI Secundario"
  | "Métrica de Éxito / ROI Esperado"
  | "Alcance General"
  | "Plan"
  | "Entregables Mensuales"
  | "Fuera de Alcance"
  | "Herramientas Asociadas"
  | "Competencia Directa"
  | "Benchmark Aspiracional"
  | "Palabras Clave SEO"
  | "Claims Generales"
  | "Claims por Cluster"
  | "CTA Recomendadas"
  | "Hashtags Do"
  | "Hashtags Don't"
  | "Restricciones Legales"
  | "Disclaimers Obligatorios"
  | "Dependencias Operativas"
  | "KAM"
  | "GM"
  | "Diseño"
  | "Planner / Pauta"
  | "Aprobador Cliente"
  | "Content Manager"
  | "Metricool Perfil"
  | "Xpandit Plantilla"
  | "Biblioteca Assets"
  | "Brandbook URL"
  | "Notas Finales / Observaciones";

export type BECPillarRow = {
  pilar: string;
  porcentaje: string;
  canales: string;
  formatos: string;
};

export type BECState = {
  fields: Record<BECFieldKey, string>;
  pilares: BECPillarRow[];
};

const BEC_PENDING_VALIDATION =
  "Pendiente de validar con cliente segun metadata_json y contexto actual.";

const STRICT_BEC_KPI_FIELDS: BECFieldKey[] = [
  "Objetivo SMART 1",
  "Objetivo SMART 2",
  "KPI Primario",
  "KPI Secundario",
  "Métrica de Éxito / ROI Esperado",
];

function sanitizeStrictBecField(key: BECFieldKey, value: string) {
  const trimmed = value.trim();
  if (!STRICT_BEC_KPI_FIELDS.includes(key)) {
    return trimmed;
  }

  if (!trimmed) {
    return BEC_PENDING_VALIDATION;
  }

  const normalized = trimmed.toLowerCase();
  if (
    normalized.includes("supuesto:") ||
    normalized.includes("por definir") ||
    normalized.includes("por confirmar") ||
    normalized.includes("por validar") ||
    normalized.includes("pendiente")
  ) {
    return BEC_PENDING_VALIDATION;
  }

  return trimmed;
}

export type BECSectionRow =
  | { kind: "field"; key: BECFieldKey; desc: string; example: string }
  | { kind: "pillars" };

export type BECSection = {
  title: string;
  rows: BECSectionRow[];
};

export const BEC_TEMPLATE: BECSection[] = [
  {
    title: "1. Datos Generales",
    rows: [
      { kind: "field", key: "Cliente", desc: "Nombre de la empresa", example: "Bali House" },
      { kind: "field", key: "Marca", desc: "Nombre comercial", example: "Bali House Panama" },
      { kind: "field", key: "País", desc: "Pais de operacion", example: "Panama" },
      { kind: "field", key: "Versión", desc: "Numero de version del documento", example: "1.0" },
      { kind: "field", key: "Vigente desde", desc: "Fecha de inicio", example: "2025-09-01" },
      { kind: "field", key: "Vigente hasta", desc: "Fecha estimada de revision", example: "2026-03-01" },
    ],
  },
  {
    title: "1. Identidad Estrategica",
    rows: [
      { kind: "field", key: "Propuesta de Valor", desc: "Que promete y diferencia la marca", example: "Creamos atmosferas con alma..." },
      { kind: "field", key: "Posicionamiento", desc: "Como quiere ser percibida", example: "Curadores de espacios con alma..." },
      { kind: "field", key: "Claim Central", desc: "Frase corta que sintetiza la propuesta", example: "Diseno artesanal con alma tropical." },
      { kind: "field", key: "Tono de Voz", desc: "Como se comunica la marca", example: "Elegante, sensorial y cercana." },
      { kind: "field", key: "Atributos de Voz", desc: "Valores expresivos", example: "Calida, confiable, inspiradora." },
      { kind: "field", key: "Frases Prohibidas / No-Go Topics", desc: "Que evitar", example: "No prometer resultados garantizados..." },
      { kind: "field", key: "Mensaje Clave / Storytelling Base", desc: "Historia base de la marca", example: "Artesania, origen, ritual..." },
    ],
  },
  {
    title: "2. ICP e Insight del Cliente",
    rows: [
      { kind: "field", key: "ICP Principal (Ideal Customer Profile)", desc: "Cliente ideal", example: "Hogares ABC1..." },
      { kind: "field", key: "ICP Secundario", desc: "Otro segmento posible", example: "Arquitectos / disenadores..." },
      { kind: "field", key: "Buyer Persona 1", desc: "Perfil detallado", example: "Mujer 32-45..." },
      { kind: "field", key: "Buyer Persona 2", desc: "Perfil detallado", example: "Hombre 35-55..." },
      { kind: "field", key: "Puntos de Dolor (Pain Points)", desc: "Problemas que resuelve", example: "Falta de asesoria, calidad..." },
    ],
  },
  {
    title: "3. Objetivos Estrategicos y KPIs",
    rows: [
      { kind: "field", key: "Objetivo SMART 1", desc: "Primer objetivo medible", example: "Aumentar leads " },
      { kind: "field", key: "Objetivo SMART 2", desc: "Segundo objetivo", example: "Mejorar tasa de cierre..." },
      { kind: "field", key: "KPI Primario", desc: "Indicador central", example: "Leads calificados / CAC" },
      { kind: "field", key: "KPI Secundario", desc: "Indicador complementario", example: "CTR / CVR / ROAS" },
      { kind: "field", key: "Métrica de Éxito / ROI Esperado", desc: "Resultado esperado segun el KPI primario, no necesariamente en porcentaje", example: "CAC objetivo <= X segun el KPI primario definido" },
    ],
  },
  {
    title: "4. Alcance del Proyecto",
    rows: [
      { kind: "field", key: "Alcance General", desc: "Servicios cubiertos", example: "Contenido + pauta + CRM..." },
      { kind: "field", key: "Plan", desc: "Plan contratado", example: "Plan Xpandit..." },
      { kind: "field", key: "Entregables Mensuales", desc: "Cuantificacion estandar", example: "8 Reels, 4 carruseles..." },
      { kind: "field", key: "Fuera de Alcance", desc: "Que no esta incluido", example: "Produccion de video pro..." },
      { kind: "field", key: "Herramientas Asociadas", desc: "Plataformas vinculadas", example: "GA4, Meta Ads, HubSpot..." },
    ],
  },
  {
    title: "5. Pilares de Comunicacion",
    rows: [{ kind: "pillars" }],
  },
  {
    title: "6. Competencia y Benchmark",
    rows: [
      { kind: "field", key: "Competencia Directa", desc: "Rivales del mismo nivel", example: "Competidor A, B" },
      { kind: "field", key: "Benchmark Aspiracional", desc: "Marcas globales a emular", example: "Marca X, Y" },
      { kind: "field", key: "Palabras Clave SEO", desc: "Keywords estrategicas", example: "muebles bali, diseno..." },
    ],
  },
  {
    title: "7. Claims, CTAs y Hashtags",
    rows: [
      { kind: "field", key: "Claims Generales", desc: "Claims principales", example: "Diseno con alma..." },
      { kind: "field", key: "Claims por Cluster", desc: "Claims por categorias", example: "Dormitorios:..., Sala:..." },
      { kind: "field", key: "CTA Recomendadas", desc: "Llamados a la accion", example: "Cotiza, Agenda, Compra" },
      { kind: "field", key: "Hashtags Do", desc: "Hashtags permitidos", example: "#diseno #decor" },
      { kind: "field", key: "Hashtags Don't", desc: "Hashtags a evitar", example: "#barato #oferta" },
    ],
  },
  {
    title: "8. Restricciones, Riesgos y Dependencias",
    rows: [
      { kind: "field", key: "Restricciones Legales", desc: "Regulatorio/compliance", example: "No prometer..." },
      { kind: "field", key: "Disclaimers Obligatorios", desc: "Textos obligatorios", example: "Aplican terminos..." },
      { kind: "field", key: "Dependencias Operativas", desc: "Que depende del cliente", example: "Stock, aprobaciones..." },
    ],
  },
  {
    title: "9. Roles y Responsables",
    rows: [
      { kind: "field", key: "KAM", desc: "Account manager", example: "Nombre / cargo" },
      { kind: "field", key: "GM", desc: "Growth manager", example: "Nombre / cargo" },
      { kind: "field", key: "Diseño", desc: "Disenador/a", example: "Nombre / cargo" },
      { kind: "field", key: "Planner / Pauta", desc: "Media planner", example: "Nombre / cargo" },
      { kind: "field", key: "Aprobador Cliente", desc: "Decisor final", example: "Nombre / cargo" },
      { kind: "field", key: "Content Manager", desc: "Contenido", example: "Nombre / cargo" },
    ],
  },
  {
    title: "10. Integraciones y Recursos",
    rows: [
      { kind: "field", key: "Metricool Perfil", desc: "Link o nombre", example: "perfil metricool" },
      { kind: "field", key: "Xpandit Plantilla", desc: "Link plantilla", example: "url" },
      { kind: "field", key: "Biblioteca Assets", desc: "Drive/Carpeta", example: "url" },
      { kind: "field", key: "Brandbook URL", desc: "Manual marca", example: "url" },
    ],
  },
  {
    title: "11. Notas Finales / Observaciones",
    rows: [{ kind: "field", key: "Notas Finales / Observaciones", desc: "Notas", example: "Notas adicionales..." }],
  },
];

export const DEFAULT_COMPANY: CompanyForm = {
  negocio: "",
  marca: "",
  industria: "",
  pais: "Peru",
  objetivo: "",
  problema: "",
};

export function makeDefaultBEC(): BECState {
  const fields = {} as Record<BECFieldKey, string>;
  for (const sec of BEC_TEMPLATE) {
    for (const row of sec.rows) {
      if (row.kind === "field") fields[row.key] = "";
    }
  }
  fields["Versión"] = "1.0";

  const pilares: BECPillarRow[] = Array.from({ length: 6 }).map(() => ({
    pilar: "",
    porcentaje: "",
    canales: "",
    formatos: "",
  }));

  return { fields, pilares };
}

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseKeyValueLines(text: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const idx = line.indexOf(":");
    if (idx <= 0 || idx >= line.length - 1) continue;

    const k = normalizeKey(line.slice(0, idx));
    const v = line.slice(idx + 1).trim();
    if (!k || !v) continue;

    map.set(k, v);
  }

  return map;
}

export function mapAnswerToBec(answer: string, base?: BECState): BECState {
  const parsed = parseKeyValueLines(answer);
  const current = base ?? makeDefaultBEC();

  const nextFields = { ...current.fields };
  (Object.keys(nextFields) as BECFieldKey[]).forEach((key) => {
    const value = parsed.get(normalizeKey(key));
    if (value) {
      nextFields[key] = sanitizeStrictBecField(key, value);
    }
  });

  const nextPilares = current.pilares.map((row, idx) => {
    const i = idx + 1;
    return {
      pilar: parsed.get(normalizeKey(`Pilar ${i} - Pilar`)) ?? row.pilar,
      porcentaje:
        parsed.get(normalizeKey(`Pilar ${i} - % Contenido`)) ?? row.porcentaje,
      canales:
        parsed.get(normalizeKey(`Pilar ${i} - Canales Principales`)) ?? row.canales,
      formatos:
        parsed.get(normalizeKey(`Pilar ${i} - Formatos Clave`)) ?? row.formatos,
    };
  });

  return { fields: nextFields, pilares: nextPilares };
}

export function loadBECState(input: unknown): BECState {
  const fallback = makeDefaultBEC();
  if (!input || typeof input !== "object") {
    return fallback;
  }

  const obj = input as {
    fields?: Record<string, unknown>;
    pilares?: Array<Partial<BECPillarRow>>;
  };

  const next = makeDefaultBEC();

  if (obj.fields && typeof obj.fields === "object") {
    for (const key of Object.keys(next.fields) as BECFieldKey[]) {
      const value = obj.fields[key];
      if (typeof value === "string") {
        next.fields[key] = sanitizeStrictBecField(key, value);
      }
    }
  }

  if (Array.isArray(obj.pilares) && obj.pilares.length > 0) {
    next.pilares = obj.pilares.map((row) => ({
      pilar: typeof row.pilar === "string" ? row.pilar : "",
      porcentaje: typeof row.porcentaje === "string" ? row.porcentaje : "",
      canales: typeof row.canales === "string" ? row.canales : "",
      formatos: typeof row.formatos === "string" ? row.formatos : "",
    }));
  }

  return next;
}

export function companyContext(c: CompanyForm): string {
  return [
    "Contexto empresa:",
    `- Cliente/Negocio: ${c.negocio || "No especificado"}`,
    `- Marca: ${c.marca || "No especificado"}`,
    `- Industria: ${c.industria || "No especificado"}`,
    `- Pais/Mercado: ${c.pais || "No especificado"}`,
    `- Objetivo: ${c.objetivo || "No especificado"}`,
    `- Problema principal: ${c.problema || "No especificado"}`,
  ].join("\n");
}

function normalizeDeliverableCount(value: unknown) {
  const count =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(count) || count <= 0) return null;
  return Math.min(10, Math.trunc(count));
}

function formatDeliverableLabel(channel: string, count: number) {
  const normalized = channel.trim().toLowerCase();

  if (normalized === "instagram") return `${count} piezas para Instagram`;
  if (normalized === "facebook") return `${count} piezas para Facebook`;
  if (normalized === "linkedin") return `${count} piezas para LinkedIn`;
  if (normalized === "tiktok") return `${count} piezas para TikTok`;
  if (normalized === "youtube") return `${count} piezas para YouTube`;
  if (normalized === "marketing email") return `${count} emails de marketing`;
  if (normalized === "blog") return `${count} articulos de blog`;
  if (normalized === "whatsapp") return `${count} piezas para WhatsApp`;

  return `${count} entregables para ${channel.trim()}`;
}

export function deriveMonthlyDeliverablesFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";

  const record = metadata as Record<string, unknown>;

  if (typeof record.entregables_mensuales === "string" && record.entregables_mensuales.trim()) {
    return record.entregables_mensuales.trim();
  }

  const alcance =
    record.alcance_calendario && typeof record.alcance_calendario === "object"
      ? (record.alcance_calendario as Record<string, unknown>)
      : null;

  if (!alcance) return "";

  return Object.entries(alcance)
    .map(([channel, rawCount]) => {
      const count = normalizeDeliverableCount(rawCount);
      if (!channel.trim() || count === null) return "";
      return formatDeliverableLabel(channel, count);
    })
    .filter(Boolean)
    .join(", ");
}

export function buildPromptBEC(
  company: CompanyForm,
  docContext: string,
  metadataContext?: string,
  forcedDeliverables?: string,
  currentBec?: BECState,
  customPrompt?: string,
): string {
  const fieldsList = Object.keys(makeDefaultBEC().fields).join(", ");
  const safeForcedDeliverables = forcedDeliverables?.trim() ?? "";
  const safeCustomPrompt = customPrompt?.trim() ?? "";
  const monthlyDeliverablesRule = safeForcedDeliverables
    ? `- El campo "Entregables Mensuales" debe salir exactamente de metadata_json. Usa este valor literal: ${safeForcedDeliverables}`
    : '- Si metadata_json trae entregables o alcance_calendario, usa esa informacion como fuente prioritaria para "Entregables Mensuales".';
  const currentBecContext = currentBec
    ? `\nBEC ACTUAL (usa esto como base para regenerar y refinar, no para ignorarlo):\n${JSON.stringify(currentBec, null, 2)}\n`
    : "";
  const customPromptRule = safeCustomPrompt
    ? `- Instruccion adicional del usuario para esta regeneracion: ${safeCustomPrompt}`
    : "- No hay instruccion adicional del usuario.";

  return `Actua como un comite senior de agencia formado por: estratega de marca, estratega de growth, planner creativo, copy chief y consultor comercial. Tu tarea es llenar o regenerar el BEC (Base Estrategica del Cliente) con nivel premium: criterio original, lectura de negocio, sensibilidad cultural, potencia comercial y claridad operativa.\n\nOBJETIVO:\n- Producir un BEC que no solo describa a la marca, sino que ordene decisiones reales de contenido, pauta, conversion, ventas y relacion cliente-agencia.\n- Mantener exactamente los mismos campos del BEC, pero elevar muchisimo la calidad del pensamiento dentro de cada campo.\n- Entregar un resultado que suene como trabajo de una agencia realmente cara, exigente y brillante, no como texto generico de IA.\n\nJERARQUIA DE FUENTES:\n- Prioridad 1: METADATA_JSON cuando tenga datos explicitos.\n- Prioridad 2: BEC actual, si existe, para conservar informacion valida y no perder aprendizaje acumulado.\n- Prioridad 3: contexto documental de empresa y agencia como soporte, matiz y enriquecimiento.\n- Si hay conflicto entre fuentes, prioriza la mas explicita, mas reciente y mas operativa. No inventes contradicciones.\n\nMENTALIDAD ESTRATEGICA:\n- Piensa como alguien que tiene que defender esta estrategia frente a founders, gerencia comercial y equipo creativo en la misma mesa.\n- Busca la tension valiosa: que hace deseable esta marca, que objecion combate, que codigo cultural puede apropiarse, que espacio competitivo puede ocupar y que narrativa puede convertir mejor.\n- No respondas como redactor administrativo. Responde como alguien que entiende mercado, decision de compra, diferenciacion y persuasion.\n- Si una frase podria pertenecerle a cualquier empresa del rubro, descartala y rehacela.\n- Prefiere ideas con filo, criterio y direccion antes que textos neutros, correctos pero olvidables.\n- Se permite ambicion creativa, pero siempre anclada al negocio, al mercado y a la realidad operativa.\n\nREGLAS CRITICAS:\n- NO uses markdown.\n- NO uses tablas.\n- NO uses bullets con guiones.\n- SOLO lineas con formato exacto "Campo: valor".\n- Usa exactamente estos campos, con los mismos nombres:\n${fieldsList}\n- Si falta informacion, escribe "SUPUESTO: ..." dentro del valor, pero hazlo con hipotesis inteligentes y plausibles.\n- No dejes campos estrategicos en blanco si se puede inferir algo razonable del contexto.\n- Si recibes un BEC actual, usalo como base y mejora solo donde aporte valor. Conserva informacion valida, concreta y coherente.\n${monthlyDeliverablesRule}\n${customPromptRule}\n\nESTANDAR DE CALIDAD DEL CONTENIDO:\n- Evita frases vacias como "mejorar presencia digital", "conectar con la audiencia", "innovacion", "calidad" o "servicio personalizado" si no estan aterrizadas con criterio.\n- Cada valor debe ayudar a tomar decisiones. Si un campo no sirve para definir mensajes, contenido, pauta, conversion o gestion, esta flojo.\n- Propuesta de Valor debe explicar por que esta marca merece atencion, confianza y preferencia frente a alternativas reales.\n- Posicionamiento debe sonar como una posicion conquistable en mercado, no como un slogan aspiracional bonito.\n- Claim Central debe ser corto, memorable, utilizable y con tension verbal. Debe sonar publicable.\n- Tono de Voz y Atributos de Voz deben ser accionables para copywriters y community managers; evita adjetivos vagos sin matiz.\n- Storytelling Base debe condensar una narrativa madre que pueda bajar a campanas, piezas, landings y ventas.\n- ICP y buyer personas deben mostrar insight de motivaciones, objeciones, nivel de consciencia, contexto de compra y disparadores de decision.\n- Pain points debe capturar fricciones reales, no problemas obvios descritos de forma plana.\n- Objetivos SMART y KPIs deben conectar con negocio y ser medibles de verdad.\n- Alcance General, Entregables Mensuales y Fuera de Alcance deben sonar operables para el equipo y claros para el cliente.\n- Competencia y benchmark deben servir para afilar diferenciacion, no para listar nombres sin lectura.\n- Claims, CTAs y hashtags deben sentirse por encima de lo tipico del rubro; evita formulas gastadas.\n- Restricciones, disclaimers y dependencias deben reducir riesgo y evitar ambiguedades operativas.\n- Notas finales deben registrar tensiones, riesgos, oportunidades, decisiones y alertas de criterio realmente utiles.\n\nHEURISTICAS DE AGENCIA TOP:\n- Combina claridad comercial con sofisticacion creativa.\n- Prioriza especificidad sobre volumen; mejor una idea potente que tres blandas.\n- Usa lenguaje humano, elegante y persuasivo, no jerga inflada ni consultoria hueca.\n- Cuando propongas ICP, claim, CTA o posicionamiento, busca piezas con personalidad propia.\n- No romantices la marca si el contexto pide precision practica.\n- No hagas branding de fantasia: todo debe poder sostenerse con el contexto disponible.\n- Si debes inferir, infiere con criterio de mercado y explica el supuesto dentro del valor.\n\nPILARES DE COMUNICACION:\n- Llena exactamente 6 filas.\n- Cada pilar debe ser distinto, complementario y defendible.\n- Cada pilar debe responder a una funcion estrategica distinta: autoridad, deseo, prueba, conversion, objeciones, cultura, comunidad, educacion, status o similar.\n- Evita pilares obvios o redundantes como repetir educacion, promocion e inspiracion sin angulo.\n- Nombra los pilares de forma afilada, no generica.\n- Los canales y formatos deben verse coherentes con el tipo de pilar y con el negocio.\n- Usa este formato exacto:\nPilar 1 - Pilar: ...\nPilar 1 - % Contenido: ...\nPilar 1 - Canales Principales: ...\nPilar 1 - Formatos Clave: ...\n- Repite el mismo patron hasta Pilar 6.\n- Los porcentajes deben verse realistas y coherentes con el mix de contenidos.\n\nPRUEBA INTERNA ANTES DE RESPONDER:\n- Revisa mentalmente cada campo y preguntate: esto suena premium o suena generico.\n- Si suena a plantilla, rehacelo.\n- Si no ayuda a vender, posicionar o ejecutar mejor, rehacelo.\n- Si podria aplicarse igual a tres marcas distintas, rehacelo.\n\n${companyContext(company)}\n${currentBecContext}\nMETADATA_JSON prioritaria:\n${metadataContext || "{}"}\n\nContexto documental (resumen):\n${docContext || "Sin documentos"}\n\nEntrega SOLO lineas Campo: valor y las lineas de pilares. Nada mas.`;
}
