import { describe, expect, it } from "vitest";
import {
  COMMERCE_PLANS,
  FREE_MAX_DOCUMENTS_PER_CASE,
  buildCommerceEntitlements,
  formatActiveDocumentCapCopy,
  formatCommerceDocumentLimitBullet,
  formatExceededDocumentLimitFeatureLabel,
  formatFreePlanLandingPrinciple,
} from "./commerce";

describe("tope de documentos por plan", () => {
  it("deja el plan gratis en un documento y conserva Esencial 15 y Pro 50", () => {
    const free = COMMERCE_PLANS.find((plan) => plan.key === "free");
    const essential = COMMERCE_PLANS.find((plan) => plan.key === "essential");
    const pro = COMMERCE_PLANS.find((plan) => plan.key === "pro");

    expect(FREE_MAX_DOCUMENTS_PER_CASE).toBe(1);
    expect(free?.limits.maxDocumentsPerCase).toBe(FREE_MAX_DOCUMENTS_PER_CASE);
    expect(essential?.limits.maxDocumentsPerCase).toBe(15);
    expect(pro?.limits.maxDocumentsPerCase).toBe(50);
    expect(buildCommerceEntitlements({ planKey: "free" }).maxDocumentsPerCase).toBe(1);
    expect(buildCommerceEntitlements({ planKey: "essential" }).maxDocumentsPerCase).toBe(15);
    expect(buildCommerceEntitlements({ planKey: "pro" }).maxDocumentsPerCase).toBe(50);
  });

  it("habla de un documento en el plan gratis, sin prometer tres ni varios recibos", () => {
    const free = COMMERCE_PLANS.find((plan) => plan.key === "free");
    const visible = [free?.description, ...(free?.featureBullets ?? []), formatFreePlanLandingPrinciple(1)].join(" ");

    expect(visible).toMatch(/un documento|1 documento/i);
    expect(visible).not.toMatch(/3 documentos|varios recibos/i);
    expect(formatCommerceDocumentLimitBullet(1)).toBe("1 documento por expediente.");
    expect(formatCommerceDocumentLimitBullet(15)).toBe("Hasta 15 documentos por expediente.");
    expect(formatActiveDocumentCapCopy(1)).toBe("1 documento con tu plan actual.");
    expect(formatExceededDocumentLimitFeatureLabel(1)).toBe(
      "Subir más de 1 documento en este expediente",
    );
    expect(formatExceededDocumentLimitFeatureLabel(15)).toBe(
      "Subir más de 15 documentos en este expediente",
    );
  });
});
