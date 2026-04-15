import type { CalendarioItem, CalendarioItemAssetBundle } from "@/lib/calendario/schema";

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
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

function basePlannerContext(params: {
  empresaNombre: string;
  calendarioTitulo: string;
  periodo: string;
}) {
  return [
    `Empresa: ${params.empresaNombre}`,
    `Calendario: ${params.calendarioTitulo}`,
    `Periodo: ${params.periodo}`,
  ];
}

function customPromptLine(customPrompt?: string) {
  return customPrompt?.trim()
    ? `Direccion adicional del usuario: ${customPrompt.trim()}`
    : "Direccion adicional del usuario: no hay.";
}

function premiumCreativeRules() {
  return [
    "REGLAS DE AGENCIA TOP:",
    "1) No escribas como plantilla de marketing ni como community manager junior.",
    "2) Evita frases intercambiables como 'conecta con tu audiencia', 'descubre', 'transforma tu vida', 'lleva tu marca al siguiente nivel' o similares.",
    "3) Cada idea debe tener un angulo claro: tension, contraste, deseo, objecion, prueba, ritual, status, error, mito, oportunidad o insight de comportamiento.",
    "4) Si una pieza suena correcta pero olvidable, rehacela hasta que tenga filo creativo y valor comercial.",
    "5) No repitas la misma estructura mental entre piezas. Cambia enfoque, promesa y mecanismo narrativo.",
    "6) Piensa como una agencia que quiere que el cliente diga 'esto no se me habria ocurrido, pero tiene sentido para mi marca'.",
  ];
}

export function buildCalendarioItemRegenerationPrompt(params: {
  empresaNombre: string;
  calendarioTitulo: string;
  periodo: string;
  item: CalendarioItem;
  customPrompt?: string;
}) {
  const { item } = params;

  return [
    ...basePlannerContext(params),
    "",
    "OBJETIVO:",
    "Regenerar un item del calendario mejorando enfoque, gancho, claridad editorial y utilidad operativa sin alterar su funcion dentro del plan.",
    "Hazlo con criterio de agencia top: ideas menos obvias, mas memorables y con mas potencial de performance.",
    "",
    "PRIORIDADES:",
    "1) Mantener intactos fecha, id, semana, orden_semana y estado.",
    "2) Mantener coherencia con canal, formato, buyer persona, objetivo y pilar.",
    "3) Mejorar especificidad: menos generalidades, mas claridad de angulo y promesa.",
    "4) Evitar ideas repetidas o copy generico.",
    "5) Si la idea suena comun o intercambiable, subela de nivel hasta que tenga un angulo distintivo.",
    "",
    "ITEM ACTUAL:",
    compactJson(item),
    "",
    ...premiumCreativeRules(),
    "",
    "CRITERIOS DE CALIDAD:",
    "1) titulo_base debe sonar publicable y diferenciado.",
    "1.1) No debe parecer titular de relleno. Debe tener un punto de vista o promesa concreta.",
    "2) tema y subtema deben ser concretos y no duplicarse entre si.",
    "2.1) tema = territorio editorial. subtema = arista puntual o detonante creativo.",
    "3) CTA debe decir que hacer y por que hacerlo ahora.",
    "4) mensaje_clave debe dejar una idea central clara, util y memorable.",
    "5) hashtags debe ser un array breve, relevante y limpio.",
    "6) Piensa como una agencia premium: mezcla insight, tension, deseo, objecion, prueba, cultura o comportamiento cuando aporte.",
    customPromptLine(params.customPrompt),
    "",
    "SALIDA OBLIGATORIA:",
    "1) Devuelve SOLO JSON valido.",
    "2) Devuelve exactamente este shape y solo estos campos regenerables.",
    compactJson(itemShapeFromAI(item)),
  ].join("\n");
}

