import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const auditarSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Auditar.tsx"),
  "utf8",
);

describe("Auditar DOCX support markers", () => {
  it("routes document reading and persistence through mobile-ready adapters", () => {
    expect(auditarSource).toContain('import { readWebFileAsDataUrl } from "@/lib/platformDocumentInput"');
    expect(auditarSource).toContain('platformStorageGetJSON');
    expect(auditarSource).toContain('platformStorageSetJSON');
    expect(auditarSource).toContain('async function fileToBase64(file: File)');
    expect(auditarSource).toContain('return readWebFileAsDataUrl(file);');
  });

  it("keeps DOCX in the upload picker and validation copy", () => {
    expect(auditarSource).toContain(".docx");
    expect(auditarSource).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(auditarSource).toContain("DOCX");
  });

  it("keeps the user-facing guardrails aligned with DOCX support", () => {
    expect(auditarSource).toContain(
      "Formatos compatibles: PDF, XML, JPG, PNG, WEBP o DOCX",
    );
    expect(auditarSource).toContain(
      "Este archivo no es compatible todavía. Sube PDF, XML, JPG, PNG, WEBP o DOCX para continuar.",
    );
  });
});
