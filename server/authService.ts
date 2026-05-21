import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { createHash, randomInt } from "crypto";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const EMAIL_LOGIN_COOKIE = "complilink_email_login";
const EMAIL_CODE_TTL_MS = 1000 * 60 * 10;
const GOOGLE_STATE_TTL_MS = 1000 * 60 * 10;
const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
const GOOGLE_START_PATH = "/api/auth/google/start";
const EMAIL_RESEND_COOLDOWN_MS = 1000 * 60;
const EMAIL_RESEND_WINDOW_MS = 1000 * 60 * 60;
const EMAIL_RESEND_MAX_REQUESTS = 5;
const EMAIL_CHALLENGE_CLOCK_TOLERANCE_SECONDS = 30;
const AUTH_BRAND_NAME = "Auditapatron";

type PendingEmailChallenge = {
  email: string;
  codeHash: string;
  name: string;
  issuedAt: number;
  expiresAt: number;
};

const emailLoginRateByEmail = new Map<string, { lastSentAt: number; windowStartedAt: number; sentCount: number }>();
const pendingEmailChallengesByEmail = new Map<string, PendingEmailChallenge>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeReturnToPath(returnTo?: string | null) {
  if (!returnTo || !returnTo.startsWith("/")) {
    return "/";
  }

  return returnTo;
}

function getBaseUrl(req: Request) {
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol || "https";
  const host = req.get("host");
  if (!host) {
    throw new Error("Missing request host");
  }
  return `${protocol}://${host}`;
}

function hashEmailCode(email: string, code: string) {
  return createHash("sha256")
    .update(`${normalizeEmail(email)}:${code}:${ENV.cookieSecret}`)
    .digest("hex");
}

function parseCookies(req: Request) {
  return parseCookieHeader(req.headers.cookie ?? "");
}

function maskEmail(email: string) {
  const normalized = normalizeEmail(email);
  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) return normalized;
  const visibleStart = localPart.slice(0, Math.min(2, localPart.length));
  return `${visibleStart}${"*".repeat(Math.max(1, localPart.length - visibleStart.length))}@${domain}`;
}

function buildFallbackName(email: string, providedName?: string | null) {
  const candidate = providedName?.trim();
  if (candidate) return candidate;
  return normalizeEmail(email);
}

function isResendExternalRecipientRestriction(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("resend rejected the request: 403") && message.includes("you can only send testing emails to your own email address");
}

export class AuthFlowError extends Error {
  constructor(
    public readonly code:
      | "EMAIL_CODE_COOLDOWN_ACTIVE"
      | "EMAIL_CODE_RATE_LIMITED"
      | "INVALID_EMAIL_CODE"
      | "EMAIL_CODE_EXPIRED",
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AuthFlowError";
  }
}

function getEmailRateState(email: string, now = Date.now()) {
  const currentState = emailLoginRateByEmail.get(email);
  if (!currentState) {
    return {
      lastSentAt: 0,
      windowStartedAt: now,
      sentCount: 0,
    };
  }

  if (now - currentState.windowStartedAt >= EMAIL_RESEND_WINDOW_MS) {
    return {
      lastSentAt: currentState.lastSentAt,
      windowStartedAt: now,
      sentCount: 0,
    };
  }

  return currentState;
}

function assertEmailCodeRequestAllowed(email: string, now = Date.now()) {
  const state = getEmailRateState(email, now);
  const cooldownRemainingMs = state.lastSentAt ? EMAIL_RESEND_COOLDOWN_MS - (now - state.lastSentAt) : 0;
  if (cooldownRemainingMs > 0) {
    throw new AuthFlowError(
      "EMAIL_CODE_COOLDOWN_ACTIVE",
      "Debes esperar antes de solicitar otro código. Intenta de nuevo en unos segundos.",
      Math.ceil(cooldownRemainingMs / 1000),
    );
  }

  if (state.sentCount >= EMAIL_RESEND_MAX_REQUESTS) {
    const windowRemainingMs = EMAIL_RESEND_WINDOW_MS - (now - state.windowStartedAt);
    throw new AuthFlowError(
      "EMAIL_CODE_RATE_LIMITED",
      "Ya enviamos demasiados códigos a este correo en la última hora. Espera antes de intentarlo otra vez.",
      Math.max(60, Math.ceil(windowRemainingMs / 1000)),
    );
  }
}

function recordEmailCodeRequest(email: string, now = Date.now()) {
  const state = getEmailRateState(email, now);
  emailLoginRateByEmail.set(email, {
    lastSentAt: now,
    windowStartedAt: state.windowStartedAt,
    sentCount: state.sentCount + 1,
  });
}

