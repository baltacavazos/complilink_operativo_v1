import { describe, expect, it } from "vitest";
import {
  FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE,
  FREE_TIER_EXHAUSTED_COPY,
  formatDocumentLimitBlockedMessage,
} from "@shared/commerce";
import { freePlanUploadNoticeFromError } from "./freePlanUploadNotice";

describe("aviso de tope del plan gratis al subir", () => {
  it("traduce el 403 del segundo documento a la frase de Claridad", () => {
    const notice = freePlanUploadNoticeFromError({
      message: formatDocumentLimitBlockedMessage(1),
      data: { code: "FORBIDDEN" },
    });

    expect(notice).toEqual({
      message: FREE_TIER_EXHAUSTED_COPY,
      detail: FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE,
    });
    expect(notice?.message).toBe(
      "En el plan gratis ya usaste tu documento. Si quieres subir otro, activa Audita Esencial.",
    );
    expect(notice?.message).not.toMatch(/interrumpió la carga|validar el recibo|reintentar ahora/i);
  });

  it("reconoce el mensaje aunque llegue con espacio extra o el prefijo del cliente", () => {
    expect(
      freePlanUploadNoticeFromError(
        new Error(`  ${FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE}  `),
      )?.message,
    ).toBe(FREE_TIER_EXHAUSTED_COPY);
    expect(
      freePlanUploadNoticeFromError(
        new Error(`TRPCClientError: ${FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE}`),
      )?.message,
    ).toBe(FREE_TIER_EXHAUSTED_COPY);
  });

  it("deja intactos un tope de plan de pago, una red caída y un recibo que no se pudo validar", () => {
    expect(freePlanUploadNoticeFromError(new Error(formatDocumentLimitBlockedMessage(15)))).toBeNull();
    expect(freePlanUploadNoticeFromError(new Error("Failed to fetch"))).toBeNull();
    expect(
      freePlanUploadNoticeFromError(new Error("No pudimos validar el recibo. Intenta de nuevo.")),
    ).toBeNull();
    expect(
      freePlanUploadNoticeFromError(
        new Error("Algo interrumpió la carga, pero tus datos siguen a salvo."),
      ),
    ).toBeNull();
    expect(freePlanUploadNoticeFromError(new Error("No fue posible guardar el documento."))).toBeNull();
  });
});
