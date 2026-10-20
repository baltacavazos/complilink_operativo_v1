import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request } from "express";

const WEBHOOK_PATH = "/api/whatsapp/webhook";

type QueryValue = string | string[] | undefined;

function firstQueryValue(value: QueryValue): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

/** Express qs turns `hub.mode` into `{ hub: { mode } }`. Meta sends the dotted names. */
function readHubParam(query: Request["query"], name: "mode" | "verify_token" | "challenge") {
  const flat = firstQueryValue(query[`hub.${name}`] as QueryValue);
  if (flat) return flat;
  const hub = query.hub;
  if (!hub || typeof hub !== "object" || Array.isArray(hub)) return "";
  return firstQueryValue((hub as Record<string, QueryValue>)[name]);
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function last4Digits(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function summarizeInbound(body: unknown) {
  const entries = Array.isArray((body as { entry?: unknown })?.entry)
    ? ((body as { entry: unknown[] }).entry)
    : [];
  let messages = 0;
  let statuses = 0;
  const last4: string[] = [];
  const remember = (value: unknown) => {
    const tail = last4Digits(value);
    if (tail) last4.push(tail);
  };

  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown })?.changes)
      ? ((entry as { changes: unknown[] }).changes)
      : [];
    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown[]; statuses?: unknown[] } })?.value ?? {};
      const messageList = Array.isArray(value.messages) ? value.messages : [];
      const statusList = Array.isArray(value.statuses) ? value.statuses : [];
      messages += messageList.length;
      statuses += statusList.length;
      for (const message of messageList) {
        remember((message as { from?: unknown })?.from);
      }
      for (const status of statusList) {
        remember((status as { recipient_id?: unknown })?.recipient_id);
      }
    }
  }

  return { messages, statuses, last4 };
}

function signatureMatches(rawBody: string, header: string | undefined, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const received = header.slice("sha256=".length).trim();
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqual(expected, received);
}

export function registerWhatsappInboundWebhook(app: Express) {
  app.get(WEBHOOK_PATH, (req, res) => {
    const mode = readHubParam(req.query, "mode");
    const token = readHubParam(req.query, "verify_token");
    const challenge = readHubParam(req.query, "challenge");
    const expected = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "").trim();
    if (mode === "subscribe" && expected && challenge && safeEqual(token, expected)) {
      res.status(200).type("text/plain").send(challenge);
      return;
    }
    res.status(403).type("text/plain").send("Forbidden");
  });

  app.post(WEBHOOK_PATH, (req, res) => {
    const secret = (process.env.WHATSAPP_APP_SECRET ?? "").trim();
    if (secret) {
      const header = req.get("x-hub-signature-256");
      const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
      if (!signatureMatches(rawBody, header, secret)) {
        res.status(403).type("text/plain").send("Forbidden");
        return;
      }
    }

    const summary = summarizeInbound(req.body);
    console.info("[whatsapp inbound]", summary);
    res.status(200).json({ received: true });
  });
}
