import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDay,
  isAfter,
  parseISO,
  startOfMonth,
  subDays,
  subYears,
} from 'date-fns'
import { useAppState } from '../../state/AppState'
import type {
  AttendanceStatus,
  DailyAttendance,
  UserInput,
} from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import './steps.css'
import './Step4Attendance.css'

type DayState =
  | { kind: 'pre_hire' | 'post_quit' }
  | { kind: 'gap' }
  | { kind: 'leave' }
  | { kind: 'public_holiday' }
  | { kind: 'unset' } // 平日・未入力
  | { kind: 'work'; hours?: number }
  | { kind: 'paid_leave' }
  | { kind: 'paid_special' }
  | { kind: 'absent' }

interface DayInfo {
  date: string
  state: DayState
  /** 賃金支払基礎日数にカウントされるか */
  isBasic: boolean
  /** ユーザー入力で上書きされた日か */
  overridden: boolean
}

const STATUS_CYCLE: AttendanceStatus[] = [
  'work',
  'paid_leave',
  'paid_special',
  'absent',
]

function expectedFromScan(scan: UserInput['scanRange']): Date | null {
  if (!scan.start || !scan.end) return null
  const s = parseISO(scan.start).getTime()
  const e = parseISO(scan.end).getTime()
  if (Number.isNaN(s) || Number.isNaN(e)) return null
  return new Date((s + e) / 2)
}

function buildJudgmentRange(input: UserInput): { start: Date; end: Date } | null {
  const expected = expectedFromScan(input.scanRange)
  if (!expected) return null
  const childCareStart = addDays(expected, 57)
  const end = subDays(childCareStart, 1)
  // 緩和を考慮し最長 4 年（簡易: 2 年と +2 年バッファ）。実際の判定対象は出産日ごとに変わるが、
  // ここではユーザーが入力できる期間として最長 4 年を確保する。
  const start = subYears(end, 4)
  return { start, end }
}

function inSegment(
  date: string,
  segments: UserInput['insuredSegments'],
): boolean {
  return segments.some((s) => {
    const segEnd = s.end ?? '9999-12-31'
    return s.start <= date && date <= segEnd
  })
}

function inGap(date: string, gaps: UserInput['nonInsuredGaps']): boolean {
  return gaps.some((g) => g.start <= date && date <= g.end)
}

function inLeave(date: string, leaves: UserInput['leavePeriods']): boolean {
  return leaves.some((l) => l.start <= date && date <= l.end)
}

function deriveDay(
  date: string,
  override: DailyAttendance | undefined,
  input: UserInput,
): DayInfo {
  if (override) {
    return {
      date,
      state: { kind: override.status, hours: override.hours },
      isBasic:
        override.status === 'work' ||
        override.status === 'paid_leave' ||
        override.status === 'paid_special',
      overridden: true,
    }
  }
  // 自動推論: 客観的に決まるものだけ
  const insured = inSegment(date, input.insuredSegments)
  if (!insured) {
    return { date, state: { kind: 'pre_hire' }, isBasic: false, overridden: false }
  }
  if (inGap(date, input.nonInsuredGaps)) {
    return { date, state: { kind: 'gap' }, isBasic: false, overridden: false }
  }
  if (inLeave(date, input.leavePeriods)) {
    return { date, state: { kind: 'leave' }, isBasic: false, overridden: false }
  }
  const dow = getDay(parseISO(date))
  if (dow === 0 || dow === 6) {
    return {
      date,
      state: { kind: 'public_holiday' },
      isBasic: false,
      overridden: false,
    }
  }
  return { date, state: { kind: 'unset' }, isBasic: false, overridden: false }
}

function nextStatus(current: AttendanceStatus | null): AttendanceStatus | null {
  // 未入力 → work → paid_leave → paid_special → absent → 未入力 のサイクル
  if (current === null) return STATUS_CYCLE[0]
  const idx = STATUS_CYCLE.indexOf(current)
  if (idx < 0 || idx === STATUS_CYCLE.length - 1) return null
  return STATUS_CYCLE[idx + 1]
}

