import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Auditapatron closeout experience", () => {
  const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
  const accessSource = readFileSync(resolve(process.cwd(), "client/src/pages/Access.tsx"), "utf8");
  const auditFlowSource = readFileSync(resolve(process.cwd(), "client/src/pages/Auditar.tsx"), "utf8");
  const legalSource = readFileSync(resolve(process.cwd(), "client/src/pages/LegalDocuments.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
  const pricingSource = readFileSync(resolve(process.cwd(), "client/src/lib/pricingExperience.ts"), "utf8");

  it("ships a shorter landing focused on value proof, clarity and trust", () => {
    expect(homeSource).toContain('{ href: "#lectura-gratis", label: "Resultado real" }');
    expect(homeSource).toContain('{ href: "#como-funciona", label: "Cómo funciona" }');
    expect(homeSource).toContain('{ href: "#privacidad", label: "Privacidad" }');
    expect(homeSource).toContain("Sube un archivo y mira una señal real antes de decidir.");
    expect(homeSource).toContain("Aquí ves qué documento llegó, qué señal apareció y cuál es el siguiente paso útil.");
    expect(homeSource).toContain("Resultado real desde el primer archivo");
    expect(homeSource).toContain("Primero ves el valor; después decides si quieres convertirlo en expediente.");
    expect(homeSource).toContain("Así pasas de duda a claridad sin enredos.");
    expect(homeSource).toContain("Control visible desde el primer archivo.");
    expect(homeSource).toContain("Privacidad visible y verificable");
    expect(homeSource).toContain("Transparencia visible");
    expect(homeSource).toContain("Nada se guarda solo");
    expect(homeSource).toContain("Rastro legal versionado");
    expect(homeSource).toContain("Privacidad accionable");
    expect(homeSource).toContain("Qué verás en tu primer uso");
    expect(homeSource).toContain("Si guardas, lo verás");
    expect(homeSource).toContain("Si borras o sales, también");
    expect(homeSource).toContain("Registro visible de tu control");
    expect(homeSource).toContain("3 señales claras");
    expect(homeSource).toContain("Antes de guardar");
    expect(homeSource).toContain("Ves una lectura preliminar sin integrar nada a tu expediente.");
    expect(homeSource).toContain("Si aceptas");
    expect(homeSource).toContain("Queda rastro visible de versión, fecha y navegador.");
    expect(homeSource).toContain("Si resguardas");
    expect(homeSource).toContain("La interfaz te confirma que el archivo quedó listo para seguimiento.");
    expect(homeSource).toContain("Toca una señal y mira qué quedaría visible para ti antes de abrir expediente.");
    expect(homeSource).toContain("Prueba tu control aquí");
    expect(homeSource).toContain("Qué queda visible para ti");
    expect(homeSource).toContain("Qué no ve tu empresa");
    expect(homeSource).toContain("Rastro verificable");
    expect(homeSource).toContain("Borrador preliminar activo");
    expect(homeSource).toContain("Documento recibido, señal preliminar y siguiente paso sugerido.");
    expect(homeSource).toContain("Tus archivos y esta lectura no se comparten con tu empresa.");
    expect(homeSource).toContain("Respuestas rápidas");
    expect(homeSource).toContain("No necesitas cuenta para ver la primera lectura.");
    expect(homeSource).toContain("Ver controles de privacidad");
    expect(homeSource).toContain("<HeroSection />");
    expect(homeSource).toContain("<HeliosFirstEntrySection />");
    expect(homeSource).toContain("<HowItWorksSection />");
    expect(homeSource).toContain("<QuickTrustSection />");
    expect(homeSource).toContain("<FinalCtaSection />");
    expect(homeSource).not.toContain("<ConfidenceMagicSection />");
    expect(homeSource).not.toContain("<FAQSection />");
    expect(homeSource).toContain('window.location.href = "/auditar"');
    expect(appSource).toContain('Route path={"/auditar"} component={Auditar}');
  });

  it("keeps the conversion promise strong and routes the primary CTA to the audit flow", () => {
    expect(homeSource).toContain("Sube tu recibo y te decimos qué revisar.");
    expect(homeSource).toContain("Sube tu recibo de nómina y en segundos te mostramos qué sí vale la pena revisar primero.");
    expect(homeSource).toContain("Primero ves una señal clara, qué significa y cuál es el siguiente paso útil para no dejar dinero ni evidencia en el aire.");
    expect(homeSource).toContain("Revisar mi recibo gratis");
    expect(homeSource).toContain("Cómo funciona en 3 pasos");
    expect(homeSource).toContain("Sube el documento que ya tienes");
    expect(homeSource).toContain("Recibe una señal clara y accionable");
    expect(homeSource).toContain("Guárdalo solo si te aporta valor");
    expect(homeSource).toContain('placement: "hero_primary"');
    expect(homeSource).toContain('placement: "final_block_cta"');
    expect(pricingSource).toContain("Empieza gratis tu auditoría laboral y paga solo cuando ya te genere valor.");
  });

  it("turns access into continuity instead of an isolated login form", () => {
    expect(accessSource).toContain("function getReturnToValueCopy");
    expect(accessSource).toContain("Vuelve a tu revisión sin empezar de cero");
    expect(accessSource).toContain("Tu avance sigue listo");
    expect(accessSource).toContain("1 paso para volver");
    expect(accessSource).toContain("Correo seguro");
    expect(accessSource).toContain("Código de 6 dígitos");
    expect(accessSource).toContain("Regreso directo");
    expect(accessSource).toContain("Tu avance te espera del otro lado.");
    expect(accessSource).toContain("Entrar y continuar");
    expect(accessSource).toContain("Tu correo solo abre tu acceso y te devuelve a tu revisión.");
    expect(accessSource).toContain("Solo para entrar");
    expect(accessSource).toContain("Código temporal");
    expect(accessSource).toContain("Regreso a tu revisión");
    expect(accessSource).toContain("Qué pasará después");
    expect(accessSource).toContain("Te llega un código temporal.");
    expect(accessSource).toContain("Lo confirmas y vuelves a tu revisión.");
    expect(accessSource).toContain("Señal visible de control");
    expect(accessSource).toContain("En cuanto lo confirmes, vuelves directo a {returnToLabel}.");
  });

  it("keeps the audit workspace oriented to defendable value after the first visible finding", () => {
    expect(auditFlowSource).toContain("Lectura visible");
    expect(auditFlowSource).toContain("Hallazgo protegido y listo para cuidar");
    expect(auditFlowSource).toContain("Ya tienes una señal seria para asegurar en tu bóveda privada, exportar o reforzar con más contexto.");
    expect(auditFlowSource).toContain("Guardar evidencia útil");
    expect(auditFlowSource).toContain("Privacidad bajo tu control");
    expect(auditFlowSource).toContain("Descargar reporte");
    expect(auditFlowSource).toContain("Seguir con más contexto");
    expect(auditFlowSource).toContain("Transparencia de esta sesión");
    expect(auditFlowSource).toContain("Borrador primero");
    expect(auditFlowSource).toContain("Rastro legal visible");
    expect(auditFlowSource).toContain("Control de privacidad");
    expect(auditFlowSource).toContain("Señal visible de control");
    expect(auditFlowSource).toContain("No tienes que adivinar qué pasó con tu archivo.");
    expect(auditFlowSource).toContain("Asegurar evidencia en tu bóveda privada");
    expect(auditFlowSource).toContain("Descargar reporte PDF");
    expect(auditFlowSource).toContain("Reforzar con otro documento");
    expect(auditFlowSource).toContain("Qué tan defendible va tu caso");
    expect(auditFlowSource).toContain("Hoy tu respaldo visible va en {dossierStatus.percent}%.");
    expect(auditFlowSource).toContain("tu evidencia quedará más sólida para reclamar con más contexto");
  });

  it("preserves the worker-centered voice and keeps internal engine branding out of public marketing copy", () => {
    expect(homeSource).toContain("Tu empresa nunca ve lo que subes.");
    expect(homeSource).toContain("Primero revisas la señal, luego decides si la guardas en tu expediente.");
    expect(legalSource).toContain("Qué sí se registra");
    expect(legalSource).toContain("Qué no ve tu empresa");
    expect(legalSource).toContain("Dónde ejerces control");
    expect(homeSource).not.toContain("Sube tu documento y Helios lo recibe");
    expect(homeSource).not.toContain("Helios te devuelve hallazgos claros");
    expect(homeSource).not.toContain("CompliLink Operativo");
  });
});
