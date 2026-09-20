import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADVISOR_MEMORY_MODEL, parseAdvisorMemoryLlmPayload } from "@shared/advisorMemory";
import { invokeLLM } from "./_core/llm";
import {
  ADVISOR_MEMORY_SYSTEM_PROMPT,
  buildFallbackAdvisorMemory,
  summarizeAdvisorCaseMemory,
} from "./advisorMemory";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

describe("summarizeAdvisorCaseMemory", () => {
  beforeEach(() => {
    vi.mocked(invokeLLM).mockReset();
  });

  it("pide el resumen a gpt-6-astra y no cae a un mini", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              greeting: "Hola de nuevo, María. Seguimos con tu caso frente a Empresa Norte.",
              highlights: ["Ya vimos el contrato"],
              documentsDiscussed: ["contrato_maria.pdf"],
              risksFlagged: ["Falta contrastar el salario"],
              nextSteps: ["Subir el recibo"],
            }),
          },
        },
      ],
    } as never);

    const memory = await summarizeAdvisorCaseMemory({
      scope: { tenantId: "tenant-a", caseId: "CASE-A", userId: 7 },
      employeeName: "María López",
      employerEntity: "Empresa Norte",
      prompt: "¿Qué riesgo ves?",
      answer: "En tu contrato falta contrastar el salario.",
      visibleDocuments: [{ originalName: "contrato_maria.pdf", documentType: "contract" }],
    });

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: ADVISOR_MEMORY_MODEL,
        responseFormat: { type: "json_object" },
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: ADVISOR_MEMORY_SYSTEM_PROMPT,
          }),
        ]),
      }),
    );
    const payload = vi.mocked(invokeLLM).mock.calls[0]?.[0] as { model?: string };
    expect(payload.model).toBe("gpt-6-astra");
    expect(payload.model).not.toMatch(/mini/i);
    expect(memory.modelUsed).toBe("gpt-6-astra");
    expect(memory.greeting).toContain("María");
    expect(memory.greeting).not.toMatch(/Helios/i);
    expect(memory.highlights).toContain("Ya vimos el contrato");
  });

  it("si el modelo falla, conserva una memoria local del mismo expediente", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("llm_unavailable"));

    const memory = buildFallbackAdvisorMemory({
      scope: { tenantId: "tenant-a", caseId: "CASE-A", userId: 7 },
      employeeName: "María López",
      employerEntity: "Empresa Norte",
      prompt: "¿Qué me conviene subir?",
      answer: "Te conviene subir el CFDI.",
      visibleDocuments: [{ originalName: "contrato.pdf" }],
    });
    const summarized = await summarizeAdvisorCaseMemory({
      previous: memory,
      scope: { tenantId: "tenant-a", caseId: "CASE-A", userId: 7 },
      employeeName: "María López",
      employerEntity: "Empresa Norte",
      prompt: "¿Y el CFDI?",
      answer: "El CFDI sirve para comparar lo timbrado.",
    });

    expect(summarized.caseId).toBe("CASE-A");
    expect(summarized.tenantId).toBe("tenant-a");
    expect(summarized.recentTurns.some((turn) => turn.content.includes("¿Y el CFDI?"))).toBe(true);
    expect(summarized.modelUsed).toBe(ADVISOR_MEMORY_MODEL);
    expect(parseAdvisorMemoryLlmPayload("no-json")).toBeNull();
  });
});
