import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OfficialCheckSummary } from "@shared/officialCheckCopy";
import { GuestOfficialFactNotice } from "./GuestOfficialFactNotice";

function check(
  source: "imss" | "sat" | "infonavit",
  hechos: string[],
  status: OfficialCheckSummary["overallStatus"] = "vivo",
): OfficialCheckSummary["checks"][number] {
  return {
    source,
    sourceLabel: source === "imss" ? "IMSS" : source === "sat" ? "SAT" : "Infonavit",
    status,
    label: source,
    detail: "Dato de la consulta.",
    checkedAt: "2026-09-24T18:00:00.000Z",
    used: { nss: source === "imss", curp: source === "infonavit", rfc: source === "sat" },
    honesty: status === "vivo" ? "live" : "failed",
    hechos,
  };
}

function summary(checks: OfficialCheckSummary["checks"]): OfficialCheckSummary {
  return {
    configured: true,
    consentGranted: true,
    overallStatus: "vivo",
    overallLabel: "Hay respuesta",
    overallDetail: "Llegó un dato oficial.",
    checkedAt: "2026-09-24T18:00:00.000Z",
    identity: { nss: true, curp: true, rfc: true },
    checks,
  };
}

function renderNotice(checks: OfficialCheckSummary["checks"]) {
  return renderToStaticMarkup(
    createElement(GuestOfficialFactNotice, {
      summary: summary(checks),
      arrivedAt: "2026-09-24T18:05:00.000Z",
      waiting: false,
    }),
  );
}

describe("GuestOfficialFactNotice", () => {
  it("pinta solo los hechos IMSS cuando Infonavit no trajo dato", () => {
    const html = renderNotice([
      check("imss", ["Hay un movimiento de alta en el IMSS."]),
      check("infonavit", [], "no_se_pudo"),
    ]);

    expect(html).toContain('data-testid="official-result-inbox"');
    expect(html).toContain('data-testid="guest-official-imss-fact"');
    expect(html).toContain("Hay un movimiento de alta en el IMSS.");
    expect(html).toContain(">IMSS<");
    expect(html).not.toContain('data-testid="guest-official-infonavit-fact"');
    expect(html).not.toMatch(/al corriente|tu patrón cumple\b/i);
  });

  it("pinta la bandeja con hechos Infonavit aunque el IMSS no haya llegado", () => {
    const html = renderNotice([
      check("imss", [], "no_se_pudo"),
      check("infonavit", ["Hay un crédito de vivienda registrado."]),
    ]);

    expect(html).toContain('data-testid="official-result-inbox"');
    expect(html).toContain('data-testid="guest-official-infonavit-fact"');
    expect(html).toContain("Hay un crédito de vivienda registrado.");
    expect(html).toContain(">Infonavit<");
    expect(html).not.toContain('data-testid="guest-official-imss-fact"');
    expect(html.match(/<ul/g)?.length).toBe(1);
    expect(html).toContain("no prueba por sí solo");
    expect(html).not.toMatch(/al corriente|tu patrón cumple\b|syntage/i);
  });

  it("pinta IMSS e Infonavit cuando los dos llegaron", () => {
    const html = renderNotice([
      check("imss", ["Hay un movimiento de alta en el IMSS."]),
      check("infonavit", ["Hay un crédito de vivienda registrado."]),
    ]);

    expect(html).toContain('data-testid="guest-official-imss-fact"');
    expect(html).toContain('data-testid="guest-official-infonavit-fact"');
    expect(html).toContain("Hay un movimiento de alta en el IMSS.");
    expect(html).toContain("Hay un crédito de vivienda registrado.");
    const imssAt = html.indexOf('data-testid="guest-official-imss-fact"');
    const infonavitAt = html.indexOf('data-testid="guest-official-infonavit-fact"');
    expect(infonavitAt).toBeGreaterThan(imssAt);
  });
});
