import express from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import {
  getStoredCommerceStatusForUser,
  getUserByEmail,
  getUserById,
  getUserByStripeCustomerId,
  linkStripeCustomerToUser,
  listCommercePaymentsForUser,
  upsertCommercePayment,
  upsertCommerceSubscription,
} from "./db";
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
import {
  buildStripeOneShotLineItem,
  buildStripePlanLineItem,
  getStripeCommerceProductSnapshot,
  type StripeCommerceProductType,
} from "./stripeProducts";

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

type CommerceHistoryPayment = {
  id: number;
  productKey: string;
  productLabel: string;
  productType: StripeCommerceProductType;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  paidAt: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
  stripeSubscriptionId: string | null;
};

type DerivedPaymentRecord = {
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
  stripeSubscriptionId: string | null;
  productKey: CommerceProductKey;
  productLabel: string;
  productType: StripeCommerceProductType;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  paidAt: Date;
};

type DerivedSubscriptionRecord = {
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  planKey: CommercePlanKey;
  status: string;
  latestInvoiceId: string | null;
  currentPeriodEnd: Date | null;
};

type StripeMetadataShape = Record<string, string | number | boolean | null | undefined> | null | undefined;

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

function buildCommerceEnvironmentStatus() {
  if (!ENV.stripeSecretKey) {
    return {
      mode: "unavailable" as const,
      isSandbox: false,
      webhookReady: false,
      checkoutReady: false,
      recommendedTestCard: null,
      validationHint: "La activación de Stripe sigue pendiente.",
    };
  }

  const isSandbox = ENV.stripeSecretKey.startsWith("sk_test_");

  return {
    mode: isSandbox ? ("sandbox" as const) : ("live" as const),
    isSandbox,
    webhookReady: Boolean(ENV.stripeWebhookSecret),
    checkoutReady: true,
    recommendedTestCard: isSandbox ? "4242 4242 4242 4242" : null,
    validationHint: isSandbox
      ? "Puedes probar el circuito completo de checkout con la tarjeta 4242 4242 4242 4242 antes de activar cobro real."
      : "Stripe ya está en modo live; conviene validar checkout, webhook y retorno con una compra controlada.",
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readMetadataString(metadata: StripeMetadataShape, key: string) {
  const value = metadata?.[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function readStripeId(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (value && typeof value === "object" && "id" in value) {
    const nestedId = (value as { id?: unknown }).id;
    return typeof nestedId === "string" && nestedId.trim().length > 0 ? nestedId : null;
  }
  return null;
}

function fromUnixTimestamp(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000);
}

function normalizePlanFromLabel(label: string | null) {
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes(" pro" ) || normalized.startsWith("pro") || normalized.includes("audita pro")) {
    return "pro" as CommercePlanKey;
  }
  if (normalized.includes("esencial") || normalized.includes("essential") || normalized.includes("audita esencial")) {
    return "essential" as CommercePlanKey;
  }
  if (normalized.includes("gratis") || normalized.includes("free")) {
    return "free" as CommercePlanKey;
  }
  return null;
}

function normalizePlanFromSubscription(subscription: Stripe.Subscription): CommercePlanKey | null {
  const metadataPlan = readMetadataString(subscription.metadata as StripeMetadataShape, "app_plan");
  if (metadataPlan && isCommercePlanKey(metadataPlan)) {
    return metadataPlan;
  }

  for (const item of subscription.items.data) {
    const nickname = readString(item.price.nickname);
    const product = item.price.product;
    const productName =
      product && typeof product === "object" && !("deleted" in product) ? readString(product.name) : null;
    const detected = normalizePlanFromLabel(`${nickname ?? ""} ${productName ?? ""}`.trim());
    if (detected) {
      return detected;
    }
  }

  return null;
}

function normalizeOneShotFromSession(session: Stripe.Checkout.Session): CommerceOneShotKey | null {
  const directKey =
    readMetadataString(session.metadata as StripeMetadataShape, "app_one_shot") ??
    readMetadataString(session.metadata as StripeMetadataShape, "app_product_key");
  if (directKey && isCommerceOneShotKey(directKey)) {
    return directKey;
  }

  const label = readMetadataString(session.metadata as StripeMetadataShape, "app_product_name");
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes("informe premium")) {
    return "informe_premium";
  }
  if (normalized.includes("expediente para abogado")) {
    return "expediente_abogado";
  }

  return null;
}

function normalizePlanFromInvoice(invoice: Stripe.Invoice): CommercePlanKey | null {
  const directPlan =
    readMetadataString(invoice.metadata as StripeMetadataShape, "app_plan") ??
    readMetadataString(invoice.metadata as StripeMetadataShape, "app_product_key");
  if (directPlan && isCommercePlanKey(directPlan)) {
    return directPlan;
  }

  for (const line of invoice.lines.data) {
    const detected = normalizePlanFromLabel(readString(line.description));
    if (detected) {
      return detected;
    }
  }

  return null;
}

function readInvoicePaymentIntentId(invoice: Stripe.Invoice) {
  return readStripeId((invoice as unknown as Record<string, unknown>).payment_intent);
}

function readInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  return readStripeId((invoice as unknown as Record<string, unknown>).subscription);
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

async function retrieveCustomerById(customerId: string): Promise<CustomerSummary | null> {
  const stripe = getStripeClient();
  if (!stripe) {
    return null;
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || (typeof customer === "object" && "deleted" in customer && customer.deleted)) {
      return null;
    }

    return {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
    };
  } catch {
    return null;
  }
}

