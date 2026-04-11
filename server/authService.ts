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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

async function signEmailChallengeToken(payload: { email: string; codeHash: string; name: string }) {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const expirationSeconds = Math.floor((Date.now() + EMAIL_CODE_TTL_MS) / 1000);

  return new SignJWT({
    email: payload.email,
    codeHash: payload.codeHash,
    name: payload.name,
    purpose: "email_login",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

async function verifyEmailChallengeToken(token: string | undefined | null) {
  if (!token) {
    throw new Error("No active email verification challenge");
  }

  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });

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

async function signGoogleStateToken(payload: { returnTo: string }) {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const expirationSeconds = Math.floor((Date.now() + GOOGLE_STATE_TTL_MS) / 1000);

  return new SignJWT({ purpose: "google_oauth", returnTo: payload.returnTo })
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
    returnTo: typeof payload.returnTo === "string" ? payload.returnTo : "/",
  };
}

export function isGoogleOAuthConfigured() {
  return Boolean(ENV.googleClientId && ENV.googleClientSecret);
}

export function getGoogleCallbackUrl(req: Request) {
  return `${getBaseUrl(req)}${GOOGLE_CALLBACK_PATH}`;
}

export async function buildGoogleAuthorizationUrl(req: Request, returnTo: string = "/") {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Google OAuth is not configured");
  }

  const state = await signGoogleStateToken({ returnTo });
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
  const existingUser = normalizedEmail ? await db.getUserByEmail(normalizedEmail) : undefined;
  const openId = existingUser?.openId ?? `${params.provider}:${params.providerUserId}`;
  const name = params.name?.trim() || existingUser?.name || normalizedEmail || params.providerUserId;

  await db.upsertUser({
    openId,
    name,
    email: normalizedEmail ?? existingUser?.email ?? null,
    loginMethod: params.provider,
    lastSignedIn: new Date(),
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
  res.clearCookie(EMAIL_LOGIN_COOKIE, { ...cookieOptions, maxAge: -1 });
}

async function sendEmailCodeWithResend(params: { email: string; code: string }) {
  if (!ENV.resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!ENV.resendFromEmail) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.resendFromEmail,
      to: [params.email],
      subject: "Tu código de acceso a CompliLink",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827"><h2>CompliLink</h2><p>Usa este código para iniciar sesión:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${params.code}</p><p>El código expira en 10 minutos.</p></div>`,
      text: `Tu código de acceso a CompliLink es ${params.code}. Expira en 10 minutos.`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend rejected the request: ${response.status} ${errorText}`);
  }
}

export async function startEmailLogin(params: { req: Request; res: Response; email: string; name?: string | null }) {
  const email = normalizeEmail(params.email);
  const code = `${randomInt(100000, 999999)}`;
  const codeHash = hashEmailCode(email, code);
  const challengeToken = await signEmailChallengeToken({
    email,
    codeHash,
    name: buildFallbackName(email, params.name),
  });

  await sendEmailCodeWithResend({ email, code });
  setEmailChallengeCookie(params.req, params.res, challengeToken);

  return {
    maskedEmail: maskEmail(email),
    expiresInSeconds: Math.floor(EMAIL_CODE_TTL_MS / 1000),
  };
}

export async function completeEmailLogin(params: { req: Request; res: Response; email: string; code: string; name?: string | null }) {
  const cookies = parseCookies(params.req);
  const challenge = await verifyEmailChallengeToken(cookies[EMAIL_LOGIN_COOKIE]);
  const normalizedEmail = normalizeEmail(params.email);

  if (challenge.email !== normalizedEmail) {
    throw new Error("Email does not match the active verification challenge");
  }

  const submittedCodeHash = hashEmailCode(normalizedEmail, params.code.trim());
  if (submittedCodeHash !== challenge.codeHash) {
    throw new Error("Invalid verification code");
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

  return user;
}

export async function completeGoogleLogin(params: { req: Request; res: Response; code: string; state: string }) {
  if (!isGoogleOAuthConfigured()) {
    throw new Error("Google OAuth is not configured");
  }

  const { returnTo } = await verifyGoogleStateToken(params.state);
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

  return { returnTo, user };
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
