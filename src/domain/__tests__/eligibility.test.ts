import { addDays, format, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import { judgeEligibility } from "../eligibility";
import type {
  DailyAttendance,
  InsuredEmploymentSegment,
  UserInput,
} from "../types";

/**
 * `[startISO, endISO]` (inclusive) の平日を全て 'work' で埋める。
 * テスト用に「フルタイム勤務」を表現するヘルパー。
 */
function fillWorkDays(
  startISO: string,
  endISO: string,
  hours = 8,
): DailyAttendance[] {
  const out: DailyAttendance[] = [];
  let cursor = parseISO(startISO);
  const last = parseISO(endISO);
  while (cursor.getTime() <= last.getTime()) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      out.push({
        date: format(cursor, "yyyy-MM-dd"),
        status: "work",
        hours,
      });
    }
    cursor = addDays(cursor, 1);
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
    attendances: fillWorkDays("2024-01-01", "2026-04-14"),
    ...overrides,
  };
}

describe("judgeEligibility", () => {
  it("基本ケース: 出産日 2026-02-17 → 育休開始 2026-04-15 / 平日勤務で充足", () => {
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

  it("出勤入力が無い完全月は条件未達としてカウントされない", () => {
    const input = makeInput({ attendances: [] });
    const result = judgeEligibility(input, "2026-02-17");

    expect(result.countedMonths).toBe(0);
    expect(result.isEligible).toBe(false);
    expect(result.shortage).toBe(12);
    expect(result.monthBreakdown.every((m) => m.reason === "条件未達")).toBe(
      true,
    );
  });

  it("paid_leave (有給) も賃金支払基礎日数にカウント", () => {
    // ある完全月だけ work を 5 日, paid_leave を 7 日 = 計 12 日
    const range = ["2026-03-15", "2026-04-14"]; // 完全月 1
    const days: DailyAttendance[] = [];
    for (let i = 0; i < 5; i++) {
      days.push({
        date: format(addDays(parseISO(range[0]), i), "yyyy-MM-dd"),
        status: "work",
      });
    }
    for (let i = 5; i < 12; i++) {
      days.push({
        date: format(addDays(parseISO(range[0]), i), "yyyy-MM-dd"),
        status: "paid_leave",
      });
    }
    const input = makeInput({ attendances: days });
    const result = judgeEligibility(input, "2026-02-17");
    const m1 = result.monthBreakdown[0];
    expect(m1.attendance?.basicWageDays).toBe(12);
    expect(m1.counted).toBe(1);
    expect(m1.reason).toBe("11日以上");
  });

  it("absent (欠勤) は賃金支払基礎日数にカウントしない", () => {
    const days: DailyAttendance[] = [];
    for (let i = 0; i < 31; i++) {
      days.push({
        date: format(addDays(parseISO("2026-03-15"), i), "yyyy-MM-dd"),
        status: "absent",
      });
    }
    const input = makeInput({ attendances: days });
    const result = judgeEligibility(input, "2026-02-17");
    const m1 = result.monthBreakdown[0];
    expect(m1.attendance?.basicWageDays).toBe(0);
    expect(m1.counted).toBe(0);
  });

  it("11 日未満かつ 80 時間以上ならカウント (Rule §3-1 (3))", () => {
    // 8 日 × 12 時間 = 96 時間（11日未満、80時間以上）
    const days: DailyAttendance[] = [];
    for (let i = 0; i < 8; i++) {
      days.push({
        date: format(addDays(parseISO("2026-03-15"), i), "yyyy-MM-dd"),
        status: "work",
        hours: 12,
      });
    }
    const input = makeInput({ attendances: days });
    const result = judgeEligibility(input, "2026-02-17");
    const m1 = result.monthBreakdown[0];
    expect(m1.attendance?.basicWageDays).toBe(8);
    expect(m1.attendance?.basicWageHours).toBe(96);
    expect(m1.counted).toBe(1);
    expect(m1.reason).toBe("80時間以上");
  });

  it("80 時間ルールは 2020-08-01 以降の月にしか適用されない", () => {
    // 育休開始 2020-08-15 → 完全月 1: 2020-07-15..2020-08-14（80h ルール非適用）
    //                    完全月 2: 2020-06-15..2020-07-14（同非適用）
    // 8 日 × 12 時間 = 96 時間 を毎月入力 → 11 日未満なので未達
    const days: DailyAttendance[] = [];
    for (
      let cursor = parseISO("2018-06-01");
      cursor.getTime() <= parseISO("2020-08-15").getTime();
      cursor = addDays(cursor, 1)
    ) {
      const day = cursor.getDay();
      if (day === 0 || day === 6) continue;
      const dn = cursor.getDate();
      if (dn > 12) continue; // 月の前 12 営業日のみ
      days.push({
        date: format(cursor, "yyyy-MM-dd"),
        status: "work",
        hours: 12, // → 各月とも 80 時間以上
      });
    }
    // 出産日 2020-06-19 → 育休開始 2020-08-15 → 完全月 1: 2020-07-15〜2020-08-14（end が施行日前）
    const input = makeInput({
      scanRange: { start: "2020-06-19", end: "2020-06-19" },
      attendances: days,
    });
    const result = judgeEligibility(input, "2020-06-19");

    // 完全月 1 (2020-07-15..2020-08-14, end < 2020-08-01? いいえ end=2020-08-14 ≥ 2020-08-01 → 適用される)
    expect(result.monthBreakdown[0].range.end).toBe("2020-08-14");
    // → 完全月 1 は 80h 適用 OK
    // 完全月 2 (2020-06-15..2020-07-14, end=2020-07-14 < 2020-08-01) → 80h 不適用
    const m2 = result.monthBreakdown[1];
    expect(m2.range.end).toBe("2020-07-14");
    // 80h あっても 11 日未満なので "条件未達"
    expect(m2.counted).toBe(0);
    expect(m2.reason).toBe("条件未達");
  });

  it("雇用保険セグメントが部分的にしかカバーしない場合、未加入の月は 0 カウント", () => {
    const input = makeInput({
      insuredSegments: [{ id: "s1", start: "2025-05-01", end: null }],
    });
    const result = judgeEligibility(input, "2026-02-17");

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

  it("入力が空の場合は countedMonths=0", () => {
    const input = makeInput({ insuredSegments: [], attendances: [] });
    const result = judgeEligibility(input, "2026-02-17");
    expect(result.countedMonths).toBe(0);
    expect(result.isEligible).toBe(false);
    expect(result.shortage).toBe(12);
    expect(
      result.monthBreakdown.every((m) => m.reason === "雇用保険未加入"),
    ).toBe(true);
  });

  it("前職通算: 30 日空白で前後セグメントが連結", () => {
    const input = makeInput({
      insuredSegments: [
        { id: "prev", start: "2024-04-01", end: "2025-04-15" },
        { id: "curr", start: "2025-05-15", end: null },
      ],
    });
    const result = judgeEligibility(input, "2026-02-17");
    const uninsured = result.monthBreakdown.filter(
      (m) => m.reason === "雇用保険未加入",
    );
    expect(uninsured.length).toBeGreaterThan(0);
    expect(uninsured.length).toBeLessThan(24);
    const earliest = result.monthBreakdown[result.monthBreakdown.length - 1];
    expect(earliest.range.start).toBe("2024-04-15");
    expect(earliest.counted).toBe(1);
  });

  it("前職通算リセット: 失業給付受給資格決定済みなら前職セグメントは判定対象外", () => {
    const input = makeInput({
      insuredSegments: [
        { id: "prev", start: "2024-04-01", end: "2025-04-15" },
        { id: "curr", start: "2025-05-15", end: null },
      ],
      nonInsuredGaps: [
        {
          id: "g1",
          start: "2025-04-16",
          end: "2025-05-14",
          reason: "退職後無職",
          basicAllowanceClaimed: true,
        },
      ],
    });
    const result = judgeEligibility(input, "2026-02-17");
    expect(result.countedMonths).toBe(11);
    expect(result.isEligible).toBe(false);
    expect(result.shortage).toBe(1);
  });

  it("緩和事由（賃金なし産休 98 日）があると scanWindow.start が 98 日前倒し", () => {
    const input = makeInput({
      leavePeriods: [
        {
          id: "p1",
          type: "産休",
          start: "2025-06-01",
          end: "2025-09-06",
          hasWageDuringLeave: false,
        },
      ],
    });
    const result = judgeEligibility(input, "2026-02-17");

    expect(result.relaxationDays).toBe(98);
    expect(result.baseWindowStart).toBe("2024-04-15");
    expect(result.scanWindow.start).toBe("2024-01-08");
    expect(result.scanWindow.end).toBe("2026-04-14");
  });
});
