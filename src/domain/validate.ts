import { isAfter, isBefore, parseISO } from "date-fns";
import type {
  DateISO,
  InsuredEmploymentSegment,
  LeavePeriod,
  NonInsuredGap,
  UserInput,
} from "./types";

/**
 * UserInput の検証結果。`severity = 'error'` はステップを進める前にブロック対象、
 * `'warning'` は注意喚起のみ（保存は許容）の想定。
 */
export interface ValidationIssue {
  severity: "error" | "warning";
  /** 配列要素由来の指摘なら対象 id を入れる（UI でハイライトするため）。 */
  itemId?: string;
  message: string;
}

export function validateUserInput(input: UserInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  validateScanRange(input, issues);
  validateLeavePeriods(input.leavePeriods, issues);
  validateNonInsuredGaps(input.nonInsuredGaps, issues);
  validateSegmentGapOverlap(input.insuredSegments, input.nonInsuredGaps, issues);
  validateAttendances(input.attendances, issues);

  return issues;
}

function validateScanRange(input: UserInput, issues: ValidationIssue[]) {
  const { start, end } = input.scanRange;
  if (start && end && isStrictlyAfter(start, end)) {
    issues.push({
      severity: "error",
      message: "出産日候補のスキャン範囲は開始日が終了日より後になっています。",
    });
  }
}

function validateLeavePeriods(
  leavePeriods: LeavePeriod[],
  issues: ValidationIssue[],
) {
  for (const p of leavePeriods) {
    if (isStrictlyAfter(p.start, p.end)) {
      issues.push({
        severity: "error",
        itemId: p.id,
        message: `休職・休業期間「${p.type}」の開始日が終了日より後になっています。`,
      });
    }
  }
  for (const [a, b] of pairs(leavePeriods)) {
    if (rangesOverlap(a.start, a.end, b.start, b.end)) {
      issues.push({
        severity: "warning",
        itemId: b.id,
        message: `休職・休業期間「${a.type}」と「${b.type}」の期間が重複しています。`,
      });
    }
  }
}

function validateNonInsuredGaps(
  gaps: NonInsuredGap[],
  issues: ValidationIssue[],
) {
  for (const g of gaps) {
    if (isStrictlyAfter(g.start, g.end)) {
      issues.push({
        severity: "error",
        itemId: g.id,
        message: `雇用保険未加入期間（${g.reason}）の開始日が終了日より後になっています。`,
      });
    }
  }
  for (const [a, b] of pairs(gaps)) {
    if (rangesOverlap(a.start, a.end, b.start, b.end)) {
      issues.push({
        severity: "warning",
        itemId: b.id,
        message: `雇用保険未加入期間が重複しています（${a.reason} / ${b.reason}）。`,
      });
    }
  }
}

function validateSegmentGapOverlap(
  segments: InsuredEmploymentSegment[],
  gaps: NonInsuredGap[],
  issues: ValidationIssue[],
) {
  for (const seg of segments) {
    const segEnd = seg.end ?? "9999-12-31";
    for (const gap of gaps) {
      if (rangesOverlap(seg.start, segEnd, gap.start, gap.end)) {
        issues.push({
          severity: "warning",
          itemId: gap.id,
          message: `雇用保険被保険者期間（${seg.employerName ?? seg.id}）と未加入期間が時間軸で重複しています。`,
        });
      }
    }
  }
}

function validateAttendances(
  attendances: UserInput["attendances"],
  issues: ValidationIssue[],
) {
  const seen = new Set<string>();
  for (const a of attendances) {
    if (seen.has(a.date)) {
      issues.push({
        severity: "error",
        message: `日別出勤情報に同一日（${a.date}）の重複があります。`,
      });
    }
    seen.add(a.date);

    if (a.hours !== undefined && !isNonNegativeFinite(a.hours)) {
      issues.push({
        severity: "error",
        message: `${a.date} の労働時間の値が不正です。`,
      });
    }
  }
}

function isStrictlyAfter(a: DateISO, b: DateISO): boolean {
  return isAfter(parseISO(a), parseISO(b));
}

function rangesOverlap(
  aStart: DateISO,
  aEnd: DateISO,
  bStart: DateISO,
  bEnd: DateISO,
): boolean {
  const as = parseISO(aStart);
  const ae = parseISO(aEnd);
  const bs = parseISO(bStart);
  const be = parseISO(bEnd);
  return !isAfter(as, be) && !isBefore(ae, bs);
}

function isNonNegativeFinite(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

/**
 * 配列要素の組み合わせを (i<j) でイテレートするヘルパー。
 */
function* pairs<T>(items: T[]): IterableIterator<[T, T]> {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      yield [items[i], items[j]];
    }
  }
}
