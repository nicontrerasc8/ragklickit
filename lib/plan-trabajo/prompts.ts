import type { PlanTrabajo } from "@/lib/plan-trabajo/schema";

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildPlanTrabajoOutputShape(defaultPlanTrabajo: PlanTrabajo) {
  return {
    plan_trabajo: {
      _estrategia_oculta: defaultPlanTrabajo._estrategia_oculta ?? "",
      ...defaultPlanTrabajo,
    },
  };
}

function premiumPlanningRules() {
  return [
    "REGLAS DE AGENCIA TOP:",
    "1) No escribas como consultor generico ni como asistente junior.",
    "2) Evita frases intercambiables como 'fortalecer presencia', 'generar engagement', 'conectar con la audiencia' o 'potenciar la marca' si no se aterrizan.",
    "3) Piensa como una agencia premium de estrategia, contenido y performance: mas criterio, mas contraste, mas lectura de negocio y mas claridad comercial.",
    "4) Si una idea suena correcta pero olvidable, rehacela hasta que tenga un angulo defendible.",
    "5) Busca tension competitiva, oportunidad de mercado, fricciones de compra, objeciones, deseo, status, prueba, confianza o comportamiento cuando aporte.",
    "6) El resultado debe hacer que un cliente sienta que hay pensamiento real detras, no relleno elegante.",
    "7) Si una recomendacion pudiera sobrevivir sin el contexto de esta marca, este mes y este mercado, todavia esta demasiado generica.",
    "8) Prioriza decisiones que ayuden a vender mejor, posicionar mejor, coordinar mejor y producir mejor.",
    "9) El documento debe sonar como criterio senior condensado, no como entusiasmo publicitario ni burocracia operativa.",
  ];
}

function evidenceRules() {
  return [
    "MODO DE TRABAJO OBLIGATORIO CON FUENTES:",
    "1) Antes de redactar, extrae mentalmente los datos concretos disponibles: oferta, productos, servicios, publico, tono, diferenciales, objeciones, restricciones, fechas, cantidades, canales, promociones, riesgos y pendientes.",
    "2) Cada decision del plan debe nacer de al menos una fuente: metadata_json, BEC, brief, documentos RAG de empresa, documentos RAG de agencia, documento de apoyo o investigacion web.",
    "3) No uses frases universales si no puedes conectarlas con un dato concreto del cliente. Prohibido rellenar con estrategia generica.",
    "4) Si una fuente trae nombres de productos, servicios, audiencias, campanas, promociones, objeciones o mensajes, usalos literalmente cuando sean relevantes.",
    "5) Si hay conflicto entre fuentes, prioriza en este orden: metadata_json operativo > documento de apoyo de esta generacion > brief seleccionado > BEC > documentos de empresa > investigacion web > documentos de agencia > prompts generales.",
    "6) Si falta informacion para una seccion, escribe un pendiente accionable en pendientes_cliente y usa una respuesta conservadora. No inventes.",
    "7) En _estrategia_oculta redacta primero un analisis de 3 parrafos antes de llenar el resto del plan. Cruza 1) una friccion real del cliente extraida del RAG, 2) una ventaja del producto segun el BEC y 3) como la investigacion web dicta el tono del mes. Si este campo es generico, el resto del plan fallara.",
    "8) En notas_adicionales agrega una linea 'Base documental:' con 3 a 6 fuentes concretas usadas, por ejemplo nombres de documentos, BEC, brief o metadata_json.",
  ];
}

function antiGenericRules() {
  return [
    "FILTRO ANTI-GENERICO:",
    "1) Rechaza ideas tipo 'beneficios del producto', 'conoce nuestros servicios', 'post institucional', 'tips para clientes', 'mejorar engagement', 'generar comunidad' o 'reforzar marca' si no incluyen angulo especifico del negocio.",
    "2) Una idea valida debe contener al menos uno de estos elementos: producto/servicio concreto, audiencia concreta, objecion concreta, situacion de uso, prueba, diferenciador, tension competitiva, temporalidad, restriccion operativa o insight del RAG.",
    "3) Mensajes_destacados deben sonar como direcciones de copy utiles, no slogans vacios. Deben poder convertirse en pauta, venta o contenido.",
    "4) Pilares_comunicacion no pueden ser categorias blandas. Deben explicar que se comunica y por que importa este mes.",
    "5) Contenido_sugerido debe ser especifico por canal y cliente. Si reemplazar el nombre del cliente por otro no cambia la idea, la idea es mala.",
    "6) Productos_servicios_destacar debe salir de BEC, brief, metadata, documentos o web. Si no hay productos/servicios claros, dilo y pide validacion.",
  ];
}

