import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import {
  applyEngineDispatchToHeliosOpinionContract,
  buildHeliosOpinionContract,
  buildRemoteHeliosOpinionContract,
  getHeliosIntegrationMode,
  hasRemoteHeliosBridgeConfigured,
} from "./heliosIntegrationService";

const originalWebhookUrl = ENV.auditapatronEngineWebhookUrl;

function buildParams() {
  return {
    tenantId: "tenant-001",
    caseId: "CASE-001",
    traceId: "trace-001",
    documentId: "DOC-001",
    documentType: "payroll_receipt",
    documentName: "recibo.pdf",
    jurisdiction: "México",
    caseTitle: "Auditoría inicial",
    preliminaryAnalysis: {
      confirmedData: {
        period: "marzo 2026",
        apparentAmount: "$8,400.00",
      },
      estimatedData: {},
      guardrails: [],
    },
  };
}

afterEach(() => {
  ENV.auditapatronEngineWebhookUrl = originalWebhookUrl;
});

describe("heliosIntegrationService mock vs remote", () => {
  it("usa plantilla local mock cuando no hay URL de webhook", () => {
    ENV.auditapatronEngineWebhookUrl = "";

    expect(hasRemoteHeliosBridgeConfigured()).toBe(false);
    expect(getHeliosIntegrationMode()).toBe("mock");

    const contract = buildHeliosOpinionContract(buildParams());
    expect(contract.mode).toBe("mock");
    expect(contract.status).toBe("completed");
    expect(contract.opinion.legalOpinion.length).toBeGreaterThan(20);
    expect(contract.opinion.confidenceScore).toBeGreaterThan(0);
    expect(contract.opinion.disclaimer).toMatch(/revisión local/i);
    expect(contract.opinion.disclaimer).toMatch(/no consulta IMSS/i);
    expect(contract.opinion.disclaimer).not.toMatch(/Helios|CompliLink|mock/i);
    expect(contract.opinion.resultCard.signalsChecked.join(" ")).toMatch(/revisión local/i);
  });

  it("queda en remoto pendiente cuando hay URL y el despacho sí se envió", () => {
    ENV.auditapatronEngineWebhookUrl = "https://engine.example/api/auditapatron/webhook";

    expect(hasRemoteHeliosBridgeConfigured()).toBe(true);
    expect(getHeliosIntegrationMode()).toBe("remote");

    const pending = buildHeliosOpinionContract(buildParams());
    expect(pending.mode).toBe("remote");
    expect(pending.status).toBe("processing");

    const afterSent = applyEngineDispatchToHeliosOpinionContract(pending, { status: "sent" });
    expect(afterSent).toBe(pending);
    expect(afterSent.status).toBe("processing");
  });

  it("no inventa dictamen si el puente remoto falla", () => {
    ENV.auditapatronEngineWebhookUrl = "https://engine.example/api/auditapatron/webhook";

    const pending = buildHeliosOpinionContract(buildParams());
    const failed = applyEngineDispatchToHeliosOpinionContract(pending, {
      status: "failed",
      reason: "upstream_5xx",
    });

    expect(failed.status).toBe("error");
    expect(failed.mode).toBe("remote");
    expect(failed.opinion.confidenceScore).toBe(0);
    expect(failed.opinion.legalFoundations).toEqual([]);
    expect(failed.opinion.legalOpinion).toMatch(/no hay una opinión jurídica/i);
    expect(failed.opinion.legalOpinion).not.toMatch(/Helios|CompliLink|webhook/i);
    expect(failed.opinion.summary).not.toMatch(/Helios|CompliLink|webhook/i);
    expect(failed.opinion.resultCard.headline).toMatch(/no pudimos completar/i);
  });

  it("tampoco inventa dictamen si falta el secreto HMAC con URL remota", () => {
    ENV.auditapatronEngineWebhookUrl = "https://engine.example/api/auditapatron/webhook";

    const pending = buildHeliosOpinionContract(buildParams());
    const failed = applyEngineDispatchToHeliosOpinionContract(pending, {
      status: "skipped",
      reason: "engine_not_configured",
    });

    expect(failed.status).toBe("error");
    expect(failed.opinion.legalFoundations).toEqual([]);
  });

  it("deja intacto un skip de aislamiento de tests", () => {
    ENV.auditapatronEngineWebhookUrl = "https://engine.example/api/auditapatron/webhook";

    const pending = buildHeliosOpinionContract(buildParams());
    const unchanged = applyEngineDispatchToHeliosOpinionContract(pending, {
      status: "skipped",
      reason: "isolated_vitest_workflow",
    });

    expect(unchanged).toBe(pending);
    expect(unchanged.status).toBe("processing");
  });

  it("cuando el cerebro remoto sí devuelve opinión, la usa y no filtra campos de sistema", () => {
    const remote = buildRemoteHeliosOpinionContract({
      tenantId: "tenant-001",
      caseId: "CASE-001",
      traceId: "trace-001",
      documentId: "DOC-001",
      documentType: "cfdi",
      documentName: "nomina.xml",
      remotePayload: {
        contractSummary: "El recibo ya tiene periodo, RFC y retenciones visibles.",
        analysisResults: {
          legalOpinion: "Ya hay una lectura consolidada del CFDI para contrastar pagos y descuentos.",
          nextStep: "Compara este CFDI con el recibo del mismo periodo.",
        },
        extractedFields: {
          payrollPeriod: "2026-05-01 al 2026-05-15",
          employerRfc: "ECC190605VA1",
          mimeType: "application/xml",
          processingProfile: "expanded",
        },
        confidenceScore: 90,
      },
    });

    expect(remote.mode).toBe("remote");
    expect(remote.opinion.mode).toBe("remote");
    expect(remote.opinion.status).toBe("completed");
    expect(remote.opinion.legalOpinion).toMatch(/lectura consolidada/i);
    expect(remote.opinion.resultCard.keyFindings.map((item) => item.label).join(" ")).toMatch(/periodo|rfc/i);
    expect(remote.opinion.resultCard.keyFindings.map((item) => `${item.label} ${item.value}`).join(" ")).not.toMatch(
      /application\/xml|expanded|mimeType/i,
    );
    expect(remote.opinion.disclaimer).toMatch(/no consulta IMSS/i);
    expect(remote.opinion.disclaimer).not.toMatch(/Helios|CompliLink/i);
  });
});
