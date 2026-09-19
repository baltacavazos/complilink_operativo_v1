import { describe, expect, it } from "vitest";

import {
  DOF_LAST_GOOD_SEED,
  OFFICIAL_DIGEST_DOCTRINA_LABEL,
  OFFICIAL_DIGEST_JURISPRUDENCIA_LABEL,
  SCJN_HARVEST_SEED,
  classifyScjnKind,
  isKnownOfficialUrl,
  isOfficialLegalQuestion,
  listKnownOfficialIds,
  selectOfficialDigest,
  toScjnCitation,
} from "./officialDigest";

describe("official digest seed", () => {
  it("solo guarda IUS reales del harvest y no inventa registros", () => {
    expect(SCJN_HARVEST_SEED).toHaveLength(5);
    expect(SCJN_HARVEST_SEED.map((item) => item.officialId).sort()).toEqual([
      "2032611",
      "2032614",
      "2032619",
      "2032625",
      "2032630",
    ]);
    for (const entry of SCJN_HARVEST_SEED) {
      expect(entry.url).toBe(`https://sjf2.scjn.gob.mx/detalle/tesis/${entry.officialId}`);
      expect(entry.title.length).toBeGreaterThan(40);
    }
  });

  it("distingue doctrina de jurisprudencia por la clave real", () => {
    expect(classifyScjnKind("XXI.2o.C.T.1 L (12a.)")).toBe("doctrina");
    expect(classifyScjnKind("PR.P.T.CN. J/14 L (12a.)")).toBe("jurisprudencia");
    expect(toScjnCitation(SCJN_HARVEST_SEED[3]!, "last_good").kindLabel).toBe(
      OFFICIAL_DIGEST_JURISPRUDENCIA_LABEL,
    );
    expect(toScjnCitation(SCJN_HARVEST_SEED[4]!, "last_good").kindLabel).toBe(
      OFFICIAL_DIGEST_DOCTRINA_LABEL,
    );
  });

  it("elige 1 a 3 títulos reales según la pregunta, sin jerga inventada", () => {
    const overtime = selectOfficialDigest({
      prompt: "¿Qué dice la ley sobre horas extra?",
    });
    expect(overtime.citations.length).toBeGreaterThan(0);
    expect(overtime.citations.length).toBeLessThanOrEqual(3);
    expect(overtime.citations.some((item) => item.officialId === "2032611")).toBe(true);
    expect(overtime.citations.some((item) => item.officialId === "5786537")).toBe(true);
    expect(overtime.honestyNote).toMatch(/consulta anterior|no pude abrir/i);

    const firing = selectOfficialDigest({
      prompt: "¿El ofrecimiento de trabajo después del despido es de buena fe?",
    });
    expect(firing.citations[0]?.officialId).toBe("2032614");
    expect(firing.citations[0]?.kind).toBe("jurisprudencia");
    expect(firing.citations[0]?.kindLabel).not.toMatch(/^jurisprudencia$/i);
  });

  it("no suelta tesis de la Cámara de Diputados en una pregunta de IMSS del recibo", () => {
    const payroll = selectOfficialDigest({
      prompt: "¿Me descontaron IMSS?",
      documentType: "payroll_receipt",
      hasImssSignal: true,
    });
    expect(payroll.citations.some((item) => item.officialId === "2032630")).toBe(false);
    expect(isOfficialLegalQuestion("¿Me descontaron IMSS?")).toBe(false);
  });

  it("reconoce títulos DOF reales del last_good y rechaza IUS inventados", () => {
    expect(DOF_LAST_GOOD_SEED.some((item) => item.officialId === "5616745")).toBe(true);
    expect(listKnownOfficialIds().has("2032614")).toBe(true);
    expect(listKnownOfficialIds().has("9999999")).toBe(false);
    expect(isKnownOfficialUrl("https://sjf2.scjn.gob.mx/detalle/tesis/2032614")).toBe(true);
    expect(isKnownOfficialUrl("https://sjf2.scjn.gob.mx/detalle/tesis/9999999")).toBe(false);
    expect(
      isKnownOfficialUrl("https://www.dof.gob.mx/nota_detalle.php?codigo=5616745&fecha=23/04/2021"),
    ).toBe(true);
  });
});
