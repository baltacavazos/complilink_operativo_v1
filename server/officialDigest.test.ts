import { afterEach, describe, expect, it, vi } from "vitest";

import { OFFICIAL_DIGEST_BLOCKED_COPY, SCJN_HARVEST_SEED } from "@shared/officialDigest";
import { collectLiveOfficialCitations, resolveOfficialDigest } from "./officialDigest";

describe("official digest live + last_good", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("si Incapsula bloquea la Corte, usa el harvest y no inventa IUS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: false,
          status: 403,
          text: async () =>
            "<html><head><script src='/_Incapsula_Resource?SWJIYLWA=1'></script></head></html>",
        };
      }),
    );

    const live = await collectLiveOfficialCitations();
    expect(live.liveAttempted).toBe(true);
    expect(live.liveBlocked).toBe(true);
    expect(live.citations).toEqual([]);

    const digest = await resolveOfficialDigest(
      { prompt: "¿Qué dice la Corte sobre el ofrecimiento de trabajo?" },
      { live: true },
    );
    expect(digest.liveBlocked).toBe(true);
    expect(digest.freshness).toBe("last_good");
    expect(digest.citations.some((item) => item.officialId === "2032614")).toBe(true);
    expect(digest.citations.every((item) => SCJN_HARVEST_SEED.some((seed) => seed.officialId === item.officialId) || /^\d+$/.test(item.officialId))).toBe(true);
    expect(digest.citations.some((item) => item.officialId === "9999999")).toBe(false);
    expect(digest.honestyNote).toMatch(/consulta anterior|no pude abrir/i);
  });

  it("si SIDOF responde, solo guarda títulos y códigos que vengan de la nota", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("buscarNotas/titulo")) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                messageCode: 200,
                Notas: [
                  {
                    codNota: 5616745,
                    fecha: "23-04-2021",
                    titulo:
                      "Decreto por el que se reforman, adicionan y derogan diversas disposiciones de la Ley Federal del Trabajo en materia de Subcontratación Laboral.",
                  },
                  {
                    codNota: 4560546,
                    fecha: "28-01-1985",
                    titulo: "CONVOCATORIA para que las organizaciones obreras elijan a sus repsesentantes",
                  },
                ],
              }),
          };
        }
        return {
          ok: false,
          status: 403,
          text: async () => "<html>_Incapsula_Resource</html>",
        };
      }),
    );

    const live = await collectLiveOfficialCitations();
    expect(live.liveBlocked).toBe(false);
    expect(live.citations.some((item) => item.officialId === "5616745")).toBe(true);
    expect(live.citations.some((item) => item.officialId === "4560546")).toBe(false);
    expect(live.citations.find((item) => item.officialId === "5616745")?.title).toMatch(
      /Subcontratación Laboral/,
    );
  });

  it("en una pregunta de IMSS del recibo no consulta ni adjunta el digest oficial", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const digest = await resolveOfficialDigest(
      {
        prompt: "¿Me descontaron IMSS?",
        documentType: "payroll_receipt",
        hasImssSignal: true,
      },
      { live: true },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(digest.citations).toEqual([]);
    expect(digest.honestyNote).toBeNull();
    expect(digest.liveAttempted).toBe(false);
  });

  it("en modo semilla, una pregunta legal bloqueada sin candidatos dice la verdad", async () => {
    const digest = await resolveOfficialDigest(
      { prompt: "¿Qué dice la jurisprudencia inventada 45/2099?" },
      { live: false },
    );
    expect(digest.citations.every((item) => item.officialId !== "45")).toBe(true);
    if (digest.citations.length === 0) {
      expect(digest.honestyNote === null || digest.honestyNote === OFFICIAL_DIGEST_BLOCKED_COPY).toBe(
        true,
      );
    }
  });
});
