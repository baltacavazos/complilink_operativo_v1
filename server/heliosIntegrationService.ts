import { ENV } from "./_core/env";

export type HeliosOpinionStatus =
  | "pending_dispatch"
  | "sent"
  | "processing"
  | "completed"
  | "partial"
  | "error"
  | "timeout"
  | "not_configured";

export type HeliosRiskLevel = "low" | "medium" | "high" | "critical";

export type HeliosIntegrationMode = "mock" | "remote";

export type HeliosLegalFoundation = {
  title: string;
  reference: string;
  relevance: string;
};

export type HeliosResultFinding = {
  label: string;
  value: string;
  source: "confirmed" | "estimated" | "derived";
  tone: "neutral" | "support" | "attention";
};

export type HeliosSimpleExplanationItem = {
  label: string;
  summary: string;
  tone: "neutral" | "support" | "attention";
};

export type HeliosResultCard = {
  headline: string;
  lead: string;
  keyFindings: HeliosResultFinding[];
  nextStepLabel: string;
  nextStepSummary: string;
  dossierUpdateLabel: string;
  dossierUpdateSummary: string;
  assistantIntro: string;
  suggestedQuestions: string[];
  signalsChecked: string[];
  simpleExplanation: HeliosSimpleExplanationItem[];
};

export type HeliosLegalHighlights = {
  primaryConclusion: string;
  primaryConcern: string | null;
  nextActionLabel: string;
};

export type HeliosOpinion = {
  documentId: string;
  caseId: string;
  status: HeliosOpinionStatus;
  mode: HeliosIntegrationMode;
  summary: string;
  legalOpinion: string;
  riskLevel: HeliosRiskLevel;
  recommendedNextStep: string;
  recommendedActions: string[];
  legalFoundations: HeliosLegalFoundation[];
  keyFactsUsed: string[];
  uncertainties: string[];
  confidenceScore: number;
  disclaimer: string;
  generatedAt: string;
  resultCard: HeliosResultCard;
  legalHighlights: HeliosLegalHighlights;
  rawPayload: Record<string, unknown>;
};

export type BuildHeliosOpinionParams = {
  tenantId: string;
  caseId: string;
  traceId: string;
  documentId: string;
  documentType: string;
  documentName?: string | null;
  jurisdiction?: string | null;
  caseTitle?: string | null;
  preliminaryAnalysis?: {
    confirmedData?: Record<string, unknown>;
    estimatedData?: Record<string, unknown>;
    guardrails?: string[];
  } | null;
};

export type HeliosOpinionContract = {
  engine: "helios";
  mode: HeliosIntegrationMode;
  traceId: string;
  tenantId: string;
  caseId: string;
  documentId: string;
  requestedOpinionType: "labor_preliminary_opinion";
  status: HeliosOpinionStatus;
  opinion: HeliosOpinion;
};

const DEFAULT_DISCLAIMER =
  "Esta es una opinión jurídica asistida por sistema. Sirve para orientar la revisión del expediente y no sustituye asesoría profesional personalizada.";

function asTextList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function getString(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function getConfirmed(params: BuildHeliosOpinionParams, key: string) {
  return getString(params.preliminaryAnalysis?.confirmedData, key);
}

function getEstimated(params: BuildHeliosOpinionParams, key: string) {
  return getString(params.preliminaryAnalysis?.estimatedData, key);
}

function getBestVisibleValue(params: BuildHeliosOpinionParams, key: string) {
  return getConfirmed(params, key) || getEstimated(params, key);
}

function lowercaseFirst(text: string) {
  return text.length ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

const VISIBLE_FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: "workerName", label: "nombre" },
  { key: "employerName", label: "empresa" },
  { key: "employerRfc", label: "RFC" },
  { key: "period", label: "periodo" },
  { key: "apparentAmount", label: "monto" },
  { key: "apparentEffectiveDate", label: "fecha" },
  { key: "jobTitle", label: "puesto" },
];

function collectVisibleFieldLabels(
  params: BuildHeliosOpinionParams,
  scope: "confirmed" | "estimated" | "any" = "any",
) {
  const getter =
    scope === "confirmed"
      ? getConfirmed
      : scope === "estimated"
        ? getEstimated
        : getBestVisibleValue;

  return VISIBLE_FIELD_LABELS.filter(({ key }) => getter(params, key))
    .map(({ label }) => label)
    .slice(0, 4);
}

function joinVisibleLabels(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} y ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;
}

function getDocumentTypeLabel(documentType: string) {
  switch (documentType) {
    case "payroll_receipt":
      return "recibo de nómina";
    case "cfdi":
      return "CFDI laboral";
    case "contract":
      return "contrato laboral";
    case "imss":
      return "soporte de IMSS";
    case "evidence":
      return "evidencia laboral";
    default:
      return "documento laboral";
  }
}

