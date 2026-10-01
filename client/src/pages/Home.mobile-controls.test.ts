import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("controles móviles de la home pública", () => {
  const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("manda Entrada rápida al acceso para continuar el caso", () => {
    expect(home).toMatch(
      /href="\/acceso\?returnTo=\/auditar"[\s\S]{0,80}data-testid="home-quick-entry"[\s\S]{0,320}Entrada rápida/,
    );
    expect(home).not.toMatch(/<span[^>]*>\s*Entrada rápida\s*<\/span>/);
  });

  it("abre /auditar desde el chip Sube foto o PDF", () => {
    const chipStart = home.indexOf('data-testid="home-upload-chip"');
    const chip = home.slice(Math.max(0, chipStart - 120), chipStart + 1600);

    expect(chipStart).toBeGreaterThan(-1);
    expect(chip).toContain('href="/auditar"');
    expect(chip).toContain('goToAuditFlow({ placement: "hero_upload_chip", source: "hero" })');
    expect(chip).toContain("Sube foto o PDF");
  });

  it("da destino a las pastillas que parecen controles", () => {
    expect(home).toContain('href="/auditar?chat=1"');
    expect(home).toContain('data-testid="home-hero-assistant-pill"');
    expect(home).toContain("Primera lectura sin correo");
    expect(home).toContain("Privado desde el inicio");
    expect(home).toContain("Primero ves valor y luego decides");
    expect(home).toContain('goToAuditFlow({ placement: "home_free_plan", source: "home_plans" })');
  });

  it("sigue la ruta real de Privacidad y solo intercepta anclas internas", () => {
    const activatorStart = home.indexOf("function handleHomeNavActivation");
    const activator = home.slice(activatorStart, activatorStart + 700);

    expect(activator).toContain('href.startsWith("#")');
    expect(activator).toContain("window.location.assign(href)");
    expect(home).toContain('{ href: "/aviso-de-privacidad", label: "Privacidad" }');
    expect(home).toContain("handleHomeNavActivation(event, link.href, () => setOpen(false))");
  });
});
