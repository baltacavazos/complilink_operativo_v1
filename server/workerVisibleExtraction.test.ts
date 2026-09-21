import { describe, expect, it } from "vitest";
import {
  humanizeMissingExtractionTarget,
  humanizeStructuredFieldLabel,
  isPayrollExtractionTargetCovered,
  isWorkerSystemStructuredField,
} from "./workerVisibleExtraction";

describe("workerVisibleExtraction", () => {
  it("oculta MIME, enums internos, banderas booleanas y códigos de sistema", () => {
    expect(isWorkerSystemStructuredField({ key: "mimeType", label: "Formato", value: "application/pdf" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "processingProfile", value: "expanded" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "hasInfonavitSignal", value: "true" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "infonavitDeductionType", value: "010" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "structuredExtractionReady", value: true })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "eventName", value: "document.processed.v1" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "sha256", value: "a".repeat(64) })).toBe(true);
    expect(isWorkerSystemStructuredField({ value: "hmac-sha256:abcdef0123456789" })).toBe(true);
    expect(isWorkerSystemStructuredField({ value: "document.uploaded" })).toBe(true);
    expect(
      isWorkerSystemStructuredField({
        key: "employerRfc",
        label: "RFC visible",
        value: "ECC190605VA1",
      }),
    ).toBe(false);
    expect(
      isWorkerSystemStructuredField({
        key: "imssWithheld",
        label: "Retención de IMSS visible",
        value: "$120.50",
      }),
    ).toBe(false);
  });

  it("humaniza campos laborales y fiscales del recibo para la vista del trabajador", () => {
    expect(humanizeStructuredFieldLabel("workerRfc")).toBe("RFC de la persona trabajadora");
    expect(humanizeStructuredFieldLabel("payrollNss")).toBe("NSS visible en el comprobante");
    expect(humanizeStructuredFieldLabel("imssWithheld")).toBe("Retención de IMSS visible");
    expect(humanizeStructuredFieldLabel("isrWithheld")).toBe("Retención de ISR visible");
    expect(humanizeStructuredFieldLabel("infonavitWithheld")).toBe("Descuento Infonavit visible");
    expect(humanizeMissingExtractionTarget("INFONAVIT")).toBe("descuento o referencia de Infonavit");
    expect(humanizeMissingExtractionTarget("NSS")).toBe("NSS o retención de IMSS");
    expect(humanizeMissingExtractionTarget("RFC patrón")).toBe("RFC del patrón");
  });

  it("no marca faltante el RFC del patrón si ya está leído, ni lo usa como RFC de la persona", () => {
    const patronVisible = [{ key: "employerRfc", label: "RFC visible", value: "ECC190605VA1" }];
    expect(isPayrollExtractionTargetCovered("RFC patrón", patronVisible)).toBe(true);
    expect(isPayrollExtractionTargetCovered("RFC del patrón", patronVisible)).toBe(true);
    expect(isPayrollExtractionTargetCovered("RFC trabajador", patronVisible)).toBe(false);
    expect(isPayrollExtractionTargetCovered("RFC de la persona trabajadora", patronVisible)).toBe(false);

    const ambos = [
      ...patronVisible,
      { key: "workerRfc", label: "RFC de la persona trabajadora", value: "UIPD9211257I0" },
      { key: "payrollCurp", label: "CURP visible en el comprobante", value: "UIPD921125HYNCLD03" },
    ];
    expect(isPayrollExtractionTargetCovered("RFC trabajador", ambos)).toBe(true);
    expect(isPayrollExtractionTargetCovered("CURP", ambos)).toBe(true);
    expect(isPayrollExtractionTargetCovered("CURP", patronVisible)).toBe(false);
  });
});
