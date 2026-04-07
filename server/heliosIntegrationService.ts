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

function getRiskLevel(params: BuildHeliosOpinionParams): HeliosRiskLevel {
  const guardrails = asTextList(params.preliminaryAnalysis?.guardrails);
  const confirmed = params.preliminaryAnalysis?.confirmedData ?? {};
  const estimated = params.preliminaryAnalysis?.estimatedData ?? {};
  const employerRfc = getString(estimated, "employerRfc") || getString(confirmed, "employerRfc");
  const effectiveDate = getString(estimated, "apparentEffectiveDate") || getString(confirmed, "apparentEffectiveDate");

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
      return "Comparar el contrato con nómina, CFDI y hechos reales para detectar diferencias jurídicas relevantes.";
    case "payroll_receipt":
      return "Cruzar este recibo con CFDI y contrato para identificar pagos, deducciones o prestaciones inconsistentes.";
    case "cfdi":
      return "Contrastar lo fiscalmente timbrado con nómina, depósitos y condiciones pactadas en el contrato.";
    case "imss":
      return "Vincular este soporte con tu cronología laboral y con recibos o contrato para validar seguridad social y salario registrado.";
    default:
      return "Aportar un documento complementario del mismo periodo para fortalecer la lectura jurídica del expediente.";
  }
}

function getSummary(params: BuildHeliosOpinionParams, riskLevel: HeliosRiskLevel) {
  const confirmed = params.preliminaryAnalysis?.confirmedData ?? {};
  const estimated = params.preliminaryAnalysis?.estimatedData ?? {};
  const workerName = getString(confirmed, "workerName") || getString(estimated, "workerName");
  const employerName = getString(confirmed, "employerName") || getString(estimated, "employerName");
  const apparentAmount = getString(estimated, "apparentAmount") || getString(confirmed, "apparentAmount");

  const subject = workerName ? `para ${workerName}` : "para este expediente";
  const counterpart = employerName ? ` frente a ${employerName}` : "";
  const amountFragment = apparentAmount ? ` También aparece un monto visible (${apparentAmount}) que conviene contrastar con otros soportes.` : "";

  return `Helios generó una lectura preliminar ${subject}${counterpart} con riesgo ${riskLevel}.${amountFragment}`.trim();
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
      return `La lectura asistida sugiere usar este contrato como base de comparación jurídica para validar salario, jornada, prestaciones y condiciones iniciales. Por ahora la exposición aparente es de nivel ${normalizedRisk}, porque el valor principal del documento está en contrastarlo con lo efectivamente ocurrido.${guardrailsFragment}`;
    case "payroll_receipt":
      return `La lectura asistida sugiere que este recibo puede servir para revisar consistencia entre percepciones, deducciones y pagos reales. El nivel de riesgo aparente es ${normalizedRisk} y conviene contrastarlo con CFDI y contrato antes de extraer una conclusión más firme.${guardrailsFragment}`;
    case "cfdi":
      return `La lectura asistida sugiere que este CFDI puede ayudar a detectar diferencias entre lo timbrado fiscalmente y lo realmente pagado o trabajado. El nivel de riesgo aparente es ${normalizedRisk} y gana valor jurídico cuando se cruza con nómina, contrato o evidencia adicional.${guardrailsFragment}`;
    case "imss":
      return `La lectura asistida sugiere que este soporte puede ser útil para verificar alta, baja, salario base o continuidad de la relación laboral. El nivel de riesgo aparente es ${normalizedRisk} y conviene conectarlo con la cronología documental del expediente.${guardrailsFragment}`;
    default:
      return `La lectura asistida sugiere que este documento aporta contexto útil al expediente, pero todavía requiere contraste con más hechos y soportes para consolidar una opinión jurídica preliminar. El nivel de riesgo aparente es ${normalizedRisk}.${guardrailsFragment}`;
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
  const confirmed = params.preliminaryAnalysis?.confirmedData ?? {};
  const estimated = params.preliminaryAnalysis?.estimatedData ?? {};
  const entries = [
    getString(confirmed, "workerName") || getString(estimated, "workerName"),
    getString(confirmed, "employerName") || getString(estimated, "employerName"),
    getString(estimated, "period") || getString(confirmed, "period"),
    getString(estimated, "apparentAmount") || getString(confirmed, "apparentAmount"),
    params.documentName || undefined,
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (entries.length > 0) {
    return entries.map((entry) => entry.trim());
  }

  return [
    `Documento clasificado como ${params.documentType}`,
    `Expediente ${params.caseId}`,
  ];
}

function getUncertainties(params: BuildHeliosOpinionParams) {
  const guardrails = asTextList(params.preliminaryAnalysis?.guardrails);
  const uncertainties = [...guardrails];

  if (!getString(params.preliminaryAnalysis?.confirmedData, "workerName")) {
    uncertainties.push("Todavía conviene confirmar con más documentos la identidad o rol laboral visible.");
  }

  if (!getString(params.preliminaryAnalysis?.estimatedData, "period")) {
    uncertainties.push("Hace falta reforzar el periodo exacto o la cronología del documento.");
  }

  if (uncertainties.length === 0) {
    uncertainties.push("La opinión asistida debe contrastarse con más hechos y documentos del expediente.");
  }

  return uncertainties.slice(0, 3);
}

function getConfidenceScore(params: BuildHeliosOpinionParams, riskLevel: HeliosRiskLevel) {
  const guardrails = asTextList(params.preliminaryAnalysis?.guardrails);
  const base = params.documentType === "contract" ? 76 : params.documentType === "payroll_receipt" || params.documentType === "cfdi" ? 74 : 70;
  const penalty = guardrails.length * 6 + (riskLevel === "high" ? 4 : riskLevel === "critical" ? 8 : 0);
  return Math.max(52, Math.min(92, base - penalty));
}

export function getHeliosIntegrationMode(): HeliosIntegrationMode {
  return "mock";
}

export function buildHeliosOpinion(params: BuildHeliosOpinionParams): HeliosOpinion {
  const riskLevel = getRiskLevel(params);
  const confidenceScore = getConfidenceScore(params, riskLevel);
  const generatedAt = new Date().toISOString();

  return {
    documentId: params.documentId,
    caseId: params.caseId,
    status: "completed",
    mode: getHeliosIntegrationMode(),
    summary: getSummary(params, riskLevel),
    legalOpinion: getLegalOpinion(params, riskLevel),
    riskLevel,
    recommendedNextStep: getRecommendedNextStep(params.documentType),
    recommendedActions: getRecommendedActions(params.documentType),
    legalFoundations: getLegalFoundations(params.documentType),
    keyFactsUsed: getKeyFactsUsed(params),
    uncertainties: getUncertainties(params),
    confidenceScore,
    disclaimer: DEFAULT_DISCLAIMER,
    generatedAt,
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

export function buildHeliosOpinionContract(params: BuildHeliosOpinionParams): HeliosOpinionContract {
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
