import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const HOST_ONLY_SUFFIXES = [".manus.space", ".manus.computer"];

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function shouldKeepHostOnly(hostname: string) {
  if (!hostname) return true;
  if (LOCAL_HOSTS.has(hostname)) return true;
  if (isIpAddress(hostname)) return true;

  return HOST_ONLY_SUFFIXES.some(
    suffix => hostname === suffix.slice(1) || hostname.endsWith(suffix),
  );
}

export function getSharedCookieDomain(hostname: string) {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (shouldKeepHostOnly(normalizedHostname)) {
    return undefined;
  }

  const labels = normalizedHostname.split(".").filter(Boolean);
  if (labels.length < 2) {
    return undefined;
  }

  return labels.slice(-2).join(".");
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);
  const domain = getSharedCookieDomain(req.hostname || "");

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  };
}
