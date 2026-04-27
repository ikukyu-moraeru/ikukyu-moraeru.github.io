import { useMemo } from 'react'
import {
  addDays,
  addMonths,
  format,
  isAfter,
  parseISO,
  startOfMonth,
  subDays,
  subYears,
} from 'date-fns'
import { useAppState } from '../../state/AppState'
import type { MonthlyAttendance, UserInput } from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import './steps.css'
import './Step4Attendance.css'

const FULLTIME_DAYS = 22
const FULLTIME_HOURS = 168

function expectedFromScan(scan: UserInput['scanRange']): Date | null {
  if (!scan.start || !scan.end) return null
  try {
    const s = parseISO(scan.start).getTime()
    const e = parseISO(scan.end).getTime()
    return new Date((s + e) / 2)
  } catch {
    return null
  }
}

interface MonthRow {
  key: string
  label: string
  ymdLabel: string
}

function buildMonths(input: UserInput): MonthRow[] {
  const expected = expectedFromScan(input.scanRange)
  if (!expected) return []

  // 育休開始日 = 出産予定日 + 産後 56 日 + 1
  const childCareStart = addDays(expected, 57)
  const windowEnd = subDays(childCareStart, 1)
  const windowStart = subYears(childCareStart, 2)

  const months: MonthRow[] = []
  let cur = startOfMonth(windowStart)
  const stop = startOfMonth(windowEnd)
  while (!isAfter(cur, stop)) {
    const key = format(cur, 'yyyy-MM')
    months.push({
      key,
      label: format(cur, 'yyyy 年 M 月'),
      ymdLabel: format(cur, 'yyyy / MM'),
    })
    cur = addMonths(cur, 1)
  }
  return months.reverse()
}

function getCount(att: MonthlyAttendance | undefined) {
  return {
    days: att?.basicWageDays ?? 0,
    hours: att?.basicWageHours ?? 0,
  }
}

function judgeRow(days: number, hours: number): 'pass' | 'border' | 'fail' {
  if (days >= 11) return 'pass'
  if (hours >= 80) return 'pass'
  if (days >= 8 || hours >= 60) return 'border'
  return 'fail'
}

export function Step4Attendance() {
  const { state, dispatch } = useAppState()
  const months = useMemo(() => buildMonths(state.input), [state.input])
  const attMap = useMemo(() => {
    const m = new Map<string, MonthlyAttendance>()
    for (const a of state.input.attendances) m.set(a.monthKey, a)
    return m
  }, [state.input.attendances])

  if (months.length === 0) {
    return (
      <div className="st-empty">
        <span className="st-empty__emoji" aria-hidden>
          📅
        </span>
        Step 1 で出産予定日を入力すると、判定対象期間が決まります。
      </div>
    )
  }

  const upsert = (key: string, patch: Partial<MonthlyAttendance>) => {
    const next = [...state.input.attendances]
    const idx = next.findIndex((a) => a.monthKey === key)
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...patch }
    } else {
      next.push({
        monthKey: key,
        basicWageDays: 0,
        basicWageHours: 0,
        ...patch,
      })
    }
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  const setAll = (days: number, hours: number) => {
    const next: MonthlyAttendance[] = months.map((m) => {
      const cur = attMap.get(m.key)
      return {
        monthKey: m.key,
        basicWageDays: days,
        basicWageHours: hours,
        ...(cur ? {} : {}),
      }
    })
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  const passCount = months.filter((m) => {
    const { days, hours } = getCount(attMap.get(m.key))
    return days >= 11 || hours >= 80
  }).length

  return (
    <div className="st-section">
      <IssueBanner />
      <div className="at-info">
        <div>
          <span className="at-info__label">判定対象期間</span>
          <strong>
            {months[months.length - 1]?.label} 〜 {months[0]?.label}
          </strong>
          <span className="at-info__sub">{months.length} か月分</span>
        </div>
        <div className="at-info__counter">
          <span className="at-info__big">{passCount}</span>
          <span className="at-info__cap">
            ／ {months.length} 月が
            <br />
            条件を満たす
          </span>
        </div>
      </div>

      <div className="at-quick">
        <span className="at-quick__label">クイック入力：</span>
        <button
          className="at-quick__btn"
          onClick={() => setAll(FULLTIME_DAYS, FULLTIME_HOURS)}
        >
          🍀 すべての月を「フルタイム勤務」（22 日 / 168 時間）
        </button>
        <button className="at-quick__btn at-quick__btn--ghost" onClick={() => setAll(0, 0)}>
          すべてクリア
        </button>
      </div>

      <p className="st-field__hint">
        各月の<strong>賃金支払基礎日数</strong>（有給休暇含む）と
        <strong>時間数</strong>を入力します。日数 11 以上、または時間数 80 以上で「条件達成」となります。
        休業期間と重なる月は <span className="at-warn-mark">⚠</span> マーク付き。
      </p>

      <ul className="at-list">
        {months.map((m) => {
          const { days, hours } = getCount(attMap.get(m.key))
          const status = judgeRow(days, hours)
          const overlapsLeave = state.input.leavePeriods.some((lp) => {
            if (!lp.start || !lp.end) return false
            const monthStart = `${m.key}-01`
            const monthEnd = format(
              addDays(addMonths(parseISO(monthStart), 1), -1),
              'yyyy-MM-dd',
            )
            return !(lp.end < monthStart || lp.start > monthEnd)
          })
          return (
            <li key={m.key} className={`at-row at-row--${status}`}>
              <div className="at-row__head">
                <span className="at-row__year">{m.key.slice(0, 4)}</span>
                <span className="at-row__month">{m.key.slice(5)} 月</span>
                {overlapsLeave && (
                  <span className="at-row__warn" title="休業期間と重なる月">
                    ⚠ 休業中
                  </span>
                )}
              </div>
              <label className="at-row__field">
                <span>日数</span>
                <input
                  type="number"
                  min={0}
                  max={31}
                  className="st-input at-row__input"
                  value={days || ''}
                  placeholder="0"
                  onChange={(e) =>
                    upsert(m.key, {
                      basicWageDays: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className="at-row__field">
                <span>時間</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="st-input at-row__input"
                  value={hours || ''}
                  placeholder="0"
                  onChange={(e) =>
                    upsert(m.key, {
                      basicWageHours: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <span className={`at-row__badge at-row__badge--${status}`}>
                {status === 'pass'
                  ? '✓ 達成'
                  : status === 'border'
                    ? '△ もう一歩'
                    : '✕ 未達'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
