import { describe, expect, it } from "vitest";
import { computeMaternityTimeline } from "../maternityTimeline";

describe("computeMaternityTimeline", () => {
  it("単胎: 産前 42 日・産後 56 日・育休は出産翌々日（+57 日）", () => {
    const t = computeMaternityTimeline("2026-09-15", false);
    expect(t).not.toBeNull();
    expect(t!.prenatalDays).toBe(42);
    expect(t!.prenatalLeaveStart).toBe("2026-08-04");
    expect(t!.postnatalDays).toBe(56);
    expect(t!.postnatalLeaveEnd).toBe("2026-11-10");
    expect(t!.childCareStart).toBe("2026-11-11");
  });

  it("多胎: 産前 98 日に拡張される", () => {
    const t = computeMaternityTimeline("2026-09-15", true);
    expect(t!.prenatalDays).toBe(98);
    expect(t!.prenatalLeaveStart).toBe("2026-06-09");
    // 産後と育休開始は変わらない
    expect(t!.postnatalLeaveEnd).toBe("2026-11-10");
    expect(t!.childCareStart).toBe("2026-11-11");
  });

  it("月またぎ: 月初の出産予定日でも産前開始日が前月になる", () => {
    const t = computeMaternityTimeline("2026-03-01", false);
    // 2026-03-01 - 42 = 2026-01-18
    expect(t!.prenatalLeaveStart).toBe("2026-01-18");
    // 2026-03-01 + 56 = 2026-04-26
    expect(t!.postnatalLeaveEnd).toBe("2026-04-26");
    expect(t!.childCareStart).toBe("2026-04-27");
  });

  it("うるう年: 2024-02-29 起点の計算が正しい", () => {
    const t = computeMaternityTimeline("2024-02-29", false);
    expect(t!.prenatalLeaveStart).toBe("2024-01-18");
    expect(t!.postnatalLeaveEnd).toBe("2024-04-25");
    expect(t!.childCareStart).toBe("2024-04-26");
  });

  it("予定日が空文字なら null", () => {
    expect(computeMaternityTimeline("", false)).toBeNull();
  });

  it("不正な日付なら null", () => {
    expect(computeMaternityTimeline("not-a-date", false)).toBeNull();
  });

  it("judgeEligibility 内部の childCareStart と一致する（プロパティ的整合）", () => {
    // judgeEligibility は (出産日, isMultipleBirth) → childCareStartDate を birthDate + 57 日で算出。
    // 同じ計算をしているか確認するための回帰テスト。
    const t = computeMaternityTimeline("2026-02-17", false);
    expect(t!.childCareStart).toBe("2026-04-15");
    expect(t!.prenatalLeaveStart).toBe("2026-01-06");
  });
});
