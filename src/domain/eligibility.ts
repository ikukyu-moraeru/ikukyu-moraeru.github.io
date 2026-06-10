import {
  addDays,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  parseISO,
  subDays,
  subYears,
} from "date-fns";
import { buildCompleteMonths } from "./completeMonth";
import { mergeInsuredSegments } from "./carryOver";
import { computeRelaxationDays } from "./relaxation";
import type {
  CompleteMonth,
  DailyAttendance,
  DateISO,
  EligibilityResult,
  FragmentMonth,
  InsuredEmploymentSegment,
  JudgedAttendance,
  LeavePeriod,
  MonthJudgment,
  UserInput,
} from "./types";

/**
 * Rule.md §2 / §3 の支給要件②（みなし被保険者期間 12 か月）判定。
 *
 * - 緩和（§3-4）と前職通算（§4-2）は relaxation.ts / carryOver.ts に委譲。
 * - 完全月 / 端数月の出勤量は `DailyAttendance[]` を日付フィルタして集計（按分なし）。
 * - 80 時間ルールは 2020-08-01 以降の月にのみ適用（厚労省 LL020615 保 01）。
 */

const PRENATAL_DAYS_SINGLE = 42;
const PRENATAL_DAYS_MULTIPLE = 98;
const POSTNATAL_DAYS = 56;

/** 賃金支払基礎時間数 80 時間ルールの施行日。 */
const HOURS_RULE_START: DateISO = "2020-08-01";

const fmt = (d: Date): DateISO => format(d, "yyyy-MM-dd");

export function judgeEligibility(
  input: UserInput,
  birthDate: DateISO,
): EligibilityResult {
  const birthDateD = parseISO(birthDate);
  const prenatalDays = input.isMultipleBirth
    ? PRENATAL_DAYS_MULTIPLE
    : PRENATAL_DAYS_SINGLE;
  // 産前休業の開始（予定・指定）より早く生まれた場合、休業は実出産日から始まる
  const plannedLeaveStart =
    input.customMaternityStart ?? fmt(subDays(birthDateD, prenatalDays));
  const leaveStartDate =
    plannedLeaveStart < birthDate ? plannedLeaveStart : birthDate;
  // 育休開始日の既定値:
  // 1. customChildCareStart（明示指定）が最優先
  // 2. customMaternityEnd（産後休業終了日）があればその翌日に追従
  // 3. いずれも無ければ自動（出産日 + 産後 56 日 + 1 日）
  const childCareStartD = input.customChildCareStart
    ? parseISO(input.customChildCareStart)
    : input.customMaternityEnd
      ? addDays(parseISO(input.customMaternityEnd), 1)
      : addDays(birthDateD, POSTNATAL_DAYS + 1);
  const childCareStartDate = fmt(childCareStartD);

  const baseWindowStart = fmt(subYears(childCareStartD, 2));
  const baseWindowEnd = fmt(subDays(childCareStartD, 1));

  // 産休期間を当該出産日候補の実態（実出産日 + 56 日など）に合わせてシフトし、
  // 緩和加算と出勤集計の両方に反映する
  const adjusted = adjustMaternityForBirthDate(input, birthDate);

  const relaxationDays = computeRelaxationDays(
    adjusted.leavePeriods,
    baseWindowStart,
    baseWindowEnd,
  );
  const windowStart = fmt(subDays(parseISO(baseWindowStart), relaxationDays));
  const windowEnd = baseWindowEnd;

  const mergedSegments = mergeInsuredSegments(input.insuredSegments);

  const { completeMonths, fragment } = buildCompleteMonths(
    childCareStartDate,
    windowStart,
  );

  const monthBreakdown: MonthJudgment[] = completeMonths.map((m) =>
    judgeCompleteMonth(m, adjusted.attendances, mergedSegments),
  );

  let countedMonths = monthBreakdown.reduce((sum, j) => sum + j.counted, 0);

  let fragmentJudgment: EligibilityResult["fragmentJudgment"];
  if (fragment) {
    fragmentJudgment = judgeFragment(
      fragment,
      adjusted.attendances,
      mergedSegments,
    );
    countedMonths += fragmentJudgment.counted;
  }

  return {
    birthDate,
    leaveStartDate,
    childCareStartDate,
    scanWindow: { start: windowStart, end: windowEnd },
    baseWindowStart,
    relaxationDays,
    countedMonths,
    isEligible: countedMonths >= 12,
    shortage: Math.max(0, 12 - countedMonths),
    monthBreakdown,
    fragmentJudgment,
  };
}

