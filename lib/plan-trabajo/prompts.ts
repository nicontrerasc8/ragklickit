import type { PlanTrabajo } from "@/lib/plan-trabajo/schema";

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
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
  empresaDocsContext: string;
  agenciaDocsContext: string;
  promptContext: string;
  defaultPlanTrabajo: PlanTrabajo;
}) {
  return [
    `Construye un plan de trabajo mensual para ${params.periodo}.`,
    "",
    "OBJETIVO:",
    "Crear un plan de trabajo con nivel ejecutivo y criterio de agencia premium.",
    "Debe combinar direccion estrategica, claridad operativa, riqueza editorial y thinking de marketing real.",
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
    "DOCUMENTO ADJUNTO PARA ESTA GENERACION:",
    params.supportDocContext || "Sin documento adjunto",
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
    ...premiumPlanningRules(),
    "",
    "REGLAS CLAVE:",
    "1) Ajusta el contenido al contexto de Peru.",
    "2) Mantén coherencia total con BEC + BRIEF + metadata_json + evidencia documental.",
    "3) Si existe documento adjunto, usalo como insumo prioritario para completar y afinar el plan.",
    "4) Respeta restricciones legales, normativas y tono de voz.",
    "5) Incluye alcance_calendario exactamente como pauta operativa.",
    "6) No inventes datos criticos. Si falta evidencia, deja contenido util pero conservador y alineado.",
    "7) El plan debe sentirse senior: mas criterio, mas contraste, mas especificidad y menos frases plantilla.",
    "",
    "REGLAS POR SECCION:",
    "1) comunidad: usa metricas resumidas por red con campos red, mes_anterior y meta. Las metas deben sonar utiles para gestion, no solo bonitas.",
    "2) resumen_actualizaciones: redacta una sintesis ejecutiva con diagnostico y criterio. observaciones debe contener hallazgos, alertas, oportunidades o decisiones claras.",
    "3) cantidad_contenidos: usa red, cantidad y formatos esperados. Si cantidad > 0, formatos no puede ir vacio.",
    "4) pilares_comunicacion: reparte porcentajes con logica estrategica. Los pilares deben ser defendibles, distintos y no copies disfrazados de estrategia.",
    "5) contenido_sugerido: genera una verdadera lluvia de ideas por canal. Devuelve lineas tematicas, no piezas terminadas.",
    "6) productos_servicios_destacar y mensajes_destacados: prioriza lo mas vendible, diferenciador o relevante para el periodo.",
    "7) fechas_importantes: incluye fechas del mes realmente utiles para planificacion en Peru, mas efemerides, campañas estacionales o hitos del rubro cuando apliquen.",
    "8) promociones: si no aplica, usa exactamente 'NO APLICA'.",
    "9) plan_medios_link: deja URL o texto corto si no existe link final.",
    "10) notas_adicionales: resume decisiones estrategicas, tensiones, riesgos, oportunidades o focos de ejecucion. No la uses como cajon de sastre vacio.",
    "11) pendientes_cliente: deben ser accionables, concretos y utiles para desbloquear ejecucion.",
    "",
    "REGLAS DE CALIDAD PARA CONTENIDO_SUGERIDO:",
    "1) Para cada canal con cantidad > 0, entrega varias ideas generales, no una sola si el canal admite mas volumen.",
    "2) Como referencia, genera entre 3 y 8 ideas por canal segun el peso del canal, sin repetir enfoques.",
    "3) NO des captions, guiones, copies, hashtags, enlaces ni piezas ya redactadas.",
    "4) Cada idea debe tener angulo, tension o promesa clara. Evita ideas como 'hablar de beneficios' o 'post institucional'.",
    "5) Si el canal o formato admite video, reparte las ideas entre arquetipos distintos: testimonio, POV ejecutivo, demo corta, tutorial, error comun, mito vs realidad, comparativa, checklist visual, objecion-respuesta, detras de camaras, caso breve, storytelling o recap.",
    "6) Para videos, evita ideas clonadas. Cada propuesta debe cambiar promesa, estructura y energia.",
    "7) Si varias ideas suenan a la misma familia, reemplaza algunas por enfoques con mas friccion, prueba, opinion, narrativa o conversion.",
    "",
    "RESTRICCIONES OPERATIVAS:",
    "1) No propongas canales fuera de alcance_calendario.",
    "2) Si un canal no aparece en alcance_calendario, excluyelo de comunidad, cantidad_contenidos y contenido_sugerido.",
    "3) Devuelve SOLO JSON con esta estructura exacta de raiz.",
    compactJson({ plan_trabajo: params.defaultPlanTrabajo }),
  ].join("\n");
}
