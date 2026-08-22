import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/validateExistingPayrollReceipt.mts");
const source = readFileSync(scriptPath, "utf8");

describe("controlled existing-document dispatch", () => {
  it("requires explicit authorization and reuses only persisted document metadata", () => {
    expect(source).toContain('ALLOW_CONTROLLED_EXISTING_DOCUMENT_DISPATCH === "YES"');
    expect(source).toContain("getDocumentById(documentId)");
    expect(source).toContain("sendDocumentToAuditaPatronEngine");
    expect(source).not.toMatch(/addDocumentRecord|updateDocumentPostProcessing|createAuditLog/);
  });

  it("passes the numeric internal identifier required by the canonical Helios bridge", () => {
    expect(source).toContain("documentNumericId: document.id");
    expect(source).toContain("title: document.originalName");
  });
});
