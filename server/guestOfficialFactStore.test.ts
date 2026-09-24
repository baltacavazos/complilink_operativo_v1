import { describe, expect, it, beforeEach } from "vitest";

import type { OfficialCheckSummary } from "@shared/officialCheckCopy";
import { hasUsableOfficialFact } from "@shared/officialResultNotification";
import {
  persistGuestOfficialFact,
  readGuestOfficialFact,
  rememberGuestOfficialSession,
  resetGuestOfficialFactStoreForTests,
} from "./guestOfficialFactStore";

function summary(
  status: OfficialCheckSummary["overallStatus"],
  hechos: string[],
  checkedAt: string,
): OfficialCheckSummary {
  const live = status === "vivo";
  return {
    configured: true,
    consentGranted: true,
    overallStatus: status,
    overallLabel: live ? "Hay respuesta" : "Pendiente",
    overallDetail: live ? "Llegó un dato del IMSS." : "Seguimos esperando.",
    checkedAt,
    identity: { nss: true, curp: false, rfc: false },
    checks: [
      {
        source: "imss",
        sourceLabel: "IMSS",
        status,
        label: "IMSS",
        detail: live ? "Dato del IMSS." : "Sin dato todavía.",
        checkedAt,
        used: { nss: true, curp: false, rfc: false },
        honesty: live ? "live" : "pending",
        hechos,
      },
    ],
  };
}

describe("guestOfficialFactStore", () => {
  beforeEach(() => {
    resetGuestOfficialFactStoreForTests();
  });

  it("guarda el hecho IMSS del webhook contra el trace del invitado", () => {
    rememberGuestOfficialSession({
      guestPreviewId: "GST-guest",
      traceId: "trace.guest-home.GST-guest.abc",
      officialCheck: summary("pendiente", [], "2026-09-24T18:00:00.000Z"),
    });

    const stored = persistGuestOfficialFact({
      lookupIds: ["trace.guest-home.GST-guest.abc"],
      officialCheck: summary("vivo", ["Hay un movimiento de alta en el IMSS."], "2026-09-24T18:01:10.000Z"),
      arrivedAt: "2026-09-24T18:01:10.000Z",
    });

    expect(stored?.arrivedAt).toBe("2026-09-24T18:01:10.000Z");
    const read = readGuestOfficialFact({
      guestPreviewId: "GST-guest",
      traceId: "trace.guest-home.GST-guest.abc",
    });
    expect(hasUsableOfficialFact(read?.officialCheck)).toBe(true);
    expect(read?.officialCheck?.checks[0]?.hechos).toEqual(["Hay un movimiento de alta en el IMSS."]);
  });

  it("si el webhook llega antes de registrar la sesión, el token lo recoge al consultar", () => {
    expect(
      persistGuestOfficialFact({
        lookupIds: ["trace.early", "GST-early"],
        officialCheck: summary("vivo", ["Hay un movimiento de alta en el IMSS."], "2026-09-24T18:01:10.000Z"),
        arrivedAt: "2026-09-24T18:01:10.000Z",
      }),
    ).toBeNull();

    rememberGuestOfficialSession({
      guestPreviewId: "GST-early",
      traceId: "trace.early",
      officialCheck: summary("pendiente", [], "2026-09-24T18:00:00.000Z"),
    });

    const read = readGuestOfficialFact({ guestPreviewId: "GST-early", traceId: "trace.early" });
    expect(read?.officialCheck?.checks[0]?.hechos).toEqual(["Hay un movimiento de alta en el IMSS."]);
  });

  it("no mezcla el hecho de un invitado con otro token", () => {
    rememberGuestOfficialSession({
      guestPreviewId: "GST-a",
      traceId: "trace.a",
      officialCheck: summary("pendiente", [], "2026-09-24T18:00:00.000Z"),
    });
    rememberGuestOfficialSession({
      guestPreviewId: "GST-b",
      traceId: "trace.b",
      officialCheck: summary("pendiente", [], "2026-09-24T18:00:00.000Z"),
    });

    persistGuestOfficialFact({
      lookupIds: ["trace.a"],
      officialCheck: summary("vivo", ["Hay un movimiento de alta en el IMSS."], "2026-09-24T18:01:10.000Z"),
      arrivedAt: "2026-09-24T18:01:10.000Z",
    });

    expect(readGuestOfficialFact({ guestPreviewId: "GST-b", traceId: "trace.b" })?.officialCheck?.overallStatus).toBe(
      "pendiente",
    );
    expect(readGuestOfficialFact({ guestPreviewId: "GST-missing", traceId: "trace.missing" })).toBeNull();
  });

  it("un pendiente posterior no borra el hecho usable", () => {
    rememberGuestOfficialSession({
      guestPreviewId: "GST-keep",
      traceId: "trace.keep",
      officialCheck: summary("vivo", ["Hay un movimiento de alta en el IMSS."], "2026-09-24T18:01:10.000Z"),
    });
    persistGuestOfficialFact({
      lookupIds: ["guest-official:GST-keep"],
      officialCheck: summary("pendiente", [], "2026-09-24T18:02:00.000Z"),
      arrivedAt: "2026-09-24T18:02:00.000Z",
    });

    const read = readGuestOfficialFact({ guestPreviewId: "GST-keep", traceId: "trace.keep" });
    expect(read?.officialCheck?.checks[0]?.hechos).toEqual(["Hay un movimiento de alta en el IMSS."]);
    expect(read?.arrivedAt).toBeTruthy();
  });
});