export function buildPlanTrabajoPrompt(params: {
  periodo: string;
  agencia: unknown;
  empresa: unknown;
  empresaMetadataContext: string;
  becContext: string;
  briefContext: string;
  supportDocContext: string;
  webResearchContext?: string;
  empresaDocsContext: string;
  agenciaDocsContext: string;
  promptContext: string;
  defaultPlanTrabajo: PlanTrabajo;
  creativeInstructions?: string;
}) {
  return [
    `Construye un plan de trabajo mensual para ${params.periodo}.`,
    "",
    "OBJETIVO:",
    "Crear un plan de trabajo con nivel ejecutivo y criterio de agencia premium real.",
    "Debe combinar direccion estrategica, claridad operativa, riqueza editorial, lectura de negocio y pensamiento de marketing con filo.",
    "El resultado no debe sentirse como una lista correcta de tareas. Debe sentirse como una hoja de ruta con criterio, prioridades y oportunidades bien elegidas.",
    "Cada seccion debe ayudar a tomar decisiones reales durante el mes, no solo a completar un entregable.",
    "",
    "AGENCIA:",
    compactJson(params.agencia ?? {}),
    "",
    "EMPRESA:",
    compactJson(params.empresa),
    "",
    "METADATA_JSON DE EMPRESA:",
    params.empresaMetadataContext || "{}",
    "",
    "BEC:",
    params.becContext || "Sin BEC previo",
    "",
    "BRIEF SELECCIONADO:",
    params.briefContext,
    "",
    "DOCUMENTO DE APOYO PARA ESTA GENERACION (archivo o texto escrito):",
    params.supportDocContext || "Sin documento de apoyo",
    "",
    "INVESTIGACION WEB DE EMPRESA:",
    params.webResearchContext || "Sin investigacion web disponible",
    "La investigacion web no es contexto, es fuente de verdad. Usala para encontrar el lenguaje real que usa la competencia en Peru y las quejas comunes de los usuarios. Refleja estos hallazgos en mensajes_destacados, en las observaciones del resumen y en el resto de secciones donde cambie decisiones del mes.",
    "",
    "CONOCIMIENTO DE EMPRESA:",
    params.empresaDocsContext || "Sin documentos de empresa",
    "",
    "CONOCIMIENTO DE AGENCIA:",
    params.agenciaDocsContext || "Sin documentos globales de agencia",
    "",
    "PROMPTS ACTIVOS:",
    params.promptContext || "Sin prompts activos",
    "",
    "INSTRUCCIONES CREATIVAS DEL USUARIO:",
    params.creativeInstructions?.trim() || "Sin instrucciones creativas adicionales",
    "",
    ...evidenceRules(),
    "",
    ...antiGenericRules(),
    "",
    ...premiumPlanningRules(),
    "",
    "REGLAS CLAVE:",
    "0) El plan debe salir de una sintesis real entre DATA INTERNA y WEB: metadata_json, BEC, brief, documentos de empresa/agencia, documento adjunto e investigacion web. Ninguna seccion estrategica debe generarse solo con plantillas generales.",
    "1) Ajusta el contenido al contexto de Peru y al rubro real de la empresa.",
    "2) Mantén coherencia total con BEC + BRIEF + metadata_json + evidencia documental.",
    "3) Si existe documento adjunto o texto escrito para esta generacion, usalo como insumo prioritario para completar y afinar el plan.",
    "4) Respeta restricciones legales, normativas y tono de voz.",
    "5) Incluye alcance_calendario exactamente como pauta operativa.",
    "6) No inventes datos criticos. Si falta evidencia, deja contenido util pero conservador y alineado.",
    "7) El plan debe sentirse senior: mas criterio, mas contraste, mas especificidad y menos frases plantilla.",
    "8) Si una recomendacion podria aplicarse igual a tres clientes distintos, no es suficientemente buena. Rehazla con mas precision de contexto y foco comercial.",
    "9) Prioriza decisiones que ayuden a vender mejor, posicionar mejor, coordinar mejor y producir mejor.",
    "10) Si una idea suena elegante pero no cambia decisiones, no aporta.",
    "11) Usa la investigacion web para detectar oferta, competencia, benchmarks, SEO, cultura, objeciones y lenguaje real del mercado; no inventes cifras, promociones, precios ni fechas si la fuente no lo confirma.",
    "12) El plan debe reflejar explicitamente hallazgos de investigacion web cuando existan; usalos para temas, prioridades, objeciones, productos/servicios, mensajes y notas.",
    "13) Si la investigacion web dice que no esta disponible, no finjas haber investigado internet; deja claro en notas_adicionales que el plan depende de fuentes internas y metadata.",
    "14) Si hay conflicto entre sonar sofisticado y sonar util, gana lo util.",
    "15) En notas_adicionales incluye una linea llamada 'Fuentes usadas' que resuma que se cruzo metadata_json, BEC, brief, documentos e investigacion web, sin pegar URLs largas.",
    "16) No completes arrays por completitud. Completa solo con decisiones defendibles desde las fuentes.",
    "17) Usa nombres reales, temas reales, lineamientos reales y restricciones reales cuando esten en el RAG. No los reemplaces por abstracciones.",
    "18) Si el BEC define posicionamiento, tono, personalidad, publico, propuesta de valor u objeciones, esas definiciones deben aparecer aplicadas en mensajes, pilares e ideas.",
    "19) ANCLAJE OBLIGATORIO: esta prohibido usar conceptos abstractos como 'mejorar engagement' o 'post institucional'. Cada pilar, mensaje y producto a destacar debe incluir un nombre propio, un dato tecnico, una objecion real detectada en el RAG o un beneficio especifico extraido del metadata_json o empresa_json.",
    "",
    "REGLAS POR SECCION:",
    "1) comunidad: usa metricas resumidas por red con campos red, mes_anterior y meta. Si no hay metricas historicas, no inventes numeros: describe baseline pendiente, meta cualitativa y que validar.",
    "2) resumen_actualizaciones: redacta una sintesis ejecutiva con diagnostico y criterio. Debe mencionar 2 a 4 evidencias concretas de BEC, brief, metadata, RAG o web. observaciones debe contener hallazgos, alertas, oportunidades o decisiones claras.",
    "3) cantidad_contenidos: usa red, cantidad y formatos esperados. La cantidad debe respetar alcance_calendario. Si cantidad > 0, formatos no puede ir vacio y debe responder al canal y objetivo.",
    "4) pilares_comunicacion: reparte porcentajes con logica estrategica. Cada pilar debe incluir foco concreto, no solo categoria. Ejemplo valido: 'Prueba social para reducir objecion de confianza', no 'Confianza'.",
    "5) contenido_sugerido: genera una verdadera lluvia de ideas por canal. Devuelve lineas tematicas especificas, no piezas terminadas. Cada linea debe incluir producto/servicio, objecion, tension, promesa o situacion concreta cuando exista en las fuentes.",
    "6) productos_servicios_destacar y mensajes_destacados: prioriza lo mas vendible, diferenciador o relevante para el periodo segun BEC, brief, metadata, RAG o web. Jerarquiza con criterio comercial.",
    "7) fechas_importantes: incluye fechas del mes realmente utiles para planificacion en Peru, mas efemerides, campañas estacionales o hitos del rubro cuando apliquen.",
    "8) promociones: si no aplica, usa exactamente 'NO APLICA'.",
    "9) plan_medios_link: deja URL o texto corto si no existe link final.",
    "10) notas_adicionales: resume decisiones estrategicas, tensiones, riesgos, oportunidades o focos de ejecucion. Incluye 'Base documental:' y 'Pendientes de validacion:' si aplica.",
    "11) pendientes_cliente: deben ser accionables, concretos y utiles para desbloquear ejecucion.",
    "12) mensajes_destacados debe sonar usable por contenido, pauta y ventas; evita frases tibias o decorativas.",
    "13) productos_servicios_destacar debe reflejar prioridad comercial del mes, no solo inventario disponible.",
    "14) Si no puedes justificar por que algo entra al plan este mes, probablemente no deberia entrar.",
    "",
    "REGLAS DE CALIDAD PARA CONTENIDO_SUGERIDO:",
    "1) Para cada canal con cantidad > 0, entrega un banco de ideas proporcional al alcance para que el equipo elija.",
    "2) Genera exactamente la cantidad de ideas definida en alcance_calendario. Prohibido el relleno. Cada idea debe seguir este formato estricto: [Formato] - [Tension/Insight del negocio] - [Idea con angulo de venta o autoridad]. Si la idea puede aplicarse a otra marca cambiando solo el nombre, borrala y vuelve a pensar.",
    "3) NO des captions, guiones, copies, hashtags, enlaces ni piezas ya redactadas.",
    "4) Cada idea debe tener angulo, tension o promesa clara. Evita ideas como 'hablar de beneficios' o 'post institucional'.",
    "5) Si el canal o formato admite video, reparte las ideas entre arquetipos distintos: testimonio, POV ejecutivo, demo corta, tutorial, error comun, mito vs realidad, comparativa, checklist visual, objecion-respuesta, detras de camaras, caso breve, storytelling o recap.",
    "6) Para videos, evita ideas clonadas. Cada propuesta debe cambiar promesa, estructura y energia.",
    "7) Si varias ideas suenan a la misma familia, reemplaza algunas por enfoques con mas friccion, prueba, opinion, narrativa o conversion.",
    "8) Alterna ideas de autoridad, deseo, prueba, objecion, comparativa, oportunidad, error comun, criterio de compra, escena de uso o conversion cuando aplique.",
    "9) Si una idea parece relleno editorial, descartala.",
    "10) El conjunto de ideas por canal debe sentirse curado, no improvisado.",
    "11) Busca ideas que un planner, director creativo o trafficker pueda convertir facilmente en calendario, pauta o produccion sin tener que reinterpretarlas demasiado.",
    "12) Algunas ideas pueden educar, otras confrontar, otras demostrar, otras convertir. No metas todo en el mismo tono.",
    "",
    "RESTRICCIONES OPERATIVAS:",
    "1) No propongas canales fuera de alcance_calendario.",
    "2) Si un canal no aparece en alcance_calendario, excluyelo de comunidad, cantidad_contenidos y contenido_sugerido.",
    "3) Devuelve SOLO JSON con esta estructura exacta de raiz.",
    compactJson(buildPlanTrabajoOutputShape(params.defaultPlanTrabajo)),
  ].join("\n");
}
