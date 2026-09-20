import { describe, expect, it } from "vitest";

import {
  ADVISOR_MEMORY_MODEL,
  buildAdvisorGreeting,
  buildAdvisorMemoryScopeKey,
  buildAsesorContinuityIntro,
  createScopedAdvisorMemoryStore,
  formatAdvisorMemoryForPrompt,
  mergeAdvisorMemory,
  parseAdvisorMemoryLlmPayload,
  resolveAdvisorMemoryModel,
  scopesShareAdvisorMemory,
} from "./advisorMemory";

const caseA = {
  tenantId: "tenant-a",
  caseId: "CASE-A",
  userId: 7,
};

const caseB = {
  tenantId: "tenant-b",
  caseId: "CASE-B",
  userId: 7,
};

describe("advisor memory scope", () => {
  it("isola la memoria del caso A respecto del caso B y no cruza tenants", () => {
    const store = createScopedAdvisorMemoryStore();
    const memoryA = mergeAdvisorMemory({
      scope: caseA,
      employeeName: "María López",
      employerEntity: "Empresa Norte",
      prompt: "¿Qué riesgo ves en mi contrato?",
      answer: "En tu contrato con Empresa Norte falta contrastar el salario.",
      draft: {
        highlights: ["El contrato no deja claro el salario pagado"],
        documentsDiscussed: ["contrato_maria.pdf"],
        risksFlagged: ["Posible diferencia de salario"],
        nextSteps: ["Subir el recibo del mismo periodo"],
      },
    });
    const memoryB = mergeAdvisorMemory({
      scope: caseB,
      employeeName: "Juan Pérez",
      employerEntity: "Taller Sur",
      prompt: "¿Qué dice mi recibo?",
      answer: "En tu recibo de Taller Sur se ve un descuento de IMSS.",
      draft: {
        highlights: ["El recibo muestra descuento IMSS"],
        documentsDiscussed: ["recibo_juan.pdf"],
        risksFlagged: ["Falta constancia de semanas"],
        nextSteps: ["Subir un papel del IMSS"],
      },
    });

    store.upsert(memoryA);
    store.upsert(memoryB);

    expect(buildAdvisorMemoryScopeKey(caseA)).not.toBe(buildAdvisorMemoryScopeKey(caseB));
    expect(scopesShareAdvisorMemory(caseA, caseB)).toBe(false);
    expect(store.get(caseA)?.highlights).toContain("El contrato no deja claro el salario pagado");
    expect(store.get(caseA)?.documentsDiscussed.join(" ")).not.toMatch(/recibo_juan|Taller Sur/i);
    expect(store.get(caseB)?.highlights).toContain("El recibo muestra descuento IMSS");
    expect(store.get(caseB)?.documentsDiscussed.join(" ")).not.toMatch(/contrato_maria|Empresa Norte/i);
    expect(formatAdvisorMemoryForPrompt(store.get(caseA)).highlights).not.toEqual(
      formatAdvisorMemoryForPrompt(store.get(caseB)).highlights,
    );
  });

  it("al recargar el mismo alcance sigue trayendo la memoria previa", () => {
    const store = createScopedAdvisorMemoryStore();
    const saved = mergeAdvisorMemory({
      scope: caseA,
      employeeName: "María López",
      employerEntity: "Empresa Norte",
      prompt: "¿Qué me conviene subir?",
      answer: "Te conviene subir el CFDI del mismo periodo.",
      draft: {
        greeting: "Hola de nuevo, María. Seguimos con tu caso frente a Empresa Norte.",
        highlights: ["Hace falta el CFDI"],
        nextSteps: ["Subir el CFDI"],
      },
    });
    store.upsert(saved);

    const reloaded = store.get({
      tenantId: "tenant-a",
      caseId: "CASE-A",
      userId: 7,
    });

    expect(reloaded?.greeting).toContain("Hola de nuevo, María");
    expect(reloaded?.greeting).toContain("Empresa Norte");
    expect(reloaded?.highlights).toContain("Hace falta el CFDI");
    expect(reloaded?.recentTurns.map((turn) => turn.content).join(" ")).toContain(
      "¿Qué me conviene subir?",
    );
  });
});

describe("advisor memory voice and model", () => {
  it("nunca usa un modelo mini para resumir memoria", () => {
    expect(resolveAdvisorMemoryModel()).toBe(ADVISOR_MEMORY_MODEL);
    expect(resolveAdvisorMemoryModel("gpt-4o-mini")).toBe(ADVISOR_MEMORY_MODEL);
    expect(resolveAdvisorMemoryModel("o4-mini")).toBe(ADVISOR_MEMORY_MODEL);
    expect(ADVISOR_MEMORY_MODEL).toBe("gpt-6-astra");
    expect(ADVISOR_MEMORY_MODEL).not.toMatch(/mini/i);
  });

  it("saluda en español cálido, caso primero y sin Helios", () => {
    const greeting = buildAdvisorGreeting({
      employeeName: "María López",
      employerEntity: "Empresa Norte",
      documentsDiscussed: ["tu contrato"],
      risksFlagged: ["una diferencia de salario"],
      nextSteps: ["subir el recibo"],
    });
    expect(greeting).toMatch(/Hola de nuevo, María/);
    expect(greeting).toContain("Empresa Norte");
    expect(greeting).not.toMatch(/Helios|CompliLink|GPT|mini/i);

    const intro = buildAsesorContinuityIntro({
      memoryGreeting: greeting,
      documentsCount: 2,
    });
    expect(intro).toBe(greeting);
  });

  it("parsea el resumen del modelo y descarta ruido técnico", () => {
    const parsed = parseAdvisorMemoryLlmPayload(`
      {
        "greeting": "Hola de nuevo, María. Seguimos con tu caso frente a Empresa Norte.",
        "highlights": ["El contrato no fija el salario"],
        "documentsDiscussed": ["contrato"],
        "risksFlagged": ["Posible diferencia de pago"],
        "nextSteps": ["Subir el recibo"]
      }
    `);
    expect(parsed?.greeting).toContain("María");
    expect(parsed?.highlights?.[0]).toContain("salario");
  });
});
