import {
  addDays,
  differenceInCalendarDays,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import type { DateISO, LeavePeriod } from "./types";

/**
 * Rule.md §3-4 受給要件の緩和（2 年 → 最長 4 年）。
 *
 * 判定対象期間 `[windowStart, windowEnd]` 内で、賃金支払いを受けられなかった
 * （= `hasWageDuringLeave === false`）休業期間を **和集合化** したうえで、
 * **連続 30 日以上** の各ブロックの日数を合算する。
 *
 * 注意点:
 *  - 賃金支払のあった休業（hasWageDuringLeave=true）は加算対象外（Rule §3-4 注）。
 *  - 連続性の判定は和集合化後に行う。複数の重なる/隣接する休業ブロックは
 *    1 つの連続期間として扱う。
 *  - windowStart/windowEnd で外側に出た部分はクリップする。
 *  - 戻り値は最大 730（= 2 年）でクランプ（合計最長 4 年の上限）。
 */
const MAX_RELAXATION_DAYS = 730;
const MIN_BLOCK_DAYS = 30;

interface DateInterval {
  start: Date;
  end: Date;
}

export function computeRelaxationDays(
  leavePeriods: LeavePeriod[],
  windowStart: DateISO,
  windowEnd: DateISO,
): number {
  const winStart = parseISO(windowStart);
  const winEnd = parseISO(windowEnd);
  if (isAfter(winStart, winEnd)) return 0;

  const eligible = leavePeriods.filter((p) => !p.hasWageDuringLeave);
  const clipped: DateInterval[] = [];
  for (const p of eligible) {
    const ps = parseISO(p.start);
    const pe = parseISO(p.end);
    if (isAfter(ps, pe)) continue;
    const s = isBefore(ps, winStart) ? winStart : ps;
    const e = isAfter(pe, winEnd) ? winEnd : pe;
    if (isAfter(s, e)) continue;
    clipped.push({ start: s, end: e });
  }
  if (clipped.length === 0) return 0;

  const merged = mergeIntervals(clipped);

  let total = 0;
  for (const block of merged) {
    const days = differenceInCalendarDays(block.end, block.start) + 1;
    if (days >= MIN_BLOCK_DAYS) total += days;
  }
  return Math.min(total, MAX_RELAXATION_DAYS);
}

/**
 * 区間を start 昇順にソートし、隣接または重複する区間を 1 つに結合する。
 * 「隣接」は end+1 == 次の start のとき（休業が日単位で途切れずつながる場合）。
 */
function mergeIntervals(intervals: DateInterval[]): DateInterval[] {
  const sorted = [...intervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const merged: DateInterval[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && !isAfter(cur.start, addDays(last.end, 1))) {
      if (isAfter(cur.end, last.end)) last.end = cur.end;
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}
