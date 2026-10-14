import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasForbiddenWorkerChatClaim } from "@shared/workerChatUx";
import {
  checkOfficialSourceHealth,
  clearOfficialWorkerDocumentState,
  inspectPdfEditSigns,
  readOfficialWorkerPdf,
  readRememberedOfficialWorkerReading,
  verifyOfficialDocumentOnline,
} from "./officialWorkerDocument";

describe("lectura del PDF oficial", () => {
  it("marca un PDF con acción automática y no lo da por bueno", async () => {
    clearOfficialWorkerDocumentState();
    const original = readFileSync(new URL("../tests/fixtures/infonavit-micuenta-sintetico.pdf", import.meta.url));
    const binary = Buffer.concat([original, Buffer.from("\n/JavaScript (alert(1))\n")]);
    expect(inspectPdfEditSigns(binary).suspicious).toBe(true);
    const fetchImpl = viFetch(async () => new Response("credito 1234567890 constancia valida", { status: 200 }));
    const reading = await readOfficialWorkerPdf({
      kind: "infonavit",
      binary,
      fetchImpl,
    });
    expect(reading.fuente).toBe("fuente oficial");
    expect(reading.editSuspicious).toBe(true);
    expect(reading.verdict).toBe("no_pudimos_confirmar");
    expect(reading.advisorAnswer).not.toMatch(/\bCumple\./);
    expect(readRememberedOfficialWorkerReading(reading.readingId)?.lines.join(" ")).toContain("1234567890");
    expect(hasForbiddenWorkerChatClaim(reading.advisorAnswer)).toBe(false);
  });

  it("confirma el SAT solo cuando la página oficial trae el mismo RFC", async () => {
    const matched = await verifyOfficialDocumentOnline({
      kind: "sat",
      url: "https://siat.sat.gob.mx/app/qr/faces/pages/mobile/validadorqr.jsf?D3=GOML800101AB1",
      needles: ["GOML800101AB1"],
      fetchImpl: viFetch(async () => new Response("<html>RFC GOML800101AB1 constancia</html>", { status: 200 })),
    });
    expect(matched).toBe("matched");

    const captcha = await verifyOfficialDocumentOnline({
      kind: "sat",
      url: "https://siat.sat.gob.mx/app/qr",
      needles: ["GOML800101AB1"],
      fetchImpl: viFetch(async () => new Response("marca el captcha", { status: 200 })),
    });
    expect(captcha).toBe("captcha");

    const blocked = await verifyOfficialDocumentOnline({
      kind: "sat",
      url: "https://example.com/qr",
      needles: ["GOML800101AB1"],
      fetchImpl: viFetch(async () => {
        throw new Error("no debe llamar");
      }),
    });
    expect(blocked).toBe("not_attempted");
  });

  it("pregunta a las tres páginas oficiales en paralelo y sigue si una falla", async () => {
    clearOfficialWorkerDocumentState();
    let started = 0;
    const fetchImpl = viFetch(async (url) => {
      started += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (String(url).includes("imss")) throw new Error("caído");
      return new Response("ok", { status: 200 });
    });
    const pending = checkOfficialSourceHealth({ fetchImpl, bypassCache: true, nowMs: 10 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toBe(3);
    const health = await pending;
    expect(health.sources).toHaveLength(3);
    expect(health.sources.find((item) => item.kind === "imss")?.up).toBe(false);
    expect(health.sources.find((item) => item.kind === "sat")?.up).toBe(true);
    expect(health.sources.find((item) => item.kind === "imss")?.detail).toMatch(/no abre ahora/);
    const cached = await checkOfficialSourceHealth({
      fetchImpl: viFetch(async () => {
        throw new Error("no debe repetir");
      }),
      nowMs: 20,
    });
    expect(cached.checkedAt).toBe(health.checkedAt);
  });

  it("lee el PDF sintético de Infonavit sin inventar Cumple", async () => {
    clearOfficialWorkerDocumentState();
    const binary = readFileSync(new URL("../tests/fixtures/infonavit-micuenta-sintetico.pdf", import.meta.url));
    const reading = await readOfficialWorkerPdf({
      kind: "infonavit",
      binary,
      fetchImpl: viFetch(async () => {
        throw new Error("sin red");
      }),
    });
    expect(reading.fuente).toBe("fuente oficial");
    expect(reading.lines.join(" ")).toContain("1234567890");
    expect(reading.verdict).not.toBe("cumple");
    expect(reading.advisorAnswer).toMatch(/Fuente oficial/);
    expect(reading.advisorAnswer).not.toMatch(/\bCumple\./);
  });
});

function viFetch(impl: (url: string) => Promise<Response>): typeof fetch {
  return ((url: string) => impl(String(url))) as typeof fetch;
}
