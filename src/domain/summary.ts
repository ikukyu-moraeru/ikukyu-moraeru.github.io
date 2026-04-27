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
};

export function summarizeScan(results: EligibilityResult[]): ScanSummary {
  if (results.length === 0) {
    return { ...emptySummary, passStreaks: [] };
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
  let streakStart: DateISO | null = null;
  let streakEnd: DateISO | null = null;
  let streakDays = 0;

  for (const r of results) {
    if (r.isEligible) {
      passDays++;
      if (firstPass === null) firstPass = r.birthDate;
      lastPass = r.birthDate;
      if (streakStart === null) {
        streakStart = r.birthDate;
        streakDays = 0;
      }
      streakEnd = r.birthDate;
      streakDays++;
    } else {
      failDays++;
      if (r.shortage < shortfallMin) shortfallMin = r.shortage;
      if (streakStart !== null && streakEnd !== null) {
        passStreaks.push({
          start: streakStart,
          end: streakEnd,
          days: streakDays,
        });
        streakStart = null;
        streakEnd = null;
        streakDays = 0;
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

  if (streakStart !== null && streakEnd !== null) {
    passStreaks.push({
      start: streakStart,
      end: streakEnd,
      days: streakDays,
    });
  }

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
  };
}
