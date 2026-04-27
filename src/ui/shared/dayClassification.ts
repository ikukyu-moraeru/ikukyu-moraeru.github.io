import { getDay, parseISO } from 'date-fns'
import type {
  AttendanceStatus,
  DailyAttendance,
  InsuredEmploymentSegment,
  LeavePeriod,
  UserInput,
} from '../../domain/types'

/**
 * 1 日のステータス（自動推論 + ユーザー入力）。
 * Step4 のカレンダー表示と Step5 の未入力検知で共通利用する。
 *
 * - out             : 加入外 / 退職後 / 育休開始日以降（判定対象外）
 * - leave           : 休業期間中
 * - public_holiday  : 公休（土日）
 * - unset           : 平日・自動推論可能だが未入力（入力対象）
 * - work / paid_leave / paid_special / absent : ユーザー入力済み
 */
export type DayKind =
  | 'out'
  | 'leave'
  | 'public_holiday'
  | 'unset'
  | AttendanceStatus

export interface ClassifiedDay {
  date: string
  kind: DayKind
  hours?: number
  /** ユーザーが明示的に入力した日か */
  overridden: boolean
  /** 賃金支払基礎日数にカウントされる（work / paid_leave / paid_special） */
  isBasic: boolean
}

/**
 * 1 日のステータスを返す。
 *
 * @param date          対象日付 (YYYY-MM-DD)
 * @param override      attendances にあるユーザー入力（あれば）
 * @param input         UserInput（leavePeriods / insuredSegments 参照）
 * @param scanWindowEnd 育休開始日 - 1 日。これより後は判定対象外
 */
export function classifyDay(
  date: string,
  override: DailyAttendance | undefined,
  input: UserInput,
  scanWindowEnd?: string,
): ClassifiedDay {
  if (override) {
    const isBasic =
      override.status === 'work' ||
      override.status === 'paid_leave' ||
      override.status === 'paid_special'
    return {
      date,
      kind: override.status,
      hours: override.hours,
      overridden: true,
      isBasic,
    }
  }
  if (scanWindowEnd && date > scanWindowEnd) {
    return { date, kind: 'out', overridden: false, isBasic: false }
  }
  if (!isInSegment(date, input.insuredSegments)) {
    return { date, kind: 'out', overridden: false, isBasic: false }
  }
  if (isInLeave(date, input.leavePeriods)) {
    return { date, kind: 'leave', overridden: false, isBasic: false }
  }
  const dow = getDay(parseISO(date))
  if (dow === 0 || dow === 6) {
    return {
      date,
      kind: 'public_holiday',
      overridden: false,
      isBasic: false,
    }
  }
  return { date, kind: 'unset', overridden: false, isBasic: false }
}

/**
 * その日がユーザーが入力すべき日か（Step5 の未入力警告で使う）。
 * 公休（土日）も「unset 扱い」だが、実務的に出勤日と被らないことが多いため、
 * Step5 では平日（unset）のみを「入力対象」と判定する。
 */
export function isInputableDay(
  date: string,
  input: UserInput,
  scanWindowEnd?: string,
): boolean {
  const c = classifyDay(date, undefined, input, scanWindowEnd)
  return c.kind === 'unset'
}

function isInSegment(
  date: string,
  segments: InsuredEmploymentSegment[],
): boolean {
  return segments.some((s) => {
    const segEnd = s.end ?? '9999-12-31'
    return s.start <= date && date <= segEnd
  })
}

function isInLeave(date: string, leaves: LeavePeriod[]): boolean {
  return leaves.some(
    (l) => l.start && l.end && l.start <= date && date <= l.end,
  )
}
