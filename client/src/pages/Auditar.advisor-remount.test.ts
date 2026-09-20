import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildAsesorContinuityIntro } from "@shared/advisorMemory";

import {
  resolveAdvisorMessagesOnRemount,
  sanitizePersistedHeliosCopilotMessages,
} from "./Auditar";

const auditarSource = readFileSync(new URL("./Auditar.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

function auditarFunctionBody(): string {
  const start = auditarSource.indexOf("export default function Auditar()");
  expect(start).toBeGreaterThan(-1);
  return auditarSource.slice(start);
}

describe("HOTFIX: volver a /auditar no tira TDZ del asesor", () => {
  it("reproduce el ReferenceError si un hook lee una const antes de inicializarla", () => {
    const remountWithTdZ = new Function(`
      const useEffect = (_fn, deps) => { void deps; };
      useEffect(() => {}, [caseDetailQuery.data?.advisorMemory?.recentTurns]);
      const caseDetailQuery = { data: { advisorMemory: { recentTurns: [] } } };
    `);

    expect(remountWithTdZ).toThrow(/Cannot access 'caseDetailQuery' before initialization/);
  });

  it("declara caseDetailQuery antes de cualquier lectura de advisorMemory en Auditar()", () => {
    const body = auditarFunctionBody();
    const queryDecl = body.indexOf("const caseDetailQuery = trpc.cases.detail.useQuery");
    const remoteMemory = body.indexOf("const remoteAdvisorMemory = caseDetailQuery.data?.advisorMemory");
    const recentTurns = body.indexOf("remoteAdvisorMemory?.recentTurns");

    expect(queryDecl).toBeGreaterThan(-1);
    expect(remoteMemory).toBeGreaterThan(queryDecl);
    expect(recentTurns).toBeGreaterThan(remoteMemory);
    expect(body.indexOf("caseDetailQuery.data?.advisorMemory?.recentTurns")).toBe(-1);
  });

  it("al remount conserva historial local y, si está vacío, retoma turnos remotos", () => {
    const stored = [
      { role: "user", content: "¿Me descontaron IMSS?" },
      { role: "assistant", content: "En tu recibo se ve un descuento de IMSS." },
    ];
    const remoteTurns = [
      { role: "user", content: "¿Y Infonavit?" },
      { role: "assistant", content: "De Infonavit todavía no hay un papel claro." },
    ];

    expect(resolveAdvisorMessagesOnRemount({ storedValue: stored, remoteTurns })).toEqual(
      sanitizePersistedHeliosCopilotMessages(stored),
    );
    expect(resolveAdvisorMessagesOnRemount({ storedValue: [], remoteTurns })).toEqual(
      sanitizePersistedHeliosCopilotMessages(remoteTurns),
    );
    expect(resolveAdvisorMessagesOnRemount({ storedValue: null, remoteTurns: [] })).toEqual([]);
  });

  it("sigue saludando con memoria al volver, o con voz caso-primero si aún no hay plática", () => {
    expect(
      buildAsesorContinuityIntro({
        memoryGreeting:
          "Hola de nuevo, María. Seguimos con tu caso frente a Compañía Piloto MX. ¿Seguimos por ahí?",
        opinionIntro: "Lectura nueva del recibo.",
        opinionSummary: "Se ve un descuento de IMSS.",
        employeeName: "María Fernanda López",
        employerEntity: "Compañía Piloto MX",
        documentsCount: 2,
      }),
    ).toContain("Hola de nuevo, María");

    expect(
      buildAsesorContinuityIntro({
        documentsCount: 1,
        employeeName: "María Fernanda López",
        employerEntity: "Compañía Piloto MX",
      }),
    ).toMatch(/expediente de María Fernanda López con Compañía Piloto MX/);

    expect(auditarSource).toContain("buildAsesorContinuityIntro");
    expect(auditarSource).toContain("remoteAdvisorMemory?.greeting");
  });

  it("abre el asesor de nuevo con ?chat=1 y rutas /asesor", () => {
    expect(auditarSource).toContain('params.get("chat") === "1"');
    expect(auditarSource).toContain('params.get("asesor") === "1"');
    expect(auditarSource).toContain("setHeliosCopilotOpen(true)");
    expect(appSource).toContain('setLocation("/auditar?chat=1")');
    expect(appSource).toContain('path={"/asesor"}');
  });
});
