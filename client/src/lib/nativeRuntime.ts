import { Capacitor } from "@capacitor/core";

export const NATIVE_PUBLIC_WEB_ORIGIN = "https://auditapatron.com";

const KNOWN_PUBLIC_HOSTS = new Set([
  "auditapatron.com",
  "www.auditapatron.com",
  "localhost",
  "127.0.0.1",
]);

const AUTH_CALLBACK_PATHS = new Set([
  "/api/oauth/callback",
  "/api/auth/google/callback",
]);

function normalizeInternalPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "/";

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.replace(/^\/+/, "/");
}

function getKnownHosts() {
  const hosts = new Set(KNOWN_PUBLIC_HOSTS);

  if (typeof window !== "undefined" && window.location.hostname) {
    hosts.add(window.location.hostname);
  }

  return hosts;
}

function getSafeReturnTo(url: URL) {
  const returnTo = url.searchParams.get("returnTo");
  if (!returnTo || !returnTo.startsWith("/")) {
    return "/";
  }

  return returnTo;
}

function buildNativeSchemePath(url: URL) {
  const hostSegment = url.hostname ? `/${url.hostname}` : "";
  return normalizeInternalPath(`${hostSegment}${url.pathname}${url.search}${url.hash}`);
}

function buildCallbackTarget(url: URL) {
  const returnTo = getSafeReturnTo(url);
  const error = url.searchParams.get("error");

  if (!error) {
    return returnTo;
  }

  const accessUrl = new URL("/acceso", NATIVE_PUBLIC_WEB_ORIGIN);
  accessUrl.searchParams.set("error", error);

  if (returnTo !== "/") {
    accessUrl.searchParams.set("returnTo", returnTo);
  }

  return `${accessUrl.pathname}${accessUrl.search}`;
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getPublicWebOrigin() {
  if (typeof window === "undefined") {
    return NATIVE_PUBLIC_WEB_ORIGIN;
  }

  return isNativeApp() ? NATIVE_PUBLIC_WEB_ORIGIN : window.location.origin;
}

export function buildAbsolutePublicUrl(path: string) {
  return new URL(path, getPublicWebOrigin()).toString();
}

export function getApiBaseUrl() {
  return buildAbsolutePublicUrl("/api/trpc");
}

export function getAppPathFromUrl(rawUrl?: string | null) {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const isNativeScheme = url.protocol === "auditapatron:";
    const isKnownWebHost = getKnownHosts().has(url.hostname);

    if (!isNativeScheme && !isKnownWebHost) {
      return null;
    }

    if (isNativeScheme) {
      return buildNativeSchemePath(url);
    }

    if (AUTH_CALLBACK_PATHS.has(url.pathname)) {
      return buildCallbackTarget(url);
    }

    return normalizeInternalPath(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return null;
  }
}

export async function openExternalUrl(url: string) {
  if (isNativeApp()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }

  window.location.href = url;
}