function getPrimaryFocus(documentType: string) {
  switch (documentType) {
    case "payroll_receipt":
      return "pagos, descuentos y periodo";
    case "cfdi":
      return "lo timbrado, los montos y el periodo";
    case "contract":
      return "lo pactado, el puesto y las condiciones iniciales";
    case "imss":
      return "fechas, salario registrado y continuidad laboral";
    case "evidence":
      return "hechos, fechas y contexto del caso";
    default:
      return "los datos más útiles del documento";
  }
}

function getRiskLevel(params: BuildHeliosOpinionParams): HeliosRiskLevel {
  const guardrails = asTextList(params.preliminaryAnalysis?.guardrails);
  const employerRfc = getBestVisibleValue(params, "employerRfc");
  const effectiveDate = getBestVisibleValue(params, "apparentEffectiveDate");

  if (guardrails.length >= 2) return "high";
  if (params.documentType === "contract") return effectiveDate ? "medium" : "high";
  if (params.documentType === "payroll_receipt" || params.documentType === "cfdi") {
    return employerRfc ? "medium" : "high";
  }
  if (params.documentType === "evidence") return "medium";
  return "low";
}

function getRecommendedActions(documentType: string) {
  switch (documentType) {
    case "contract":
      return [
        "Comparar sueldo, jornada y prestaciones pactadas contra lo que realmente ocurrió.",
        "Subir recibos de nómina o CFDI del mismo periodo para contrastar hechos y pagos.",
        "Marcar cualquier cláusula ambigua o condición que haya cambiado en la práctica.",
      ];
    case "payroll_receipt":
      return [
        "Contrastar este recibo con el CFDI del mismo periodo.",
        "Verificar si las deducciones y percepciones coinciden con tu pago real.",
        "Agregar contrato o evidencia si detectas diferencias repetidas.",
      ];
    case "cfdi":
      return [
        "Comparar lo timbrado con tus recibos de nómina y depósitos reales.",
        "Identificar periodos o montos que no coincidan entre documentos.",
        "Aportar contrato o soporte IMSS para reforzar el contexto laboral.",
      ];
    case "imss":
      return [
        "Revisar si el alta, baja o salario base coincide con el resto del expediente.",
        "Añadir contrato o nómina para conectar seguridad social y condiciones reales de trabajo.",
        "Guardar fechas clave que puedan servir para cronología del caso.",
      ];
    default:
      return [
        "Relacionar este documento con otros archivos del mismo expediente.",
        "Subir documentos complementarios para reducir vacíos interpretativos.",
        "Revisar fechas, montos y nombres para confirmar consistencia documental.",
      ];
  }
}

function getRecommendedNextStep(documentType: string) {
  switch (documentType) {
    case "contract":
      return "Comparar el contrato con nómina, CFDI y hechos reales para detectar diferencias relevantes.";
    case "payroll_receipt":
      return "Si puedes, sube el CFDI o el contrato del mismo periodo para comprobar si pagos, deducciones y prestaciones coinciden entre sí.";
    case "cfdi":
      return "Contrastar lo fiscalmente timbrado con nómina, depósitos y condiciones pactadas en el contrato.";
    case "imss":
      return "Vincular este soporte con tu cronología laboral y con recibos o contrato para validar seguridad social y salario registrado.";
    default:
      return "Aportar un documento complementario del mismo periodo para fortalecer la lectura del expediente.";
  }
}

function getSummary(params: BuildHeliosOpinionParams) {
  const workerName = getBestVisibleValue(params, "workerName");
  const employerName = getBestVisibleValue(params, "employerName");
  const apparentAmount = getBestVisibleValue(params, "apparentAmount");

  const subject = workerName ? `para ${workerName}` : "para este expediente";
  const counterpart = employerName ? ` frente a ${employerName}` : "";
  const amountFragment = apparentAmount
    ? ` También aparece un monto visible (${apparentAmount}) que conviene contrastar con otros soportes.`
    : "";

  if (params.documentType === "payroll_receipt") {
    return `Ya hay una primera lectura útil ${subject}${counterpart} para revisar pagos, deducciones y señales del recibo.${amountFragment}`.trim();
  }

  if (params.documentType === "contract") {
    return `Ya hay una primera lectura útil ${subject}${counterpart} para comparar lo pactado en el contrato con lo que realmente ocurrió.${amountFragment}`.trim();
  }

  if (params.documentType === "cfdi") {
    return `Ya hay una primera lectura útil ${subject}${counterpart} para revisar montos, periodo y lo que quedó timbrado.${amountFragment}`.trim();
  }

  if (params.documentType === "imss") {
    return `Ya hay una primera lectura útil ${subject}${counterpart} para revisar fechas, salario registrado y continuidad laboral.${amountFragment}`.trim();
  }

  return `Ya hay una primera lectura útil ${subject}${counterpart} con los datos más visibles del documento.${amountFragment}`.trim();
}

