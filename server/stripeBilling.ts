import express from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import {
  buildCommerceEntitlements,
  COMMERCE_ONE_SHOTS,
  COMMERCE_PLANS,
  formatCommercePriceMx,
  getCommerceOneShotDefinition,
  getCommercePlanDefinition,
  isCommerceOneShotKey,
  isCommercePlanKey,
  resolveHighestCommercePlan,
  type CommerceOneShotKey,
  type CommercePlanKey,
  type CommerceProductKey,
} from "@shared/commerce";

type CommerceActor = {
  id: number;
  email: string | null | undefined;
  name: string | null | undefined;
  role?: string | null;
};

type CustomerSummary = {
  id: string;
  email: string | null;
  name: string | null;
};

type PurchasedOneShot = {
  key: CommerceOneShotKey;
  name: string;
  purchasedAt: string;
  sessionId: string;
};

let stripeClient: Stripe | null = null;

function getStripeClient() {
  if (!ENV.stripeSecretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2026-04-22.dahlia",
    });
  }

  return stripeClient;
}

function buildOrigin(originHeader?: string | null) {
  if (originHeader && /^https?:\/\//i.test(originHeader)) {
    return originHeader;
  }

  return "http://localhost:3000";
}

async function findCustomerByEmail(actor: CommerceActor): Promise<CustomerSummary | null> {
  const stripe = getStripeClient();
  if (!stripe || !actor.email) {
    return null;
  }

  const result = await stripe.customers.list({ email: actor.email, limit: 1 });
  const customer = result.data[0];
  if (!customer) {
    return null;
  }

  return {
    id: customer.id,
    email: customer.email ?? null,
    name: customer.name ?? null,
  };
}

async function ensureCustomer(actor: CommerceActor) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe no está configurado todavía.");
  }
  if (!actor.email) {
    throw new Error("Necesitas un correo visible en tu cuenta para activar pagos.");
  }

  const existing = await findCustomerByEmail(actor);
  if (existing) {
    return existing;
  }

  const created = await stripe.customers.create({
    email: actor.email,
    name: actor.name ?? undefined,
    metadata: {
      user_id: String(actor.id),
      customer_email: actor.email,
      customer_name: actor.name ?? "",
    },
  });

  return {
    id: created.id,
    email: created.email ?? null,
    name: created.name ?? null,
  };
}

function normalizePlanFromSubscription(subscription: Stripe.Subscription): CommercePlanKey | null {
  const metadataPlan = typeof subscription.metadata?.app_plan === "string" ? subscription.metadata.app_plan : "";
  if (isCommercePlanKey(metadataPlan)) {
    return metadataPlan;
  }

  for (const item of subscription.items.data) {
    const nickname = item.price.nickname?.toLowerCase() ?? "";
    const product = item.price.product;
    const productName = typeof product === "object" && product !== null && !("deleted" in product) ? product.name?.toLowerCase() ?? "" : "";
    const joined = `${nickname} ${productName}`;
    if (joined.includes("pro")) {
      return "pro";
    }
    if (joined.includes("esencial") || joined.includes("essential")) {
      return "essential";
    }
  }

  return null;
}

function normalizeOneShotFromSession(session: Stripe.Checkout.Session): CommerceOneShotKey | null {
  const metadataKey = typeof session.metadata?.app_one_shot === "string" ? session.metadata.app_one_shot : "";
  if (isCommerceOneShotKey(metadataKey)) {
    return metadataKey;
  }

  const label = `${session.metadata?.app_product_name ?? ""}`.toLowerCase();
  if (label.includes("informe premium")) {
    return "informe_premium";
  }
  if (label.includes("expediente para abogado")) {
    return "expediente_abogado";
  }

  return null;
}

async function listSubscriptionPlans(customerId: string) {
  const stripe = getStripeClient();
  if (!stripe) {
    return [] as CommercePlanKey[];
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 12,
    expand: ["data.items.data.price.product"],
  });

  return subscriptions.data
    .filter((subscription) => ["active", "trialing", "past_due"].includes(subscription.status))
    .map(normalizePlanFromSubscription)
    .filter((value): value is CommercePlanKey => Boolean(value));
}

async function listPurchasedOneShots(customerId: string): Promise<PurchasedOneShot[]> {
  const stripe = getStripeClient();
  if (!stripe) {
    return [];
  }

  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    limit: 30,
  });

  return sessions.data
    .filter((session) => session.mode === "payment" && session.payment_status === "paid")
    .map((session) => {
      const key = normalizeOneShotFromSession(session);
      if (!key) {
        return null;
      }
      const product = getCommerceOneShotDefinition(key);
      return {
        key,
        name: product.name,
        purchasedAt: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        sessionId: session.id,
      } satisfies PurchasedOneShot;
    })
    .filter((item): item is PurchasedOneShot => Boolean(item));
}

