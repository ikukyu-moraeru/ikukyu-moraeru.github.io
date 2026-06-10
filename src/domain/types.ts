/**
 * ドメイン型定義。
 * 仕様の出典は Rule.md を参照（厚労省パンフレット 2025-08-01 改訂版 / 業務取扱要領 59523 等）。
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
 * 雇用保険に加入していたセグメント（1事業所 = 1セグメント想定）。
 * 在職中の場合 `end` は null。
 *
 * `claimedBasicAllowanceAfterEnd = true` の場合、この離職後に失業給付（基本手当）の
 * 受給資格決定を受けたことを意味し、それ以前の被保険者期間は通算対象外
 * （Rule.md §4-1 イ / §4-2）になる。
 */
export interface InsuredEmploymentSegment {
  id: string;
  start: DateISO;
  end: DateISO | null;
  employerName?: string;
  claimedBasicAllowanceAfterEnd?: boolean;
}

/**
 * 1 日の出勤ステータス。
 * ユーザーが明示的に入力した日のみ `DailyAttendance` として保存する。
 * 配列に存在しない日は「未入力」（賃金支払基礎日数にカウントしない）扱い。
 *
 * - work          : 実労働（出社・在宅問わず）。賃金支払基礎日数にカウント。
 * - paid_leave    : 年次有給休暇。賃金支払基礎日数にカウント（有給日も基礎日数に含まれる）。
 * - paid_special  : 賃金が支払われる特別休暇 / 休業手当（労基法 26 条）対象日。同上。
 * - absent        : 欠勤・無給休暇。賃金支払基礎日数にカウントしない。
 *
 * 注: 公休（土日祝）／休業期間中／未加入期間／入社前後 などは
 *     `LeavePeriod` / `InsuredEmploymentSegment` から自動推論できるため、
 *     ここには含めない。UI 側で自動着色して扱う。
 */
export type AttendanceStatus = "work" | "paid_leave" | "paid_special" | "absent";

/**
 * ユーザーが明示的に入力した 1 日分の勤務情報。
 * `hours` は任意（時間入力したい人向け）。`hours` が無い日は 80 時間ルールには寄与しない。
 */
export interface DailyAttendance {
  date: DateISO; // "YYYY-MM-DD"
  status: AttendanceStatus;
  hours?: number;
  note?: string;
}

/**
 * ユーザー入力全体。
 */
export interface UserInput {
  isMultipleBirth: boolean; // 多胎妊娠
  scanRange: { start: DateISO; end: DateISO }; // 出産日候補のスキャン範囲
  /**
   * 育休開始日のカスタム指定。未設定ならデフォルト（出産日 + 産後 56 日 + 1 日）を使う。
   * 「産後復職→数か月後に育休」のように会社と確定日が決まっているケース用。
   */
  customChildCareStart?: DateISO;
  /**
   * 産前休業の開始日のカスタム指定。undefined = 自動（予定日 - 42/98 日）。
   * 出産直前まで働いた場合など、法定最長より短く取るケース用。
   */
  customMaternityStart?: DateISO;
  /**
   * 産後休業の終了日のカスタム指定。undefined = 自動（予定日 + 56 日）。
   * これを指定すると育休開始日の自動既定値もこの翌日に追従する。
   */
  customMaternityEnd?: DateISO;
  insuredSegments: InsuredEmploymentSegment[];
  leavePeriods: LeavePeriod[];
  attendances: DailyAttendance[];
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
 * 完全月・端数月の判定で使う集計値。
 * `DailyAttendance` を期間内で日付フィルタして集計した結果を保持する（按分なし）。
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
    reason: "11日以上" | "80時間以上" | "条件未達" | "15日未満" | "雇用保険未加入";
    attendance?: JudgedAttendance;
  };
}