export function buildCalendarioFullRegenerationPrompt(params: {
  empresaNombre: string;
  calendarioTitulo: string;
  periodo: string;
  items: CalendarioItem[];
  customPrompt?: string;
}) {
  const fallback = params.items.map((item) => itemShapeFromAI(item));

  return [
    ...basePlannerContext(params),
    "",
    "OBJETIVO:",
    "Regenerar todo el calendario mejorando angulos, hooks, CTA, mensaje y claridad editorial de cada item.",
    "Hazlo con nivel de agencia premium: menos plantilla, mas criterio, mas diferenciacion y mas potencial comercial.",
    "",
    "RESTRICCIONES DURAS:",
    "1) Mantener exactamente la misma cantidad de items.",
    "2) Mantener el mismo orden de entrada.",
    "3) No cambiar ids, fechas, semanas, orden_semana ni estados.",
    "4) Mantener coherencia entre canal y formato en cada item.",
    "",
    "ITEMS ACTUALES:",
    compactJson(
      params.items.map((item) => ({
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
    ),
    "",
    ...premiumCreativeRules(),
    "",
    "CRITERIOS DE CALIDAD:",
    "1) Cada item debe tener un angulo reconocible y no sentirse intercambiable.",
    "2) Debe haber variedad real entre items; evita repetir la misma idea con palabras distintas.",
    "3) titulo_base, tema y subtema deben ser utiles para produccion editorial.",
    "4) CTA y mensaje_clave deben ser accionables y especificos.",
    "5) Introduce ideas con thinking out of the box cuando sumen: contraste, POV, objeciones, micro-historias, anti-mitos, comparativas, rituales, errores, pruebas, simbolos culturales o tension de compra.",
    "6) Distribuye tipos de angulo entre piezas para que el calendario se sienta curado y no monocorde.",
    "7) Si varias piezas caen en educacion generica, reemplaza algunas por piezas con friccion, opinion, prueba, narrativa o conversion.",
    customPromptLine(params.customPrompt),
    "",
    "SALIDA OBLIGATORIA:",
    "1) Devuelve SOLO JSON valido.",
    "2) Devuelve un objeto con clave items.",
    "3) Cada item debe usar exactamente este shape.",
    compactJson({ items: fallback }),
  ].join("\n");
}

export function buildCalendarioStudioPrompt(params: {
  empresaNombre: string;
  calendarioTitulo: string;
  periodo: string;
  item: CalendarioItem;
  contentKind: CalendarioItemAssetBundle["content_kind"];
  isLongform: boolean;
  webResearchContext?: string;
  existingBundle?: CalendarioItemAssetBundle | null;
}) {
  const { item, contentKind, isLongform, existingBundle } = params;

  return [
    ...basePlannerContext(params),
    `Canal: ${item.canal}`,
    `Formato: ${item.formato}`,
    `Tema: ${item.tema || item.titulo_base || "Sin tema"}`,
    `Subtema: ${item.subtema || "Sin subtema"}`,
    `Pilar: ${item.pilar || "General"}`,
    `Buyer persona: ${item.buyer_persona || "General"}`,
    `Objetivo del contenido: ${item.objetivo_contenido || "Sin objetivo definido"}`,
    `CTA base: ${item.CTA || "Sin CTA"}`,
    `Mensaje clave: ${item.mensaje_clave || "Sin mensaje clave"}`,
    "",
    "INVESTIGACION WEB DE EMPRESA:",
    params.webResearchContext || "Sin investigacion web disponible",
    "",
    "OBJETIVO:",
    "Generar un paquete de contenido listo para produccion y publicacion.",
    "Hazlo como una agencia creativa y estrategica de alto nivel, no como generador de copy generico.",
    "",
    "PRIORIDADES:",
    "1) Mantener coherencia con canal, formato, buyer persona, CTA y mensaje clave.",
    "2) Evitar copy generico o relleno; cada salida debe sentirse util y publicable.",
    "3) Visual direction e image_prompt_base deben servir realmente para produccion visual.",
    "4) Buscar angulos que destaquen frente a lo tipico del rubro sin perder claridad comercial.",
    "5) Usar investigacion web para aterrizar lenguaje, competencia, SEO, objeciones, escenas de uso y referencias culturales; no inventar precios, promociones, fechas ni claims duros.",
    "",
    ...premiumCreativeRules(),
    "",
    "CRITERIOS DE CALIDAD:",
    "1) headline, caption y short_copy deben ser especificos para el tema y evitar lugares comunes.",
    "1.1) headline debe poder competir por atencion en el feed sin sonar clickbait vacio.",
    "2) hashtags debe ser un array de hashtags limpios y relevantes.",
    "3) Si es video o reel, video_script debe traer 3 variantes claramente distintas en hook, estructura y ritmo.",
    "3.1) Las 3 variantes no pueden ser la misma idea con palabras cambiadas.",
    "4) Si es carrusel, carousel_slides debe incluir 4 a 8 slides con progresion clara.",
    "4.1) El carrusel debe abrir fuerte, desarrollar tension o valor y cerrar con CTA natural.",
    "5) Si es email, completar subject, preheader y body con nivel publicable.",
    "6) Si es blog o articulo, completar blog_title y blog_body_markdown con suficiente profundidad.",
    "7) visual_direction e image_prompt_base deben ser concretos, cinematograficos y sin vaguedades.",
    "8) Si el resultado suena a plantilla de agencia junior, rehacerlo con mas filo, insight y personalidad.",
    "",
    "RESTRICCIONES:",
    "1) Devuelve SOLO JSON.",
    "2) caption y short_copy deben estar en espanol.",
    "3) No metas markdown fuera de los campos que lo admiten.",
    "4) Si un campo no aplica por tipo de contenido, devuelvelo vacio o array vacio.",
    "",
    "JSON EXACTO ESPERADO:",
    compactJson({
      content_kind: contentKind,
      headline: existingBundle?.headline ?? "",
      caption: existingBundle?.caption ?? "",
      short_copy: existingBundle?.short_copy ?? "",
      blog_title: existingBundle?.blog_title ?? "",
      blog_body_markdown: existingBundle?.blog_body_markdown ?? "",
      email_subject: existingBundle?.email_subject ?? "",
      email_preheader: existingBundle?.email_preheader ?? "",
      email_body_markdown: existingBundle?.email_body_markdown ?? "",
      video_hook: existingBundle?.video_hook ?? "",
      video_script: existingBundle?.video_script ?? "",
      carousel_slides: existingBundle?.carousel_slides ?? [],
      cta: existingBundle?.cta ?? item.CTA ?? "",
      hashtags: existingBundle?.hashtags ?? [],
      visual_direction: existingBundle?.visual_direction ?? "",
      image_prompt_base: existingBundle?.image_prompt_base ?? "",
    }),
    isLongform
      ? "Tipo longform: blog_title y blog_body_markdown deben venir completos."
      : "No es longform: blog_title y blog_body_markdown deben ir vacios.",
  ].join("\n");
}

export function buildCalendarioDraftPrompt(params: {
  periodo: string;
  empresa: unknown;
  empresaMetadataContext: string;
  webResearchContext?: string;
  planRoot: Record<string, unknown>;
  alcanceCalendario: Record<string, number>;
  defaultCalendario: unknown;
  customPrompt?: string;
}) {
  return [
    `Genera un calendario editorial mensual para el periodo ${params.periodo}.`,
    "",
    "OBJETIVO:",
    "Construir un calendario editorial que se sienta estrategico, creativo, diverso, culturalmente sensible y comercialmente inteligente.",
    "Debe parecer trabajo de una agencia premium de verdad: fuerte en insight, criterio creativo, lectura de negocio, performance y claridad de ejecucion.",
    "El resultado no debe verse como una lista de ideas correctas. Debe verse como una curaduria editorial con intencion, variedad y potencial real de impacto.",
    "",
    "CONTEXTO EMPRESA:",
    compactJson(params.empresa),
    "",
    "METADATA_JSON DE EMPRESA:",
    params.empresaMetadataContext || "{}",
    "",
    "INVESTIGACION WEB DE EMPRESA:",
    params.webResearchContext || "Sin investigacion web disponible",
    "",
    "PLAN DE TRABAJO BASE:",
    compactJson(params.planRoot),
    "",
    `ALCANCE OPERATIVO POR CANAL: ${compactJson(params.alcanceCalendario)}`,
    "",
    ...premiumCreativeRules(),
    "",
    "REGLAS ESTRATEGICAS:",
    "1) Devuelve SOLO JSON con la estructura exacta indicada.",
    "2) Usa fechas reales YYYY-MM-DD dentro del mes del periodo.",
    "3) NUNCA programes piezas en domingo. Todas las fechas deben caer entre lunes y sabado.",
    "4) Mantén coherencia con plan_trabajo, especialmente pilares, ideas sugeridas, mensajes destacados y productos/servicios.",
    "5) metadata_json es la fuente operativa de verdad. Si hay conflicto con el plan, manda metadata_json.",
    "6) calendario.items debe contener todos los eventos editables.",
    "7) No agregues claves fuera de la estructura.",
    "8) No propongas canales fuera del alcance_calendario.",
    "9) Cada item debe sentirse como una pieza distinta, no como una plantilla reciclada.",
    "10) Si hay multiples piezas del mismo canal o formato, diversifica angulo, CTA, pilar, buyer persona, tono, tension y etapa del funnel.",
    "11) No llenes el calendario con ideas reformuladas. Cambia mecanismo narrativo, promesa, friccion y forma de capturar atencion.",
    "12) titulo_base, tema y subtema deben ser especificos y producir una pieza que un equipo creativo pueda entender de inmediato.",
    "13) Cada pieza debe responder a una funcion estrategica clara: captar atencion, instalar deseo, educar con filo, vencer objeciones, mostrar prueba, activar accion o sostener recordacion.",
    "14) Si una idea podria servir igual para tres marcas distintas, no sirve. Rehazla con mas criterio de marca, mercado y momento.",
    "15) Evita por defecto calendarios llenos de educacion basica, efemerides vacias o frases inspiracionales sin utilidad.",
    "16) Usa investigacion web para aterrizar lenguaje, competencia, SEO, cultura, objeciones y escenarios reales de compra; no uses datos no verificados como fechas, precios, promociones o claims duros.",
    "",
    "REGLAS CREATIVAS POR TIPO DE PIEZA:",
    "1) Si hay formatos de video, reparte entre tutorial, demo, POV, objecion-respuesta, caso breve, comparativa, mito vs realidad, storytelling, checklist, entrevista corta, behind the scenes, FAQ, error comun, prueba o testimonio.",
    "2) Los videos deben variar tambien en energia: algunos educan, otros confrontan, otros muestran prueba, otros convierten.",
    "3) Si hay carruseles, algunos pueden ordenar ideas, otros desmontar mitos, otros mostrar framework, otros comparar opciones o errores.",
    "4) Si hay posts estaticos, no los uses solo para frases bonitas: pueden funcionar como prueba, contraste, opinion, data point, insight o propuesta.",
    "5) Reparte el calendario entre awareness, consideracion, conversion, prueba social y retencion cuando aplique.",
    "5.1) Alterna tipos de gancho: sorpresa, precision, contraste, problema mal entendido, costo oculto, deseo aspiracional, prueba concreta, anti-mito o insight de comportamiento.",
    "5.2) No conviertas cada pieza en un mini anuncio. Algunas deben construir autoridad, otras deseo, otras confianza y otras accion directa.",
    "5.3) Cuando el contexto lo permita, usa ideas con punto de vista: comparativas, errores comunes, elecciones inteligentes, trampas del mercado, signos de buen criterio o escenas de decision.",
    "6) Introduce thinking out of the box cuando sume: simbolos culturales, tensiones de compra, objeciones ocultas, microrrelatos, decisiones de status, rituales, hábitos, escenas reales de uso o contradicciones del mercado.",
    "",
    "CRITERIOS DE CALIDAD:",
    "1) Cada item debe tener una hipotesis editorial concreta.",
    "2) Cada semana debe sentirse curada, no rellenada.",
    "3) El conjunto debe verse como una mezcla balanceada de valor, diferenciacion, persuasion, prueba y conversion.",
    "4) Si una idea suena correcta pero olvidable, sustituyela por una mejor.",
    "5) Buyer persona, objetivo_contenido, CTA y mensaje_clave deben empujar en la misma direccion y no contradecirse.",
    "6) El calendario debe dar ganas de producirse. Debe sentirse vivo, no burocratico.",
    customPromptLine(params.customPrompt),
    "",
    "ESTRUCTURA EXACTA REQUERIDA:",
    compactJson(params.defaultCalendario),
  ].join("\n");
}

export { itemShapeFromAI };
