import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  subDays,
  subYears,
} from "date-fns";
import { buildCompleteMonths } from "./completeMonth";
import type {
  CompleteMonth,
  DateISO,
  EligibilityResult,
  FragmentMonth,
  InsuredEmploymentSegment,
  JudgedAttendance,
  MonthJudgment,
  MonthlyAttendance,
  UserInput,
} from "./types";

/**
 * Rule.md §2 / §3 の支給要件②（みなし被保険者期間 12 か月）判定。
 *
 * 本ファイルは Phase P2 までのスコープ：
 *   - 緩和（§3-4） は未適用（relaxationDays = 0 で固定）
 *   - 前職通算（§4-2）は未適用（input.insuredSegments をそのまま使用）
 * 後フェーズで relaxation.ts / carryOver.ts を導入し、`scanWindow` と
 * `insuredSegments` の前処理として差し込む形にする。
 */

const PRENATAL_DAYS_SINGLE = 42;
const PRENATAL_DAYS_MULTIPLE = 98;
const POSTNATAL_DAYS = 56;

const fmt = (d: Date): DateISO => format(d, "yyyy-MM-dd");

export function judgeEligibility(
  input: UserInput,
  birthDate: DateISO,
): EligibilityResult {
  const birthDateD = parseISO(birthDate);
  const prenatalDays = input.isMultipleBirth
    ? PRENATAL_DAYS_MULTIPLE
    : PRENATAL_DAYS_SINGLE;
  const leaveStartDate = fmt(subDays(birthDateD, prenatalDays));
  const childCareStartD = addDays(birthDateD, POSTNATAL_DAYS + 1);
  const childCareStartDate = fmt(childCareStartD);

  const baseWindowStart = fmt(subYears(childCareStartD, 2));
  const windowStart = baseWindowStart;
  const windowEnd = fmt(subDays(childCareStartD, 1));

  const { completeMonths, fragment } = buildCompleteMonths(
    childCareStartDate,
    windowStart,
  );

  const monthBreakdown: MonthJudgment[] = completeMonths.map((m) =>
    judgeCompleteMonth(m, input.attendances, input.insuredSegments),
  );

  let countedMonths = monthBreakdown.reduce((sum, j) => sum + j.counted, 0);

  let fragmentJudgment: EligibilityResult["fragmentJudgment"];
  if (fragment) {
    fragmentJudgment = judgeFragment(
      fragment,
      input.attendances,
      input.insuredSegments,
    );
    countedMonths += fragmentJudgment.counted;
  }

  return {
    birthDate,
    leaveStartDate,
    childCareStartDate,
    scanWindow: { start: windowStart, end: windowEnd },
    baseWindowStart,
    relaxationDays: 0,
    countedMonths,
    isEligible: countedMonths >= 12,
    shortage: Math.max(0, 12 - countedMonths),
    monthBreakdown,
    fragmentJudgment,
  };
}

function judgeCompleteMonth(
  month: CompleteMonth,
  attendances: MonthlyAttendance[],
  segments: InsuredEmploymentSegment[],
): MonthJudgment {
  if (!isFullyInsured(month.start, month.end, segments)) {
    return { range: month, counted: 0, reason: "雇用保険未加入" };
  }
  const attendance = aggregateAttendance(month.start, month.end, attendances);
  if (attendance.basicWageDays >= 11) {
    return { range: month, counted: 1, reason: "11日以上", attendance };
  }
  if (attendance.basicWageHours >= 80) {
    return { range: month, counted: 1, reason: "80時間以上", attendance };
  }
  return { range: month, counted: 0, reason: "条件未達", attendance };
}

function judgeFragment(
  fragment: FragmentMonth,
  attendances: MonthlyAttendance[],
  segments: InsuredEmploymentSegment[],
): NonNullable<EligibilityResult["fragmentJudgment"]> {
  if (!isFullyInsured(fragment.start, fragment.end, segments)) {
    return { range: fragment, counted: 0, reason: "雇用保険未加入" };
  }
  if (fragment.days < 15) {
    return { range: fragment, counted: 0, reason: "15日未満" };
  }
  const attendance = aggregateAttendance(
    fragment.start,
    fragment.end,
    attendances,
  );
  if (attendance.basicWageDays >= 11) {
    return { range: fragment, counted: 0.5, reason: "11日以上", attendance };
  }
  return { range: fragment, counted: 0, reason: "条件未達", attendance };
}

/**
 * `[start, end]` が 1 つの被保険者セグメント（在職中なら end=null）に
 * 完全に内包されているかを判定する。
 *
 * 注意： Phase P2 ではセグメント結合（前職通算）を行わないため、複数セグメントを
 * またぐ完全月は「未加入」と判定される。これは P3 で carryOver.ts が
 * 結合済みセグメントを渡すことで解消する想定。
 */
function isFullyInsured(
  start: DateISO,
  end: DateISO,
  segments: InsuredEmploymentSegment[],
): boolean {
  const s = parseISO(start);
  const e = parseISO(end);
  return segments.some((seg) => {
    const segStart = parseISO(seg.start);
    const segEnd = seg.end ? parseISO(seg.end) : new Date(8640000000000000);
    return !isAfter(segStart, s) && !isBefore(segEnd, e);
  });
}

/**
 * 完全月／端数月の `[start, end]` 範囲に対し、暦月ベースで入力された
 * `MonthlyAttendance[]` を日数比で按分して合算する。
 *
 * 完全月は暦月境界をまたぐ（例： 2026-03-15〜2026-04-14）ため、
 * - 2026-03 の 17 日分（3/15〜3/31）/ 31 日 ×（3 月の値）
 * - 2026-04 の 14 日分（4/01〜4/14）/ 30 日 ×（4 月の値）
 * を合計する。
 */
function aggregateAttendance(
  start: DateISO,
  end: DateISO,
  attendances: MonthlyAttendance[],
): JudgedAttendance {
  const s = parseISO(start);
  const e = parseISO(end);
  let basicWageDays = 0;
  let basicWageHours = 0;

  let cursor = startOfMonth(s);
  const lastMonth = startOfMonth(e);
  while (!isAfter(cursor, lastMonth)) {
    const ym = format(cursor, "yyyy-MM");
    const att = attendances.find((a) => a.monthKey === ym);
    if (att) {
      const monthStart = startOfMonth(cursor);
      const monthEnd = endOfMonth(cursor);
      const overlapStart = isBefore(monthStart, s) ? s : monthStart;
      const overlapEnd = isAfter(monthEnd, e) ? e : monthEnd;
      const overlapDays = differenceInCalendarDays(overlapEnd, overlapStart) + 1;
      const totalDays = differenceInCalendarDays(monthEnd, monthStart) + 1;
      const ratio = overlapDays / totalDays;
      basicWageDays += att.basicWageDays * ratio;
      basicWageHours += att.basicWageHours * ratio;
    }
    cursor = addMonths(cursor, 1);
  }
  return { basicWageDays, basicWageHours };
}
