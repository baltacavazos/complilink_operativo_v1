import { describe, expect, it } from "vitest";

import { SHARE_REWARD_COPY } from "@shared/shareCopy";
import {
  readReferral,
  recordPlanInterest,
  recordReferralReceipt,
  recordReferralVisit,
  resetPlanInterestForTests,
  resetReferralsForTests,
} from "./referrals";

describe("referidos", () => {
  it("cuenta visitas y recibos, y la revisión extra solo queda registrada", async () => {
    resetReferralsForTests();
    await recordReferralVisit("AB23CD");
    const afterReceipt = await recordReferralReceipt("AB23CD");
    const stored = await readReferral("ab23cd");
    expect(afterReceipt?.visits).toBe(1);
    expect(afterReceipt?.receiptsAnalyzed).toBe(1);
    expect(afterReceipt?.extraReviews).toBe(1);
    expect(afterReceipt?.rewardedAt).toBeTruthy();
    expect(stored?.receiptsAnalyzed).toBe(1);
    expect(SHARE_REWARD_COPY).toContain("1 revisión extra");
    expect(SHARE_REWARD_COPY).not.toMatch(/\$\d/);
  });

  it("guarda el aviso de un plan sin cobrar", async () => {
    resetPlanInterestForTests();
    const saved = await recordPlanInterest({ contact: "persona@correo.com", planKey: "essential" });
    expect(saved).toEqual({ saved: true, charged: false });
  });
});
