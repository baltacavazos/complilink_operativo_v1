import { afterEach, describe, expect, it, vi } from "vitest";
import { DOCUMENT_SIGNAL_DISCLAIMER } from "./laborFiscalSignals";
import {
  applyLaborFiscalNarrativeToOpinion,
  buildDeterministicLaborFiscalNarrative,
  pickLaborFiscalNarrativeProvider,
  prependNarrativeExplanations,
  resolveLaborFiscalNarrative,
  sanitizeLaborFiscalNarrativeText,
  shouldAttemptLocalNarrativeAi,
} from "./laborFiscalNarrative";

const FACTS = {
  period: "2026-05-01 al 2026-05-15",
  netAmount: "$4,725.60",
  perceptions: "$4,725.60",
  deductions: "$0.00",
  employerRfc: "ECC190605VA1",
  workerRfc: "XOXX010101000",
  nss: "84129214965",
  employerRegistration: "R1379389106",
  isrWithheld: "$0.00",
  imssWithheld: "$0.00",
  infonavitWithheld: null,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("laborFiscalNarrative", () => {
  it("arma un siguiente paso determinista con periodo, neto, RFC y NSS sin fingir portal", () => {
    const narrative = buildDeterministicLaborFiscalNarrative(FACTS, "cfdi");

    expect(narrative.source).toBe("deterministic");
    expect(narrative.liveOfficialValidation).toBe(false);
    expect(narrative.nextStep).toMatch(/2026-05-01 al 2026-05-15/);
    expect(narrative.nextStep).toMatch(/\$4,725\.60/);
    expect(narrative.explanation).toMatch(/ECC190605VA1/);
    expect(narrative.explanation).toMatch(/84129214965/);
    expect(narrative.explanation).toContain(DOCUMENT_SIGNAL_DISCLAIMER);
    expect(narrative.concern).toMatch(/no confirma alta/i);
    expect(`${narrative.nextStep} ${narrative.explanation}`).not.toMatch(/Helios|CompliLink|en vivo al IMSS/i);
  });

  it("no intenta IA si faltan claves o si ya hay opinión remota usable", () => {
    expect(pickLaborFiscalNarrativeProvider({})).toBeNull();
    expect(
      shouldAttemptLocalNarrativeAi({
        env: {},
        allowInTests: true,
      }),
    ).toBe(false);
    expect(
      shouldAttemptLocalNarrativeAi({
        env: { OPENAI_API_KEY: "sk-test" },
        preferredOpinion: {
          mode: "remote",
          status: "completed",
          legalOpinion: "Ya hay una lectura consolidada del recibo.",
        },
        allowInTests: true,
      }),
    ).toBe(false);
    expect(
      shouldAttemptLocalNarrativeAi({
        env: { OPENAI_API_KEY: "sk-test" },
        preferredOpinion: { mode: "mock", status: "completed" },
        allowInTests: true,
      }),
    ).toBe(true);
  });

  it("usa una sola respuesta estructurada de OpenAI en la ruta local", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("api.openai.com");
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                nextStep:
                  "Cruza este CFDI del 1 al 15 de mayo con tu recibo o depósito de ese mismo periodo.",
                explanation:
                  "En el papel se lee un neto de $4,725.60, el RFC ECC190605VA1 y el NSS 84129214965. Eso no prueba alta ni entero ante IMSS o SAT.",
                concern: "El NSS visible no confirma semanas cotizadas.",
              }),
            },
          },
        ],
      });
    });

    const narrative = await resolveLaborFiscalNarrative({
      documentType: "cfdi",
      facts: FACTS,
      preferredOpinion: { mode: "mock", status: "completed", summary: "Plantilla local." },
      env: { OPENAI_API_KEY: "sk-test", GEMINI_API_KEY: "gemini-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      allowInTests: true,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/v1/responses");
    const openaiBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(openaiBody.model).toBe("gpt-6-astra");
    expect(openaiBody.model).not.toMatch(/mini/i);
    expect(narrative).toMatchObject({
      source: "ai",
      provider: "openai",
      liveOfficialValidation: false,
    });
    expect(narrative.nextStep).toMatch(/1 al 15 de mayo/i);
    expect(narrative.explanation).toMatch(/\$4,725\.60/);
    expect(narrative.explanation).not.toMatch(/Helios|CompliLink|MIME/i);
  });

  it("cae a Gemini si solo hay GEMINI_API_KEY", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("generativelanguage.googleapis.com");
      return jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    nextStep: "Compara el recibo de mayo con el CFDI del mismo periodo.",
                    explanation:
                      "Se alcanza a leer el periodo y el neto. Esta lectura no consulta SAT ni IMSS en un portal.",
                    concern: "",
                  }),
                },
              ],
            },
          },
        ],
      });
    });

    const narrative = await resolveLaborFiscalNarrative({
      documentType: "payroll_receipt",
      facts: FACTS,
      env: { GEMINI_API_KEY: "gemini-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      allowInTests: true,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("gemini-3.1-pro-preview");
    expect(String(fetchImpl.mock.calls[0]?.[0])).not.toMatch(/flash|lite/i);
    expect(narrative.provider).toBe("gemini");
    expect(narrative.source).toBe("ai");
    expect(narrative.nextStep).toMatch(/recibo de mayo/i);
  });

  it("si faltan claves se queda en la narrativa determinista y no llama al modelo", async () => {
    const fetchImpl = vi.fn();
    const narrative = await resolveLaborFiscalNarrative({
      documentType: "cfdi",
      facts: FACTS,
      env: {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
      allowInTests: true,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(narrative.source).toBe("deterministic");
    expect(narrative.nextStep).toMatch(/2026-05-01 al 2026-05-15/);
  });

  it("si el modelo tarda o falla, conserva las señales deterministas", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });

    const narrative = await resolveLaborFiscalNarrative({
      documentType: "cfdi",
      facts: FACTS,
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 20,
      allowInTests: true,
    });

    expect(narrative.source).toBe("deterministic");
    expect(narrative.liveOfficialValidation).toBe(false);
    expect(narrative.explanation).toContain(DOCUMENT_SIGNAL_DISCLAIMER);
  });

  it("rechaza una respuesta que finge consulta oficial o filtra jerga interna", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                nextStep: "Ya consultamos el portal del IMSS y tu alta está vigente.",
                explanation: "Helios y CompliLink validaron el MIME application/xml ante SAT.",
                concern: "mock",
              }),
            },
          },
        ],
      }),
    );

    const narrative = await resolveLaborFiscalNarrative({
      documentType: "cfdi",
      facts: FACTS,
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      allowInTests: true,
    });

    expect(narrative.source).toBe("deterministic");
    expect(narrative.nextStep).not.toMatch(/consultamos el portal/i);
    expect(sanitizeLaborFiscalNarrativeText("Ya consultamos el portal del IMSS y tu alta está vigente.")).toBeNull();
    expect(sanitizeLaborFiscalNarrativeText("Helios preparó un mock del webhook.")).toBeNull();
    expect(sanitizeLaborFiscalNarrativeText(DOCUMENT_SIGNAL_DISCLAIMER)).toBeTruthy();
  });

  it("prefiere la opinión remota y no llama al modelo", async () => {
    const fetchImpl = vi.fn();
    const narrative = await resolveLaborFiscalNarrative({
      documentType: "cfdi",
      facts: FACTS,
      preferredOpinion: {
        mode: "remote",
        status: "completed",
        summary: "El asesor laboral ya terminó esta lectura.",
        legalOpinion: "Ya hay una lectura consolidada del CFDI para contrastar pagos y descuentos.",
        recommendedNextStep: "Compara este CFDI con el recibo del mismo periodo.",
      },
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      allowInTests: true,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(narrative).toMatchObject({
      source: "remote",
      provider: "remote",
      nextStep: "Compara este CFDI con el recibo del mismo periodo.",
    });
  });

  it("aplica la narrativa al mock local y no pisa una opinión remota usable", () => {
    const local = applyLaborFiscalNarrativeToOpinion(
      {
        mode: "mock",
        status: "completed",
        recommendedNextStep: "Paso genérico.",
        resultCard: {
          nextStepSummary: "Paso genérico.",
          simpleExplanation: [
            { label: "Si quieres más claridad, esto sigue", summary: "Paso genérico.", tone: "neutral" },
          ],
        },
        legalHighlights: { nextActionLabel: "Paso genérico." },
        rawPayload: { preliminaryAnalysis: { confirmedData: { payrollPeriod: FACTS.period } } },
      },
      {
        nextStep: "Cruza el CFDI de mayo con tu depósito.",
        explanation: "Se lee periodo y neto. Esto no consulta IMSS en vivo.",
        concern: "El NSS visible no confirma alta.",
        source: "ai",
        provider: "openai",
        liveOfficialValidation: false,
      },
    );

    expect(local.recommendedNextStep).toBe("Cruza el CFDI de mayo con tu depósito.");
    expect(local.resultCard?.nextStepSummary).toMatch(/NSS visible no confirma alta/);
    expect(local.resultCard?.simpleExplanation?.[0]?.summary).toBe("Cruza el CFDI de mayo con tu depósito.");
    expect(local.rawPayload?.localNarrative).toMatchObject({
      source: "ai",
      provider: "openai",
      liveOfficialValidation: false,
    });

    const remote = applyLaborFiscalNarrativeToOpinion(
      {
        mode: "remote",
        status: "completed",
        legalOpinion: "Lectura remota.",
        recommendedNextStep: "Usa la lectura avanzada.",
        rawPayload: {},
      },
      {
        nextStep: "No deberías ver este texto.",
        explanation: "Texto local.",
        concern: null,
        source: "ai",
        provider: "openai",
        liveOfficialValidation: false,
      },
    );

    expect(remote.recommendedNextStep).toBe("Usa la lectura avanzada.");
  });

  it("antepone el siguiente paso de IA a las explicaciones visibles", () => {
    const merged = prependNarrativeExplanations(
      [
        { label: "Periodo visible", summary: "El periodo es mayo." },
        { label: "Límite de esta lectura", summary: DOCUMENT_SIGNAL_DISCLAIMER },
      ],
      {
        nextStep: "Compara el CFDI con tu recibo de mayo.",
        explanation: "Hay periodo, neto y RFC visibles.",
        concern: null,
        source: "ai",
        provider: "openai",
        liveOfficialValidation: false,
      },
    );

    expect(merged[0]).toMatchObject({ label: "Siguiente paso" });
    expect(merged.at(-1)?.label).toBe("Límite de esta lectura");
    expect(merged.map((item) => `${item.label} ${item.summary}`).join(" ")).not.toMatch(
      /Helios|CompliLink|application\/xml/i,
    );
  });
});
