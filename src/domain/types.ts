/**
 * ドメイン型定義。
 * 仕様の出典は Rule.md を参照（厚労省パンフレット 2025-08-01 改訂版 / 業務取扱要領 59533 等）。
 */

export type DateISO = string; // "YYYY-MM-DD"

export type LeaveType =
  | "産休"
  | "育休"
  | "病気休職"
  | "介護休業"
  | "組合専従"
  | "配偶者海外同行"
  | "事業所休業"
  | "その他";

/**
 * 休職・休業期間。
 * `hasWageDuringLeave = true` の場合、3-4 の受給要件緩和の対象外（Rule.md §3-4 注）。
 */
export interface LeavePeriod {
  id: string;
  type: LeaveType;
  start: DateISO;
  end: DateISO;
  hasWageDuringLeave: boolean;
}

/**
 * 雇用保険に加入していなかった期間（転職空白・無職・短時間労働等）。
 * `basicAllowanceClaimed = true` の場合、それ以前の被保険者期間は通算対象外（Rule.md §4-1 イ / §4-2）。
 */
export interface NonInsuredGap {
  id: string;
  start: DateISO;
  end: DateISO;
  reason: "転職の空白" | "退職後無職" | "短時間労働で未加入" | "その他";
  basicAllowanceClaimed: boolean;
}

/**
 * 雇用保険に加入していたセグメント（1事業所 = 1セグメント想定）。
 * 在職中の場合 `end` は null。
 */
export interface InsuredEmploymentSegment {
  id: string;
  start: DateISO;
  end: DateISO | null;
  employerName?: string;
}

/**
 * 月単位の出勤情報。
 * 「完全月」とは別概念で、暦月での集計値。判定ロジック側で完全月にマッピングする。
 */
export interface MonthlyAttendance {
  monthKey: string; // "YYYY-MM"
  basicWageDays: number;
  basicWageHours: number;
}

/**
 * ユーザー入力全体。
 */
export interface UserInput {
  isMultipleBirth: boolean; // 多胎妊娠
  scanRange: { start: DateISO; end: DateISO }; // 出産日候補のスキャン範囲
  insuredSegments: InsuredEmploymentSegment[];
  nonInsuredGaps: NonInsuredGap[];
  leavePeriods: LeavePeriod[];
  attendances: MonthlyAttendance[];
}

/**
 * 完全月の区切り（Rule.md §3-2）。
 * 範囲は inclusive。日数は (endDate - startDate + 1)。
 */
export interface CompleteMonth {
  index: number; // 1 が育休開始日に最も近い完全月
  start: DateISO;
  end: DateISO;
}

/**
 * 端数月（Rule.md §3-3）。
 */
export interface FragmentMonth {
  start: DateISO;
  end: DateISO;
  days: number;
}

/**
 * 完全月・端数月の判定で使う集計後出勤量。
 * 入力 `MonthlyAttendance` は暦月ベースだが、完全月は暦月境界をまたぐため、
 * 各完全月にかかる暦月の日数比で按分した値を保持する。
 */
export interface JudgedAttendance {
  basicWageDays: number;
  basicWageHours: number;
}

/**
 * 各完全月の判定結果。
 */
export interface MonthJudgment {
  range: CompleteMonth;
  counted: 0 | 0.5 | 1;
  reason:
    | "11日以上"
    | "80時間以上"
    | "条件未達"
    | "雇用保険未加入"
    | "前職通算外";
  attendance?: JudgedAttendance;
}

/**
 * 1 つの「実際の出産日」候補に対する判定結果。
 */
export interface EligibilityResult {
  birthDate: DateISO;
  leaveStartDate: DateISO; // 産前休業開始日 = 出産予定日 - (42 or 98)
  childCareStartDate: DateISO; // 育児休業開始日 = 出産日 + 産後休業日数 + 1
  scanWindow: { start: DateISO; end: DateISO }; // 緩和適用後の判定対象期間
  baseWindowStart: DateISO; // 緩和なしの基本始端（= childCareStartDate - 2年）
  relaxationDays: number; // 緩和で加算された日数（最大 730）
  countedMonths: number; // カウント合計（端数 0.5 含む）
  isEligible: boolean;
  shortage: number; // 12 - countedMonths（不足月数。0 以上）
  monthBreakdown: MonthJudgment[];
  fragmentJudgment?: {
    range: FragmentMonth;
    counted: 0 | 0.5;
    reason: "11日以上" | "条件未達" | "15日未満" | "雇用保険未加入";
    attendance?: JudgedAttendance;
  };
}
