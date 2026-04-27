import { describe, expect, it } from "vitest";
import { judgeEligibility } from "../eligibility";
import type {
  InsuredEmploymentSegment,
  MonthlyAttendance,
  UserInput,
} from "../types";

/**
 * 2024-04 〜 2026-04 の 25 暦月分のサンプル出勤を生成するヘルパー。
 */
function generateAttendances(
  days: number,
  hours: number,
): MonthlyAttendance[] {
  const out: MonthlyAttendance[] = [];
  for (let y = 2024; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${y}-${String(m).padStart(2, "0")}`;
      out.push({ monthKey, basicWageDays: days, basicWageHours: hours });
    }
  }
  return out;
}

const fullCoverageSegment: InsuredEmploymentSegment = {
  id: "seg1",
  start: "2020-01-01",
  end: null,
};

function makeInput(overrides: Partial<UserInput> = {}): UserInput {
  return {
    isMultipleBirth: false,
    scanRange: { start: "2026-02-17", end: "2026-02-17" },
    insuredSegments: [fullCoverageSegment],
    nonInsuredGaps: [],
    leavePeriods: [],
    attendances: generateAttendances(22, 168),
    ...overrides,
  };
}

describe("judgeEligibility (Phase P2: 緩和・通算なし)", () => {
  it("基本ケース: 出産日 2026-02-17 → 育休開始 2026-04-15 / 24完全月フルタイムで充足", () => {
    const input = makeInput();
    const result = judgeEligibility(input, "2026-02-17");

    expect(result.leaveStartDate).toBe("2026-01-06");
    expect(result.childCareStartDate).toBe("2026-04-15");
    expect(result.baseWindowStart).toBe("2024-04-15");
    expect(result.scanWindow).toEqual({
      start: "2024-04-15",
      end: "2026-04-14",
    });
    expect(result.relaxationDays).toBe(0);
    expect(result.monthBreakdown).toHaveLength(24);
    expect(result.fragmentJudgment).toBeUndefined();
    expect(result.countedMonths).toBe(24);
    expect(result.isEligible).toBe(true);
    expect(result.shortage).toBe(0);
  });

  it("多胎妊娠は産前休業 98 日 → leaveStartDate が前倒しされる", () => {
    const single = judgeEligibility(makeInput(), "2026-09-01");
    expect(single.leaveStartDate).toBe("2026-07-21");

    const multi = judgeEligibility(
      makeInput({ isMultipleBirth: true }),
      "2026-09-01",
    );
    expect(multi.leaveStartDate).toBe("2026-05-26");
  });

  it("11 日未満でも 80 時間以上なら 1 か月としてカウントする (Rule §3-1 (3))", () => {
    const input = makeInput({ attendances: generateAttendances(8, 100) });
    const result = judgeEligibility(input, "2026-02-17");

    expect(result.countedMonths).toBe(24);
    expect(result.isEligible).toBe(true);
    expect(result.monthBreakdown.every((m) => m.reason === "80時間以上")).toBe(
      true,
    );
  });

  it("11 日未満かつ 80 時間未満は条件未達 → カウントされない", () => {
    const input = makeInput({ attendances: generateAttendances(8, 60) });
    const result = judgeEligibility(input, "2026-02-17");

    expect(result.countedMonths).toBe(0);
    expect(result.isEligible).toBe(false);
    expect(result.shortage).toBe(12);
    expect(result.monthBreakdown.every((m) => m.reason === "条件未達")).toBe(
      true,
    );
  });

  it("雇用保険セグメントが部分的にしかカバーしない場合、未加入の月は 0 カウント", () => {
    // 2025-05-01 開始の単一セグメント。子育休開始 2026-04-15 の前 11 月分のみ通算可能。
    const input = makeInput({
      insuredSegments: [{ id: "s1", start: "2025-05-01", end: null }],
    });
    const result = judgeEligibility(input, "2026-02-17");

    // i=11 (2025-05-15〜2025-06-14) 以降はカバー、i=12 (2025-04-15〜2025-05-14) はカバー外
    expect(result.countedMonths).toBe(11);
    expect(result.isEligible).toBe(false);
    expect(result.shortage).toBe(1);

    const insured = result.monthBreakdown.filter((m) => m.counted === 1);
    const uninsured = result.monthBreakdown.filter(
      (m) => m.reason === "雇用保険未加入",
    );
    expect(insured).toHaveLength(11);
    expect(uninsured).toHaveLength(13);
  });

  it("入力が空の場合は countedMonths=0 / shortage=12", () => {
    const input = makeInput({
      insuredSegments: [],
      attendances: [],
    });
    const result = judgeEligibility(input, "2026-02-17");

    expect(result.countedMonths).toBe(0);
    expect(result.isEligible).toBe(false);
    expect(result.shortage).toBe(12);
    expect(
      result.monthBreakdown.every((m) => m.reason === "雇用保険未加入"),
    ).toBe(true);
  });

  it("各完全月の attendance は暦月の値を日数比で按分した合計値が入る", () => {
    // 2026-03 = 22 日 / 168 時間, 2026-04 = 0 日 / 0 時間 のみ入力
    const attendances: MonthlyAttendance[] = [
      { monthKey: "2026-03", basicWageDays: 22, basicWageHours: 168 },
    ];
    const input = makeInput({ attendances });
    const result = judgeEligibility(input, "2026-02-17");

    // 完全月 1 (2026-03-15〜2026-04-14): 2026-03 から 17/31 日, 2026-04 はデータなし
    const m1 = result.monthBreakdown[0];
    expect(m1.range).toEqual({
      index: 1,
      start: "2026-03-15",
      end: "2026-04-14",
    });
    // 22 × 17/31 ≒ 12.06 日 → 11 日以上を満たす
    expect(m1.attendance?.basicWageDays).toBeCloseTo(22 * (17 / 31), 5);
    expect(m1.counted).toBe(1);
    expect(m1.reason).toBe("11日以上");

    // 完全月 2 (2026-02-15〜2026-03-14): 2026-03 から 14/31 日
    const m2 = result.monthBreakdown[1];
    expect(m2.attendance?.basicWageDays).toBeCloseTo(22 * (14 / 31), 5);
    // 22 × 14/31 ≒ 9.94 日 → 11 日未満。168 × 14/31 ≒ 75.87 時間 → 80 時間未満 → 条件未達
    expect(m2.counted).toBe(0);
    expect(m2.reason).toBe("条件未達");
  });
});