function getLegalOpinion(params: BuildHeliosOpinionParams, riskLevel: HeliosRiskLevel) {
  const guardrails = asTextList(params.preliminaryAnalysis?.guardrails);
  const normalizedRisk =
    riskLevel === "critical"
      ? "crítico"
      : riskLevel === "high"
        ? "alto"
        : riskLevel === "medium"
          ? "medio"
          : "bajo";

  const guardrailsFragment =
    guardrails.length > 0
      ? ` Además, el sistema detectó señales que justifican revisar con mayor cautela: ${guardrails.slice(0, 2).join("; ")}.`
      : "";

  switch (params.documentType) {
    case "contract":
      return `La lectura asistida sugiere usar este contrato como base de comparación para validar salario, jornada, prestaciones y condiciones iniciales. Por ahora la exposición aparente es de nivel ${normalizedRisk}, porque el valor principal del documento está en contrastarlo con lo efectivamente ocurrido.${guardrailsFragment}`;
    case "payroll_receipt":
      return `La lectura asistida ya te devuelve una base inicial para revisar si percepciones, deducciones y pagos del recibo se entienden con claridad. Antes de cerrar una conclusión más firme, conviene contrastarlo con CFDI y contrato; por ahora la exposición aparente se ubica en nivel ${normalizedRisk}.${guardrailsFragment}`;
    case "cfdi":
      return `La lectura asistida sugiere que este CFDI puede ayudar a detectar diferencias entre lo timbrado fiscalmente y lo realmente pagado o trabajado. El nivel de riesgo aparente es ${normalizedRisk} y gana valor cuando se cruza con nómina, contrato o evidencia adicional.${guardrailsFragment}`;
    case "imss":
      return `La lectura asistida sugiere que este soporte puede ser útil para verificar alta, baja, salario base o continuidad de la relación laboral. El nivel de riesgo aparente es ${normalizedRisk} y conviene conectarlo con la cronología documental del expediente.${guardrailsFragment}`;
    default:
      return `La lectura asistida sugiere que este documento aporta contexto útil al expediente, pero todavía requiere contraste con más hechos y soportes para consolidar una opinión preliminar. El nivel de riesgo aparente es ${normalizedRisk}.${guardrailsFragment}`;
  }
}

function getLegalFoundations(documentType: string): HeliosLegalFoundation[] {
  const common = [
    {
      title: "Primacía de la realidad",
      reference: "Doctrina laboral aplicable",
      relevance: "Sirve para contrastar lo que se pactó documentalmente contra lo que realmente ocurrió en la relación de trabajo.",
    },
    {
      title: "Protección de derechos laborales",
      reference: "Marco laboral mexicano",
      relevance: "La interpretación inicial debe favorecer una revisión suficiente de salario, jornada, prestaciones y seguridad social.",
    },
  ];

  if (documentType === "contract") {
    return [
      {
        title: "Condiciones de trabajo pactadas",
        reference: "Contrato individual y condiciones iniciales",
        relevance: "Permite fijar el punto de partida para comparar sueldo, puesto y jornada con la práctica real.",
      },
      ...common,
    ];
  }

  if (documentType === "payroll_receipt" || documentType === "cfdi") {
    return [
      {
        title: "Acreditación de pagos y deducciones",
        reference: "Recibos y comprobantes fiscales laborales",
        relevance: "Permite revisar si los pagos documentados coinciden con la relación laboral y con otros soportes del expediente.",
      },
      ...common,
    ];
  }

  return common;
}

