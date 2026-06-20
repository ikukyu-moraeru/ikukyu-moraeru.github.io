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
    leavePeriods: [],
    attendances: fillWorkDays("2024-01-01", "2026-04-14"),
    ...overrides,
  };
}

describe("judgeEligibility", () => {
  it("基本ケース: 出産日 2026-02-17 → 育休開始 2026-04-15 / 平日勤務で充足", () => {
    const input = makeInput();
    const result = judgeEligibility(input, "2026-02-17");

    expect(result.leaveStartDate).toBe("2026-01-07");
    expect(result.childCareStartDate).toBe("2026-04-15");
    expect(result.baseWindowStart).toBe("2024-04-15");
    expect(result.scanWindow).toEqual({
      start: "2024-04-15",
      end: "2026-04-14",
    });
    expect(result.relaxationDays).toBe(0);
    expect(result.monthBreakdown).toHaveLength(24);
    expect(result.fragmentJudgments).toEqual([]);
    expect(result.countedMonths).toBe(24);
    expect(result.isEligible).toBe(true);
    expect(result.shortage).toBe(0);
  });

  it("多胎妊娠は産前休業 98 日 → leaveStartDate が前倒しされる", () => {
    const single = judgeEligibility(makeInput(), "2026-09-01");
    expect(single.leaveStartDate).toBe("2026-07-22");

    const multi = judgeEligibility(
      makeInput({ isMultipleBirth: true }),
      "2026-09-01",
    );
    expect(multi.leaveStartDate).toBe("2026-05-27");
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

  it("端数月: 11 日未満でも 80 時間以上なら 0.5 か月 (業務取扱要領 R8.4 版 59523)", () => {
    // 疾病休職 50 日（無給）で窓が 2024-02-25 まで延び、19 日間の端数月が生じる。
    // 端数月内は 10 日 × 8 時間 = 80 時間（11 日未満、80 時間以上）。
    const fragmentWork: DailyAttendance[] = [
      "2024-02-26",
      "2024-02-27",
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
      "2024-03-04",
      "2024-03-05",
      "2024-03-06",
      "2024-03-07",
      "2024-03-08",
    ].map((date) => ({ date, status: "work" as const, hours: 8 }));
    const input = makeInput({
      leavePeriods: [
        {
          id: "sick1",
          type: "病気休職",
          start: "2025-06-01",
          end: "2025-07-20",
          hasWageDuringLeave: false,
        },
      ],
      attendances: [
        ...fragmentWork,
        ...fillWorkDays("2024-03-15", "2026-04-14"),
      ],
    });
    const result = judgeEligibility(input, "2026-02-17");
    expect(result.relaxationDays).toBe(50);
    expect(result.scanWindow.start).toBe("2024-02-25");
    expect(result.fragmentJudgments).toHaveLength(1);
    expect(result.fragmentJudgments[0].range.days).toBe(19);
    expect(result.fragmentJudgments[0].attendance?.basicWageDays).toBe(10);
    expect(result.fragmentJudgments[0].attendance?.basicWageHours).toBe(80);
    expect(result.fragmentJudgments[0].counted).toBe(0.5);
    expect(result.fragmentJudgments[0].reason).toBe("80時間以上");
  });

  it("在籍したままの休職では完全月の区切りは動かない（区切りが動くのは被保険者でなくなった場合のみ）", () => {
    // 育休開始 2026-04-15。休職 2025-05-01〜2025-06-15（46 日・無給）を挟んでも、
    // 被保険者資格は継続しているため応当日（15 日）区切りはそのまま。
    // 休職がかかる完全月は賃金支払基礎日数不足で 0 になるだけで、
    // 「4/1〜4/30, 6/15〜7/15」のような区切り直しは起きない（行政手引 50103 例示 2）。
    const leaveStart = "2025-05-01";
    const leaveEnd = "2025-06-15";
    const input = makeInput({
      leavePeriods: [
        {
          id: "sick1",
          type: "病気休職",
          start: leaveStart,
          end: leaveEnd,
          hasWageDuringLeave: false,
        },
      ],
      attendances: fillWorkDays("2024-01-01", "2026-04-14").filter(
        (a) => a.date < leaveStart || a.date > leaveEnd,
      ),
    });
    const result = judgeEligibility(input, "2026-02-17");

    // 無給 46 日 → 緩和で窓が 46 日延びる
    expect(result.relaxationDays).toBe(46);
    expect(result.scanWindow.start).toBe("2024-02-29");

    // 区切りは応当日（毎月 15 日）のまま。休職開始/終了日では切れない
    const ranges = result.monthBreakdown.map((m) => `${m.range.start}/${m.range.end}`);
    expect(ranges).toContain("2025-04-15/2025-05-14");
    expect(ranges).toContain("2025-05-15/2025-06-14");
    expect(ranges).toContain("2025-06-15/2025-07-14");
    expect(ranges.some((r) => r.includes("2025-06-16"))).toBe(false);

    // 休職に完全に覆われた月だけが 0 になる
    const may = result.monthBreakdown.find(
      (m) => m.range.start === "2025-05-15",
    );
    expect(may?.counted).toBe(0);
    expect(may?.reason).toBe("条件未達");
    const apr = result.monthBreakdown.find(
      (m) => m.range.start === "2025-04-15",
    );
    expect(apr?.counted).toBe(1);
    const jun = result.monthBreakdown.find(
      (m) => m.range.start === "2025-06-15",
    );
    expect(jun?.counted).toBe(1);
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

  it("雇用保険セグメントが部分的にしかカバーしない場合、セグメント内の完全月だけが対象になる", () => {
    const input = makeInput({
      insuredSegments: [{ id: "s1", start: "2025-05-01", end: null }],
    });
    const result = judgeEligibility(input, "2026-02-17");

    // 完全月は入社日（2025-05-01）で打ち切られ、11 か月。
    // 頭の 2025-05-01〜05-14（14 日）は 15 日未満の端数で 0。
    expect(result.monthBreakdown).toHaveLength(11);
    expect(result.monthBreakdown.every((m) => m.counted === 1)).toBe(true);
    expect(result.fragmentJudgments).toHaveLength(1);
    expect(result.fragmentJudgments[0].range.days).toBe(14);
    expect(result.fragmentJudgments[0].reason).toBe("15日未満");
    expect(result.countedMonths).toBe(11);
    expect(result.isEligible).toBe(false);
    expect(result.shortage).toBe(1);
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

  it("前職通算: 前職はその離職日の翌日をアンカーに区切る（50103 イ(イ)・50104）", () => {
    const input = makeInput({
      insuredSegments: [
        { id: "prev", start: "2024-04-01", end: "2025-04-15" },
        { id: "curr", start: "2025-05-15", end: null },
      ],
    });
    const result = judgeEligibility(input, "2026-02-17");
    const ranges = result.monthBreakdown.map(
      (m) => `${m.range.start}/${m.range.end}`,
    );

    // 現職: 育休開始日（2026-04-15）アンカー → 入社日ちょうどまで 11 か月、端数なし
    expect(ranges).toContain("2025-05-15/2025-06-14");
    // 前職: 離職日の翌日（2025-04-16）アンカー → 16 日区切りに変わる
    expect(ranges).toContain("2025-03-16/2025-04-15");
    expect(ranges).toContain("2024-04-16/2024-05-15");
    // 旧実装のような「育休開始日アンカーのままギャップをまたぐ月」は作らない
    expect(ranges).not.toContain("2025-04-15/2025-05-14");
    expect(
      result.monthBreakdown.some((m) => m.reason === "雇用保険未加入"),
    ).toBe(false);

    // 現職 11 + 前職 12 = 23 か月（前職頭の 2024-04-15 の 1 日は 15 日未満で 0）
    expect(result.monthBreakdown).toHaveLength(23);
    expect(result.countedMonths).toBe(23);
    expect(result.fragmentJudgments).toHaveLength(1);
    expect(result.fragmentJudgments[0].range.days).toBe(1);
    expect(result.fragmentJudgments[0].reason).toBe("15日未満");
  });

  it("連続転職（ギャップ 0 日）でも 1 つの期間に連結せず、転職をまたぐ完全月を作らない", () => {
    // A 社 2024-01-01〜2025-09-30 → B 社 2025-10-01〜（離職翌日に再就職）
    // 東京ハローワーク記入見本【例3】: 現職の区切りは休業開始日アンカーで入社日打ち切り、
    // 前職は離職票（離職日アンカー）で数えて通算する。
    const input = makeInput({
      insuredSegments: [
        { id: "a", start: "2024-01-01", end: "2025-09-30" },
        { id: "b", start: "2025-10-01", end: null },
      ],
    });
    const result = judgeEligibility(input, "2026-02-17");
    const ranges = result.monthBreakdown.map(
      (m) => `${m.range.start}/${m.range.end}`,
    );

    // B 社（現職）: 育休開始日（2026-04-15）アンカー → 15 日区切り、入社日打ち切り
    expect(ranges).toContain("2025-10-15/2025-11-14");
    // A 社（前職）: 離職日の翌日（2025-10-01）アンカー → 暦月区切りに変わる
    expect(ranges).toContain("2025-09-01/2025-09-30");
    // 転職をまたぐ月（旧実装の連結で生じていた区切り）は存在しない
    expect(ranges).not.toContain("2025-09-15/2025-10-14");

    // B: 6 完全月 + 頭 14 日（15 日未満→0）/ A: 17 完全月 + 頭 16 日（11 日以上→0.5）
    expect(result.monthBreakdown).toHaveLength(23);
    expect(result.fragmentJudgments).toHaveLength(2);
    expect(result.fragmentJudgments[0].range.days).toBe(14);
    expect(result.fragmentJudgments[0].counted).toBe(0);
    expect(result.fragmentJudgments[1].range.days).toBe(16);
    expect(result.fragmentJudgments[1].counted).toBe(0.5);
    expect(result.countedMonths).toBe(23.5);
  });

  it("転職で端数 0.5 が 2 つ積み上がり、12 か月の境界を越えるケース", () => {
    // 完全月 11（B 社 7 + A 社 4）+ 端数 0.5 × 2 = 12.0 → 受給資格あり
    const input = makeInput({
      insuredSegments: [
        { id: "a", start: "2025-03-25", end: "2025-08-19" },
        { id: "b", start: "2025-08-20", end: null },
      ],
      attendances: fillWorkDays("2025-03-25", "2026-04-14"),
    });
    const result = judgeEligibility(input, "2026-02-17");

    expect(result.monthBreakdown).toHaveLength(11);
    expect(result.monthBreakdown.every((m) => m.counted === 1)).toBe(true);
    expect(result.fragmentJudgments).toHaveLength(2);
    expect(result.fragmentJudgments.every((f) => f.counted === 0.5)).toBe(true);
    expect(result.countedMonths).toBe(12);
    expect(result.isEligible).toBe(true);
  });

  it("前職通算リセット: 失業給付受給資格決定済みなら前職セグメントは判定対象外", () => {
    const input = makeInput({
      insuredSegments: [
        {
          id: "prev",
          start: "2024-04-01",
          end: "2025-04-15",
          claimedBasicAllowanceAfterEnd: true,
        },
        { id: "curr", start: "2025-05-15", end: null },
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

  it("customMaternityStart が leaveStartDate に反映される", () => {
    // 自動なら 2026-01-06（出産日 - 42 日）。手動指定で上書きされる。
    const input = makeInput({ customMaternityStart: "2026-01-20" });
    const result = judgeEligibility(input, "2026-02-17");
    expect(result.leaveStartDate).toBe("2026-01-20");
    // 育休開始日（基準日）は自動のまま
    expect(result.childCareStartDate).toBe("2026-04-15");
  });

  it("customMaternityEnd を指定すると childCareStartDate が end+1 になる", () => {
    // 自動なら 2026-04-15（出産日 + 56 日 + 1）。終了日を早めると追従。
    const input = makeInput({ customMaternityEnd: "2026-03-31" });
    const result = judgeEligibility(input, "2026-02-17");
    expect(result.childCareStartDate).toBe("2026-04-01");
  });

  it("customChildCareStart は customMaternityEnd より優先される", () => {
    const input = makeInput({
      customMaternityEnd: "2026-03-31",
      customChildCareStart: "2026-06-01",
    });
    const result = judgeEligibility(input, "2026-02-17");
    expect(result.childCareStartDate).toBe("2026-06-01");
  });
});
