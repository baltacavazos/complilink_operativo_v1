import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");

describe("Auditar first visit", () => {
  it("uses the public guest analysis flow from the Auditar upload CTA", () => {
    expect(source).toContain("trpc.cases.guestAnalyzeDocument.useMutation()");
    expect(source).toContain("guestFileInputRef.current?.click()");
    expect(source).toContain("handleGuestFileChange");
    expect(source).not.toContain('focusRecommendedUpload(effectiveRecommendedTarget?.type ?? null)');
  });

  it("keeps a plain-Spanish signal and the same review through account access", () => {
    expect(source).toContain("buildPayrollSignalFallback");
    expect(source).toContain("Qué conviene revisar");
    expect(source).toContain("Siguiente paso útil");
    expect(source).toContain("claimGuestPreview.useMutation()");
    expect(source).toContain('"/auditar?resume=guest-review"');
  });

  it("removes the inaccurate seconds promise from the public Auditar entry", () => {
    expect(source).not.toContain("Recibes una revisión gratis en segundos.");
    expect(source).not.toContain("Sube y revisa en segundos");
    expect(source).toContain("La lectura puede tardar un momento");
  });
});
