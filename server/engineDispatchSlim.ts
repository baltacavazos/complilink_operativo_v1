import type { AuditaPatronEngineDispatchResult, CompliLinkBridgeResponseAck } from "./auditaPatronIntegrationService";

function pickScalar(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function slimBridgeAck(ack: CompliLinkBridgeResponseAck) {
  const contract = ack.responseContract;
  if (!contract || typeof contract === "string") {
    return {
      received: ack.received,
      intakeId: ack.intakeId ?? null,
      documentId: ack.documentId ?? null,
      processingStatus: ack.processingStatus ?? null,
      traceId: ack.traceId ?? null,
      correlationId: ack.correlationId ?? null,
      remoteEventId: ack.remoteEventId ?? null,
      receivedAt: ack.receivedAt ?? null,
      responseContract: contract ?? null,
    } satisfies CompliLinkBridgeResponseAck;
  }

  const current = (contract as { currentResponseEvent?: unknown }).currentResponseEvent;
  const event = current && typeof current === "object" ? (current as Record<string, unknown>) : null;

  return {
    received: ack.received,
    intakeId: ack.intakeId ?? null,
    documentId: ack.documentId ?? pickScalar(event, "documentId"),
    processingStatus:
      ack.processingStatus ??
      (typeof event?.businessStatus === "string" ? event.businessStatus : null),
    traceId: ack.traceId ?? (typeof event?.traceId === "string" ? event.traceId : null),
    correlationId:
      ack.correlationId ?? (typeof event?.correlationId === "string" ? event.correlationId : null),
    remoteEventId: ack.remoteEventId ?? (typeof event?.eventId === "string" ? event.eventId : null),
    receivedAt: ack.receivedAt ?? null,
    responseContract: {
      contractVersion: contract.contractVersion ?? "auditapatron_return_contract_v1",
      currentResponseEvent: event
        ? {
            eventName: typeof event.eventName === "string" ? event.eventName : null,
            event: typeof event.event === "string" ? event.event : null,
            eventId: pickScalar(event, "eventId"),
            documentId: pickScalar(event, "documentId"),
            correlationId: pickScalar(event, "correlationId"),
            traceId: pickScalar(event, "traceId"),
            finality: pickScalar(event, "finality"),
            businessStatus: pickScalar(event, "businessStatus"),
            compliLinkId: pickScalar(event, "compliLinkId"),
          }
        : null,
    },
  };
}

/** The bridge ack can carry the whole Helios snapshot. Persist and return only the ids the expediente needs. */
export function slimEngineDispatchResult<T extends Pick<AuditaPatronEngineDispatchResult, "responseAck" | "responseBody">>(
  dispatch: T,
): T {
  return {
    ...dispatch,
    responseBody: typeof dispatch.responseBody === "string" ? dispatch.responseBody.slice(0, 2_000) : dispatch.responseBody,
    responseAck: dispatch.responseAck ? slimBridgeAck(dispatch.responseAck) : dispatch.responseAck,
  };
}
