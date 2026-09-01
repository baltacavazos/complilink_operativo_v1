import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfPlainText } from "./pdfTextExtraction";

describe("extractPdfPlainText", () => {
  it("reads a native text layer from a printable PDF", async () => {
    const fixture = readFileSync(
      resolve(process.cwd(), "bridge_complilink_consulta_fase_siguiente.pdf")
    );

    await expect(extractPdfPlainText(fixture)).resolves.toContain(
      "Consulta técnica para el otro chat de"
    );
  });

  it("returns no inferred text for a non-PDF buffer", async () => {
    await expect(extractPdfPlainText(Buffer.from("no es un PDF"))).resolves.toBe("");
  });
});
