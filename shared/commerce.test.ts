import { describe, expect, it } from "vitest";
import {
  COMMERCE_ONE_SHOTS,
  COMMERCE_PLANS,
  COMMERCE_PRICE_FOOTER,
  FREE_MAX_DOCUMENTS_PER_CASE,
  buildCommerceEntitlements,
  formatActiveDocumentCapCopy,
  formatCommerceDocumentLimitBullet,
  formatCommerceIvaSticker,
  formatDocumentLimitBlockedMessage,
  formatExceededDocumentLimitFeatureLabel,
  formatFreePlanLandingPrinciple,
  FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE,
  FREE_TIER_EXHAUSTED_COPY,
  isFreePlanDocumentLimitMessage,
} from "./commerce";

describe("stickers Lectura A con IVA incluido", () => {
  it("publica el precio con IVA dentro del número y no la base anterior", () => {
    const essential = COMMERCE_PLANS.find((plan) => plan.key === "essential");
    const pro = COMMERCE_PLANS.find((plan) => plan.key === "pro");
    const informe = COMMERCE_ONE_SHOTS.find((item) => item.key === "informe_premium");
    const lawyer = COMMERCE_ONE_SHOTS.find((item) => item.key === "expediente_abogado");
    const free = COMMERCE_PLANS.find((plan) => plan.key === "free");

    expect(free?.monthlyPriceMx).toBe(0);
    expect(formatCommerceIvaSticker(0)).toBe("$0");
    expect(essential?.monthlyPriceMx).toBe(92);
    expect(formatCommerceIvaSticker(essential?.monthlyPriceMx ?? 0)).toBe("$92 · IVA incluido");
    expect(pro?.monthlyPriceMx).toBe(231);
    expect(formatCommerceIvaSticker(pro?.monthlyPriceMx ?? 0)).toBe("$231 · IVA incluido");
    expect(informe?.priceMx).toBe(347);
    expect(formatCommerceIvaSticker(informe?.priceMx ?? 0)).toBe("$347 · IVA incluido");
    expect(lawyer?.priceMx).toBe(579);
    expect(formatCommerceIvaSticker(lawyer?.priceMx ?? 0)).toBe("$579 · IVA incluido");
    expect(COMMERCE_PRICE_FOOTER).toBe("Precios en MXN. IVA incluido.");
    expect(
      [
        formatCommerceIvaSticker(92),
        formatCommerceIvaSticker(231),
        formatCommerceIvaSticker(347),
        formatCommerceIvaSticker(579),
        COMMERCE_PRICE_FOOTER,
      ].join(" "),
    ).not.toMatch(/sin IVA|\b79\b|\b199\b|\b299\b|\b499\b/);
  });
});

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
    expect(formatCommerceDocumentLimitBullet(1)).toBe("1 documento en tu caso.");
    expect(formatCommerceDocumentLimitBullet(15)).toBe("Hasta 15 documentos en tu caso.");
    expect(formatActiveDocumentCapCopy(1)).toBe("1 documento con tu plan actual.");
    expect(FREE_TIER_EXHAUSTED_COPY).toBe(
      "En el plan gratis ya usaste tu documento. Si quieres subir otro, activa Audita Esencial.",
    );
    expect(formatDocumentLimitBlockedMessage(1)).toBe(FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE);
    expect(FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE).toBe(
      "Subir otro documento en este caso está disponible desde Audita Esencial.",
    );
    expect(formatExceededDocumentLimitFeatureLabel(15)).toBe(
      "Subir más de 15 documentos en este caso",
    );
    expect(formatDocumentLimitBlockedMessage(15)).toMatch(/Subir más de 15 documentos en este caso está disponible desde Audita Esencial/);
    expect(isFreePlanDocumentLimitMessage(formatDocumentLimitBlockedMessage(1))).toBe(true);
    expect(isFreePlanDocumentLimitMessage(FREE_TIER_EXHAUSTED_COPY)).toBe(true);
    expect(isFreePlanDocumentLimitMessage(formatDocumentLimitBlockedMessage(15))).toBe(false);
    expect(isFreePlanDocumentLimitMessage("No pudimos validar el recibo. Intenta de nuevo.")).toBe(false);
    expect(isFreePlanDocumentLimitMessage("Algo interrumpió la carga, pero tus datos siguen a salvo.")).toBe(false);
  });

  it("el catálogo visible no dice expediente ni revalidaciones", () => {
    const visible = [
      ...COMMERCE_PLANS.flatMap((plan) => [
        plan.name,
        plan.headline,
        plan.description,
        plan.ctaLabel,
        plan.badge,
        ...plan.featureBullets,
      ]),
      ...COMMERCE_ONE_SHOTS.flatMap((item) => [
        item.name,
        item.description,
        item.deliveryLabel,
        item.ctaLabel,
        item.badge,
        ...item.featureBullets,
      ]),
      formatFreePlanLandingPrinciple(1),
      formatCommerceDocumentLimitBullet(1),
      formatCommerceDocumentLimitBullet(15),
    ].join(" ");

    expect(visible).not.toMatch(/expediente|revalidacion/i);
    expect(COMMERCE_ONE_SHOTS.map((item) => item.key)).toEqual([
      "informe_premium",
      "expediente_abogado",
    ]);
    expect(COMMERCE_PLANS.find((plan) => plan.key === "pro")?.limits.includedRevalidations).toBe(true);
    expect(COMMERCE_ONE_SHOTS.find((item) => item.key === "expediente_abogado")).toMatchObject({
      name: "Paquete para tu abogado",
      ctaLabel: "Preparar paquete",
    });
    expect(COMMERCE_PLANS.find((plan) => plan.key === "free")?.featureBullets).toContain(
      "1 documento. Primera lectura y asesor básico.",
    );
    expect(COMMERCE_PLANS.find((plan) => plan.key === "essential")?.featureBullets[0]).toMatch(
      /^Hasta 15 recibos/,
    );
    expect(COMMERCE_PLANS.find((plan) => plan.key === "pro")?.featureBullets.join(" ")).toMatch(
      /Volvemos a preguntar a IMSS e Infonavit/,
    );
  });
});
