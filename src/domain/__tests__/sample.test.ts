import { describe, expect, it } from "vitest";
import { judgeEligibility } from "../eligibility";
import { buildSampleInput } from "../sample";

const CENTER_BIRTH_DATE = "2026-09-15";

describe("buildSampleInput", () => {
  describe("simple", () => {
    it("中央日でフル充足（同一会社 3 年フルタイム）", () => {
      const input = buildSampleInput("simple");
      const result = judgeEligibility(input, CENTER_BIRTH_DATE);
      expect(result.isEligible).toBe(true);
      expect(result.countedMonths).toBeGreaterThanOrEqual(20);
      expect(result.relaxationDays).toBe(0);
    });
  });

  describe("transition", () => {
    it("中央日で充足（前職通算が機能している）", () => {
      const input = buildSampleInput("transition");
      const result = judgeEligibility(input, CENTER_BIRTH_DATE);
      expect(result.isEligible).toBe(true);
      // 前職分（4..10/2025）+ 後職分（12/2025..在職中）両方が breakdown に算入されている
      const insuredCount = result.monthBreakdown.filter(
        (m) => m.counted === 1,
      ).length;
      expect(insuredCount).toBeGreaterThanOrEqual(12);
    });

    it("通算がないと（前職セグメントだけ消すと）不足する", () => {
      const input = buildSampleInput("transition");
      const onlyCurrent = {
        ...input,
        insuredSegments: input.insuredSegments.filter((s) => s.id === "curr"),
      };
      const result = judgeEligibility(onlyCurrent, CENTER_BIRTH_DATE);
      expect(result.isEligible).toBe(false);
    });
  });

  describe("sickness", () => {
    it("中央日で 60 日緩和が加算される（relaxationDays = 60）", () => {
      const input = buildSampleInput("sickness");
      const result = judgeEligibility(input, CENTER_BIRTH_DATE);
      expect(result.relaxationDays).toBe(60);
    });

    it("中央日で充足する（緩和加算が効くケース）", () => {
      const input = buildSampleInput("sickness");
      const result = judgeEligibility(input, CENTER_BIRTH_DATE);
      expect(result.isEligible).toBe(true);
    });
  });
});
