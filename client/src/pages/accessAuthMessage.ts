export type ParsedAuthMessage = {
  message: string;
  retryAfterSeconds: number | null;
  code: string | null;
};

export function parseStructuredAuthMessage(rawMessage: string): ParsedAuthMessage {
  const [baseMessage, ...tokens] = rawMessage.split("||");
  let retryAfterSeconds: number | null = null;
  let code: string | null = null;

  for (const token of tokens) {
    if (token.startsWith("retry_after=")) {
      const parsedSeconds = Number(token.replace("retry_after=", ""));
      retryAfterSeconds = Number.isFinite(parsedSeconds) ? parsedSeconds : null;
    }

    if (token.startsWith("code=")) {
      code = token.replace("code=", "") || null;
    }
  }

  return {
    message: baseMessage.trim(),
    retryAfterSeconds,
    code,
  };
}

export function getFriendlyAuthMessage(parsed: ParsedAuthMessage) {
  switch (parsed.code) {
    case "EMAIL_CODE_COOLDOWN_ACTIVE":
      return parsed.retryAfterSeconds
        ? `Espera ${parsed.retryAfterSeconds}s para pedir otro código.`
        : "Espera un momento antes de pedir otro código.";
    case "EMAIL_CODE_RATE_LIMITED":
      return "Ya enviamos varios códigos a este correo. Intenta de nuevo más tarde.";
    case "EMAIL_CODE_EXPIRED":
      return "Ese código ya venció. Pide uno nuevo.";
    case "INVALID_EMAIL_CODE":
      return "Código incorrecto. Revisa tu correo e inténtalo otra vez.";
    default:
      return parsed.message;
  }
}
