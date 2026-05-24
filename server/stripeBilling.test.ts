import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  derivePaymentRecordFromCheckoutSession,
  derivePaymentRecordFromInvoice,
  deriveSubscriptionRecordFromSubscription,
} from "./stripeBilling";

describe("stripeBilling projections", () => {
  it("deriva un pago local desde checkout.session.completed", () => {
    const session = {
      id: "cs_test_123",
      payment_intent: "pi_test_123",
      invoice: "in_test_123",
      subscription: "sub_test_123",
      amount_total: 7900,
      currency: "mxn",
      payment_status: "paid",
      status: "complete",
      created: 1779580000,
      metadata: {
        app_product_key: "essential",
        app_product_name: "Audita Esencial",
        user_id: "42",
      },
    } as unknown as Stripe.Checkout.Session;

    const record = derivePaymentRecordFromCheckoutSession(session);

    expect(record).toMatchObject({
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_test_123",
      stripeInvoiceId: "in_test_123",
      stripeSubscriptionId: "sub_test_123",
      productKey: "essential",
      productLabel: "Audita Esencial",
      productType: "subscription",
      amountTotal: 7900,
      currency: "mxn",
      paymentStatus: "paid",
    });
    expect(record?.paidAt.toISOString()).toBe("2026-05-23T23:46:40.000Z");
  });

  it("deriva una suscripción local desde customer.subscription.updated", () => {
    const subscription = {
      id: "sub_test_pro",
      status: "active",
      latest_invoice: "in_latest_123",
      current_period_end: 1779666400,
      metadata: {
        app_plan: "pro",
      },
      items: {
        data: [
          {
            price: {
              id: "price_test_pro",
              nickname: "Audita Pro",
              product: {
                name: "Audita Pro",
              },
            },
          },
        ],
      },
    } as unknown as Stripe.Subscription;

    const record = deriveSubscriptionRecordFromSubscription(subscription);

    expect(record).toMatchObject({
      stripeSubscriptionId: "sub_test_pro",
      stripePriceId: "price_test_pro",
      planKey: "pro",
      status: "active",
      latestInvoiceId: "in_latest_123",
    });
    expect(record?.currentPeriodEnd?.toISOString()).toBe("2026-05-24T23:46:40.000Z");
  });

  it("deriva un pago de factura desde invoice.paid", () => {
    const invoice = {
      id: "in_paid_123",
      payment_intent: "pi_paid_123",
      subscription: "sub_paid_123",
      amount_paid: 19900,
      amount_due: 19900,
      currency: "mxn",
      status: "paid",
      created: 1779580000,
      status_transitions: {
        paid_at: 1779583600,
      },
      metadata: {},
      lines: {
        data: [
          {
            description: "Audita Pro · mayo 2026",
          },
        ],
      },
    } as unknown as Stripe.Invoice;

    const record = derivePaymentRecordFromInvoice(invoice);

    expect(record).toMatchObject({
      stripeInvoiceId: "in_paid_123",
      stripePaymentIntentId: "pi_paid_123",
      stripeSubscriptionId: "sub_paid_123",
      productKey: "pro",
      productLabel: "Audita Pro",
      productType: "subscription",
      amountTotal: 19900,
      currency: "mxn",
      paymentStatus: "paid",
    });
    expect(record?.paidAt.toISOString()).toBe("2026-05-24T00:46:40.000Z");
  });

  it("devuelve null cuando un checkout no trae metadata comercial reconocible", () => {
    const session = {
      id: "cs_unknown",
      metadata: {},
      created: 1779580000,
    } as unknown as Stripe.Checkout.Session;

    expect(derivePaymentRecordFromCheckoutSession(session)).toBeNull();
  });
});