/**
 * 産休（産前産後休業）期間を出産日候補の実態に合わせてシフトする。
 *
 * 産休の終了は法律上「実出産日 + 56 日」で決まるため、登録されている産休期間
 * （出産予定日を前提に組まれた日付）は、候補の出産日が予定日からずれた分だけ
 * 終端が前後する。開始も、予定より早く生まれた場合は実出産日からになる。
 *
 * - 終了: 予定日とのずれ（delta）だけシフト。ただし `customMaternityEnd` を
 *   ユーザーが明示指定している場合は固定のまま（育休開始日の既定値も
 *   その翌日に固定される設計のため）。
 * - 開始: `min(登録上の開始日, 出産日)`。出産日以降に働き続けることはできない。
 * - シフト後の産休期間に重なる出勤入力は「実際には働けなかった日」として
 *   集計から除外する（予定より早い出産で、出勤予定だった日が消えるケース）。
 *
 * 産休以外の休業（病気休職など）は出産日と無関係なのでそのまま。
 * 予定日は scanRange の中央日（UI の deriveExpectedBirthDate と同じ定義）。
 */
function adjustMaternityForBirthDate(
  input: UserInput,
  birthDate: DateISO,
): { leavePeriods: LeavePeriod[]; attendances: DailyAttendance[] } {
  const hasMaternity = input.leavePeriods.some(
    (p) => p.type === "産休" && p.start && p.end,
  );
  if (!hasMaternity) {
    return { leavePeriods: input.leavePeriods, attendances: input.attendances };
  }

  const expected = deriveExpectedFromScanRange(input);
  const delta = expected
    ? differenceInCalendarDays(parseISO(birthDate), parseISO(expected))
    : 0;

  const shiftedRanges: Array<{ start: DateISO; end: DateISO }> = [];
  const leavePeriods = input.leavePeriods.map((p) => {
    if (p.type !== "産休" || !p.start || !p.end) return p;
    const start = p.start < birthDate ? p.start : birthDate;
    const end = input.customMaternityEnd
      ? p.end
      : fmt(addDays(parseISO(p.end), delta));
    if (end < start) return p; // 入力不整合（出産日が固定終了日より後など）は触らない
    shiftedRanges.push({ start, end });
    return { ...p, start, end };
  });

  const attendances =
    shiftedRanges.length === 0
      ? input.attendances
      : input.attendances.filter(
          (a) =>
            !shiftedRanges.some((r) => a.date >= r.start && a.date <= r.end),
        );

  return { leavePeriods, attendances };
}

/** scanRange の中央日 = 出産予定日（UI 側 deriveExpectedBirthDate と同一定義）。 */
function deriveExpectedFromScanRange(input: UserInput): DateISO | null {
  const { start, end } = input.scanRange;
  if (!start || !end) return null;
  const s = parseISO(start).getTime();
  const e = parseISO(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return fmt(new Date((s + e) / 2));
}

function judgeCompleteMonth(
  month: CompleteMonth,
  attendances: DailyAttendance[],
  segments: InsuredEmploymentSegment[],
): MonthJudgment {
  if (!isFullyInsured(month.start, month.end, segments)) {
    return { range: month, counted: 0, reason: "雇用保険未加入" };
  }
  const attendance = aggregateAttendance(month.start, month.end, attendances);
  if (attendance.basicWageDays >= 11) {
    return { range: month, counted: 1, reason: "11日以上", attendance };
  }
  if (canApplyHoursRule(month.end) && attendance.basicWageHours >= 80) {
    return { range: month, counted: 1, reason: "80時間以上", attendance };
  }
  return { range: month, counted: 0, reason: "条件未達", attendance };
}

function judgeFragment(
  fragment: FragmentMonth,
  attendances: DailyAttendance[],
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
 * 完全に内包されているかを判定する。前職通算は `mergeInsuredSegments` で済んでいる前提。
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
 * `DailyAttendance[]` を `[start, end]` (inclusive) でフィルタし、
 * 賃金支払基礎日数 / 時間数を集計する（按分なし）。
 *
 * - 賃金支払基礎日数 = `status ∈ {work, paid_leave, paid_special}` の日数
 * - 賃金支払基礎時間数 = 上記日のうち `hours` がある日の合計（時間未入力日は 0 寄与）
 */
function aggregateAttendance(
  start: DateISO,
  end: DateISO,
  attendances: DailyAttendance[],
): JudgedAttendance {
  let basicWageDays = 0;
  let basicWageHours = 0;
  for (const a of attendances) {
    if (a.date < start || a.date > end) continue;
    if (
      a.status === "work" ||
      a.status === "paid_leave" ||
      a.status === "paid_special"
    ) {
      basicWageDays += 1;
      if (typeof a.hours === "number" && Number.isFinite(a.hours)) {
        basicWageHours += a.hours;
      }
    }
  }
  return { basicWageDays, basicWageHours };
}

/**
 * 80 時間ルールを完全月の終端日に対して適用してよいかを判定する。
 * 厚労省 LL020615 保 01: 2020-08-01 以降の月に限り適用。
 */
function canApplyHoursRule(monthEnd: DateISO): boolean {
  return monthEnd >= HOURS_RULE_START;
}