export function Step4Attendance() {
  const { state, dispatch } = useAppState()

  const range = useMemo(() => buildJudgmentRange(state.input), [state.input])
  const [monthOffset, setMonthOffset] = useState(0)

  const overrideMap = useMemo(() => {
    const m = new Map<string, DailyAttendance>()
    for (const a of state.input.attendances) m.set(a.date, a)
    return m
  }, [state.input.attendances])

  if (!range) {
    return (
      <div className="st-empty">
        <span className="st-empty__emoji" aria-hidden>
          📅
        </span>
        Step 1 で出産予定日を入力すると、判定対象期間が決まります。
      </div>
    )
  }

  // 入力可能な月リスト（最古 → 最新）
  const monthsList: string[] = []
  let cursor = startOfMonth(range.start)
  const stop = startOfMonth(range.end)
  while (!isAfter(cursor, stop)) {
    monthsList.push(format(cursor, 'yyyy-MM'))
    cursor = addMonths(cursor, 1)
  }
  // デフォルト表示は最新月（出産直前）
  const defaultIdx = monthsList.length - 1
  const idx = Math.min(
    Math.max(0, defaultIdx + monthOffset),
    monthsList.length - 1,
  )
  const currentMonthKey = monthsList[idx]
  const monthStart = parseISO(`${currentMonthKey}-01`)
  const monthEnd = endOfMonth(monthStart)

  // この月のすべての日
  const days: DayInfo[] = []
  for (
    let d = monthStart;
    d.getTime() <= monthEnd.getTime();
    d = addDays(d, 1)
  ) {
    const date = format(d, 'yyyy-MM-dd')
    days.push(deriveDay(date, overrideMap.get(date), state.input))
  }

  // この月の集計
  const basicCount = days.filter((d) => d.isBasic).length
  const totalHours = days.reduce((sum, d) => {
    if (d.state.kind === 'work' && typeof d.state.hours === 'number') {
      return sum + d.state.hours
    }
    return sum
  }, 0)

  const setStatus = (date: string, status: AttendanceStatus | null) => {
    const next = state.input.attendances.filter((a) => a.date !== date)
    if (status !== null) {
      const existing = overrideMap.get(date)
      next.push({
        date,
        status,
        ...(existing?.hours !== undefined ? { hours: existing.hours } : {}),
      })
    }
    next.sort((a, b) => a.date.localeCompare(b.date))
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  const setHours = (date: string, hours: number | null) => {
    const existing = overrideMap.get(date)
    if (!existing) return
    const next = state.input.attendances.map((a) => {
      if (a.date !== date) return a
      if (hours === null) {
        const { hours: _omit, ...rest } = a
        return rest
      }
      return { ...a, hours }
    })
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  const cycle = (info: DayInfo) => {
    if (
      info.state.kind === 'pre_hire' ||
      info.state.kind === 'post_quit' ||
      info.state.kind === 'gap' ||
      info.state.kind === 'leave' ||
      info.state.kind === 'public_holiday'
    ) {
      // 自動着色日も明示入力可能（休業中だが特例で出勤した、など）
      setStatus(info.date, 'work')
      return
    }
    const cur =
      info.state.kind === 'work' ||
      info.state.kind === 'paid_leave' ||
      info.state.kind === 'paid_special' ||
      info.state.kind === 'absent'
        ? info.state.kind
        : null
    setStatus(info.date, nextStatus(cur))
  }

  // 月内の平日（自動着色されない日）を一括 work に
  const fillWeekdaysInMonth = () => {
    const next = state.input.attendances.filter(
      (a) => !a.date.startsWith(currentMonthKey),
    )
    for (const d of days) {
      if (d.state.kind === 'unset') {
        next.push({ date: d.date, status: 'work' })
      } else if (d.overridden) {
        const o = overrideMap.get(d.date)
        if (o) next.push(o)
      }
    }
    next.sort((a, b) => a.date.localeCompare(b.date))
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  // 月内のオーバーライドをクリア
  const clearMonth = () => {
    const next = state.input.attendances.filter(
      (a) => !a.date.startsWith(currentMonthKey),
    )
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  // 全期間の平日を一括 work に
  const fillWeekdaysAll = () => {
    const next: DailyAttendance[] = []
    // 既存オーバーライドは保持
    for (const a of state.input.attendances) next.push(a)
    const seen = new Set(next.map((a) => a.date))
    for (const ymKey of monthsList) {
      const mStart = parseISO(`${ymKey}-01`)
      const mEnd = endOfMonth(mStart)
      for (let d = mStart; d.getTime() <= mEnd.getTime(); d = addDays(d, 1)) {
        const date = format(d, 'yyyy-MM-dd')
        if (seen.has(date)) continue
        const info = deriveDay(date, undefined, state.input)
        if (info.state.kind === 'unset') {
          next.push({ date, status: 'work' })
        }
      }
    }
    next.sort((a, b) => a.date.localeCompare(b.date))
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  return (
    <div className="st-section">
      <IssueBanner />

      <p className="st-field__hint">
        各日の出勤状況を入力してください。<strong>出勤・有給・賃金の出る特休</strong>
        が「賃金支払基礎日数」にカウントされます。<strong>欠勤・休業中・公休（土日）</strong>
        はカウントされません。<br />
        セルをタップすると <span className="at-key at-key--work">出勤</span> →
        <span className="at-key at-key--paid_leave">有給</span> →
        <span className="at-key at-key--paid_special">特休</span> →
        <span className="at-key at-key--absent">欠勤</span> →
        未入力 の順に切り替わります。
      </p>

      <div className="at-toolbar">
        <button
          className="at-month-nav"
          onClick={() => setMonthOffset((o) => o - 1)}
          disabled={idx === 0}
          aria-label="前の月"
        >
          ‹
        </button>
        <select
          className="at-month-select"
          value={currentMonthKey}
          onChange={(e) => {
            const newIdx = monthsList.indexOf(e.target.value)
            if (newIdx >= 0) setMonthOffset(newIdx - defaultIdx)
          }}
        >
          {monthsList.map((ym) => (
            <option key={ym} value={ym}>
              {ym.slice(0, 4)} 年 {Number(ym.slice(5))} 月
            </option>
          ))}
        </select>
        <button
          className="at-month-nav"
          onClick={() => setMonthOffset((o) => o + 1)}
          disabled={idx === monthsList.length - 1}
          aria-label="次の月"
        >
          ›
        </button>

        <div className="at-toolbar__spacer" />

        <button className="at-quick" onClick={fillWeekdaysInMonth}>
          📌 この月の平日を出勤に
        </button>
        <button className="at-quick at-quick--ghost" onClick={clearMonth}>
          月をクリア
        </button>
      </div>

      <div className="at-summary">
        <div className="at-summary__cell">
          <span className="at-summary__big">{basicCount}</span>
          <span className="at-summary__lab">
            賃金支払基礎日数
            <br />
            <small>11日以上で達成</small>
          </span>
        </div>
        <div className="at-summary__cell">
          <span className="at-summary__big">
            {totalHours > 0 ? totalHours : '—'}
          </span>
          <span className="at-summary__lab">
            出勤時間（任意）
            <br />
            <small>80時間以上で達成（11日未満時）</small>
          </span>
        </div>
        <div
          className={`at-summary__verdict at-summary__verdict--${basicCount >= 11 ? 'pass' : totalHours >= 80 ? 'pass' : 'fail'}`}
        >
          {basicCount >= 11
            ? '✓ 11日以上を達成'
            : totalHours >= 80
              ? '✓ 80時間以上を達成'
              : '✕ 未達'}
        </div>
      </div>

      <div className="at-cal">
        <div className="at-cal__head">
          {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="at-cal__grid">
          {/* 月初の曜日まで空セル */}
          {Array.from({ length: getDay(monthStart) }).map((_, i) => (
            <span key={`pad-${i}`} className="at-cell at-cell--pad" />
          ))}
          {days.map((d) => (
            <DayCell
              key={d.date}
              info={d}
              onCycle={() => cycle(d)}
              onClear={() => setStatus(d.date, null)}
              onHoursChange={(h) => setHours(d.date, h)}
            />
          ))}
        </div>
      </div>

      <details className="at-actions">
        <summary>その他の操作</summary>
        <div className="at-actions__body">
          <button className="at-quick" onClick={fillWeekdaysAll}>
            🌿 入力対象期間 全部の平日を出勤に
          </button>
        </div>
      </details>

      <div className="at-legend">
        <span className="at-key at-key--work">🟢 出勤</span>
        <span className="at-key at-key--paid_leave">🅿️ 有給</span>
        <span className="at-key at-key--paid_special">✨ 特休</span>
        <span className="at-key at-key--absent">✕ 欠勤</span>
        <span className="at-key at-key--leave">🛏 休業中</span>
        <span className="at-key at-key--gap">🌀 未加入</span>
        <span className="at-key at-key--holiday">— 公休</span>
        <span className="at-key at-key--unset">？ 未入力</span>
      </div>
    </div>
  )
}

interface DayCellProps {
  info: DayInfo
  onCycle: () => void
  onClear: () => void
  onHoursChange: (hours: number | null) => void
}

function DayCell({ info, onCycle, onClear, onHoursChange }: DayCellProps) {
  const dn = Number(info.date.slice(8, 10))
  const klass = (() => {
    switch (info.state.kind) {
      case 'work':
        return 'at-cell at-cell--work'
      case 'paid_leave':
        return 'at-cell at-cell--paid_leave'
      case 'paid_special':
        return 'at-cell at-cell--paid_special'
      case 'absent':
        return 'at-cell at-cell--absent'
      case 'leave':
        return 'at-cell at-cell--leave'
      case 'gap':
        return 'at-cell at-cell--gap'
      case 'pre_hire':
      case 'post_quit':
        return 'at-cell at-cell--out'
      case 'public_holiday':
        return 'at-cell at-cell--holiday'
      case 'unset':
        return 'at-cell at-cell--unset'
    }
  })()

  const label = (() => {
    switch (info.state.kind) {
      case 'work':
        return '出勤'
      case 'paid_leave':
        return '有給'
      case 'paid_special':
        return '特休'
      case 'absent':
        return '欠勤'
      case 'leave':
        return '休業'
      case 'gap':
        return '未加入'
      case 'pre_hire':
      case 'post_quit':
        return '対象外'
      case 'public_holiday':
        return '公休'
      case 'unset':
        return ''
    }
  })()

  const [editingHours, setEditingHours] = useState(false)
  const hours = info.state.kind === 'work' ? info.state.hours : undefined

  return (
    <button
      className={klass}
      onClick={(e) => {
        // hours 入力欄クリック時はサイクルしない
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT') return
        onCycle()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (info.overridden) onClear()
      }}
      title={`${info.date} · ${label || '未入力'}（クリックで変更、右クリックで未入力に戻す）`}
    >
      <span className="at-cell__day">{dn}</span>
      {label && <span className="at-cell__label">{label}</span>}
      {info.state.kind === 'work' &&
        (editingHours ? (
          <input
            type="number"
            className="at-cell__hours-input"
            min={0}
            max={24}
            step={0.5}
            value={hours ?? ''}
            placeholder="時間"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value
              if (v === '') {
                onHoursChange(null)
              } else {
                const n = Number(v)
                if (Number.isFinite(n)) onHoursChange(n)
              }
            }}
            onBlur={() => setEditingHours(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
          />
        ) : (
          <span
            className="at-cell__hours"
            onClick={(e) => {
              e.stopPropagation()
              setEditingHours(true)
            }}
            role="button"
            tabIndex={-1}
          >
            {hours !== undefined ? `${hours}h` : '時間'}
          </span>
        ))}
    </button>
  )
}
