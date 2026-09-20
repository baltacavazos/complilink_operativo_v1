export const USER_FACING_DATABASE_ERROR =
  "No pudimos preparar tu expediente ahora. Intenta de nuevo en un momento.";

const RAW_DATABASE_ERROR_RE =
  /ER_NO_SUCH_TABLE|ER_BAD_FIELD_ERROR|ER_NO_REFERENCED_ROW|ER_PARSE_ERROR|SQLSTATE|doesn't exist|does not exist|Unknown column|Unknown table|Table ['`][^'`]+['`]|labor_cases|case_access|tenant_memberships|Duplicate entry|Deadlock found|Lock wait timeout|ECONNREFUSED|PROTOCOL_CONNECTION_LOST|connect ETIMEDOUT/i;

export function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "";
}

export function readErrorCode(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code?: string }).code ?? "");
  }
  return "";
}

export function isDuplicateKeyError(error: unknown): boolean {
  return readErrorCode(error) === "ER_DUP_ENTRY" || /Duplicate entry/i.test(readErrorMessage(error));
}

export function logActionableDatabaseFailure(
  scope: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const databaseUrlConfigured = Boolean(process.env.DATABASE_URL?.trim());
  console.error(`[${scope}] Fallo de base de datos`, {
    ...context,
    code: readErrorCode(error) || undefined,
    cause: readErrorMessage(error) || "sin mensaje",
    databaseUrlConfigured,
    hint: !databaseUrlConfigured
      ? "Falta DATABASE_URL en este servicio. Configúrala y reinicia."
      : "Si es ER_DUP_ENTRY el alta debe reutilizar el tenant/expediente. Si es ER_NO_SUCH_TABLE, el bootstrap de tablas no corrió.",
  });
}

export function isRawDatabaseError(error: unknown): boolean {
  const message = readErrorMessage(error);
  if (!message) {
    return false;
  }

  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code ?? "")
      : "";

  return RAW_DATABASE_ERROR_RE.test(message) || RAW_DATABASE_ERROR_RE.test(code);
}

export function toUserFacingDatabaseError(error: unknown, fallback = USER_FACING_DATABASE_ERROR): Error {
  if (error instanceof Error) {
    if (!isRawDatabaseError(error) && error.message.trim() && !/sql|mysql|drizzle|errno/i.test(error.message)) {
      return error;
    }
    return new Error(fallback);
  }

  return new Error(fallback);
}
