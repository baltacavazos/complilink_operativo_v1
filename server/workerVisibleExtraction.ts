const WORKER_SYSTEM_FIELD_KEYS = new Set([
  "filename",
  "mimetype",
  "internaldocumenttype",
  "normalizeddoctype",
  "processingprofile",
  "structuredextractionready",
  "benefittestimationready",
  "hasinfonavitsignal",
  "infonavitdeductiontype",
  "liveimssvalidation",
  "validationsource",
  "validationmode",
  "readyforsharedengine",
  "sourcechannel",
  "sourceModule",
  "sourcemodule",
  "sha256",
  "eventid",
  "eventkey",
  "eventname",
  "complilinkid",
  "correlationid",
  "dispatchid",
  "traceid",
  "engine",
  "helios",
  "webhookpath",
  "responsecontract",
]);

const WORKER_SYSTEM_LABEL =
  /^(archivo|formato|tipo de documento|detalle detectado|nivel de revisi[oó]n|puede leer detalles|puede estimar prestaciones)$/i;

const WORKER_INTERNAL_VALUE =
  /^(application\/[a-z0-9.+-]+|image\/[a-z0-9.+-]+|text\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|multipart\/[a-z0-9.+-]+|other|expanded|standard|contract[_-]?deep[_-]?dive|payroll[_-]?receipt|cfdi|imss|contract|settlement|evidence|true|false|document\.(uploaded|processed\.v1|rejected\.v1|retry_requested\.v1)|hmac-sha256:[a-f0-9]+|[a-f0-9]{64})$/i;

const WORKER_FIELD_LABELS: Record<string, string> = {
  employerRfc: "RFC visible",
  workerRfc: "RFC de la persona trabajadora",
  period: "Periodo visible",
  apparentAmount: "Monto visible",
  apparentEffectiveDate: "Fecha visible",
  contractDailySalary: "Salario diario detectado en contrato",
  socialSecurityBaseSalary: "SBC visible en el comprobante",
  integratedDailySalary: "SDI visible en el comprobante",
  workerName: "Nombre visible de la persona trabajadora",
  employerName: "Nombre visible del patrón o empresa",
  jobTitle: "Puesto visible",
  payrollEmployerName: "Nombre visible de la empresa",
  payrollPeriod: "Periodo de pago visible",
  payrollNetAmount: "Pago neto visible",
  payrollPerceptions: "Total de percepciones",
  payrollDeductions: "Total de deducciones",
  payrollNss: "NSS visible en el comprobante",
  payrollEmployerRegistration: "Registro patronal visible",
  isrWithheld: "Retención de ISR visible",
  imssWithheld: "Retención de IMSS visible",
  infonavitWithheld: "Descuento Infonavit visible",
};

function compactKey(value?: string | null) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function isWorkerSystemStructuredField(params: {
  key?: string;
  label?: string;
  value?: unknown;
}) {
  const key = compactKey(params.key);
  if (WORKER_SYSTEM_FIELD_KEYS.has(key)) {
    return true;
  }

  const label = (params.label ?? "").replace(/\s+/g, " ").trim();
  if (WORKER_SYSTEM_LABEL.test(label)) {
    return true;
  }

  const value = String(params.value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return WORKER_INTERNAL_VALUE.test(value);
}

export function humanizeStructuredFieldLabel(key: string) {
  if (WORKER_FIELD_LABELS[key]) {
    return WORKER_FIELD_LABELS[key];
  }

  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

export function humanizeMissingExtractionTarget(target: string) {
  const normalized = target.replace(/\s+/g, " ").trim();
  const compact = compactKey(normalized);

  if (compact === "infonavit") return "descuento o referencia de Infonavit";
  if (compact === "imss" || compact === "nss") return "NSS o retención de IMSS";
  if (compact === "isr" || compact === "impuestosobrelarenta") return "retención de ISR";
  if (compact === "rfcpatron" || compact === "rfcempleador") return "RFC del patrón";
  if (compact === "rfctrabajador") return "RFC de la persona trabajadora";
  if (compact === "periodo") return "periodo de pago";
  if (compact === "salario") return "salario o monto visible";
  if (compact === "percepciones") return "total de percepciones";
  if (compact === "deducciones") return "total de deducciones";

  return normalized;
}
