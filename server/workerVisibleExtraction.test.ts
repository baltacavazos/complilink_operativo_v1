import { describe, expect, it } from "vitest";
import {
  humanizeMissingExtractionTarget,
  humanizeStructuredFieldLabel,
  isWorkerSystemStructuredField,
} from "./workerVisibleExtraction";

describe("workerVisibleExtraction", () => {
  it("oculta MIME, enums internos, banderas booleanas y códigos de sistema", () => {
    expect(isWorkerSystemStructuredField({ key: "mimeType", label: "Formato", value: "application/pdf" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "processingProfile", value: "expanded" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "hasInfonavitSignal", value: "true" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "infonavitDeductionType", value: "010" })).toBe(true);
    expect(isWorkerSystemStructuredField({ key: "structuredExtractionReady", value: true })).toBe(true);
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
    expect(humanizeStructuredFieldLabel("payrollNss")).toBe("NSS visible en el comprobante");
    expect(humanizeStructuredFieldLabel("imssWithheld")).toBe("Retención de IMSS visible");
    expect(humanizeStructuredFieldLabel("isrWithheld")).toBe("Retención de ISR visible");
    expect(humanizeStructuredFieldLabel("infonavitWithheld")).toBe("Descuento Infonavit visible");
    expect(humanizeMissingExtractionTarget("INFONAVIT")).toBe("descuento o referencia de Infonavit");
    expect(humanizeMissingExtractionTarget("NSS")).toBe("NSS o retención de IMSS");
  });
});
