import { addDays, format, parseISO } from "date-fns";
import type { DailyAttendance, UserInput } from "./types";

/**
 * ランディング画面の「サンプルを見る」用 / 開発・テスト用の UserInput 生成。
 *
 * いずれも出産予定日中央 = 2026-09-15、走査範囲 ±14 日（2026-09-01 〜 2026-09-29）で固定。
 *  - simple:     同一会社で 3 年勤務、フルタイム。全候補で余裕を持って充足。
 *  - transition: 前職退職 → 30 日空白（基本手当未受給） → 再就職。後職分のみだと不足、
 *                通算で充足する典型例。
 *  - sickness:   出産前に 60 日連続の病気休職（賃金なし）。緩和加算が効くケース。
 */
export type SampleScenario = "simple" | "transition" | "sickness";

const SCAN_RANGE = { start: "2026-09-01", end: "2026-09-29" };

export function buildSampleInput(scenario: SampleScenario): UserInput {
  switch (scenario) {
    case "simple":
      return buildSimple();
    case "transition":
      return buildTransition();
    case "sickness":
      return buildSickness();
  }
}

function buildSimple(): UserInput {
  return {
    isMultipleBirth: false,
    scanRange: { ...SCAN_RANGE },
    insuredSegments: [{ id: "main", start: "2023-01-01", end: null }],
    nonInsuredGaps: [],
    leavePeriods: [],
    attendances: fillWeekdays("2023-01-01", "2026-12-31"),
  };
}

function buildTransition(): UserInput {
  return {
    isMultipleBirth: false,
    scanRange: { ...SCAN_RANGE },
    insuredSegments: [
      { id: "prev", start: "2024-04-01", end: "2025-10-31", employerName: "前職" },
      { id: "curr", start: "2025-12-01", end: null, employerName: "現職" },
    ],
    nonInsuredGaps: [
      {
        id: "g1",
        start: "2025-11-01",
        end: "2025-11-30",
        reason: "転職の空白",
        basicAllowanceClaimed: false,
      },
    ],
    leavePeriods: [],
    // 平日を出勤に。空白期間 (2025-11) は除外。
    attendances: [
      ...fillWeekdays("2024-04-01", "2025-10-31"),
      ...fillWeekdays("2025-12-01", "2026-12-31"),
    ],
  };
}

function buildSickness(): UserInput {
  return {
    isMultipleBirth: false,
    scanRange: { ...SCAN_RANGE },
    insuredSegments: [
      { id: "main", start: "2024-09-01", end: null, employerName: "勤務先" },
    ],
    nonInsuredGaps: [],
    leavePeriods: [
      {
        id: "sick1",
        type: "病気休職",
        start: "2025-06-01",
        end: "2025-07-30",
        hasWageDuringLeave: false,
      },
    ],
    // 病休期間は除外。
    attendances: [
      ...fillWeekdays("2024-09-01", "2025-05-31"),
      ...fillWeekdays("2025-07-31", "2026-12-31"),
    ],
  };
}

/**
 * `[startISO, endISO]` (inclusive) の平日を全部 'work' で埋める。
 * 土日は出力に含めない（UI 側で自動着色する想定）。
 */
function fillWeekdays(startISO: string, endISO: string): DailyAttendance[] {
  const out: DailyAttendance[] = [];
  let cursor = parseISO(startISO);
  const last = parseISO(endISO);
  while (cursor.getTime() <= last.getTime()) {
    const day = cursor.getDay(); // 0 = Sun, 6 = Sat
    if (day !== 0 && day !== 6) {
      out.push({
        date: format(cursor, "yyyy-MM-dd"),
        status: "work",
        hours: 8,
      });
    }
    cursor = addDays(cursor, 1);
  }
  return out;
}
