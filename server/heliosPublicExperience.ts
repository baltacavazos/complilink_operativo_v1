import { createHmac, timingSafeEqual } from "node:crypto";

import { ENV } from "./_core/env";
import {
  buildPreliminaryLaborAnalysis,
  classifyMexicanLaborDocument,
  getHeliosDocumentState,
} from "./caseContracts";
import { buildHeliosOpinion, type HeliosOpinion } from "./heliosIntegrationService";

const GUEST_PREVIEW_TTL_MS = 45 * 60 * 1000;
const GUEST_PREVIEW_VERSION = 1;
const PUBLIC_HOME_TENANT_ID = "public-home";
const PUBLIC_HOME_CASE_ID = "PUBLIC-HOME";

type GuestPreviewClassification = ReturnType<typeof classifyMexicanLaborDocument>;
type GuestPreviewPreliminaryAnalysis = ReturnType<typeof buildPreliminaryLaborAnalysis>;

export type GuestPreviewTokenPayload = {
  version: number;
  guestPreviewId: string;
  traceId: string;
  createdAt: string;
  expiresAt: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  storageUrl: string;
  expectedDocumentType: string | null;
  captureMode: string | null;
  sourceChannel: "manual" | "email" | "api" | "bulk_import";
  classification: GuestPreviewClassification;
  preliminaryAnalysis: GuestPreviewPreliminaryAnalysis;
  scanAssistance: unknown;
  previewOpinion: HeliosOpinion;
};

export type PublicHeliosHomeExample = {
  id: string;
  badge: string;
  documentLabel: string;
  title: string;
  summary: string;
  nextStep: string;
  primaryConcern: string;
};

function getSigningSecret() {
  return ENV.auditapatronEngineHmacSecret || ENV.cookieSecret || "guest-preview-fallback-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signEncodedPayload(encodedPayload: string) {
  return createHmac("sha256", getSigningSecret()).update(encodedPayload).digest("base64url");
}

export function createGuestPreviewToken(payload: Omit<GuestPreviewTokenPayload, "version" | "expiresAt"> & { expiresAt?: string }) {
  const fullPayload: GuestPreviewTokenPayload = {
    ...payload,
    version: GUEST_PREVIEW_VERSION,
    expiresAt: payload.expiresAt ?? new Date(Date.now() + GUEST_PREVIEW_TTL_MS).toISOString(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = signEncodedPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readGuestPreviewToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("La vista previa temporal ya no es válida. Súbela otra vez para continuar.");
  }

  const expectedSignature = signEncodedPayload(encodedPayload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new Error("La vista previa temporal no pasó la validación de seguridad. Súbela otra vez.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as GuestPreviewTokenPayload;
  if (payload.version !== GUEST_PREVIEW_VERSION) {
    throw new Error("La vista previa temporal pertenece a una versión no compatible. Súbela otra vez.");
  }

  const expiresAt = new Date(payload.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    throw new Error("La vista previa temporal expiró por seguridad. Súbela otra vez para continuar.");
  }

  return payload;
}

export function buildGuestPreviewOpinion(params: {
  guestPreviewId: string;
  traceId: string;
  fileName: string;
  classification: GuestPreviewClassification;
  preliminaryAnalysis: GuestPreviewPreliminaryAnalysis;
}) {
  return buildHeliosOpinion({
    tenantId: "guest-preview",
    caseId: params.guestPreviewId,
    traceId: params.traceId,
    documentId: params.guestPreviewId,
    documentType: params.classification.documentType,
    documentName: params.fileName,
    jurisdiction: "México",
    caseTitle: "Vista previa temporal Helios",
    preliminaryAnalysis: {
      confirmedData: params.preliminaryAnalysis.confirmedData,
      estimatedData: params.preliminaryAnalysis.estimatedData,
      guardrails: params.preliminaryAnalysis.guardrails,
    },
  });
}

export function buildPublicHeliosHomeExamples(): PublicHeliosHomeExample[] {
  const scenarios = [
    {
      id: "public-payroll",
      badge: "Lectura Helios · recibo de nómina",
      fileName: "recibo_nomina_abril.pdf",
      mimeType: "application/pdf",
    },
    {
      id: "public-cfdi",
      badge: "Lectura Helios · CFDI de nómina",
      fileName: "cfdi_nomina_marzo.xml",
      mimeType: "application/xml",
    },
    {
      id: "public-contract",
      badge: "Lectura Helios · contrato laboral",
      fileName: "contrato_laboral_ingreso.pdf",
      mimeType: "application/pdf",
    },
  ] as const;

  return scenarios.map((scenario, index) => {
    const classification = classifyMexicanLaborDocument({
      fileName: scenario.fileName,
      mimeType: scenario.mimeType,
    });
    const preliminaryAnalysis = buildPreliminaryLaborAnalysis({
      fileName: scenario.fileName,
      mimeType: scenario.mimeType,
      classification,
    });
    const opinion = buildHeliosOpinion({
      tenantId: PUBLIC_HOME_TENANT_ID,
      caseId: `${PUBLIC_HOME_CASE_ID}-${index + 1}`,
      traceId: `PUBLIC-HOME-TRACE-${index + 1}`,
      documentId: `DOC-PUBLIC-HOME-${index + 1}`,
      documentType: classification.documentType,
      documentName: scenario.fileName,
      jurisdiction: "México",
      caseTitle: "Ejemplo público Helios",
      preliminaryAnalysis: {
        confirmedData: preliminaryAnalysis.confirmedData,
        estimatedData: preliminaryAnalysis.estimatedData,
        guardrails: preliminaryAnalysis.guardrails,
      },
    });
    const documentState = getHeliosDocumentState({
      documentType: classification.documentType,
      hasOpinion: true,
      processedAt: opinion.generatedAt,
    });

    return {
      id: scenario.id,
      badge: scenario.badge,
      documentLabel: documentState.canonicalLabel,
      title: opinion.resultCard?.headline ?? opinion.summary,
      summary: opinion.summary,
      nextStep: opinion.resultCard?.nextStepSummary ?? opinion.recommendedNextStep ?? "Continúa con el siguiente documento útil sugerido por Helios.",
      primaryConcern: opinion.legalHighlights?.primaryConcern ?? opinion.summary,
    };
  });
}