async function findCustomerByStoredReference(actor: CommerceActor): Promise<CustomerSummary | null> {
  const user = await getUserById(actor.id);
  if (!user?.stripeCustomerId) {
    return null;
  }

  return retrieveCustomerById(user.stripeCustomerId);
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

async function findCustomerForActor(actor: CommerceActor) {
  const stored = await findCustomerByStoredReference(actor);
  if (stored) {
    return stored;
  }

  return findCustomerByEmail(actor);
}

async function ensureCustomer(actor: CommerceActor) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe no está configurado todavía.");
  }
  if (!actor.email) {
    throw new Error("Necesitas un correo visible en tu cuenta para activar pagos.");
  }

  const existing = await findCustomerForActor(actor);
  if (existing) {
    await linkStripeCustomerToUser({
      userId: actor.id,
      stripeCustomerId: existing.id,
    });
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

  await linkStripeCustomerToUser({
    userId: actor.id,
    stripeCustomerId: created.id,
  });

  return {
    id: created.id,
    email: created.email ?? null,
    name: created.name ?? null,
  };
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

function buildStoredPurchasedOneShots(
  payments: Awaited<ReturnType<typeof getStoredCommerceStatusForUser>>["payments"],
): PurchasedOneShot[] {
  return payments
    .filter((payment) => payment.productType === "one_shot" && payment.paymentStatus === "paid")
    .map((payment) => {
      if (!isCommerceOneShotKey(payment.productKey)) {
        return null;
      }
      const definition = getCommerceOneShotDefinition(payment.productKey);
      return {
        key: payment.productKey,
        name: definition.name,
        purchasedAt: payment.paidAt.toISOString(),
        sessionId: payment.stripeCheckoutSessionId ?? `payment-${payment.id}`,
      } satisfies PurchasedOneShot;
    })
    .filter((payment): payment is PurchasedOneShot => Boolean(payment));
}

function buildStoredPlanCandidates(
  subscriptions: Awaited<ReturnType<typeof getStoredCommerceStatusForUser>>["subscriptions"],
) {
  return subscriptions
    .filter((subscription) => ["active", "trialing", "past_due"].includes(subscription.status))
    .map((subscription) => subscription.planKey)
    .filter((planKey): planKey is CommercePlanKey => isCommercePlanKey(planKey));
}

export async function resolveCommerceStatus(actor: CommerceActor) {
  const stripe = getStripeClient();
  const hasStripe = Boolean(stripe);
  const adminBypass = actor.role === "admin";
  const environment = buildCommerceEnvironmentStatus();
  const stored = await getStoredCommerceStatusForUser(actor.id);

  if (!hasStripe) {
    const entitlements = buildCommerceEntitlements({ planKey: adminBypass ? "pro" : "free" });
    return {
      hasStripe,
      customerId: stored.stripeCustomerId,
      activePlanKey: entitlements.planKey,
      activePlan: getCommercePlanDefinition(entitlements.planKey),
      entitlements,
      purchasedOneShots: buildStoredPurchasedOneShots(stored.payments),
      canManageBilling: false,
      adminBypass,
      environment,
    };
  }

  let customerId = stored.stripeCustomerId;
  let planCandidates = adminBypass ? (["pro"] as CommercePlanKey[]) : buildStoredPlanCandidates(stored.subscriptions);
  let purchasedOneShots = buildStoredPurchasedOneShots(stored.payments);

  if (!customerId || planCandidates.length === 0 || purchasedOneShots.length === 0) {
    const customer = customerId ? await retrieveCustomerById(customerId) : await findCustomerForActor(actor);
    if (customer) {
      customerId = customer.id;
      await linkStripeCustomerToUser({ userId: actor.id, stripeCustomerId: customer.id });
      if (planCandidates.length === 0) {
        planCandidates = adminBypass ? (["pro"] as CommercePlanKey[]) : await listSubscriptionPlans(customer.id);
      }
      if (purchasedOneShots.length === 0) {
        purchasedOneShots = await listPurchasedOneShots(customer.id);
      }
    }
  }

  const activePlanKey =
    planCandidates.length > 0 ? resolveHighestCommercePlan(planCandidates) : adminBypass ? "pro" : "free";
  const entitlements = buildCommerceEntitlements({
    planKey: activePlanKey,
    purchasedOneShots: purchasedOneShots.map((item) => item.key),
  });

  return {
    hasStripe,
    customerId,
    activePlanKey,
    activePlan: getCommercePlanDefinition(activePlanKey),
    entitlements,
    purchasedOneShots,
    canManageBilling: Boolean(customerId),
    adminBypass,
    environment,
  };
}

export async function resolveCommerceHistory(userId: number) {
  const stored = await getStoredCommerceStatusForUser(userId);
  const payments = await listCommercePaymentsForUser(userId);
  const activeSubscription = stored.subscriptions.find((subscription) =>
    ["active", "trialing", "past_due"].includes(subscription.status),
  );

  return {
    customerId: stored.stripeCustomerId,
    activeSubscription: activeSubscription
      ? {
          stripeSubscriptionId: activeSubscription.stripeSubscriptionId,
          stripePriceId: activeSubscription.stripePriceId,
          planKey: activeSubscription.planKey,
          planName: getCommercePlanDefinition(activeSubscription.planKey).name,
          status: activeSubscription.status,
          latestInvoiceId: activeSubscription.latestInvoiceId,
          currentPeriodEnd: activeSubscription.currentPeriodEnd?.toISOString() ?? null,
          updatedAt: activeSubscription.updatedAt.toISOString(),
        }
      : null,
    payments: payments.map(
      (payment) =>
        ({
          id: payment.id,
          productKey: payment.productKey,
          productLabel: payment.productLabel,
          productType: payment.productType,
          amountTotal: payment.amountTotal,
          currency: payment.currency,
          paymentStatus: payment.paymentStatus,
          paidAt: payment.paidAt.toISOString(),
          stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          stripeInvoiceId: payment.stripeInvoiceId,
          stripeSubscriptionId: payment.stripeSubscriptionId,
        }) satisfies CommerceHistoryPayment,
    ),
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
      line_items: [buildStripePlanLineItem(plan.key)],
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
    client_reference_id: String(params.actor.id),
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata: {
      ...buildCheckoutMetadata(params.actor, oneShot.key, oneShot.name),
      app_one_shot: oneShot.key,
    },
    line_items: [buildStripeOneShotLineItem(oneShot.key)],
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

async function resolveStripeEventUser(params: {
  userIdCandidate?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
}) {
  const userId = Number.parseInt(params.userIdCandidate ?? "", 10);
  if (Number.isFinite(userId) && userId > 0) {
    const byId = await getUserById(userId);
    if (byId) {
      return byId;
    }
  }

  if (params.customerId) {
    const byCustomer = await getUserByStripeCustomerId(params.customerId);
    if (byCustomer) {
      return byCustomer;
    }
  }

  if (params.customerEmail) {
    const byEmail = await getUserByEmail(params.customerEmail);
    if (byEmail) {
      return byEmail;
    }
  }

  return undefined;
}

export function derivePaymentRecordFromCheckoutSession(session: Stripe.Checkout.Session): DerivedPaymentRecord | null {
  const productKey =
    readMetadataString(session.metadata as StripeMetadataShape, "app_product_key") ??
    readMetadataString(session.metadata as StripeMetadataShape, "app_plan") ??
    readMetadataString(session.metadata as StripeMetadataShape, "app_one_shot");
  if (!productKey || (!isCommercePlanKey(productKey) && !isCommerceOneShotKey(productKey))) {
    return null;
  }

  const snapshot = getStripeCommerceProductSnapshot(productKey);
  return {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: readStripeId(session.payment_intent),
    stripeInvoiceId: readStripeId(session.invoice),
    stripeSubscriptionId: readStripeId(session.subscription),
    productKey,
    productLabel:
      readMetadataString(session.metadata as StripeMetadataShape, "app_product_name") ?? snapshot.definition.name,
    productType: snapshot.type,
    amountTotal: session.amount_total ?? 0,
    currency: readString(session.currency) ?? "mxn",
    paymentStatus: readString(session.payment_status) ?? readString(session.status) ?? "open",
    paidAt: fromUnixTimestamp(session.created) ?? new Date(),
  };
}

export function deriveSubscriptionRecordFromSubscription(
  subscription: Stripe.Subscription,
): DerivedSubscriptionRecord | null {
  const planKey = normalizePlanFromSubscription(subscription);
  if (!planKey) {
    return null;
  }

  const subscriptionShape = subscription as unknown as { current_period_end?: number | null };

  return {
    stripeSubscriptionId: subscription.id,
    stripePriceId: readStripeId(subscription.items.data[0]?.price?.id),
    planKey,
    status: subscription.status,
    latestInvoiceId: readStripeId(subscription.latest_invoice),
    currentPeriodEnd: fromUnixTimestamp(subscriptionShape.current_period_end ?? null) ?? null,
  };
}

export function derivePaymentRecordFromInvoice(invoice: Stripe.Invoice): DerivedPaymentRecord | null {
  const planKey = normalizePlanFromInvoice(invoice);
  if (!planKey) {
    return null;
  }

  const plan = getCommercePlanDefinition(planKey);
  return {
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: readInvoicePaymentIntentId(invoice),
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: readInvoiceSubscriptionId(invoice),
    productKey: planKey,
    productLabel: plan.name,
    productType: "subscription",
    amountTotal: invoice.amount_paid ?? invoice.amount_due ?? 0,
    currency: readString(invoice.currency) ?? "mxn",
    paymentStatus: readString(invoice.status) ?? "paid",
    paidAt: fromUnixTimestamp(invoice.status_transitions?.paid_at ?? invoice.created) ?? new Date(),
  };
}

async function persistCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customerId = readStripeId(session.customer);
  const customerEmail =
    readMetadataString(session.metadata as StripeMetadataShape, "customer_email") ?? readString(session.customer_details?.email);
  const user = await resolveStripeEventUser({
    userIdCandidate:
      readMetadataString(session.metadata as StripeMetadataShape, "user_id") ?? readString(session.client_reference_id),
    customerId,
    customerEmail,
  });

  if (user && customerId) {
    await linkStripeCustomerToUser({ userId: user.id, stripeCustomerId: customerId });
  }

  const paymentRecord = derivePaymentRecordFromCheckoutSession(session);
  if (!paymentRecord) {
    return;
  }

  await upsertCommercePayment({
    userId: user?.id ?? null,
    stripeCustomerId: customerId,
    stripeCheckoutSessionId: paymentRecord.stripeCheckoutSessionId,
    stripePaymentIntentId: paymentRecord.stripePaymentIntentId,
    stripeInvoiceId: paymentRecord.stripeInvoiceId,
    stripeSubscriptionId: paymentRecord.stripeSubscriptionId,
    productKey: paymentRecord.productKey,
    productLabel: paymentRecord.productLabel,
    productType: paymentRecord.productType,
    amountTotal: paymentRecord.amountTotal,
    currency: paymentRecord.currency,
    paymentStatus: paymentRecord.paymentStatus,
    paidAt: paymentRecord.paidAt,
  });

  if (user && customerId && paymentRecord.productType === "subscription" && paymentRecord.stripeSubscriptionId) {
    const planKey = isCommercePlanKey(paymentRecord.productKey) ? paymentRecord.productKey : null;
    if (planKey) {
      await upsertCommerceSubscription({
        userId: user.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: paymentRecord.stripeSubscriptionId,
        stripePriceId: null,
        planKey,
        status: paymentRecord.paymentStatus === "paid" ? "active" : paymentRecord.paymentStatus,
        latestInvoiceId: paymentRecord.stripeInvoiceId,
        currentPeriodEnd: null,
      });
    }
  }
}

async function persistSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = readStripeId(subscription.customer);
  const user = await resolveStripeEventUser({
    userIdCandidate: readMetadataString(subscription.metadata as StripeMetadataShape, "user_id"),
    customerId,
    customerEmail: readMetadataString(subscription.metadata as StripeMetadataShape, "customer_email"),
  });
  if (!user || !customerId) {
    return;
  }

  await linkStripeCustomerToUser({ userId: user.id, stripeCustomerId: customerId });
  const record = deriveSubscriptionRecordFromSubscription(subscription);
  if (!record) {
    return;
  }

  await upsertCommerceSubscription({
    userId: user.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    stripePriceId: record.stripePriceId,
    planKey: record.planKey,
    status: record.status,
    latestInvoiceId: record.latestInvoiceId,
    currentPeriodEnd: record.currentPeriodEnd,
  });
}

async function persistInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = readStripeId(invoice.customer);
  const user = await resolveStripeEventUser({
    userIdCandidate: readMetadataString(invoice.metadata as StripeMetadataShape, "user_id"),
    customerId,
    customerEmail: readMetadataString(invoice.metadata as StripeMetadataShape, "customer_email"),
  });
  if (!user || !customerId) {
    return;
  }

  await linkStripeCustomerToUser({ userId: user.id, stripeCustomerId: customerId });

  const paymentRecord = derivePaymentRecordFromInvoice(invoice);
  if (paymentRecord) {
    await upsertCommercePayment({
      userId: user.id,
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: paymentRecord.stripeCheckoutSessionId,
      stripePaymentIntentId: paymentRecord.stripePaymentIntentId,
      stripeInvoiceId: paymentRecord.stripeInvoiceId,
      stripeSubscriptionId: paymentRecord.stripeSubscriptionId,
      productKey: paymentRecord.productKey,
      productLabel: paymentRecord.productLabel,
      productType: paymentRecord.productType,
      amountTotal: paymentRecord.amountTotal,
      currency: paymentRecord.currency,
      paymentStatus: paymentRecord.paymentStatus,
      paidAt: paymentRecord.paidAt,
    });
  }

  const planKey = normalizePlanFromInvoice(invoice);
  const subscriptionId = readInvoiceSubscriptionId(invoice);
  if (planKey && subscriptionId) {
    await upsertCommerceSubscription({
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: null,
      planKey,
      status: readString(invoice.status) === "paid" ? "active" : readString(invoice.status) ?? "open",
      latestInvoiceId: invoice.id,
      currentPeriodEnd: null,
    });
  }
}

async function persistStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await persistCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await persistSubscriptionUpdate(event.data.object as Stripe.Subscription);
      return;
    case "invoice.paid":
      await persistInvoicePaid(event.data.object as Stripe.Invoice);
      return;
    default:
      return;
  }
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

      await persistStripeEvent(event);
      return res.json({ received: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook inválido";
      console.error("[Stripe webhook] processing_failed", message);
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
