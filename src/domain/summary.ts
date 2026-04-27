import type { DateISO, EligibilityResult } from "./types";

/**
 * `scanBirthDates` の結果配列を集計したサマリ。
 * UI のヒートマップ／結果サマリで「全候補のうち何日が充足/ボーダー/不足か」
 * 「最良・最悪の出産日候補」「連続して充足する区間」を表示するために使う。
 */
export interface ScanSummary {
  totalDays: number;
  passDays: number;
  /**
   * 「ボーダー」候補日。`11.5 ≤ countedMonths < 12.5` を満たす日。
   * `isEligible`（>= 12）の真偽軸とは別に、わずかな入力差で結果が裏返り得る範囲を示す。
   */
  borderDays: number;
  failDays: number;
  /** 不足候補のうち最小不足月数（最も惜しい候補）。不足候補がないときは 0。 */
  shortfallMin: number;
  /** countedMonths 最大の候補日（同値なら最も早い日）。 */
  bestBirthDate: DateISO | null;
  /** countedMonths 最小の候補日（同値なら最も早い日）。 */
  worstBirthDate: DateISO | null;
  firstPassDate: DateISO | null;
  lastPassDate: DateISO | null;
  /** isEligible が連続する区間のリスト（results は scanRange 順を仮定）。 */
  passStreaks: Array<{ start: DateISO; end: DateISO; days: number }>;
  /** !isEligible が連続する区間のリスト（results は scanRange 順を仮定）。 */
  failStreaks: Array<{ start: DateISO; end: DateISO; days: number }>;
}

const BORDER_LOWER = 11.5;
const BORDER_UPPER = 12.5;

const emptySummary: ScanSummary = {
  totalDays: 0,
  passDays: 0,
  borderDays: 0,
  failDays: 0,
  shortfallMin: 0,
  bestBirthDate: null,
  worstBirthDate: null,
  firstPassDate: null,
  lastPassDate: null,
  passStreaks: [],
  failStreaks: [],
};

export function summarizeScan(results: EligibilityResult[]): ScanSummary {
  if (results.length === 0) {
    return { ...emptySummary, passStreaks: [], failStreaks: [] };
  }

  let passDays = 0;
  let borderDays = 0;
  let failDays = 0;
  let shortfallMin = Number.POSITIVE_INFINITY;
  let best: EligibilityResult = results[0];
  let worst: EligibilityResult = results[0];
  let firstPass: DateISO | null = null;
  let lastPass: DateISO | null = null;

  const passStreaks: ScanSummary["passStreaks"] = [];
  const failStreaks: ScanSummary["failStreaks"] = [];

  type Streak = { start: DateISO; end: DateISO; days: number };
  let passSt: Streak | null = null;
  let failSt: Streak | null = null;

  for (const r of results) {
    if (r.isEligible) {
      passDays++;
      if (firstPass === null) firstPass = r.birthDate;
      lastPass = r.birthDate;
      if (passSt === null) {
        passSt = { start: r.birthDate, end: r.birthDate, days: 1 };
      } else {
        passSt.end = r.birthDate;
        passSt.days++;
      }
      if (failSt !== null) {
        failStreaks.push(failSt);
        failSt = null;
      }
    } else {
      failDays++;
      if (r.shortage < shortfallMin) shortfallMin = r.shortage;
      if (failSt === null) {
        failSt = { start: r.birthDate, end: r.birthDate, days: 1 };
      } else {
        failSt.end = r.birthDate;
        failSt.days++;
      }
      if (passSt !== null) {
        passStreaks.push(passSt);
        passSt = null;
      }
    }

    if (
      r.countedMonths >= BORDER_LOWER &&
      r.countedMonths < BORDER_UPPER
    ) {
      borderDays++;
    }

    if (r.countedMonths > best.countedMonths) best = r;
    if (r.countedMonths < worst.countedMonths) worst = r;
  }

  if (passSt !== null) passStreaks.push(passSt);
  if (failSt !== null) failStreaks.push(failSt);

  return {
    totalDays: results.length,
    passDays,
    borderDays,
    failDays,
    shortfallMin: Number.isFinite(shortfallMin) ? shortfallMin : 0,
    bestBirthDate: best.birthDate,
    worstBirthDate: worst.birthDate,
    firstPassDate: firstPass,
    lastPassDate: lastPass,
    passStreaks,
    failStreaks,
  };
}
