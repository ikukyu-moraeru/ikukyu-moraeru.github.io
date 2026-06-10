import { differenceInCalendarDays, isAfter, parseISO } from "date-fns";
import type { InsuredEmploymentSegment } from "./types";

/**
 * Rule.md §4-2 前職通算ルール。
 *
 * 雇用保険被保険者セグメントを時系列順に並べ、各「離職→再就職」のギャップに対し
 * 次の両方を満たす場合のみ、前後のセグメントをそれぞれ通算対象として残す：
 *   (a) ギャップ日数（離職翌日〜再就職前日）≤ 365 日
 *   (b) **直前のセグメントの離職後に基本手当の受給資格決定を受けていない**
 *       （`claimedBasicAllowanceAfterEnd !== true`）
 *
 * いずれかを満たさない場合は **それ以前に累積していたセグメントをすべて破棄**
 * （Rule §4-1 (イ) の趣旨：基本手当受給資格決定以前の被保険者期間は全除外）し、
 * 当該セグメント以降のみを通算対象として再スタートする。
 *
 * - 重複セグメント（同一期間の二重入力）は end を伸ばして 1 つに集約。
 * - **ギャップ 0 日（離職翌日に再就職）でも連結しない**。転職では被保険者資格の
 *   喪失・取得が起きるため、完全月の区切りはセグメント（資格）ごとに行う必要がある
 *   （行政手引 50103 イ(イ)・50104：離職票ごとに喪失応当日で区切って通算）。
 *   同一事業主で資格が継続している期間は 1 セグメントとして入力される前提。
 */
export function mergeInsuredSegments(
  segments: InsuredEmploymentSegment[],
): InsuredEmploymentSegment[] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime(),
  );

  let kept: InsuredEmploymentSegment[] = [];

  for (const seg of sorted) {
    if (kept.length === 0) {
      kept.push({ ...seg });
      continue;
    }
    const prev = kept[kept.length - 1];
    if (prev.end === null) {
      // 直前が在職中のはずなのに後続セグメントがあるのは入力不整合。
      // 安全側で前職を破棄して当該セグメントから再スタート。
      kept = [{ ...seg }];
      continue;
    }
    const prevEnd = parseISO(prev.end);
    const nextStart = parseISO(seg.start);
    const gapDays = differenceInCalendarDays(nextStart, prevEnd) - 1;

    if (gapDays < 0) {
      if (seg.end === null) {
        kept[kept.length - 1] = { ...prev, end: null };
      } else if (isAfter(parseISO(seg.end), prevEnd)) {
        kept[kept.length - 1] = { ...prev, end: seg.end };
      }
      continue;
    }

    const claimed = prev.claimedBasicAllowanceAfterEnd === true;

    if (gapDays > 365 || claimed) {
      // 通算不可: 既存累積をすべて破棄（Rule §4-1 イ）し、当該セグメントから再スタート。
      kept = [{ ...seg }];
    } else {
      // 通算可: 前職セグメントを残したまま当該セグメントを追加。
      kept.push({ ...seg });
    }
  }
  return kept;
}
