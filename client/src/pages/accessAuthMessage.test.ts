import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getFriendlyAuthMessage, parseStructuredAuthMessage } from "./accessAuthMessage";

const accessSource = readFileSync(resolve(process.cwd(), "client/src/pages/Access.tsx"), "utf8");

describe("access email code messages", () => {
  it("shows the expired-code copy for a rejected EMAIL_CODE_EXPIRED response", () => {
    const message =
      "El código ya expiró o esta solicitud ya no es válida. Solicita uno nuevo para continuar.||code=EMAIL_CODE_EXPIRED";

    expect(getFriendlyAuthMessage(parseStructuredAuthMessage(message))).toBe(
      "Ese código ya venció. Pide uno nuevo.",
    );
  });

  it("shows the wrong-code copy for INVALID_EMAIL_CODE", () => {
    const message =
      "El código es incorrecto o ya expiró. Revisa tu correo e inténtalo otra vez.||code=INVALID_EMAIL_CODE";

    expect(getFriendlyAuthMessage(parseStructuredAuthMessage(message))).toBe(
      "Código incorrecto. Revisa tu correo e inténtalo otra vez.",
    );
  });

  it("shows the wait copy for cooldown and rate limit", () => {
    expect(
      getFriendlyAuthMessage(
        parseStructuredAuthMessage(
          "Debes esperar antes de solicitar otro código.||retry_after=42||code=EMAIL_CODE_COOLDOWN_ACTIVE",
        ),
      ),
    ).toBe("Espera 42s para pedir otro código.");
    expect(
      getFriendlyAuthMessage(
        parseStructuredAuthMessage("Espera un momento.||code=EMAIL_CODE_COOLDOWN_ACTIVE"),
      ),
    ).toBe("Espera un momento antes de pedir otro código.");
    expect(
      getFriendlyAuthMessage(
        parseStructuredAuthMessage(
          "Ya enviamos demasiados códigos a este correo en la última hora.||code=EMAIL_CODE_RATE_LIMITED",
        ),
      ),
    ).toBe("Ya enviamos varios códigos a este correo. Intenta de nuevo más tarde.");
  });

  it("keeps an unexpected server message visible", () => {
    expect(getFriendlyAuthMessage(parseStructuredAuthMessage("Database not available"))).toBe(
      "Database not available",
    );
  });

  it("still wires verify and request errors through the friendly message", () => {
    expect(accessSource).toContain(
      'import { getFriendlyAuthMessage, parseStructuredAuthMessage } from "./accessAuthMessage"',
    );
    const verifyStart = accessSource.indexOf("const verifyEmailCode = trpc.auth.verifyEmailCode.useMutation");
    const requestStart = accessSource.indexOf("const requestEmailCode = trpc.auth.requestEmailCode.useMutation");
    expect(verifyStart).toBeGreaterThan(-1);
    expect(requestStart).toBeGreaterThan(-1);

    for (const start of [verifyStart, requestStart]) {
      const nextDeclaration = accessSource.indexOf("\n  const ", start + 10);
      const block = accessSource.slice(start, nextDeclaration === -1 ? undefined : nextDeclaration);
      expect(block).toContain("parseStructuredAuthMessage(error.message)");
      expect(block).toContain("setErrorMessage(getFriendlyAuthMessage(parsed))");
    }
  });
});
