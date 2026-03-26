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
      { kind: "field", key: "Objetivo SMART 1", desc: "Primer objetivo medible", example: "Aumentar leads 30%..." },
      { kind: "field", key: "Objetivo SMART 2", desc: "Segundo objetivo", example: "Mejorar tasa de cierre..." },
      { kind: "field", key: "KPI Primario", desc: "Indicador central", example: "Leads calificados / CAC" },
      { kind: "field", key: "KPI Secundario", desc: "Indicador complementario", example: "CTR / CVR / ROAS" },
      { kind: "field", key: "Métrica de Éxito / ROI Esperado", desc: "Como se mide exito", example: "ROAS > 3, CAC < X" },
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
      nextFields[key] = value;
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
        next.fields[key] = value;
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

  return `Actua como una agencia elite de marketing estrategico, branding y growth.\nTu tarea es llenar o regenerar el BEC (Base Estrategica del Cliente) con el nivel de criterio de una agencia top: pensamiento original, lectura de negocio, claridad comercial y diferenciacion real.\n\nOBJETIVO:\n- Producir un BEC que sirva para alinear estrategia, ejecucion, contenido, pauta y aprobacion con el cliente.\n- Mantener exactamente los mismos campos del BEC, pero elevar radicalmente la calidad del pensamiento dentro de cada campo.\n\nJERARQUIA DE FUENTES:\n- Prioridad 1: METADATA_JSON cuando tenga datos explicitos.\n- Prioridad 2: BEC actual, si existe, para conservar informacion valida.\n- Prioridad 3: contexto documental de empresa y agencia como soporte y enriquecimiento.\n- Si hay conflicto entre fuentes, prioriza la mas explicita y reciente. No inventes contradicciones.\n\nMODO DE PENSAR:\n- Piensa como una agencia super pro, no como un asistente generico.\n- Busca angulos con tension, diferenciacion, insight cultural, oportunidad competitiva y potencial comercial.\n- Evita respuestas promedio, corporativas, timidas o intercambiables.\n- Si dos marcas pudieran decir lo mismo, no es suficientemente bueno.\n- Prioriza ideas que ayuden a vender mejor, posicionar mejor y producir mejor contenido.\n- Se permite pensar out of the box, pero sin romper coherencia con la marca, mercado o contexto.\n\nREGLAS CRITICAS:\n- NO uses markdown.\n- NO uses tablas.\n- NO uses bullets con guiones.\n- SOLO lineas con formato exacto "Campo: valor".\n- Usa exactamente estos campos, con los mismos nombres:\n${fieldsList}\n- Si falta informacion, escribe "SUPUESTO: ..." dentro del valor.\n- No dejes campos estrategicos en blanco si se puede inferir algo razonable del contexto.\n- Si recibes un BEC actual, usalo como base y mejora solo donde aporte valor. Conserva informacion valida y coherente.\n${monthlyDeliverablesRule}\n${customPromptRule}\n\nCRITERIOS DE CALIDAD:\n- Evita frases vacias como "mejorar presencia digital" o "conectar con la audiencia". Todo debe aterrizarse.\n- Propuesta de Valor debe expresar por que esta marca gana atencion, confianza o preferencia.\n- Posicionamiento debe sonar defendible en mercado, no como slogan bonito.\n- Claim Central debe ser recordable, afilado y usable.\n- ICP, buyer persona y pain points deben mostrar insight real del cliente y del proceso de compra.\n- Objetivos SMART y KPIs deben poder medirse y conectarse con negocio.\n- Alcance General, Entregables Mensuales y Fuera de Alcance deben ser operables para el equipo.\n- Claims, CTAs y hashtags deben ser usables por contenido y pauta y sonar superiores a lo tipico del rubro.\n- Restricciones, disclaimers y dependencias deben reducir riesgo operativo.\n- Notas finales deben capturar tensiones, riesgos, oportunidades o decisiones estrategicas relevantes.\n\nPILARES DE COMUNICACION:\n- Llena exactamente 6 filas.\n- Cada pilar debe ser distinto, complementario y defendible.\n- Evita pilares obvios o redundantes como repetir educacion, promocion e inspiracion sin angulo.\n- Usa este formato exacto:\nPilar 1 - Pilar: ...\nPilar 1 - % Contenido: ...\nPilar 1 - Canales Principales: ...\nPilar 1 - Formatos Clave: ...\n- Repite el mismo patron hasta Pilar 6.\n- Los porcentajes deben verse realistas y coherentes con el mix de contenidos.\n\n${companyContext(company)}\n${currentBecContext}\nMETADATA_JSON prioritaria:\n${metadataContext || "{}"}\n\nContexto documental (resumen):\n${docContext || "Sin documentos"}\n\nEntrega SOLO lineas Campo: valor y las lineas de pilares. Nada mas.`;
}
