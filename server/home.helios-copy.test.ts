import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sanitizeClientVisibleCopy } from "../client/src/lib/clientVisibleCopy";
import { toPlainWorkerLandingCopy } from "@shared/plainWorkerCopy";
import { getHeliosDocumentState, getHeliosExpedienteStage } from "./caseContracts";
import { buildHeliosOpinion } from "./heliosIntegrationService";
import { buildPublicHeliosHomeExamples } from "./heliosPublicExperience";

const FORBIDDEN_LIVE_PHRASE =
  "Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar";

function collectHomeVisibleStringLiterals(source: string) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  return [...withoutComments.matchAll(/(["'`])([^"'`\n]{8,400})\1/g)]
    .map((match) => match[2])
    .filter((text) => /\s/.test(text) && /[A-ZÁÉÍÓÚÑáéíóúñ]/.test(text))
    .join("\n");
}

function collectHomeRenderedCopy() {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const examples = buildPublicHeliosHomeExamples().map((example) => ({
    badge: toPlainWorkerLandingCopy(sanitizeClientVisibleCopy(example.badge) ?? example.badge),
    title: toPlainWorkerLandingCopy(sanitizeClientVisibleCopy(example.title) ?? example.title),
    summary: toPlainWorkerLandingCopy(sanitizeClientVisibleCopy(example.summary) ?? example.summary),
    nextStep: toPlainWorkerLandingCopy(sanitizeClientVisibleCopy(example.nextStep) ?? example.nextStep),
    primaryConcern: toPlainWorkerLandingCopy(
      sanitizeClientVisibleCopy(example.primaryConcern) ?? example.primaryConcern,
    ),
  }));
  const latestCaseSummaries = [
    getHeliosExpedienteStage({ caseStatus: "draft", documentsCount: 0, documentsWithOpinion: 0 }),
    getHeliosExpedienteStage({ caseStatus: "analysis", documentsCount: 2, documentsWithOpinion: 0 }),
    getHeliosExpedienteStage({
      caseStatus: "conciliation",
      documentsCount: 2,
      documentsWithOpinion: 1,
    }),
    getHeliosExpedienteStage({ caseStatus: "resolved", documentsCount: 2, documentsWithOpinion: 1 }),
  ].map((stage) =>
    toPlainWorkerLandingCopy(sanitizeClientVisibleCopy(stage.summary) ?? stage.summary),
  );

  const featuredExample = examples[0];

  return [
    collectHomeVisibleStringLiterals(homeSource),
    featuredExample?.title,
    featuredExample?.summary,
    featuredExample?.primaryConcern,
    featuredExample?.nextStep,
    ...examples.flatMap((example) => [
      example.badge,
      example.title,
      example.summary,
      example.nextStep,
      example.primaryConcern,
    ]),
    ...latestCaseSummaries,
  ]
    .filter(Boolean)
    .join("\n");
}

describe("Home · copy visible sin Helios", () => {
  it("no deja la frase exacta de Helios en el copy que Home renderiza", () => {
    const rendered = collectHomeRenderedCopy();

    expect(rendered).not.toContain(FORBIDDEN_LIVE_PHRASE);
    expect(rendered).not.toMatch(/\bHelios\b/);
    expect(rendered).not.toMatch(/\bhelios\b/i);
    expect(rendered).not.toMatch(/expediente/i);
  });

  it("el payload de ejemplos y la etapa del expediente ya salen limpios antes del sanitizador", () => {
    const examples = buildPublicHeliosHomeExamples();
    const recommendation = getHeliosExpedienteStage({
      caseStatus: "conciliation",
      documentsCount: 2,
      documentsWithOpinion: 1,
    });
    const documentState = getHeliosDocumentState({
      documentType: "payroll_receipt",
      hasOpinion: true,
    });
    const opinion = buildHeliosOpinion({
      tenantId: "public-home",
      caseId: "PUBLIC-HOME-1",
      traceId: "PUBLIC-HOME-TRACE-1",
      documentId: "DOC-PUBLIC-HOME-1",
      documentType: "payroll_receipt",
      documentName: "recibo_nomina_abril.pdf",
    });

    for (const example of examples) {
      const surface = [example.title, example.summary, example.nextStep, example.primaryConcern, example.badge].join(
        "\n",
      );
      expect(surface).not.toContain(FORBIDDEN_LIVE_PHRASE);
      expect(surface).not.toMatch(/\bHelios\b/);
      expect(surface).not.toMatch(/expediente/i);
    }

    expect(recommendation.summary).not.toContain(FORBIDDEN_LIVE_PHRASE);
    expect(recommendation.summary).not.toMatch(/\bHelios\b/);
    expect(documentState.summary).not.toMatch(/\bHelios\b/);
    expect(JSON.stringify(opinion)).not.toMatch(/\bHelios\b/);
  });

  it("Home sanitiza ejemplos, demo y latestCase para que una frase cruda no se vea", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

    expect(homeSource).toContain("sanitizeHomeVisibleCopy(example.badge)");
    expect(homeSource).toContain("sanitizeHomeVisibleCopy(example.title)");
    expect(homeSource).toContain("sanitizeHomeVisibleCopy(example.summary)");
    expect(homeSource).toContain("sanitizeHomeVisibleCopy(example.nextStep)");
    expect(homeSource).toContain("sanitizeHomeVisibleCopy(example.primaryConcern)");
    expect(homeSource).toContain("sanitizeHomeVisibleCopy(homeSnapshotQuery.data.latestCase.summary)");
    expect(homeSource).not.toContain(FORBIDDEN_LIVE_PHRASE);
    expect(
      sanitizeClientVisibleCopy(
        "Helios ya conectó documentos del expediente y está devolviendo una lectura preliminar con señales y siguientes pasos útiles.",
      ),
    ).not.toMatch(/\bHelios\b/);
  });
});
