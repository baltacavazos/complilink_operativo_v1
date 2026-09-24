import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INFONAVIT_DOCUMENT_UNREADABLE,
  infonavitDocumentCopyIsHonest,
} from "@shared/infonavitMiCuentaDocument";
import { readInfonavitMiCuentaPdfBinary } from "./infonavitMiCuentaPdf";

// Fixture sintético. Sustituir cuando Baltasar suba un PDF real de Mi Cuenta, sin PII.
const FIXTURE_PATH = resolve(process.cwd(), "tests/fixtures/infonavit-micuenta-sintetico.pdf");

describe("PDF Mi Cuenta Infonavit sintético", () => {
  it("parsea el fixture y marca el origen como documento", async () => {
    const reading = await readInfonavitMiCuentaPdfBinary(readFileSync(FIXTURE_PATH));
    const copy = [reading.originLine, reading.shield ?? "", reading.notice, ...reading.lines].join("\n");

    expect(reading.origin).toBe("document");
    expect(reading.source).toBe("user_upload");
    expect(reading.readable).toBe(true);
    expect(reading.facts.find((fact) => fact.kind === "credit")?.creditNumber).toBe("1234567890");
    expect(reading.lines.join(" ")).toContain("$125000.00");
    expect(reading.lines.join(" ")).toContain("$18450.50");
    expect(reading.lines.join(" ")).toContain("2026-08-15");
    expect(reading.lines.join(" ")).toContain("2026-07-15");
    expect(reading.lines.join(" ")).toContain("documento que subiste");
    expect(copy).toMatch(/documento que subiste/);
    expect(infonavitDocumentCopyIsHonest(copy)).toBe(true);
    expect(copy).not.toMatch(/consulta en vivo/i);
    expect(copy).not.toMatch(/al corriente/i);
    expect(copy).not.toMatch(/\bBien\b/);
    expect(copy).not.toMatch(/tu patr[oó]n cumple\b/i);
  });

  it("un archivo que no es PDF queda en silencio", async () => {
    const reading = await readInfonavitMiCuentaPdfBinary(Buffer.from("no es un PDF de Mi Cuenta"));

    expect(reading.readable).toBe(false);
    expect(reading.origin).toBe("document");
    expect(reading.notice).toBe(INFONAVIT_DOCUMENT_UNREADABLE);
    expect(reading.lines).toEqual([]);
  });
});
