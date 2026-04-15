import { describe, expect, it } from "vitest";
import { getSessionCookieOptions, getSharedCookieDomain } from "./cookies";

function makeRequest(hostname: string, protocol: "http" | "https" = "https") {
  return {
    hostname,
    protocol,
    headers: {
      "x-forwarded-proto": protocol,
    },
  } as never;
}

describe("getSharedCookieDomain", () => {
  it("comparte la cookie entre dominio raíz y www en custom domains", () => {
    expect(getSharedCookieDomain("auditapatron.com")).toBe("auditapatron.com");
    expect(getSharedCookieDomain("www.auditapatron.com")).toBe("auditapatron.com");
  });

  it("mantiene host-only en localhost, IPs y dominios hospedados de preview", () => {
    expect(getSharedCookieDomain("localhost")).toBeUndefined();
    expect(getSharedCookieDomain("127.0.0.1")).toBeUndefined();
    expect(getSharedCookieDomain("3000-abc.us2.manus.computer")).toBeUndefined();
    expect(getSharedCookieDomain("demo.manus.space")).toBeUndefined();
  });
});

describe("getSessionCookieOptions", () => {
  it("usa sameSite lax y un dominio compartido en producción HTTPS", () => {
    expect(getSessionCookieOptions(makeRequest("www.auditapatron.com"))).toMatchObject({
      domain: "auditapatron.com",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("no fuerza domain en entornos locales", () => {
    expect(getSessionCookieOptions(makeRequest("localhost", "http"))).toMatchObject({
      domain: undefined,
      sameSite: "lax",
      secure: false,
    });
  });
});
