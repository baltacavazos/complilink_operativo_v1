import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("controles públicos fuera de la home", () => {
  const auditar = read("client/src/pages/Auditar.tsx");
  const legal = read("client/src/pages/LegalDocuments.tsx");
  const plans = read("client/src/pages/Plans.tsx");
  const home = read("client/src/pages/Home.tsx");
  const notice = read("client/src/components/GuestOfficialFactNotice.tsx");
  const authHook = read("client/src/_core/hooks/useAuth.ts");
  const payments = read("client/src/pages/Payments.tsx");

  it("manda el CTA legal de revisión a /auditar y deja Volver en el inicio", () => {
    expect(legal).toContain('href="/auditar"');
    expect(legal).toContain('data-testid="legal-review-cta"');
    expect(legal).toContain("Revisar mi recibo gratis");
    expect(legal).toContain('href="/"');
    expect(legal).toContain("Volver al inicio");
  });

  it("abre el asistente en la entrada de invitado y en /planes", () => {
    expect(auditar).toContain('data-testid="auditar-guest-advisor"');
    expect(auditar).toContain("const guestAdvisorSheet = auth.isAuthenticated ? null : (");
    expect(auditar).toContain("if (!auth.isAuthenticated)");
    expect(auditar).toContain('data-testid="auditar-upload-chip"');
    expect(plans).toContain('href="/auditar?chat=1"');
    expect(plans).toContain('data-testid="planes-assistant-title"');
  });

  it("da acción a las pastillas del hallazgo, la privacidad y la bandeja", () => {
    const pills = auditar.slice(auditar.indexOf("Guardar evidencia útil") - 400, auditar.indexOf("Seguir con más contexto") + 80);
    expect(pills).toContain("<button");
    expect(pills).toContain("Guardar evidencia útil");
    expect(pills).toContain("exportQuickHallazgoPdf");
    expect(pills).toContain('href="/aviso-de-privacidad"');
    expect(pills).toContain("Privacidad bajo tu control");
    expect(pills).toContain("Descargar reporte");
    expect(pills).toContain("openPreferredPicker()");
    expect(pills).toContain("Seguir con más contexto");
    expect(notice).toContain('data-testid="official-result-inbox-cta"');
    expect(notice).toContain("OFFICIAL_RESULT_NOTIFICATION_COPY.actionLabel");
  });

  it("el pie de la home sigue las anclas sin cancelar las rutas legales", () => {
    expect(home).toContain('onClick={(event) => handleHomeNavActivation(event, "#lectura-gratis")}');
    expect(home).toContain('onClick={(event) => handleHomeNavActivation(event, "#como-funciona")}');
    expect(home).toContain('href="/aviso-de-privacidad"');
  });

  it("manda /pagos y /ceo sin sesión a acceso, y los botones de planes navegan de verdad", () => {
    expect(authHook).toContain("getAccessUrl(redirectPath)");
    expect(authHook).toContain('window.location.pathname === "/acceso"');
    expect(payments).toContain('window.location.href = "/acceso?returnTo=/pagos"');
    expect(auditar).toContain('<a href="/planes">Ver planes y activar</a>');
    expect(auditar).toContain('<a href="/pagos">Ver historial de pagos</a>');
    expect(auditar).not.toContain('<a href="/planes" className="w-full">');
  });
});