export async function resolveCommerceStatus(actor: CommerceActor) {
  const stripe = getStripeClient();
  const hasStripe = Boolean(stripe);
  const adminBypass = actor.role === "admin";

  if (!hasStripe) {
    const entitlements = buildCommerceEntitlements({ planKey: adminBypass ? "pro" : "free" });
    return {
      hasStripe,
      customerId: null,
      activePlanKey: entitlements.planKey,
      activePlan: getCommercePlanDefinition(entitlements.planKey),
      entitlements,
      purchasedOneShots: [] as PurchasedOneShot[],
      canManageBilling: false,
      adminBypass,
    };
  }

  const customer = await findCustomerByEmail(actor);
  const planCandidates = adminBypass ? (["pro"] as CommercePlanKey[]) : customer ? await listSubscriptionPlans(customer.id) : [];
  const purchasedOneShots = customer ? await listPurchasedOneShots(customer.id) : [];
  const activePlanKey = planCandidates.length > 0 ? resolveHighestCommercePlan(planCandidates) : adminBypass ? "pro" : "free";
  const entitlements = buildCommerceEntitlements({
    planKey: activePlanKey,
    purchasedOneShots: purchasedOneShots.map((item) => item.key),
  });

  return {
    hasStripe,
    customerId: customer?.id ?? null,
    activePlanKey,
    activePlan: getCommercePlanDefinition(activePlanKey),
    entitlements,
    purchasedOneShots,
    canManageBilling: Boolean(customer?.id),
    adminBypass,
  };
}

function buildCheckoutMetadata(actor: CommerceActor, productKey: CommerceProductKey, productName: string) {
  return {
    user_id: String(actor.id),
    customer_email: actor.email ?? "",
    customer_name: actor.name ?? "",
    app_product_key: productKey,
    app_product_name: productName,
  };
}

export async function createCommerceCheckoutSession(params: {
  actor: CommerceActor;
  originHeader?: string | null;
  productKey: CommerceProductKey;
}) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe no está configurado todavía.");
  }

  const origin = buildOrigin(params.originHeader);
  const customer = await ensureCustomer(params.actor);

  if (isCommercePlanKey(params.productKey)) {
    const plan = getCommercePlanDefinition(params.productKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      customer_email: params.actor.email ?? undefined,
      client_reference_id: String(params.actor.id),
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: buildCheckoutMetadata(params.actor, plan.key, plan.name),
      subscription_data: {
        metadata: {
          ...buildCheckoutMetadata(params.actor, plan.key, plan.name),
          app_plan: plan.key,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: plan.monthlyPriceMx * 100,
            recurring: { interval: "month" },
            product_data: {
              name: plan.name,
              description: `${plan.headline} · ${plan.description}`,
            },
          },
        },
      ],
      success_url: `${origin}/auditar?billing=success&product=${plan.key}`,
      cancel_url: `${origin}/planes?billing=cancel`,
    });

    return {
      url: session.url,
      productLabel: `${plan.name} · ${formatCommercePriceMx(plan.monthlyPriceMx)}/mes`,
    };
  }

  const oneShot = getCommerceOneShotDefinition(params.productKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customer.id,
    customer_email: params.actor.email ?? undefined,
    client_reference_id: String(params.actor.id),
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata: {
      ...buildCheckoutMetadata(params.actor, oneShot.key, oneShot.name),
      app_one_shot: oneShot.key,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: oneShot.priceMx * 100,
          product_data: {
            name: oneShot.name,
            description: `${oneShot.description} · ${oneShot.deliveryLabel}`,
          },
        },
      },
    ],
    success_url: `${origin}/auditar?billing=success&product=${oneShot.key}`,
    cancel_url: `${origin}/planes?billing=cancel`,
  });

  return {
    url: session.url,
    productLabel: `${oneShot.name} · ${formatCommercePriceMx(oneShot.priceMx)}`,
  };
}

export async function createCommerceBillingPortalSession(params: {
  actor: CommerceActor;
  originHeader?: string | null;
}) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe no está configurado todavía.");
  }

  const customer = await ensureCustomer(params.actor);
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${buildOrigin(params.originHeader)}/planes?billing=portal`,
  });

  return {
    url: session.url,
  };
}

export function registerStripeWebhook(app: express.Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const stripe = getStripeClient();
    if (!stripe || !ENV.stripeWebhookSecret) {
      return res.status(503).json({ error: "stripe_not_configured" });
    }

    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
      return res.status(400).json({ error: "missing_signature" });
    }

    try {
      const event = stripe.webhooks.constructEvent(req.body, signature, ENV.stripeWebhookSecret);

      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log("[Stripe webhook]", {
        eventId: event.id,
        eventType: event.type,
        created: event.created,
      });

      return res.json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook inválido";
      console.error("[Stripe webhook] verification_failed", message);
      return res.status(400).json({ error: "invalid_signature", message });
    }
  });
}

export function buildCommercialSnapshot() {
  return {
    plans: COMMERCE_PLANS.map((plan) => ({
      ...plan,
      formattedPrice: plan.monthlyPriceMx === 0 ? "Gratis" : `${formatCommercePriceMx(plan.monthlyPriceMx)}/mes`,
    })),
    oneShots: COMMERCE_ONE_SHOTS.map((item) => ({
      ...item,
      formattedPrice: formatCommercePriceMx(item.priceMx),
    })),
  };
}
