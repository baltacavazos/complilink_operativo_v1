import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { OFFICIAL_CHECK_BUTTON, OFFICIAL_CHECK_CONSENT, OFFICIAL_WAIT_STILL_TRYING } from "@shared/officialCheckCopy";

const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const waitLayer = readFileSync(new URL("../components/OfficialWaitLayer.tsx", import.meta.url), "utf8");

function homeGuestOfficialCheckSource() {
  const start = home.indexOf("function HomeGuestOfficialCheck");
  const end = home.indexOf("function HeliosFirstEntrySection");
  return home.slice(start, end);
}

describe("Home guest · consulta IMSS y SAT", () => {
  it("monta la misma tarjeta tras la primera lectura, cableada al preview de invitado", () => {
    const card = homeGuestOfficialCheckSource();
    const previewStart = home.indexOf("{guestPreview ? (");
    const examplesStart = home.indexOf('id: "fallback-payroll"');
    const previewBranch = home.slice(previewStart, examplesStart);

    expect(OFFICIAL_CHECK_BUTTON).toBe("Consultar IMSS y SAT");
    expect(OFFICIAL_CHECK_CONSENT).toMatch(/Autorizo que pregunten a IMSS y SAT/);
    expect(OFFICIAL_WAIT_STILL_TRYING).toBe("Seguimos intentando. Te avisamos cuando haya resultado.");

    expect(card).toContain('data-testid="official-check-card"');
    expect(card).toContain('data-testid="official-check-headline"');
    expect(card).toContain('data-testid="official-check-consent"');
    expect(card).toContain('data-testid="official-check-cta"');
    expect(card).toContain("{OFFICIAL_CHECK_CONSENT}");
    expect(card).toContain("{officialCheckDisplay.buttonLabel}");
    expect(card).toContain("guestOfficialCheck.useMutation()");
    expect(card).toContain("useGuestOfficialFact");
    expect(card).toContain("<GuestOfficialFactNotice");
    expect(card).toContain("writeHomeGuestOfficial");
    expect(home).toContain("auditapatron_home_guest_official_v1");
    expect(home).toContain("sessionStorage");
    expect(card).toContain("resolveOfficialCheckDisplay");
    expect(card).toContain("pickPromptOfficialCheck");
    expect(card).toContain("<OfficialWaitLayer");
    expect(card).toContain("guestPreviewToken,");
    expect(card).toContain("consentGranted: officialCheckConsent || Boolean(officialCheckDisplay.silence)");
    expect(card).not.toMatch(/CURP|NSS|\d{11}/);
    expect(card).not.toMatch(/\bcumple\b/i);

    expect(previewBranch).toContain("<HomeGuestOfficialCheck");
    expect(previewBranch).toContain("guestPreviewToken={guestPreview.guestPreviewToken}");
    expect(previewBranch).toContain("guestPreviewId={guestPreview.guestPreviewId}");
    expect(previewBranch).toContain("key={guestPreview.guestPreviewId}");
    expect(previewBranch).toContain("!auth.isAuthenticated");
    expect(home.slice(examplesStart, home.indexOf("function QuickTrustSection"))).not.toContain(
      "HomeGuestOfficialCheck",
    );
    expect(home.slice(examplesStart)).not.toContain('data-testid="official-check-card"');

    expect(waitLayer).toContain("OFFICIAL_WAIT_STILL_TRYING");
    expect(waitLayer).toContain("{OFFICIAL_WAIT_STILL_TRYING}");

    const upload = home.slice(home.indexOf("async function handleFileSelection"), home.indexOf("function handleGuestUploadClick"));
    expect(upload).toContain("const input = event.currentTarget");
    expect(upload).toContain("input.value = \"\"");
    expect(upload).not.toContain("event.currentTarget.value");
  });
});
