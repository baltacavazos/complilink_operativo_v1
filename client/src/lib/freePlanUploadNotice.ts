import {
  FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE,
  FREE_TIER_EXHAUSTED_COPY,
  isFreePlanDocumentLimitMessage,
} from "@shared/commerce";

export type FreePlanUploadNotice = {
  message: string;
  detail: string;
};

export function readUploadErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (!error || typeof error !== "object" || !("message" in error)) {
    return "";
  }

  const message = error.message;
  return typeof message === "string" ? message : "";
}

/** El tope del plan gratis es un límite de plan, no un fallo de carga ni de validación del recibo. */
export function freePlanUploadNoticeFromError(error: unknown): FreePlanUploadNotice | null {
  if (!isFreePlanDocumentLimitMessage(readUploadErrorMessage(error))) {
    return null;
  }

  return {
    message: FREE_TIER_EXHAUSTED_COPY,
    detail: FREE_DOCUMENT_LIMIT_BLOCK_MESSAGE,
  };
}
