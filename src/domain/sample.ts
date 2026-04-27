import { addMonths, format } from "date-fns";
import type { MonthlyAttendance, UserInput } from "./types";

/**
 * ランディング画面の「サンプルを見る」用の UserInput 生成。
 *
 * いずれも出産予定日中央 = 2026-09-15、走査範囲 ±14 日（2026-09-01 〜 2026-09-29）で固定。
 *  - simple:     同一会社で 3 年勤務、フルタイム。全候補で余裕を持って充足。
 *  - transition: 前職退職 → 30 日空白（基本手当未受給） → 再就職。後職分のみだと不足、
 *                通算で充足する典型例。
 *  - sickness:   出産前に 60 日連続の病気休職（賃金なし）。緩和加算が効くケース。
 */
export type SampleScenario = "simple" | "transition" | "sickness";

const SCAN_RANGE = { start: "2026-09-01", end: "2026-09-29" };
const FULL_DAYS = 22;
const FULL_HOURS = 168;

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
    attendances: fillMonths("2023-01", "2026-12", () => ({
      basicWageDays: FULL_DAYS,
      basicWageHours: FULL_HOURS,
    })),
  };
}

function buildTransition(): UserInput {
  // 前職: 2024-04-01..2025-10-31（19 ヶ月）
  // 空白: 2025-11-01..2025-11-30（30 日、基本手当未受給）
  // 後職: 2025-12-01..在職中
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
    attendances: fillMonths("2024-04", "2026-12", (ym) => {
      if (ym === "2025-11") return { basicWageDays: 0, basicWageHours: 0 };
      return { basicWageDays: FULL_DAYS, basicWageHours: FULL_HOURS };
    }),
  };
}

function buildSickness(): UserInput {
  // 同一会社 2024-09-01..在職中。
  // 病気休職: 2025-06-01..2025-07-30（60 日連続、賃金なし）→ 緩和加算 60 日。
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
    attendances: fillMonths("2024-09", "2026-12", (ym) => {
      if (ym === "2025-06" || ym === "2025-07") {
        return { basicWageDays: 0, basicWageHours: 0 };
      }
      return { basicWageDays: FULL_DAYS, basicWageHours: FULL_HOURS };
    }),
  };
}

/**
 * `startYm` 〜 `endYm`（共に "YYYY-MM" inclusive）で月別出勤を生成する。
 */
function fillMonths(
  startYm: string,
  endYm: string,
  factory: (monthKey: string) => Pick<MonthlyAttendance, "basicWageDays" | "basicWageHours">,
): MonthlyAttendance[] {
  const out: MonthlyAttendance[] = [];
  let cursor = parseYm(startYm);
  const last = parseYm(endYm);
  while (cursor.getTime() <= last.getTime()) {
    const monthKey = format(cursor, "yyyy-MM");
    const { basicWageDays, basicWageHours } = factory(monthKey);
    out.push({ monthKey, basicWageDays, basicWageHours });
    cursor = addMonths(cursor, 1);
  }
  return out;
}

function parseYm(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1);
}
