import LZString from 'lz-string'
import type {
  AttendanceStatus,
  DailyAttendance,
  DateISO,
  InsuredEmploymentSegment,
  LeavePeriod,
  LeaveType,
  UserInput,
} from '../domain/types'

/**
 * UserInput を URL ハッシュに載せる文字列に変換する。
 *
 * 工夫:
 * - キー名を 1 文字に短縮（m/s/c/g/l/a）
 * - 真偽値は 0/1 で表現
 * - 配列要素は固定順のタプル形式
 * - id は撤廃（受信側で再生成）
 * - lz-string で encodedURIComponent 圧縮（URL safe）
 */

interface CompactInput {
  m: 0 | 1 // isMultipleBirth
  s: [DateISO, DateISO] // scanRange
  c?: DateISO // customChildCareStart
  g: Array<[DateISO, DateISO | null, string, 0 | 1]> // [start, end, employerName, claimedBasicAllowanceAfterEnd]
  l: Array<[LeaveType, DateISO, DateISO, 0 | 1]> // [type, start, end, hasWageDuringLeave]
  a: Array<[DateISO, AttendanceStatus] | [DateISO, AttendanceStatus, number]> // [date, status, hours?]
}

function toCompact(input: UserInput): CompactInput {
  return {
    m: input.isMultipleBirth ? 1 : 0,
    s: [input.scanRange.start, input.scanRange.end],
    ...(input.customChildCareStart
      ? { c: input.customChildCareStart }
      : {}),
    g: input.insuredSegments.map(
      (seg) =>
        [
          seg.start,
          seg.end,
          seg.employerName ?? '',
          seg.claimedBasicAllowanceAfterEnd ? 1 : 0,
        ] as CompactInput['g'][number],
    ),
    l: input.leavePeriods.map(
      (p) =>
        [
          p.type,
          p.start,
          p.end,
          p.hasWageDuringLeave ? 1 : 0,
        ] as CompactInput['l'][number],
    ),
    a: input.attendances.map((a) =>
      typeof a.hours === 'number'
        ? ([a.date, a.status, a.hours] as [DateISO, AttendanceStatus, number])
        : ([a.date, a.status] as [DateISO, AttendanceStatus]),
    ),
  }
}

function fromCompact(c: CompactInput): UserInput {
  return {
    isMultipleBirth: c.m === 1,
    scanRange: { start: c.s[0], end: c.s[1] },
    ...(c.c ? { customChildCareStart: c.c } : {}),
    insuredSegments: c.g.map(
      ([start, end, employerName, claimed], i): InsuredEmploymentSegment => ({
        id: `seg-${i}`,
        start,
        end,
        ...(employerName ? { employerName } : {}),
        ...(claimed === 1 ? { claimedBasicAllowanceAfterEnd: true } : {}),
      }),
    ),
    leavePeriods: c.l.map(
      ([type, start, end, wage], i): LeavePeriod => ({
        id: `lp-${i}`,
        type,
        start,
        end,
        hasWageDuringLeave: wage === 1,
      }),
    ),
    attendances: c.a.map(
      ([date, status, hours]): DailyAttendance =>
        typeof hours === 'number'
          ? { date, status, hours }
          : { date, status },
    ),
  }
}

export function serializeInput(input: UserInput): string {
  const compact = toCompact(input)
  const json = JSON.stringify(compact)
  return LZString.compressToEncodedURIComponent(json)
}

export function deserializeInput(data: string): UserInput | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(data)
    if (!json) return null
    const c = JSON.parse(json) as CompactInput
    if (!c || typeof c !== 'object' || !Array.isArray(c.s)) return null
    return fromCompact(c)
  } catch {
    return null
  }
}

const APP_BASE = ''

export function buildShareUrl(input: UserInput): string {
  if (typeof window === 'undefined') return ''
  const data = serializeInput(input)
  return `${window.location.origin}${APP_BASE}/import?data=${data}`
}

export function readImportDataFromHash(): string | null {
  if (typeof window === 'undefined') return null
  // pathname ベース: /import?data=...
  if (window.location.pathname.endsWith('/import')) {
    const params = new URLSearchParams(window.location.search)
    return params.get('data')
  }
  return null
}

export function clearImportFromHash() {
  if (typeof window === 'undefined') return
  window.history.replaceState(null, '', `${APP_BASE}/`)
}
