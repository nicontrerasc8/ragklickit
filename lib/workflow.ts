type WorkflowSeverity = "low" | "medium" | "high" | "critical";
type WorkflowDecision =
  | "approved"
  | "approved_with_warnings"
  | "needs_human_review"
  | "blocked"
  | "alternative_proposed";
type WorkflowStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "blocked"
  | "exception";
type ApprovalState = "pending" | "approved" | "changes_requested" | "blocked";

export type WorkflowAlert = {
  id: string;
  type: string;
  severity: WorkflowSeverity;
  title: string;
  detail: string;
  action_required: string;
  blocking: boolean;
  due_at: string | null;
  status: "open" | "resolved";
};

export type WorkflowApproval = {
  required: boolean;
  state: ApprovalState;
  approved_by: string | null;
  approved_at: string | null;
  note: string | null;
};

export type WorkflowMeta = {
  object_type: "bec" | "brief_evaluation" | "plan_trabajo" | "calendario";
  status: WorkflowStatus;
  decision: WorkflowDecision;
  degradation_level: 0 | 1 | 2 | 3;
  degradation_label: "normal" | "light" | "medium" | "severe";
  requires_human_review: boolean;
  approval: WorkflowApproval;
  alerts: WorkflowAlert[];
  blockers: string[];
  assumptions: string[];
  summary: string;
  score_snapshot: Partial<Record<string, number>>;
  generated_at: string;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

function addHours(dateIso: string, hours: number) {
  const date = new Date(dateIso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function asObj(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeCountMap(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, number>;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const name = String(key ?? "").trim();
    const count =
      typeof raw === "number"
        ? raw
        : Number.parseInt(String(raw ?? "").trim(), 10);
    if (!name || !Number.isFinite(count) || count <= 0) continue;
    out[name] = Math.trunc(count);
  }
  return out;
}

function normalizeComparableText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildAlert(input: {
  type: string;
  severity: WorkflowSeverity;
  title: string;
  detail: string;
  actionRequired: string;
  blocking?: boolean;
  dueAt?: string | null;
}) {
  return {
    id: slugify(`${input.type}-${input.title}`),
    type: input.type,
    severity: input.severity,
    title: input.title,
    detail: input.detail,
    action_required: input.actionRequired,
    blocking: Boolean(input.blocking),
    due_at: input.dueAt ?? null,
    status: "open",
  } satisfies WorkflowAlert;
}

function inferDegradation(params: {
  confidence?: number;
  dataQuality?: number;
  risk?: number;
  criticalMissingCount?: number;
  warningCount?: number;
}) {
  const confidence = clamp(params.confidence ?? 0.5);
  const dataQuality = clamp(params.dataQuality ?? 0.5);
  const risk = clamp(params.risk ?? 0.5);
  const criticalMissingCount = Math.max(0, params.criticalMissingCount ?? 0);
  const warningCount = Math.max(0, params.warningCount ?? 0);

  if (criticalMissingCount >= 2 || confidence < 0.45 || dataQuality < 0.45 || risk >= 0.8) {
    return { level: 3, label: "severe" } as const;
  }
  if (criticalMissingCount >= 1 || confidence < 0.6 || dataQuality < 0.6 || risk >= 0.65) {
    return { level: 2, label: "medium" } as const;
  }
  if (warningCount > 0 || confidence < 0.75 || dataQuality < 0.75 || risk >= 0.4) {
    return { level: 1, label: "light" } as const;
  }
  return { level: 0, label: "normal" } as const;
}

function deriveDecision(params: {
  blocked: boolean;
  warnings: number;
  requiresReview: boolean;
}) {
  if (params.blocked) return "blocked" as const;
  if (params.requiresReview) return "needs_human_review" as const;
  if (params.warnings > 0) return "approved_with_warnings" as const;
  return "approved" as const;
}

function deriveStatus(params: {
  blocked: boolean;
  approved: boolean;
  exception?: boolean;
  requiresReview: boolean;
}) {
  if (params.exception) return "exception" as const;
  if (params.blocked) return "blocked" as const;
  if (params.approved) return "approved" as const;
  if (params.requiresReview) return "needs_review" as const;
  return "draft" as const;
}

function parseWorkflowMeta(value: unknown): Partial<WorkflowMeta> {
  return value && typeof value === "object" ? (value as Partial<WorkflowMeta>) : {};
}

export function attachWorkflow<T extends Record<string, unknown>>(content: T, workflow: WorkflowMeta) {
  return {
    ...content,
    workflow,
  };
}

export function readWorkflow(content: unknown): WorkflowMeta | null {
  if (!content || typeof content !== "object") return null;
  const workflow = parseWorkflowMeta((content as Record<string, unknown>).workflow);
  if (!workflow.object_type || !workflow.status) {
    return null;
  }
  return workflow as WorkflowMeta;
}

export function buildBecWorkflow(params: {
  content: unknown;
  scores: Partial<Record<"confidence" | "data_quality" | "risk", number>>;
  isLocked: boolean;
  previousWorkflow?: unknown;
}) {
  const raw = params.content && typeof params.content === "object" ? (params.content as Record<string, unknown>) : {};
  const fields =
    raw.fields && typeof raw.fields === "object" ? (raw.fields as Record<string, string>) : {};
  const confidence = clamp(params.scores.confidence ?? 0.5);
  const dataQuality = clamp(params.scores.data_quality ?? 0.5);
  const risk = clamp(params.scores.risk ?? 0.5);
  const alerts: WorkflowAlert[] = [];
  const blockers: string[] = [];
  const assumptions: string[] = [];

  const missingCritical = [
    !String(fields["Propuesta de Valor"] ?? "").trim(),
    !String(fields["ICP Principal (Ideal Customer Profile)"] ?? "").trim(),
    !String(fields["KPI Primario"] ?? "").trim() &&
      !String(fields["KPI Secundario"] ?? "").trim() &&
      !String(fields["Métrica de Éxito / ROI Esperado"] ?? fields["MÃ©trica de Ã‰xito / ROI Esperado"] ?? "").trim(),
    !String(fields["Alcance General"] ?? "").trim(),
    !String(fields["Entregables Mensuales"] ?? "").trim(),
  ].filter(Boolean).length;

  if (missingCritical > 0) {
    alerts.push(
      buildAlert({
        type: "missing_data",
        severity: missingCritical >= 2 ? "high" : "medium",
        title: "BEC incompleto para operar",
        detail: "Faltan campos estructurales para usar el BEC como fuente de verdad.",
        actionRequired: "Completar propuesta de valor, ICP, KPIs y alcance antes de planificar.",
        blocking: missingCritical >= 2,
      }),
    );
  }

  if (confidence < 0.75) {
    alerts.push(
      buildAlert({
        type: "low_confidence",
        severity: confidence < 0.6 ? "high" : "medium",
        title: "Confianza baja del BEC",
        detail: "La señal del BEC no es lo bastante robusta para automatizar decisiones.",
        actionRequired: "Revisar manualmente el BEC y completar contexto faltante.",
      }),
    );
  }

  if (risk >= 0.7) {
    blockers.push("El riesgo operativo del BEC supera el umbral seguro.");
    alerts.push(
      buildAlert({
        type: "high_risk",
        severity: "high",
        title: "Riesgo alto en el BEC",
        detail: "Faltan restricciones o lineamientos que protejan marca, alcance o compliance.",
        actionRequired: "Resolver restricciones y dependencias antes de usar este BEC.",
        blocking: true,
      }),
    );
  }

  if (!String(fields["Restricciones Legales"] ?? "").trim()) {
    assumptions.push("Se asume ausencia de restricciones legales adicionales no documentadas.");
  }

  const degradation = inferDegradation({
    confidence,
    dataQuality,
    risk,
    criticalMissingCount: missingCritical,
    warningCount: alerts.length,
  });
  const previous = parseWorkflowMeta(params.previousWorkflow);
  const approvedBy = params.isLocked ? previous.approval?.approved_by ?? null : null;
  const approvedAt = params.isLocked ? previous.approval?.approved_at ?? null : null;
  const note = params.isLocked ? previous.approval?.note ?? null : null;
  const blocked = blockers.length > 0;
  const requiresReview = blocked || confidence < 0.75 || dataQuality < 0.75 || risk >= 0.4;

  return {
    object_type: "bec",
    status: deriveStatus({
      blocked,
      approved: params.isLocked,
      requiresReview,
    }),
    decision: deriveDecision({
      blocked,
      warnings: alerts.length,
      requiresReview,
    }),
    degradation_level: degradation.level,
    degradation_label: degradation.label,
    requires_human_review: !params.isLocked || requiresReview,
    approval: {
      required: true,
      state: params.isLocked ? "approved" : blocked ? "blocked" : "pending",
      approved_by: approvedBy,
      approved_at: approvedAt,
      note,
    },
    alerts,
    blockers,
    assumptions,
    summary:
      params.isLocked && !requiresReview
        ? "BEC validado y utilizable como fuente de verdad."
        : blocked
          ? "El BEC requiere correcciones antes de operar."
          : "El BEC necesita revision humana antes de usarse para planificacion.",
    score_snapshot: {
      confidence,
      data_quality: dataQuality,
      risk,
    },
    generated_at: nowIso(),
  } satisfies WorkflowMeta;
}

export function buildBriefEvaluationWorkflow(params: {
  evaluationContent: {
    brief_evaluation: {
      status: string;
      conflicts: Array<{ severity: string }>;
      data_gaps: Array<{ impact: string }>;
      assumptions: string[];
      global_confidence_score: number;
      global_risk_score: number;
      requires_human_review: boolean;
    };
  };
  briefStatus?: string;
  updatedAt?: string | null;
}) {
  const evaluation = params.evaluationContent.brief_evaluation;
  const confidence = clamp(evaluation.global_confidence_score);
  const risk = clamp(evaluation.global_risk_score);
  const highConflicts = evaluation.conflicts.filter((item) => item.severity === "high").length;
  const highGaps = evaluation.data_gaps.filter((item) => item.impact === "high").length;
  const alerts: WorkflowAlert[] = [];
  const blockers: string[] = [];

  if (highConflicts > 0) {
    blockers.push("El brief tiene conflictos de alcance, riesgo o capacidad.");
    alerts.push(
      buildAlert({
        type: "conflict",
        severity: "high",
        title: "Conflictos criticos en el brief",
        detail: "La evaluacion detecto conflictos que deben resolverse antes de pasar a plan.",
        actionRequired: "Corregir el brief o escalar una excepcion comercial.",
        blocking: true,
      }),
    );
  }

  if (highGaps > 0) {
    alerts.push(
      buildAlert({
        type: "data_gap",
        severity: "high",
        title: "Faltan datos criticos en el brief",
        detail: "El brief no tiene toda la informacion necesaria para una planificacion confiable.",
        actionRequired: "Completar presupuesto, prioridades o dependencias antes de generar plan.",
        blocking: true,
      }),
    );
  }

  if (params.briefStatus === "exception") {
    alerts.push(
      buildAlert({
        type: "exception",
        severity: "critical",
        title: "Brief de excepcion",
        detail: "Este brief se marco fuera del ciclo mensual normal.",
        actionRequired: "Validar explicitamente por KAM antes de operarlo.",
        blocking: false,
      }),
    );
  }

  if (params.updatedAt) {
    const stale = Date.now() - new Date(params.updatedAt).getTime() > 72 * 60 * 60 * 1000;
    if (stale && params.briefStatus !== "aprobado") {
      alerts.push(
        buildAlert({
          type: "sla",
          severity: "medium",
          title: "Brief sin cierre operativo",
          detail: "El brief lleva mas de 72h sin resolverse o aprobarse.",
          actionRequired: "Revisar, aprobar o corregir para no bloquear el plan mensual.",
          dueAt: addHours(params.updatedAt, 72),
        }),
      );
    }
  }

  const blocked = highConflicts > 0 || highGaps > 0 || params.briefStatus === "exception";
  const degradation = inferDegradation({
    confidence,
    risk,
    criticalMissingCount: highGaps,
    warningCount: alerts.length,
  });

  return {
    object_type: "brief_evaluation",
    status: deriveStatus({
      blocked,
      approved: params.briefStatus === "aprobado",
      exception: params.briefStatus === "exception",
      requiresReview: evaluation.requires_human_review,
    }),
    decision: deriveDecision({
      blocked,
      warnings: alerts.length,
      requiresReview: evaluation.requires_human_review,
    }),
    degradation_level: degradation.level,
    degradation_label: degradation.label,
    requires_human_review: true,
    approval: {
      required: true,
      state:
        params.briefStatus === "aprobado"
          ? "approved"
          : "pending",
      approved_by: null,
      approved_at: null,
      note: null,
    },
    alerts,
    blockers,
    assumptions: evaluation.assumptions,
    summary:
      blocked
        ? "El brief no deberia pasar a plan hasta resolver conflictos o vacios criticos."
        : evaluation.requires_human_review
          ? "El brief es utilizable, pero necesita validacion humana explicita."
          : "El brief puede pasar a plan con supervision normal.",
    score_snapshot: {
      confidence,
      risk,
    },
    generated_at: nowIso(),
  } satisfies WorkflowMeta;
}

export function buildPlanWorkflow(params: {
  content: unknown;
  status: string;
  scores: Partial<Record<"confidence" | "data_quality" | "risk" | "priority", number>>;
  previousWorkflow?: unknown;
  updatedAt?: string | null;
}) {
  const root = params.content && typeof params.content === "object" ? (params.content as Record<string, unknown>) : {};
  const plan =
    root.plan_trabajo && typeof root.plan_trabajo === "object"
      ? (root.plan_trabajo as Record<string, unknown>)
      : root;
  const quantityRows = Array.isArray(plan.cantidad_contenidos)
    ? (plan.cantidad_contenidos as Array<Record<string, unknown>>)
    : [];
  const alcance =
    plan.alcance_calendario && typeof plan.alcance_calendario === "object"
      ? (plan.alcance_calendario as Record<string, number>)
      : {};

  const confidence = clamp(params.scores.confidence ?? 0.5);
  const dataQuality = clamp(params.scores.data_quality ?? 0.5);
  const risk = clamp(params.scores.risk ?? 0.5);
  const priority = clamp(params.scores.priority ?? 0.5);
  const alerts: WorkflowAlert[] = [];
  const blockers: string[] = [];
  const assumptions: string[] = [];

  if (quantityRows.length === 0) {
    blockers.push("El plan no tiene iniciativas ni cantidades de contenido definidas.");
  }

  if (Object.keys(alcance).length === 0) {
    blockers.push("No hay alcance operativo para traducir el plan a calendario.");
  }

  const channelsOutsideScope = [...new Set(
    quantityRows
      .map((item) => String(item.red ?? "").trim())
      .filter((channel) => channel && !(channel in alcance)),
  )];

  if (channelsOutsideScope.length > 0) {
    alerts.push(
      buildAlert({
        type: "scope_conflict",
        severity: "high",
        title: "Canales fuera de alcance",
        detail: `El plan propone canales sin cupo declarado: ${channelsOutsideScope.join(", ")}.`,
        actionRequired: "Reducir el plan a canales en alcance o ajustar el alcance comercial.",
        blocking: true,
      }),
    );
    blockers.push("Hay iniciativas fuera del alcance operativo del calendario.");
  }

  if (confidence < 0.75) {
    alerts.push(
      buildAlert({
        type: "low_confidence",
        severity: confidence < 0.6 ? "high" : "medium",
        title: "Confianza baja del plan",
        detail: "La calidad de señal no alcanza para operar el plan sin supervision fuerte.",
        actionRequired: "Revisar hipotesis, alcance y supuestos antes de aprobar.",
      }),
    );
  }

  if (risk >= 0.7) {
    alerts.push(
      buildAlert({
        type: "high_risk",
        severity: "high",
        title: "Riesgo alto del plan",
        detail: "El plan tiene un nivel de riesgo elevado para pasar directo a produccion.",
        actionRequired: "Ajustar plan, presupuesto o dependencias y volver a revisar.",
        blocking: true,
      }),
    );
    blockers.push("El riesgo global del plan supera el umbral operativo.");
  }

  if (params.updatedAt) {
    const stale = Date.now() - new Date(params.updatedAt).getTime() > 72 * 60 * 60 * 1000;
    if (stale && params.status !== "aprobado") {
      alerts.push(
        buildAlert({
          type: "sla",
          severity: "medium",
          title: "Plan pendiente fuera de SLA",
          detail: "El plan lleva mas de 72h sin aprobacion operativa.",
          actionRequired: "KAM o lead operativo deben aprobarlo o pedir cambios.",
          dueAt: addHours(params.updatedAt, 72),
        }),
      );
    }
  }

  if (priority < 0.4) {
    assumptions.push("El plan deberia concentrarse en quick wins o en una version mas acotada.");
  }

  const isApproved = params.status === "aprobado";
  const approvedBy = isApproved
    ? parseWorkflowMeta(params.previousWorkflow).approval?.approved_by ?? null
    : null;
  const approvedAt = isApproved
    ? parseWorkflowMeta(params.previousWorkflow).approval?.approved_at ?? null
    : null;
  const note = isApproved
    ? parseWorkflowMeta(params.previousWorkflow).approval?.note ?? null
    : null;
  const blocked = !isApproved && blockers.length > 0;
  const requiresReview = !isApproved && (blocked || confidence < 0.75 || risk >= 0.4 || dataQuality < 0.7);
  const degradation = inferDegradation({
    confidence,
    dataQuality,
    risk,
    criticalMissingCount: blockers.length,
    warningCount: alerts.length,
  });

  return {
    object_type: "plan_trabajo",
    status: deriveStatus({
      blocked,
      approved: isApproved,
      exception: params.status === "exception",
      requiresReview,
    }),
    decision: deriveDecision({
      blocked,
      warnings: isApproved ? alerts.filter((item) => !item.blocking).length : alerts.length,
      requiresReview,
    }),
    degradation_level: degradation.level,
    degradation_label: degradation.label,
    requires_human_review: requiresReview,
    approval: {
      required: true,
      state:
        isApproved
          ? "approved"
          : params.status === "revision"
              ? "changes_requested"
              : "pending",
      approved_by: approvedBy,
      approved_at: approvedAt,
      note,
    },
    alerts,
    blockers,
    assumptions,
    summary:
      blocked
        ? "El plan no puede operar hasta resolver conflictos de alcance o riesgo."
        : requiresReview
          ? "El plan esta listo para revision humana, pero no para ejecucion directa."
          : "El plan esta listo para aprobacion operativa.",
    score_snapshot: {
      confidence,
      data_quality: dataQuality,
      risk,
      priority,
    },
    generated_at: nowIso(),
  } satisfies WorkflowMeta;
}

export function buildCalendarioWorkflow(params: {
  content: unknown;
  status: string;
  scores: Partial<Record<"confidence" | "data_quality" | "risk" | "priority", number>>;
  metadata?: unknown;
  previousWorkflow?: unknown;
  updatedAt?: string | null;
}) {
  const root = params.content && typeof params.content === "object" ? (params.content as Record<string, unknown>) : {};
  const calendario =
    root.calendario && typeof root.calendario === "object"
      ? (root.calendario as Record<string, unknown>)
      : root;
  const metadata = asObj(params.metadata);
  const items = Array.isArray(calendario.items) ? (calendario.items as Array<Record<string, unknown>>) : [];
  const alcance =
    root.alcance_calendario && typeof root.alcance_calendario === "object"
      ? (root.alcance_calendario as Record<string, number>)
      : {};
  const metadataAlcance = normalizeCountMap(metadata.alcance_calendario);
  const metadataMarca = String(metadata.marca ?? "").trim();
  const metadataPais = String(metadata.pais ?? "").trim();

  const confidence = clamp(params.scores.confidence ?? 0.5);
  const dataQuality = clamp(params.scores.data_quality ?? 0.5);
  const risk = clamp(params.scores.risk ?? 0.5);
  const priority = clamp(params.scores.priority ?? 0.5);
  const alerts: WorkflowAlert[] = [];
  const blockers: string[] = [];
  const assumptions: string[] = [];

  if (items.length === 0) {
    blockers.push("El calendario no tiene piezas programadas.");
  }

  const itemsWithoutCriticalData = items.filter(
    (item) =>
      !String(item.fecha ?? "").trim() ||
      !String(item.canal ?? "").trim() ||
      !String(item.formato ?? "").trim() ||
      !String(item.titulo_base ?? "").trim() ||
      !String(item.CTA ?? "").trim(),
  ).length;

  if (itemsWithoutCriticalData > 0) {
    alerts.push(
      buildAlert({
        type: "missing_fields",
        severity: itemsWithoutCriticalData >= 3 ? "high" : "medium",
        title: "Piezas incompletas en calendario",
        detail: `${itemsWithoutCriticalData} piezas no tienen fecha, formato, titulo o CTA completos.`,
        actionRequired: "Completar piezas antes de aprobar el calendario.",
        blocking: itemsWithoutCriticalData >= 3,
      }),
    );
    if (itemsWithoutCriticalData >= 3) {
      blockers.push("Varias piezas del calendario estan incompletas.");
    }
  }

  const countsByChannel = items.reduce<Record<string, number>>((acc, item) => {
    const channel = String(item.canal ?? "").trim();
    if (!channel) return acc;
    acc[channel] = (acc[channel] ?? 0) + 1;
    return acc;
  }, {});

  const channelsOverScope = Object.entries(countsByChannel)
    .filter(([channel, count]) => {
      const allowed = alcance[channel];
      return typeof allowed === "number" && count > allowed;
    })
    .map(([channel]) => channel);

  const channelsOutsideMetadata =
    Object.keys(metadataAlcance).length > 0
      ? Object.keys(countsByChannel).filter((channel) => typeof metadataAlcance[channel] !== "number")
      : [];

  if (channelsOverScope.length > 0) {
    alerts.push(
      buildAlert({
        type: "capacity",
        severity: "high",
        title: "Calendario excede alcance",
        detail: `Hay mas piezas de las permitidas en: ${channelsOverScope.join(", ")}.`,
        actionRequired: "Reducir volumen o ampliar alcance antes de aprobar.",
        blocking: true,
      }),
    );
    blockers.push("El calendario excede el alcance operativo definido.");
  }

  if (channelsOutsideMetadata.length > 0) {
    alerts.push(
      buildAlert({
        type: "metadata_scope",
        severity: "high",
        title: "Calendario fuera de metadata_json",
        detail: `Hay canales no declarados en metadata_json: ${channelsOutsideMetadata.join(", ")}.`,
        actionRequired: "Eliminar esos canales o corregir metadata_json antes de operar.",
        blocking: true,
      }),
    );
    blockers.push("El calendario usa canales fuera del alcance declarado en metadata_json.");
  }

  if (Object.keys(metadataAlcance).length > 0) {
    const scopeDifferences = Array.from(new Set([...Object.keys(metadataAlcance), ...Object.keys(alcance)]))
      .filter((channel) => (metadataAlcance[channel] ?? 0) !== (alcance[channel] ?? 0));

    if (scopeDifferences.length > 0) {
      alerts.push(
        buildAlert({
          type: "metadata_alignment",
          severity: "high",
          title: "Alcance desalineado con metadata_json",
          detail: `El alcance operativo del calendario no coincide con metadata_json en: ${scopeDifferences.join(", ")}.`,
          actionRequired: "Alinear el alcance del calendario con metadata_json antes de operar.",
          blocking: true,
        }),
      );
      blockers.push("El alcance del calendario no coincide con metadata_json.");
    }
  }

  if (
    metadataMarca &&
    normalizeComparableText(calendario.marca) &&
    normalizeComparableText(calendario.marca) !== normalizeComparableText(metadataMarca)
  ) {
    alerts.push(
      buildAlert({
        type: "metadata_brand",
        severity: "high",
        title: "Marca desalineada con metadata_json",
        detail: `La marca del calendario (${String(calendario.marca ?? "").trim()}) no coincide con metadata_json (${metadataMarca}).`,
        actionRequired: "Corregir la marca del calendario o actualizar metadata_json.",
        blocking: true,
      }),
    );
    blockers.push("La marca del calendario no coincide con metadata_json.");
  }

  if (
    metadataPais &&
    normalizeComparableText(calendario.pais) &&
    normalizeComparableText(calendario.pais) !== normalizeComparableText(metadataPais)
  ) {
    alerts.push(
      buildAlert({
        type: "metadata_country",
        severity: "high",
        title: "Pais desalineado con metadata_json",
        detail: `El pais del calendario (${String(calendario.pais ?? "").trim()}) no coincide con metadata_json (${metadataPais}).`,
        actionRequired: "Corregir el pais del calendario o actualizar metadata_json.",
        blocking: true,
      }),
    );
    blockers.push("El pais del calendario no coincide con metadata_json.");
  }

  if (risk >= 0.7) {
    alerts.push(
      buildAlert({
        type: "high_risk",
        severity: "high",
        title: "Riesgo alto en calendario",
        detail: "El calendario tiene demasiado riesgo para pasar a produccion.",
        actionRequired: "Ajustar piezas con mayor riesgo o dependencias abiertas.",
        blocking: true,
      }),
    );
    blockers.push("El calendario supera el umbral de riesgo permitido.");
  }

  if (params.updatedAt) {
    const stale = Date.now() - new Date(params.updatedAt).getTime() > 48 * 60 * 60 * 1000;
    if (stale && params.status !== "aprobado") {
      alerts.push(
        buildAlert({
          type: "sla",
          severity: "medium",
          title: "Calendario pendiente fuera de SLA",
          detail: "El calendario lleva mas de 48h sin cierre.",
          actionRequired: "Operacion debe aprobarlo o devolver cambios.",
          dueAt: addHours(params.updatedAt, 48),
        }),
      );
    }
  }

  if (confidence < 0.75) {
    assumptions.push("El calendario debe verse como propuesta operativa, no como version final de produccion.");
  }

  const previous = parseWorkflowMeta(params.previousWorkflow);
  const isApproved = params.status === "aprobado" || params.status === "approved";
  const hasOperationalAlerts = blockers.length > 0;
  const blocked = false;
  const requiresReview = !isApproved && (hasOperationalAlerts || confidence < 0.75 || dataQuality < 0.75 || risk >= 0.4);
  const degradation = inferDegradation({
    confidence,
    dataQuality,
    risk,
    criticalMissingCount: blockers.length,
    warningCount: alerts.length,
  });

  return {
    object_type: "calendario",
    status: deriveStatus({
      blocked,
      approved: isApproved,
      exception: params.status === "exception",
      requiresReview,
    }),
    decision: deriveDecision({
      blocked,
      warnings: alerts.length,
      requiresReview,
    }),
    degradation_level: degradation.level,
    degradation_label: degradation.label,
    requires_human_review: !isApproved,
    approval: {
      required: true,
      state:
        isApproved
          ? "approved"
          : params.status === "revision"
            ? "changes_requested"
            : "pending",
      approved_by: isApproved ? previous.approval?.approved_by ?? null : null,
      approved_at: isApproved ? previous.approval?.approved_at ?? null : null,
      note: isApproved ? previous.approval?.note ?? null : null,
    },
    alerts,
    blockers,
    assumptions,
    summary:
      isApproved
        ? alerts.length > 0
          ? "El calendario fue aprobado con alertas operativas abiertas."
          : "El calendario esta aprobado para produccion."
        : requiresReview
          ? hasOperationalAlerts
            ? "El calendario requiere validacion humana y ajustes operativos antes de producir."
            : "El calendario requiere validacion humana antes de producir."
          : "El calendario esta listo para aprobacion final.",
    score_snapshot: {
      confidence,
      data_quality: dataQuality,
      risk,
      priority,
    },
    generated_at: nowIso(),
  } satisfies WorkflowMeta;
}

export function applyApprovalDecision(params: {
  workflow: WorkflowMeta;
  userId: string;
  note?: string | null;
  action: "approve" | "reopen" | "request_changes";
}) {
  const note = params.note?.trim() || null;
  const canBeBlocked = params.workflow.object_type !== "calendario";
  const hasBlockingAlerts = canBeBlocked && params.workflow.alerts.some((item) => item.blocking);
  const calendarHasOperationalAlerts =
    params.workflow.object_type === "calendario" &&
    (params.workflow.alerts.length > 0 || params.workflow.blockers.length > 0);

  if (params.action === "approve") {
    return {
      ...params.workflow,
      status: "approved",
      decision: params.workflow.alerts.some((item) => item.blocking) ? "approved_with_warnings" : "approved",
      requires_human_review: false,
      summary:
        params.workflow.object_type === "calendario"
          ? calendarHasOperationalAlerts
            ? "El calendario fue aprobado con alertas operativas abiertas."
            : "El calendario esta aprobado para produccion."
          : params.workflow.summary,
      approval: {
        ...params.workflow.approval,
        required: true,
        state: "approved",
        approved_by: params.userId,
        approved_at: nowIso(),
        note,
      },
      generated_at: nowIso(),
    } satisfies WorkflowMeta;
  }

  if (params.action === "request_changes") {
    return {
      ...params.workflow,
      status: "needs_review",
      decision: "needs_human_review",
      requires_human_review: true,
      summary:
        params.workflow.object_type === "calendario"
          ? calendarHasOperationalAlerts
            ? "El calendario requiere ajustes operativos antes de una nueva revision."
            : "El calendario quedo abierto para cambios y nueva revision."
          : params.workflow.summary,
      approval: {
        ...params.workflow.approval,
        required: true,
        state: "changes_requested",
        approved_by: null,
        approved_at: null,
        note,
      },
      generated_at: nowIso(),
    } satisfies WorkflowMeta;
  }

  return {
    ...params.workflow,
    status: hasBlockingAlerts ? "blocked" : "draft",
    decision: hasBlockingAlerts ? "blocked" : "needs_human_review",
    requires_human_review: true,
    summary:
      params.workflow.object_type === "calendario"
        ? calendarHasOperationalAlerts
          ? "El calendario quedo reabierto con alertas operativas por revisar."
          : "El calendario esta nuevamente en revision operativa."
        : params.workflow.summary,
    approval: {
      ...params.workflow.approval,
      required: true,
      state: hasBlockingAlerts ? "blocked" : "pending",
      approved_by: null,
      approved_at: null,
      note,
    },
    generated_at: nowIso(),
  } satisfies WorkflowMeta;
}
