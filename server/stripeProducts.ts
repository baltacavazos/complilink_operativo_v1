import type Stripe from "stripe";
import {
  getCommerceOneShotDefinition,
  getCommercePlanDefinition,
  isCommerceOneShotKey,
  isCommercePlanKey,
  type CommerceOneShotKey,
  type CommercePlanKey,
  type CommerceProductKey,
} from "@shared/commerce";

export type StripeCommerceProductType = "subscription" | "one_shot";

export function buildStripePlanLineItem(planKey: CommercePlanKey) {
  const plan = getCommercePlanDefinition(planKey);
  return {
    quantity: 1,
    price_data: {
      currency: "mxn",
      unit_amount: plan.monthlyPriceMx * 100,
      recurring: { interval: "month" as const },
      product_data: {
        name: plan.name,
        description: `${plan.headline} · ${plan.description}`,
      },
    },
  };
}

export function buildStripeOneShotLineItem(productKey: CommerceOneShotKey) {
  const product = getCommerceOneShotDefinition(productKey);
  return {
    quantity: 1,
    price_data: {
      currency: "mxn",
      unit_amount: product.priceMx * 100,
      product_data: {
        name: product.name,
        description: `${product.description} · ${product.deliveryLabel}`,
      },
    },
  };
}

export function getStripeCommerceProductSnapshot(productKey: CommerceProductKey): {
  type: StripeCommerceProductType;
  definition: ReturnType<typeof getCommercePlanDefinition> | ReturnType<typeof getCommerceOneShotDefinition>;
} {
  if (isCommercePlanKey(productKey)) {
    return {
      type: "subscription",
      definition: getCommercePlanDefinition(productKey),
    };
  }

  if (isCommerceOneShotKey(productKey)) {
    return {
      type: "one_shot",
      definition: getCommerceOneShotDefinition(productKey),
    };
  }

  return {
    type: "one_shot",
    definition: getCommerceOneShotDefinition("informe_premium"),
  };
}
