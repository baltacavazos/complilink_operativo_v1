import { Capacitor } from "@capacitor/core";

export const NATIVE_PUBLIC_WEB_ORIGIN = "https://auditapatron.com";

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

export function getAppPathFromUrl(rawUrl?: string | null) {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const knownHosts = new Set([
      "auditapatron.com",
      "www.auditapatron.com",
      "localhost",
      "127.0.0.1",
    ]);

    const isNativeScheme = url.protocol === "auditapatron:";
    const isKnownWebHost = knownHosts.has(url.hostname);

    if (!isNativeScheme && !isKnownWebHost) {
      return null;
    }

    const slug = `${url.pathname}${url.search}${url.hash}`;
    return slug.startsWith("/") ? slug : `/${slug}`;
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