function clearEmailCodeRequestState(email: string) {
  emailLoginRateByEmail.delete(email);
}

function createPendingEmailChallenge(payload: { email: string; codeHash: string; name: string }): PendingEmailChallenge {
  const issuedAt = Date.now();
  return {
    email: payload.email,
    codeHash: payload.codeHash,
    name: payload.name,
    issuedAt,
    expiresAt: issuedAt + EMAIL_CODE_TTL_MS,
  };
}

function setPendingEmailChallenge(challenge: PendingEmailChallenge) {
  pendingEmailChallengesByEmail.set(challenge.email, challenge);
}

function getPendingEmailChallenge(email: string, now = Date.now()) {
  const challenge = pendingEmailChallengesByEmail.get(email);
  if (!challenge) {
    return null;
  }

  if (challenge.expiresAt <= now) {
    pendingEmailChallengesByEmail.delete(email);
    return null;
  }

  return challenge;
}

function clearPendingEmailChallenge(email: string) {
  pendingEmailChallengesByEmail.delete(email);
}

async function signEmailChallengeToken(payload: PendingEmailChallenge) {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const issuedAtSeconds = Math.floor(payload.issuedAt / 1000);
  const expirationSeconds = Math.floor(payload.expiresAt / 1000);

  return new SignJWT({
    email: payload.email,
    codeHash: payload.codeHash,
    name: payload.name,
    purpose: "email_login",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

async function verifyEmailChallengeToken(token: string | undefined | null) {
  if (!token) {
    throw new Error("No active email verification challenge");
  }

  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
    clockTolerance: EMAIL_CHALLENGE_CLOCK_TOLERANCE_SECONDS,
  });

  if (payload.purpose !== "email_login") {
    throw new Error("Invalid email verification challenge");
  }

  const email = typeof payload.email === "string" ? payload.email : "";
  const codeHash = typeof payload.codeHash === "string" ? payload.codeHash : "";
  const name = typeof payload.name === "string" ? payload.name : "";

  if (!email || !codeHash || !name) {
    throw new Error("Incomplete email verification challenge");
  }

  return { email, codeHash, name };
}

async function signGoogleStateToken(payload: { returnTo: string; nativeApp?: boolean }) {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const expirationSeconds = Math.floor((Date.now() + GOOGLE_STATE_TTL_MS) / 1000);

  return new SignJWT({
    purpose: "google_oauth",
    returnTo: normalizeReturnToPath(payload.returnTo),
    nativeApp: payload.nativeApp === true,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

export async function verifyGoogleStateToken(token: string) {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
  if (payload.purpose !== "google_oauth") {
    throw new Error("Invalid Google OAuth state");
  }

  return {
    returnTo: normalizeReturnToPath(typeof payload.returnTo === "string" ? payload.returnTo : "/"),
    nativeApp: payload.nativeApp === true,
  };
}

export function isGoogleOAuthConfigured() {
  return Boolean(ENV.googleClientId && ENV.googleClientSecret);
}

export function getGoogleCallbackUrl(req: Request) {
  return `${getBaseUrl(req)}${GOOGLE_CALLBACK_PATH}`;
}

export async function buildGoogleAuthorizationUrl(
  req: Request,
  returnTo: string = "/",
  options?: { nativeApp?: boolean },
) {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Google OAuth is not configured");
  }

  const state = await signGoogleStateToken({
    returnTo: normalizeReturnToPath(returnTo),
    nativeApp: options?.nativeApp === true,
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", ENV.googleClientId);
  url.searchParams.set("redirect_uri", getGoogleCallbackUrl(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function resolveOrCreateUser(params: {
  provider: "email" | "google" | "manus";
  providerUserId: string;
  email?: string | null;
  name?: string | null;
}) {
  const normalizedEmail = params.email ? normalizeEmail(params.email) : null;
  const isOwnerManusIdentity = params.provider === "manus" && params.providerUserId === ENV.ownerOpenId;
  const providerScopedOpenId = params.provider === "manus"
    ? params.providerUserId
    : `${params.provider}:${params.providerUserId}`;
  const canonicalOwnerUser = isOwnerManusIdentity ? await db.getUserByOpenId(ENV.ownerOpenId) : undefined;
  const existingProviderUser = isOwnerManusIdentity ? canonicalOwnerUser : await db.getUserByOpenId(providerScopedOpenId);
  const existingUserByEmail = normalizedEmail ? await db.getUserByEmail(normalizedEmail) : undefined;
  const existingUser = canonicalOwnerUser ?? existingProviderUser ?? existingUserByEmail;
  const openId = isOwnerManusIdentity ? ENV.ownerOpenId : existingUser?.openId ?? providerScopedOpenId;
  const name = params.name?.trim() || existingUser?.name || normalizedEmail || params.providerUserId;

  await db.upsertUser({
    openId,
    name,
    email: normalizedEmail ?? existingUser?.email ?? null,
    loginMethod: params.provider,
    lastSignedIn: new Date(),
    ...(isOwnerManusIdentity ? { role: "admin" as const } : {}),
  });

  const user = await db.getUserByOpenId(openId);
  if (!user) {
    throw new Error("Could not resolve user after sign-in");
  }

  return user;
}

export async function createAppSessionForUser(req: Request, res: Response, params: { openId: string; name: string }) {
  const sessionToken = await sdk.createSessionToken(params.openId, {
    name: params.name,
    expiresInMs: ONE_YEAR_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

function setEmailChallengeCookie(req: Request, res: Response, token: string) {
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(EMAIL_LOGIN_COOKIE, token, { ...cookieOptions, maxAge: EMAIL_CODE_TTL_MS });
}

export function clearEmailChallengeCookie(req: Request, res: Response) {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(EMAIL_LOGIN_COOKIE, cookieOptions);
}

export async function createTestingEmailLoginChallenge(params: {
  req: Request;
  res: Response;
  email: string;
  name?: string | null;
  code?: string;
}) {
  const email = normalizeEmail(params.email);
  const code = params.code?.trim() || "111111";

  if (!/^\d{6}$/.test(code)) {
    throw new Error("Testing email code must contain exactly 6 digits");
  }

  const challenge = createPendingEmailChallenge({
    email,
    codeHash: hashEmailCode(email, code),
    name: buildFallbackName(email, params.name),
  });
  const challengeToken = await signEmailChallengeToken(challenge);

  setPendingEmailChallenge(challenge);
  setEmailChallengeCookie(params.req, params.res, challengeToken);

  return {
    email,
    code,
    name: challenge.name,
  } as const;
}

type ResendAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

export async function sendEmailWithResend(params: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: ResendAttachment[];
}) {
  if (!ENV.resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!ENV.resendFromEmail) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  const fromAddress = ENV.resendFromEmail.includes("<")
    ? ENV.resendFromEmail
    : `${AUTH_BRAND_NAME} <${ENV.resendFromEmail}>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        content_type: attachment.contentType,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend rejected the request: ${response.status} ${errorText}`);
  }
}

async function sendEmailCodeWithResend(params: { email: string; code: string }) {
  await sendEmailWithResend({
    to: [params.email],
    subject: `Tu código de acceso a ${AUTH_BRAND_NAME}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827"><h2>${AUTH_BRAND_NAME}</h2><p>Usa este código para iniciar sesión:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${params.code}</p><p>El código expira en 10 minutos.</p><p style="margin-top:18px;color:#475569">Tu acceso es privado. Si después decides asegurar evidencia, podrás conservarla en tu Bóveda Laboral con un resguardo serio y visible.</p></div>`,
    text: `Tu código de acceso a ${AUTH_BRAND_NAME} es ${params.code}. Expira en 10 minutos. Tu acceso es privado. Si después decides asegurar evidencia, podrás conservarla en tu Bóveda Laboral con un resguardo serio y visible.`,
  });
}

async function deliverEmailCode(params: { requestedEmail: string; code: string }) {
  try {
    await sendEmailCodeWithResend({ email: params.requestedEmail, code: params.code });
    return { deliveredToEmail: params.requestedEmail, usedOwnerBackupEmail: false };
  } catch (error) {
    const ownerUser = await db.getUserByEmail(params.requestedEmail);
    const ownerBackupEmail = normalizeEmail(ENV.ownerBackupEmail || "");
    const canUseOwnerFallback = Boolean(ownerUser?.role === "admin" && ownerBackupEmail && ownerBackupEmail !== params.requestedEmail);

    if (!canUseOwnerFallback || !isResendExternalRecipientRestriction(error)) {
      throw error;
    }

    await sendEmailCodeWithResend({ email: ownerBackupEmail, code: params.code });
    return { deliveredToEmail: ownerBackupEmail, usedOwnerBackupEmail: true };
  }
}

export async function startEmailLogin(params: { req: Request; res: Response; email: string; name?: string | null }) {
  const email = normalizeEmail(params.email);
  assertEmailCodeRequestAllowed(email);

  const code = `${randomInt(100000, 999999)}`;
  const challenge = createPendingEmailChallenge({
    email,
    codeHash: hashEmailCode(email, code),
    name: buildFallbackName(email, params.name),
  });
  const challengeToken = await signEmailChallengeToken(challenge);

  const delivery = await deliverEmailCode({ requestedEmail: email, code });
  recordEmailCodeRequest(email);
  setPendingEmailChallenge(challenge);
  setEmailChallengeCookie(params.req, params.res, challengeToken);

  return {
    maskedEmail: maskEmail(delivery.deliveredToEmail),
    usedOwnerBackupEmail: delivery.usedOwnerBackupEmail,
    expiresInSeconds: Math.floor(EMAIL_CODE_TTL_MS / 1000),
    cooldownSeconds: Math.floor(EMAIL_RESEND_COOLDOWN_MS / 1000),
    maxRequestsPerWindow: EMAIL_RESEND_MAX_REQUESTS,
    rateLimitWindowSeconds: Math.floor(EMAIL_RESEND_WINDOW_MS / 1000),
  };
}

export async function completeEmailLogin(params: { req: Request; res: Response; email: string; code: string; name?: string | null }) {
  const cookies = parseCookies(params.req);
  const normalizedEmail = normalizeEmail(params.email);
  const submittedCodeHash = hashEmailCode(normalizedEmail, params.code.trim());

  let challenge: Awaited<ReturnType<typeof verifyEmailChallengeToken>> | PendingEmailChallenge | null = null;
  try {
    challenge = await verifyEmailChallengeToken(cookies[EMAIL_LOGIN_COOKIE]);
  } catch {
    challenge = getPendingEmailChallenge(normalizedEmail);
  }

  if (!challenge) {
    throw new AuthFlowError(
      "EMAIL_CODE_EXPIRED",
      "El código ya expiró o esta solicitud ya no es válida. Solicita uno nuevo para continuar.",
    );
  }

  if (challenge.email !== normalizedEmail) {
    throw new AuthFlowError(
      "INVALID_EMAIL_CODE",
      "El código no coincide con el correo que estás intentando validar. Verifica el dato e inténtalo otra vez.",
    );
  }

  if (submittedCodeHash !== challenge.codeHash) {
    throw new AuthFlowError(
      "INVALID_EMAIL_CODE",
      "El código es incorrecto o ya expiró. Revisa tu correo e inténtalo otra vez.",
    );
  }

  const user = await resolveOrCreateUser({
    provider: "email",
    providerUserId: normalizedEmail,
    email: normalizedEmail,
    name: params.name ?? challenge.name,
  });

  await createAppSessionForUser(params.req, params.res, {
    openId: user.openId,
    name: user.name ?? normalizedEmail,
  });
  clearEmailChallengeCookie(params.req, params.res);
  clearEmailCodeRequestState(normalizedEmail);
  clearPendingEmailChallenge(normalizedEmail);

  return user;
}

export async function completeGoogleLogin(params: { req: Request; res: Response; code: string; state: string }) {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Google OAuth is not configured");
  }

  const { returnTo, nativeApp } = await verifyGoogleStateToken(params.state);
  const redirectUri = getGoogleCallbackUrl(params.req);

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google token exchange failed: ${tokenResponse.status} ${errorText}`);
  }

  const tokenJson = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Google token exchange returned no access token");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!profileResponse.ok) {
    const errorText = await profileResponse.text();
    throw new Error(`Google profile request failed: ${profileResponse.status} ${errorText}`);
  }

  const profile = (await profileResponse.json()) as { sub?: string; email?: string; name?: string };
  if (!profile.sub || !profile.email) {
    throw new Error("Google profile is missing required identity fields");
  }

  const user = await resolveOrCreateUser({
    provider: "google",
    providerUserId: profile.sub,
    email: profile.email,
    name: profile.name ?? profile.email,
  });

  await createAppSessionForUser(params.req, params.res, {
    openId: user.openId,
    name: user.name ?? profile.email,
  });

  return { returnTo, nativeApp, user };
}

export async function syncManusUser(params: { openId: string; email?: string | null; name?: string | null }) {
  return resolveOrCreateUser({
    provider: "manus",
    providerUserId: params.openId,
    email: params.email ?? null,
    name: params.name ?? null,
  });
}

export function getGoogleStartPath() {
  return GOOGLE_START_PATH;
}
