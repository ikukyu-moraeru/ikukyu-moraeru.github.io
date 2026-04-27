import {
  differenceInCalendarDays,
  format,
  isBefore,
  parseISO,
  subDays,
  subMonths,
} from "date-fns";
import type { CompleteMonth, DateISO, FragmentMonth } from "./types";

const fmt = (d: Date): DateISO => format(d, "yyyy-MM-dd");

/**
 * Rule.md §3-2 / §3-3。
 * 育児休業開始日 `childCareStart` の前日を末尾基準に、月単位で遡って完全月を作る。
 * 応当日のない月は date-fns `subMonths` の仕様（月末クランプ）が「末日を応当日とみなす」要件と一致する。
 *
 * 例: childCareStart = 2026-04-15
 *   完全月 1: 2026-03-15 〜 2026-04-14
 *   完全月 2: 2026-02-15 〜 2026-03-14
 *   ...
 *
 * 戻り値の `completeMonths` は index=1 が最新（育休開始日に最も近い）。
 * windowStart にかからない先頭の余り部分は `fragment` として返す。
 */
export function buildCompleteMonths(
  childCareStart: DateISO,
  windowStart: DateISO,
): { completeMonths: CompleteMonth[]; fragment: FragmentMonth | null } {
  const childCareDate = parseISO(childCareStart);
  const windowStartDate = parseISO(windowStart);

  if (!isBefore(windowStartDate, childCareDate)) {
    return { completeMonths: [], fragment: null };
  }

  const completeMonths: CompleteMonth[] = [];
  for (let i = 1; ; i++) {
    const startI = subMonths(childCareDate, i);
    const endI = subDays(subMonths(childCareDate, i - 1), 1);
    if (isBefore(startI, windowStartDate)) break;
    completeMonths.push({ index: i, start: fmt(startI), end: fmt(endI) });
  }

  const lastCompleteStart =
    completeMonths.length > 0
      ? parseISO(completeMonths[completeMonths.length - 1].start)
      : childCareDate;
  const fragmentEnd = subDays(lastCompleteStart, 1);
  if (isBefore(fragmentEnd, windowStartDate)) {
    return { completeMonths, fragment: null };
  }
  const days = differenceInCalendarDays(fragmentEnd, windowStartDate) + 1;
  return {
    completeMonths,
    fragment: { start: fmt(windowStartDate), end: fmt(fragmentEnd), days },
  };
}
