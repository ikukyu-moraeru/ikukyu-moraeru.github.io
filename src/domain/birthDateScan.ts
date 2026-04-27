import { addDays, format, isAfter, parseISO } from "date-fns";
import { judgeEligibility } from "./eligibility";
import type { DateISO, EligibilityResult, UserInput } from "./types";

/**
 * `input.scanRange` で指定された出産日候補のすべての日について
 * `judgeEligibility` を呼び、結果を配列で返す。
 *
 * UI の Step 5（ヒートマップ）で「出産日 × 充足判定」を可視化するために使う。
 *
 * - `scanRange.start` > `scanRange.end` の場合は空配列を返す。
 * - 開始日と終了日は inclusive。
 */
export function scanBirthDates(input: UserInput): EligibilityResult[] {
  const { start, end } = input.scanRange;
  if (!start || !end) return [];

  const startD = parseISO(start);
  const endD = parseISO(end);
  if (isAfter(startD, endD)) return [];

  const results: EligibilityResult[] = [];
  let cursor = startD;
  while (!isAfter(cursor, endD)) {
    const dateStr: DateISO = format(cursor, "yyyy-MM-dd");
    results.push(judgeEligibility(input, dateStr));
    cursor = addDays(cursor, 1);
  }
  return results;
}
