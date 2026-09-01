import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const advisorSheetSource = readFileSync(
  new URL("../components/HeliosCopilotSheet.tsx", import.meta.url),
  "utf8"
);

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

  it("renders facts and a non-empty attention point without exposing programmer keys", () => {
    expect(source).toContain("buildPayrollFactSignal");
    expect(source).toContain("Empresa que aparece:");
    expect(source).toContain("Periodo identificado:");
    expect(source).toContain("Deducciones que se alcanzan a leer:");
    expect(source).toContain("Hoy conviene poner atención especial en esto");
    expect(source).toContain("IMSS según este documento");
    expect(source).toContain("Impuestos y retenciones");
    expect(source).toContain("Esto sale de tus papeles; no es una constancia oficial");
    expect(source).toContain("isTechnicalAnalysisKey");
    expect(source).toContain("Dato visible en el documento");
    expect(advisorSheetSource).toContain('eyebrow: "Asesor laboral"');
    expect(advisorSheetSource).not.toContain('eyebrow: "Helios · asesor laboral"');
  });

  it("removes the inaccurate seconds promise from the public Auditar entry", () => {
    expect(source).not.toContain("Recibes una revisión gratis en segundos.");
    expect(source).not.toContain("Sube y revisa en segundos");
    expect(source).toContain("La lectura puede tardar un momento");
  });
});
