import { addDays, differenceInCalendarDays, isAfter, isBefore, parseISO } from "date-fns";
import type { InsuredEmploymentSegment, NonInsuredGap } from "./types";

/**
 * Rule.md §4-2 前職通算ルール。
 *
 * 雇用保険被保険者セグメントを時系列順に並べ、各「離職→再就職」のギャップに対し
 * 次の両方を満たす場合のみ、前後のセグメントをそれぞれ通算対象として残す：
 *   (a) ギャップ日数（離職翌日〜再就職前日）≤ 365 日
 *   (b) ギャップ期間内に該当する NonInsuredGap で `basicAllowanceClaimed === true` がない
 *
 * いずれかを満たさない場合は **それ以前に累積していたセグメントをすべて破棄**
 * （Rule §4-1 (イ) の趣旨：基本手当受給資格決定以前の被保険者期間は全除外）し、
 * 当該セグメント以降のみを通算対象として再スタートする。
 *
 * 戻り値はセグメントの **配列** を返す。「通算可」とは前後をまとめて 1 つの被保険者期間と
 * みなすことではなく、両セグメントの月数を共に算定基礎に含めることを意味する。
 * ギャップ期間そのものは雇用保険未加入のままなので（Rule §4-3）、ここで両セグメントを
 * 連結 (= start..end の 1 区間) してしまうと、ギャップ期間まで被保険者扱いになって
 * 判定が誤る。配列のまま返すことでこれを避ける。
 *
 * 重複するセグメントだけは安全のため end を伸ばして 1 つに集約する（同一企業の入力ミスを想定）。
 */
export function mergeInsuredSegments(
  segments: InsuredEmploymentSegment[],
  gaps: NonInsuredGap[],
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
      // 重複セグメントは end を伸ばして 1 つに集約。
      if (seg.end === null) {
        kept[kept.length - 1] = { ...prev, end: null };
      } else if (isAfter(parseISO(seg.end), prevEnd)) {
        kept[kept.length - 1] = { ...prev, end: seg.end };
      }
      continue;
    }

    const claimed = hasBasicAllowanceClaimedBetween(
      addDays(prevEnd, 1),
      addDays(nextStart, -1),
      gaps,
    );

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

function hasBasicAllowanceClaimedBetween(
  rangeStart: Date,
  rangeEnd: Date,
  gaps: NonInsuredGap[],
): boolean {
  return gaps.some((g) => {
    if (!g.basicAllowanceClaimed) return false;
    const gs = parseISO(g.start);
    const ge = parseISO(g.end);
    return !isAfter(gs, rangeEnd) && !isBefore(ge, rangeStart);
  });
}