function getKeyFactsUsed(params: BuildHeliosOpinionParams) {
  const entries = [
    getBestVisibleValue(params, "workerName"),
    getBestVisibleValue(params, "employerName"),
    getBestVisibleValue(params, "period"),
    getBestVisibleValue(params, "apparentAmount"),
    params.documentName || undefined,
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (entries.length > 0) {
    return entries.map((entry) => entry.trim());
  }

  return [`Documento clasificado como ${params.documentType}`, `Expediente ${params.caseId}`];
}

function getUncertainties(params: BuildHeliosOpinionParams) {
  const guardrails = asTextList(params.preliminaryAnalysis?.guardrails);
  const uncertainties = [...guardrails];

  if (!getConfirmed(params, "workerName")) {
    uncertainties.push("Todavía conviene confirmar con más documentos la identidad o rol laboral visible.");
  }

  if (!getBestVisibleValue(params, "period")) {
    uncertainties.push("Hace falta reforzar el periodo exacto o la cronología del documento.");
  }

  if (uncertainties.length === 0) {
    uncertainties.push("La opinión asistida debe contrastarse con más hechos y documentos del expediente.");
  }

  return uncertainties.slice(0, 3);
}

function getConfidenceScore(params: BuildHeliosOpinionParams, riskLevel: HeliosRiskLevel) {
  const guardrails = asTextList(params.preliminaryAnalysis?.guardrails);
  const base =
    params.documentType === "contract"
      ? 76
      : params.documentType === "payroll_receipt" || params.documentType === "cfdi"
        ? 74
        : 70;
  const penalty = guardrails.length * 6 + (riskLevel === "high" ? 4 : riskLevel === "critical" ? 8 : 0);
  return Math.max(52, Math.min(92, base - penalty));
}

function pushFinding(
  findings: HeliosResultFinding[],
  label: string,
  value: string | undefined,
  source: "confirmed" | "estimated" | "derived",
  tone: "neutral" | "support" | "attention" = "neutral",
) {
  if (!value) return;
  if (findings.some((item) => item.label === label && item.value === value)) return;
  findings.push({ label, value, source, tone });
}

function getKeyFindings(params: BuildHeliosOpinionParams) {
  const findings: HeliosResultFinding[] = [];
  const workerNameConfirmed = getConfirmed(params, "workerName");
  const workerNameEstimated = getEstimated(params, "workerName");
  const employerNameConfirmed = getConfirmed(params, "employerName");
  const employerNameEstimated = getEstimated(params, "employerName");
  const periodConfirmed = getConfirmed(params, "period");
  const periodEstimated = getEstimated(params, "period");
  const amountConfirmed = getConfirmed(params, "apparentAmount");
  const amountEstimated = getEstimated(params, "apparentAmount");
  const jobTitleConfirmed = getConfirmed(params, "jobTitle");
  const jobTitleEstimated = getEstimated(params, "jobTitle");
  const employerRfcConfirmed = getConfirmed(params, "employerRfc");
  const employerRfcEstimated = getEstimated(params, "employerRfc");
  const effectiveDateConfirmed = getConfirmed(params, "apparentEffectiveDate");
  const effectiveDateEstimated = getEstimated(params, "apparentEffectiveDate");
  const guardrails = asTextList(params.preliminaryAnalysis?.guardrails);

  pushFinding(findings, "Documento detectado", getDocumentTypeLabel(params.documentType), "derived", "support");
  pushFinding(findings, "Nombre visible", workerNameConfirmed, "confirmed");
  pushFinding(findings, "Nombre visible", workerNameEstimated, "estimated");
  pushFinding(findings, "Empresa visible", employerNameConfirmed, "confirmed");
  pushFinding(findings, "Empresa visible", employerNameEstimated, "estimated");
  pushFinding(findings, "Periodo visible", periodConfirmed, "confirmed");
  pushFinding(findings, "Periodo visible", periodEstimated, "estimated");

  if (params.documentType === "payroll_receipt" || params.documentType === "cfdi") {
    pushFinding(findings, "Monto visible", amountConfirmed, "confirmed", "support");
    pushFinding(findings, "Monto visible", amountEstimated, "estimated", "support");
  }

  if (params.documentType === "contract") {
    pushFinding(findings, "Puesto visible", jobTitleConfirmed, "confirmed");
    pushFinding(findings, "Puesto visible", jobTitleEstimated, "estimated");
    pushFinding(findings, "Fecha visible", effectiveDateConfirmed, "confirmed");
    pushFinding(findings, "Fecha visible", effectiveDateEstimated, "estimated");
  }

  if (params.documentType === "imss") {
    pushFinding(findings, "RFC visible", employerRfcConfirmed, "confirmed");
    pushFinding(findings, "RFC visible", employerRfcEstimated, "estimated");
    pushFinding(findings, "Fecha visible", effectiveDateConfirmed, "confirmed");
    pushFinding(findings, "Fecha visible", effectiveDateEstimated, "estimated");
  }

  if (guardrails[0]) {
    pushFinding(findings, "Ojo", guardrails[0], "derived", "attention");
  }

  if (findings.length < 3) {
    pushFinding(
      findings,
      "Para qué sirve",
      `Este ${getDocumentTypeLabel(params.documentType)} ayuda a revisar ${lowercaseFirst(getPrimaryFocus(params.documentType))}.`,
      "derived",
      "support",
    );
  }

  return findings.slice(0, 4);
}

function getHeadline(params: BuildHeliosOpinionParams) {
  switch (params.documentType) {
    case "payroll_receipt":
      return "Ya revisamos tu recibo y hay una primera lectura útil";
    case "contract":
      return "Ya revisamos tu contrato y hay una primera lectura útil";
    case "cfdi":
      return "Ya revisamos tu CFDI y hay una primera lectura útil";
    case "imss":
      return "Ya revisamos tu soporte de IMSS y hay una primera lectura útil";
    default:
      return "Ya revisamos tu documento y hay una primera lectura útil";
  }
}

function getLead(params: BuildHeliosOpinionParams, findings: HeliosResultFinding[]) {
  const visibleLabels = findings
    .filter((item) => item.label !== "Documento detectado" && item.label !== "Ojo" && item.label !== "Para qué sirve")
    .slice(0, 3)
    .map((item) => item.label.toLowerCase());

  const evidenceFragment = visibleLabels.length
    ? `Por ahora ya se alcanzan a ver ${joinVisibleLabels(visibleLabels)}.`
    : `Por ahora ya se alcanzan a ver señales útiles sobre ${lowercaseFirst(getPrimaryFocus(params.documentType))}.`;

  return `${evidenceFragment} Antes de pedirte algo más, Helios ya agotó lo visible, las reglas básicas de consistencia y el contexto inmediato del expediente.`;
}

function getSignalsChecked(params: BuildHeliosOpinionParams) {
  const signals = [
    "tipo de documento detectado",
    "campos visibles del archivo",
    "reglas básicas de consistencia",
  ];

  const visibleFieldLabels = collectVisibleFieldLabels(params, "any");
  if (visibleFieldLabels.length > 0) {
    signals.push(`datos visibles como ${joinVisibleLabels(visibleFieldLabels)}`);
  }

  if (params.documentType === "payroll_receipt" || params.documentType === "cfdi") {
    signals.push("montos, pagos y descuentos visibles");
  } else if (params.documentType === "contract") {
    signals.push("puesto, fecha y condiciones visibles");
  } else if (params.documentType === "imss") {
    signals.push("salario registrado y continuidad visible");
  }

  if (asTextList(params.preliminaryAnalysis?.guardrails).length > 0) {
    signals.push("alertas y faltantes detectados");
  }

  return Array.from(new Set(signals)).slice(0, 5);
}

function buildSimpleExplanation(
  params: BuildHeliosOpinionParams,
  uncertainties: string[],
): { signalsChecked: string[]; simpleExplanation: HeliosSimpleExplanationItem[] } {
  const documentLabel = getDocumentTypeLabel(params.documentType);
  const confirmedLabels = collectVisibleFieldLabels(params, "confirmed");
  const estimatedLabels = collectVisibleFieldLabels(params, "estimated");
  const signalsChecked = getSignalsChecked(params);
  const nextStep = getRecommendedNextStep(params.documentType);
  const pendingSummary =
    uncertainties[0] ??
    "Todavía conviene contrastar este archivo con más evidencia antes de cerrar una conclusión más fuerte.";

  return {
    signalsChecked,
    simpleExplanation: [
      {
        label: "Qué ya revisé por ti",
        summary: `Antes de pedirte algo más, Helios ya revisó ${joinVisibleLabels(signalsChecked)} dentro de este ${documentLabel}.`,
        tone: "support",
      },
      {
        label: "Lo que sí pude concluir",
        summary:
          confirmedLabels.length > 0
            ? `Ya pude ubicar con claridad ${joinVisibleLabels(confirmedLabels)} dentro del archivo.`
            : `Ya pude sacar una primera lectura útil sin inventar datos que no se vean claros en el archivo.`,
        tone: "support",
      },
      {
        label: "Lo que todavía no puedo asegurar",
        summary:
          estimatedLabels.length > 0
            ? `${pendingSummary} También hay pistas sobre ${joinVisibleLabels(estimatedLabels)}, pero todavía no lo tomo como hecho cerrado.`
            : pendingSummary,
        tone: "attention",
      },
      {
        label: "Si quieres más claridad, esto sigue",
        summary: nextStep,
        tone: "neutral",
      },
    ],
  };
}

function getNextStepLabel(documentType: string) {
  switch (documentType) {
    case "contract":
    case "imss":
      return "Lo que más te conviene hacer ahora";
    default:
      return "Siguiente paso sugerido";
  }
}

function getDossierUpdateSummary(params: BuildHeliosOpinionParams) {
  const label = getDocumentTypeLabel(params.documentType);
  return `Tu ${label} ya quedó ordenado dentro de tu expediente y servirá para futuras comparaciones, respuestas y seguimientos.`;
}

function getSuggestedQuestions(params: BuildHeliosOpinionParams) {
  switch (params.documentType) {
    case "payroll_receipt":
      return [
        "Explícame este recibo con palabras simples.",
        "¿Qué no cuadra o qué conviene revisar aquí?",
        "¿Qué documento me conviene subir después?",
      ];
    case "contract":
      return [
        "Explícame qué dice este contrato en palabras simples.",
        "¿Qué parte de este contrato conviene comparar con mi realidad?",
        "¿Qué documento me conviene subir después?",
      ];
    case "cfdi":
      return [
        "Explícame este CFDI con palabras simples.",
        "¿Qué podría no coincidir con mis pagos reales?",
        "¿Qué documento me conviene subir después?",
      ];
    case "imss":
      return [
        "Explícame este soporte de IMSS con palabras simples.",
        "¿Qué fecha o dato conviene confirmar?",
        "¿Qué documento me conviene subir después?",
      ];
    default:
      return [
        "Explícame este documento con palabras simples.",
        "¿Qué hallazgo es el más importante aquí?",
        "¿Qué documento me conviene subir después?",
      ];
  }
}

function buildResultCard(params: BuildHeliosOpinionParams, uncertainties: string[]): HeliosResultCard {
  const keyFindings = getKeyFindings(params);
  const nextStepSummary = getRecommendedNextStep(params.documentType);
  const firstUncertainty = uncertainties[0];
  const { signalsChecked, simpleExplanation } = buildSimpleExplanation(params, uncertainties);

  return {
    headline: getHeadline(params),
    lead: getLead(params, keyFindings),
    keyFindings,
    nextStepLabel: getNextStepLabel(params.documentType),
    nextStepSummary: firstUncertainty
      ? `${nextStepSummary} Hoy conviene poner atención especial en esto: ${firstUncertainty}`
      : nextStepSummary,
    dossierUpdateLabel: "Tu expediente ya se actualizó",
    dossierUpdateSummary: getDossierUpdateSummary(params),
    assistantIntro:
      "Si quieres, ahora puedo explicarte este documento con palabras simples, decirte qué sí pude concluir, qué sigue pendiente y ayudarte a elegir el siguiente archivo más útil.",
    suggestedQuestions: getSuggestedQuestions(params),
    signalsChecked,
    simpleExplanation,
  };
}

function buildLegalHighlights(summary: string, uncertainties: string[], recommendedNextStep: string): HeliosLegalHighlights {
  return {
    primaryConclusion: summary,
    primaryConcern: uncertainties[0] ?? null,
    nextActionLabel: recommendedNextStep,
  };
}

function toOptionalText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toOptionalRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function clampConfidenceScore(value: unknown, fallback = 78) {
  const normalized = toOptionalNumber(value);
  if (typeof normalized !== "number") return fallback;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function getPendingRemoteSummary(documentType: string) {
  switch (documentType) {
    case "contract":
      return "Helios ya recibió tu contrato y está preparando una lectura jurídica más precisa para este expediente.";
    case "payroll_receipt":
      return "Helios ya recibió tu recibo de nómina y está contrastando pagos, deducciones y periodo con el resto del expediente.";
    case "cfdi":
      return "Helios ya recibió tu CFDI laboral y está revisando montos, periodo y consistencia documental.";
    case "imss":
      return "Helios ya recibió tu soporte de IMSS y está validando continuidad, salario registrado y señales de seguridad social.";
    default:
      return "Helios ya recibió tu documento y está preparando una respuesta jurídica más útil para este expediente.";
  }
}

function buildPendingRemoteResultCard(params: BuildHeliosOpinionParams): HeliosResultCard {
  const suggestedQuestions = getSuggestedQuestions(params);
  return {
    headline: "Tu documento ya está en revisión avanzada",
    lead: getPendingRemoteSummary(params.documentType),
    keyFindings: [
      {
        label: "Estado del motor",
        value: "Helios remoto ya recibió el documento y está procesándolo dentro del expediente.",
        source: "derived",
        tone: "support",
      },
      {
        label: "Qué sigue",
        value: "En cuanto el motor termine, esta vista se actualizará con hallazgos concretos, contexto del expediente y preguntas sugeridas.",
        source: "derived",
        tone: "neutral",
      },
    ],
    nextStepLabel: "Siguiente paso sugerido",
    nextStepSummary: "Mientras Helios termina, puedes seguir subiendo documentos del mismo periodo para enriquecer el expediente y mejorar la lectura final.",
    dossierUpdateLabel: "Tu expediente ya se actualizó",
    dossierUpdateSummary: getDossierUpdateSummary(params),
    assistantIntro: "Puedo ayudarte a entender qué está revisando Helios, qué ya agotó y qué documento conviene subir después mientras llega la respuesta final.",
    suggestedQuestions,
    signalsChecked: [
      "tipo de documento detectado",
      "campos visibles del archivo",
      "estado del motor Helios",
      "contexto inmediato del expediente",
    ],
    simpleExplanation: [
      {
        label: "Qué ya revisé por ti",
        summary: "Tu documento ya fue recibido, clasificado y enviado al flujo avanzado de Helios.",
        tone: "support",
      },
      {
        label: "Lo que sí pude concluir",
        summary: "Ya sabemos qué tipo de documento es y cómo puede ayudar dentro de tu expediente.",
        tone: "support",
      },
      {
        label: "Lo que todavía no puedo asegurar",
        summary: "La lectura jurídica fina todavía depende de que termine el procesamiento remoto del documento completo.",
        tone: "attention",
      },
      {
        label: "Si quieres más claridad, esto sigue",
        summary: "Mientras llega la respuesta final, puedes seguir subiendo archivos del mismo periodo para enriquecer el expediente.",
        tone: "neutral",
      },
    ],
  };
}

export function hasRemoteHeliosBridgeConfigured() {
  return ENV.auditapatronEngineWebhookUrl.trim().length > 0;
}

export function getHeliosIntegrationMode(): HeliosIntegrationMode {
  return hasRemoteHeliosBridgeConfigured() ? "remote" : "mock";
}

export function buildHeliosOpinion(params: BuildHeliosOpinionParams): HeliosOpinion {
  const riskLevel = getRiskLevel(params);
  const confidenceScore = getConfidenceScore(params, riskLevel);
  const generatedAt = new Date().toISOString();
  const summary = getSummary(params);
  const legalOpinion = getLegalOpinion(params, riskLevel);
  const recommendedNextStep = getRecommendedNextStep(params.documentType);
  const recommendedActions = getRecommendedActions(params.documentType);
  const uncertainties = getUncertainties(params);

  return {
    documentId: params.documentId,
    caseId: params.caseId,
    status: "completed",
    mode: "mock",
    summary,
    legalOpinion,
    riskLevel,
    recommendedNextStep,
    recommendedActions,
    legalFoundations: getLegalFoundations(params.documentType),
    keyFactsUsed: getKeyFactsUsed(params),
    uncertainties,
    confidenceScore,
    disclaimer: DEFAULT_DISCLAIMER,
    generatedAt,
    resultCard: buildResultCard(params, uncertainties),
    legalHighlights: buildLegalHighlights(summary, uncertainties, recommendedNextStep),
    rawPayload: {
      tenantId: params.tenantId,
      caseId: params.caseId,
      traceId: params.traceId,
      documentId: params.documentId,
      documentType: params.documentType,
      jurisdiction: params.jurisdiction ?? "México",
      caseTitle: params.caseTitle ?? null,
      preliminaryAnalysis: params.preliminaryAnalysis ?? null,
    },
  };
}

export function buildRemotePendingHeliosOpinionContract(params: BuildHeliosOpinionParams): HeliosOpinionContract {
  const generatedAt = new Date().toISOString();
  const mode = getHeliosIntegrationMode();
  const summary = getPendingRemoteSummary(params.documentType);
  const recommendedNextStep = getRecommendedNextStep(params.documentType);
  const uncertainties = ["La respuesta jurídica final depende de la lectura remota del motor sobre el documento completo."];
  const opinion: HeliosOpinion = {
    documentId: params.documentId,
    caseId: params.caseId,
    status: hasRemoteHeliosBridgeConfigured() ? "processing" : "not_configured",
    mode,
    summary,
    legalOpinion:
      mode === "remote"
        ? "El documento ya fue enviado a Helios y la opinión jurídica final se completará cuando el motor termine de procesarlo dentro del expediente."
        : "Helios remoto todavía no está configurado. Este expediente necesita la conexión del motor para devolver una opinión final.",
    riskLevel: "low",
    recommendedNextStep,
    recommendedActions: getRecommendedActions(params.documentType),
    legalFoundations: getLegalFoundations(params.documentType),
    keyFactsUsed: getKeyFactsUsed(params),
    uncertainties,
    confidenceScore: 78,
    disclaimer: DEFAULT_DISCLAIMER,
    generatedAt,
    resultCard: buildPendingRemoteResultCard(params),
    legalHighlights: buildLegalHighlights(summary, uncertainties, recommendedNextStep),
    rawPayload: {
      tenantId: params.tenantId,
      caseId: params.caseId,
      traceId: params.traceId,
      documentId: params.documentId,
      documentType: params.documentType,
      jurisdiction: params.jurisdiction ?? "México",
      caseTitle: params.caseTitle ?? null,
      preliminaryAnalysis: params.preliminaryAnalysis ?? null,
      bridgeConfigured: hasRemoteHeliosBridgeConfigured(),
    },
  };

  return {
    engine: "helios",
    mode,
    traceId: params.traceId,
    tenantId: params.tenantId,
    caseId: params.caseId,
    documentId: params.documentId,
    requestedOpinionType: "labor_preliminary_opinion",
    status: opinion.status,
    opinion,
  };
}

export function buildHeliosOpinionContract(params: BuildHeliosOpinionParams): HeliosOpinionContract {
  if (hasRemoteHeliosBridgeConfigured()) {
    return buildRemotePendingHeliosOpinionContract(params);
  }

  const opinion = buildHeliosOpinion(params);

  return {
    engine: "helios",
    mode: opinion.mode,
    traceId: params.traceId,
    tenantId: params.tenantId,
    caseId: params.caseId,
    documentId: params.documentId,
    requestedOpinionType: "labor_preliminary_opinion",
    status: opinion.status,
    opinion,
  };
}

export function buildRemoteHeliosOpinionContract(params: {
  tenantId: string;
  caseId: string;
  traceId: string;
  documentId: string;
  documentType: string;
  documentName?: string | null;
  remotePayload: Record<string, unknown>;
}) {
  const payload = params.remotePayload;
  const contractSummary = toOptionalText(payload.contractSummary);
  const extractedFields = toOptionalRecord(payload.extractedFields);
  const analysisResults = toOptionalRecord(payload.analysisResults);
  const estimatedBenefits = toOptionalRecord(payload.estimatedBenefits);
  const metadata = toOptionalRecord(payload.metadata);
  const guardrails = [
    ...asTextList(payload.guardrailWarnings),
    ...asTextList(payload.guardrailsFlags),
  ].slice(0, 3);
  const summary =
    contractSummary ??
    toOptionalText(analysisResults?.summary) ??
    toOptionalText(metadata?.summary) ??
    getPendingRemoteSummary(params.documentType);
  const recommendedNextStep =
    toOptionalText(analysisResults?.nextStep) ??
    toOptionalText(metadata?.nextStep) ??
    getRecommendedNextStep(params.documentType);
  const legalOpinion =
    toOptionalText(analysisResults?.legalOpinion) ??
    toOptionalText(metadata?.legalOpinion) ??
    "Helios terminó de procesar este documento y ya devolvió una lectura consolidada basada en el expediente y en el contenido recibido.";
  const recommendedActions = [
    ...asTextList(analysisResults?.recommendedActions),
    ...asTextList(metadata?.recommendedActions),
    ...getRecommendedActions(params.documentType),
  ].slice(0, 3);
  const confidenceScore = clampConfidenceScore(payload.confidenceScore, 84);
  const riskLevel: HeliosRiskLevel =
    guardrails.length >= 2
      ? "high"
      : guardrails.length === 1
        ? "medium"
        : confidenceScore >= 88
          ? "low"
          : "medium";
  const keyFindings: HeliosResultFinding[] = [];

  const topFieldEntries = Object.entries(extractedFields ?? {}).filter(([, value]) => toOptionalText(value)).slice(0, 2);
  topFieldEntries.forEach(([label, value]) => {
    keyFindings.push({
      label: label.replace(/[_-]+/g, " "),
      value: String(value),
      source: "confirmed",
      tone: "support",
    });
  });

  const benefitEntries = Object.entries(estimatedBenefits ?? {}).filter(([, value]) => toOptionalText(value)).slice(0, 1);
  benefitEntries.forEach(([label, value]) => {
    keyFindings.push({
      label: label.replace(/[_-]+/g, " "),
      value: String(value),
      source: "derived",
      tone: "support",
    });
  });

  if (guardrails[0]) {
    keyFindings.push({
      label: "Atención prioritaria",
      value: guardrails[0],
      source: "derived",
      tone: "attention",
    });
  }

  if (keyFindings.length === 0) {
    keyFindings.push({
      label: "Resultado remoto",
      value: summary,
      source: "derived",
      tone: "support",
    });
  }

  const suggestedQuestions = [
    ...asTextList(metadata?.suggestedQuestions),
    ...asTextList(analysisResults?.suggestedQuestions),
    ...getSuggestedQuestions({
      tenantId: params.tenantId,
      caseId: params.caseId,
      traceId: params.traceId,
      documentId: params.documentId,
      documentType: params.documentType,
      documentName: params.documentName,
    }),
  ].slice(0, 3);

  const opinion: HeliosOpinion = {
    documentId: params.documentId,
    caseId: params.caseId,
    status: "completed",
    mode: "remote",
    summary,
    legalOpinion,
    riskLevel,
    recommendedNextStep,
    recommendedActions,
    legalFoundations: getLegalFoundations(params.documentType),
    keyFactsUsed: [
      ...topFieldEntries.map(([label, value]) => `${label}: ${String(value)}`),
      ...(params.documentName ? [params.documentName] : []),
      `Expediente ${params.caseId}`,
    ].slice(0, 5),
    uncertainties:
      guardrails.length > 0
        ? guardrails
        : ["La lectura final debe contrastarse con el resto del expediente para construir una estrategia laboral completa."],
    confidenceScore,
    disclaimer: DEFAULT_DISCLAIMER,
    generatedAt: toOptionalText(payload.timestamp) ?? new Date().toISOString(),
    resultCard: {
      headline: "Helios ya terminó esta lectura",
      lead: summary,
      keyFindings: keyFindings.slice(0, 3),
      nextStepLabel: "Siguiente paso sugerido",
      nextStepSummary: recommendedNextStep,
      dossierUpdateLabel: "Tu expediente quedó enriquecido",
      dossierUpdateSummary: "La respuesta remota ya quedó ligada a este documento para futuras comparaciones dentro del expediente.",
      assistantIntro: "Ahora puedo explicarte esta lectura remota en palabras simples, decirte qué sí quedó claro y qué sigue pendiente.",
      suggestedQuestions,
      signalsChecked: [
        "documento completo",
        "respuesta remota del motor",
        "hallazgos priorizados",
        "contexto del expediente",
      ],
      simpleExplanation: [
        {
          label: "Qué ya revisé por ti",
          summary: "Helios ya terminó la lectura remota y priorizó los hallazgos más útiles de este documento.",
          tone: "support",
        },
        {
          label: "Lo que sí pude concluir",
          summary: summary,
          tone: "support",
        },
        {
          label: "Lo que todavía no puedo asegurar",
          summary:
            guardrails[0] ??
            "Esta lectura todavía conviene contrastarla con el resto del expediente antes de cerrar una estrategia más fuerte.",
          tone: "attention",
        },
        {
          label: "Si quieres más claridad, esto sigue",
          summary: recommendedNextStep,
          tone: "neutral",
        },
      ],
    },
    legalHighlights: buildLegalHighlights(summary, guardrails, recommendedNextStep),
    rawPayload: payload,
  };

  return {
    engine: "helios",
    mode: "remote",
    traceId: params.traceId,
    tenantId: params.tenantId,
    caseId: params.caseId,
    documentId: params.documentId,
    requestedOpinionType: "labor_preliminary_opinion",
    status: opinion.status,
    opinion,
  } satisfies HeliosOpinionContract;
}
