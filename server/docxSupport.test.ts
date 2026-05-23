import { describe, expect, it } from "vitest";

import {
  DOCX_MIME_TYPE,
  extractDocxPlainText,
  looksLikeZipContainer,
  normalizeAuditarMimeType,
} from "./docxSupport";

describe("docxSupport", () => {
  it("normalizes generic binary mime types using the file extension", () => {
    expect(
      normalizeAuditarMimeType(
        "CONTRATOINDETERMINADO-UICABPALOMODIDIERANTONIO.docx",
        "application/octet-stream",
      ),
    ).toBe(DOCX_MIME_TYPE);

    expect(normalizeAuditarMimeType("recibo.pdf", "application/octet-stream")).toBe(
      "application/pdf",
    );
  });

  it("preserves explicit mime types when they are already specific", () => {
    expect(normalizeAuditarMimeType("contrato.docx", DOCX_MIME_TYPE)).toBe(
      DOCX_MIME_TYPE,
    );
    expect(normalizeAuditarMimeType("recibo.xml", "application/xml")).toBe(
      "application/xml",
    );
  });

  it("detects docx-like zip containers from their signature", () => {
    expect(looksLikeZipContainer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
    expect(looksLikeZipContainer(Buffer.from([0x25, 0x50, 0x44, 0x46]))).toBe(false);
  });

  it("returns a friendly error when the uploaded docx cannot be parsed", async () => {
    await expect(extractDocxPlainText(Buffer.from("not-a-real-docx"))).rejects.toThrow(
      "No pudimos leer este contrato en DOCX. Vuelve a exportarlo desde Word o súbelo como PDF para continuar.",
    );
  });
});
