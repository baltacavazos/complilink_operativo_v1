import { describe, expect, it } from "vitest";
import { resolveWorkerPrivacySignal } from "./privacySignal";

describe("privacidad cuando ya hay resultado", () => {
  it("no dice «mientras analizamos» si la consulta ya existe", () => {
    const signal = resolveWorkerPrivacySignal({
      pendingDraft: false,
      analyzing: true,
      saved: true,
      officialResultReady: true,
    });

    expect(signal.ready).toBe(true);
    expect(signal.title).toBe("Tu empresa no ve esto.");
    expect(signal.detail).not.toMatch(/mientras analizamos/);
    expect(JSON.stringify(signal)).not.toMatch(/mientras analizamos/);
  });

  it("mientras no hay resultado, el análisis sigue protegido", () => {
    const signal = resolveWorkerPrivacySignal({
      pendingDraft: false,
      analyzing: true,
      saved: false,
      officialResultReady: false,
    });

    expect(signal.ready).toBe(false);
    expect(signal.title).toBe("Privacidad activa mientras analizamos");
  });
});
