import { useMemo, useRef, useState } from 'react'
import {
  addDays,
  format,
  getDay,
  parseISO,
} from 'date-fns'
import { useAppState } from '../../state/AppState'
import { judgeEligibility } from '../../domain/eligibility'
import type {
  AttendanceStatus,
  DailyAttendance,
  EligibilityResult,
  UserInput,
} from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import './steps.css'
import './Step4Attendance.css'

/* -------------------------------------------------------------------- */
/* 1 日のセル状態                                                       */
/* -------------------------------------------------------------------- */

type DayState =
  | { kind: 'out' } // 加入前 / 退職後 / 未加入期間
  | { kind: 'leave' } // 休業期間中
  | { kind: 'public_holiday' } // 公休（土日）
  | { kind: 'unset' } // 平日・未入力
  | { kind: 'work'; hours?: number }
  | { kind: 'paid_leave'; hours?: number }
  | { kind: 'paid_special'; hours?: number }
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

/* -------------------------------------------------------------------- */
/* 期間判定ユーティリティ                                               */
/* -------------------------------------------------------------------- */

function expectedFromScan(scan: UserInput['scanRange']): string | null {
  if (!scan.start || !scan.end) return null
  const s = parseISO(scan.start).getTime()
  const e = parseISO(scan.end).getTime()
  if (Number.isNaN(s) || Number.isNaN(e)) return null
  return format(new Date((s + e) / 2), 'yyyy-MM-dd')
}

function inSegment(date: string, segments: UserInput['insuredSegments']): boolean {
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
    const isBasic =
      override.status === 'work' ||
      override.status === 'paid_leave' ||
      override.status === 'paid_special'
    return {
      date,
      state:
        override.status === 'absent'
          ? { kind: 'absent' }
          : { kind: override.status, hours: override.hours },
      isBasic,
      overridden: true,
    }
  }
  const insured = inSegment(date, input.insuredSegments)
  if (!insured) {
    return { date, state: { kind: 'out' }, isBasic: false, overridden: false }
  }
  if (inGap(date, input.nonInsuredGaps)) {
    return { date, state: { kind: 'out' }, isBasic: false, overridden: false }
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
  if (current === null) return STATUS_CYCLE[0]
  const idx = STATUS_CYCLE.indexOf(current)
  if (idx < 0 || idx === STATUS_CYCLE.length - 1) return null
  return STATUS_CYCLE[idx + 1]
}

/* -------------------------------------------------------------------- */
/* メイン                                                                */
/* -------------------------------------------------------------------- */

const SPREAD_DAYS_FOR_VOLATILITY = 14 // 注釈に出す scanRange ±N 日（実際の値は scanRange から）

export function Step4Attendance() {
  const { state, dispatch } = useAppState()
  const [selectedIdx, setSelectedIdx] = useState(0) // 直近月を 0 として選択
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showSkipped, setShowSkipped] = useState(false)
  const detailRef = useRef<HTMLElement>(null)

  const selectMonth = (idx: number) => {
    setSelectedIdx(idx)
    setSelectedDate(null)
    // 次フレームでスクロール（state 反映後）
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const expected = expectedFromScan(state.input.scanRange)

  const result: EligibilityResult | null = useMemo(() => {
    if (!expected) return null
    return judgeEligibility(state.input, expected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.input, expected])

  if (!expected || !result) {
    return (
      <div className="st-empty">
        <span className="st-empty__emoji" aria-hidden>
          📅
        </span>
        Step 1 で出産予定日を入力すると、判定対象期間が決まります。
      </div>
    )
  }

  const overrideMap = new Map<string, DailyAttendance>()
  for (const a of state.input.attendances) overrideMap.set(a.date, a)

  /* 達成ラインの計算（直近順に累積し 12 を超えたインデックス） */
  let cumulative = 0
  let achievedAt = -1 // 0-indexed
  for (let i = 0; i < result.monthBreakdown.length; i++) {
    cumulative += result.monthBreakdown[i].counted
    if (cumulative >= 12 && achievedAt === -1) {
      achievedAt = i
    }
  }
  const achieved = achievedAt >= 0
  const remainingNeeded = Math.max(0, 12 - result.countedMonths)

  /* 走査範囲（ぶれの大きさ） */
  const scanSpreadDays = (() => {
    if (!state.input.scanRange.start || !state.input.scanRange.end) {
      return SPREAD_DAYS_FOR_VOLATILITY
    }
    const s = parseISO(state.input.scanRange.start).getTime()
    const e = parseISO(state.input.scanRange.end).getTime()
    return Math.max(0, Math.round((e - s) / 2 / 86400000))
  })()

  /* 緩和加算の表記 */
  const relaxLabel =
    result.relaxationDays > 0
      ? `（うち緩和加算 +${result.relaxationDays} 日）`
      : ''

  /* 詳細パネル: 選択された対象月 */
  const selectedMonth = result.monthBreakdown[selectedIdx] ?? result.monthBreakdown[0]
  const days: DayInfo[] = []
  if (selectedMonth) {
    let d = parseISO(selectedMonth.range.start)
    const end = parseISO(selectedMonth.range.end)
    while (d.getTime() <= end.getTime()) {
      const date = format(d, 'yyyy-MM-dd')
      days.push(deriveDay(date, overrideMap.get(date), state.input))
      d = addDays(d, 1)
    }
  }

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
    const next = state.input.attendances.map((a) => {
      if (a.date !== date) return a
      if (hours === null || Number.isNaN(hours)) {
        const { hours: _omit, ...rest } = a
        return rest
      }
      return { ...a, hours }
    })
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  const cycleDay = (info: DayInfo) => {
    if (info.state.kind === 'out') return // 加入前/未加入は変更不可
    const cur =
      info.state.kind === 'work' ||
      info.state.kind === 'paid_leave' ||
      info.state.kind === 'paid_special' ||
      info.state.kind === 'absent'
        ? info.state.kind
        : null
    setStatus(info.date, nextStatus(cur))
  }

  const fillSelectedMonthWeekdaysWithWork = () => {
    const next = state.input.attendances.filter((a) => {
      // この対象月範囲外は維持
      return (
        a.date < selectedMonth.range.start || a.date > selectedMonth.range.end
      )
    })
    for (const d of days) {
      if (d.overridden) {
        const o = overrideMap.get(d.date)
        if (o) next.push(o)
        continue
      }
      if (d.state.kind === 'unset') {
        next.push({ date: d.date, status: 'work' })
      }
    }
    next.sort((a, b) => a.date.localeCompare(b.date))
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  const clearSelectedMonth = () => {
    const next = state.input.attendances.filter(
      (a) => a.date < selectedMonth.range.start || a.date > selectedMonth.range.end,
    )
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  const selectedDay = selectedDate
    ? days.find((d) => d.date === selectedDate) ?? null
    : null

  /* 表示する対象月（達成済みで折りたたんでいる場合は必須分のみ） */
  const visibleMonths = result.monthBreakdown.map((m, idx) => ({
    month: m,
    idx,
    isOptional: achieved && idx > achievedAt,
  }))

  return (
    <div className="st-section">
      <IssueBanner />

      {/* 進捗カウンタ */}
      <div
        className={`ac-progress ac-progress--${achieved ? 'pass' : 'work'}`}
      >
        <div className="ac-progress__head">
          <div>
            <span className="ac-progress__small">対象期間の達成状況</span>
            <strong className="ac-progress__title">
              {achieved
                ? '✓ 12 か月の要件 達成'
                : `達成 ${result.countedMonths.toFixed(1)} / 12 か月`}
            </strong>
            {!achieved && (
              <span className="ac-progress__sub">
                あと {remainingNeeded.toFixed(1)} か月の達成で要件を満たします。
                直近の月から入力すると効率的です。
              </span>
            )}
            {achieved && (
              <span className="ac-progress__sub">
                直近 {achievedAt + 1} か月分で要件を満たしています。
                これより前の月の入力は不要です。
              </span>
            )}
          </div>
        </div>
        <div className="ac-progress__bar">
          <div
            className="ac-progress__fill"
            style={{ width: `${Math.min(100, (result.countedMonths / 12) * 100)}%` }}
          />
        </div>
      </div>

      {/* 概念ガイダンス */}
      <details className="ac-guide">
        <summary>「対象月」とは？／用語と曖昧さについて</summary>
        <div className="ac-guide__body">
          <p>
            判定は<strong>育休開始日（出産予定日 + 産後 56 日 + 1 日）</strong>から
            <strong>1 か月単位</strong>でさかのぼった区間ごとに集計します。
            たとえば育休開始 2026-04-15 なら、直近の対象月は <code>2026-03-15 〜 2026-04-14</code>。
          </p>
          <p>
            このように<strong>月の中旬で区切られる</strong>ため、暦月（4 月、5 月…）とは一致しません。
            正確な日付の境界は各セルに表示されます。
          </p>
          <p className="ac-guide__caveat">
            <strong>※ 曖昧さの注意：</strong>
            実際の出産日が予定日 ± {scanSpreadDays} 日ぶれると、
            対象月の区切りも同じだけ前後します。
            このページは<strong>予定日（{expected}）を中央</strong>として代表計算した結果です。
            判定結果がぎりぎりの月（例: 10〜12 日付近、70〜90 時間付近）は、
            実際の出産日次第で結果が変わる可能性があります。
          </p>
        </div>
      </details>

      {/* 対象月の年ビュー */}
      <section className="ac-year">
        <header className="ac-year__head">
          <div>
            <h3>対象月（直近順）</h3>
            <p className="ac-year__hint">
              タップで詳細を表示。直近 M01 から順に達成数を稼ぐと効率的です。
            </p>
          </div>
          <div className="ac-year__legend">
            <span className="ac-pill ac-pill--pass">達成</span>
            <span className="ac-pill ac-pill--fail">未達</span>
            <span className="ac-pill ac-pill--out">対象外</span>
            <span
              className="ac-pill ac-pill--volatile"
              title="出産日次第で結果が変わる可能性"
            >
              ⚠
            </span>
          </div>
        </header>

        <ol className="ac-year__grid">
          {visibleMonths.map(({ month, idx, isOptional }) => {
            if (isOptional && !showSkipped) return null
            const status =
              month.reason === '雇用保険未加入'
                ? 'out'
                : month.counted === 1
                  ? 'pass'
                  : 'fail'
            const days = month.attendance?.basicWageDays ?? 0
            const hours = month.attendance?.basicWageHours ?? 0
            const volatile =
              status !== 'out' &&
              ((days >= 8 && days <= 12) || (hours >= 70 && hours <= 90))
            const monthIndexDisplay = `M${String(idx + 1).padStart(2, '0')}`
            const isSelected = idx === selectedIdx
            return (
              <li
                key={month.range.index}
                className={`ac-month ac-month--${status} ${
                  isSelected ? 'is-selected' : ''
                } ${isOptional ? 'is-optional' : ''}`}
              >
                <button onClick={() => selectMonth(idx)}>
                  <span className="ac-month__no">{monthIndexDisplay}</span>
                  <span className="ac-month__range">
                    {month.range.start.slice(5).replace('-', '/')}
                    <span className="ac-month__sep">–</span>
                    {month.range.end.slice(5).replace('-', '/')}
                  </span>
                  <span className="ac-month__counter">
                    {month.attendance ? (
                      <>
                        <span className="ac-month__num">{days.toFixed(0)}</span>
                        <span className="ac-month__unit">日</span>
                      </>
                    ) : (
                      <span className="ac-month__missing">未入力</span>
                    )}
                  </span>
                  <span className="ac-month__statusrow">
                    {status === 'pass' && <span className="ac-month__check">✓</span>}
                    {status === 'fail' && <span className="ac-month__x">○</span>}
                    {status === 'out' && (
                      <span className="ac-month__out-mark">—</span>
                    )}
                    {volatile && (
                      <span
                        className="ac-month__warn"
                        title="出産日次第で結果が変わる可能性"
                      >
                        ⚠
                      </span>
                    )}
                    {isOptional && (
                      <span className="ac-month__skip">不要</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {/* 達成ライン or 入力下限ライン */}
        {achieved && (
          <div className="ac-line ac-line--achieved">
            <span>━━━ ここで 12 か月達成 ━━━</span>
            <button
              className="ac-skip-toggle"
              onClick={() => setShowSkipped((s) => !s)}
            >
              {showSkipped
                ? '入力不要の期間を隠す'
                : `入力不要の ${result.monthBreakdown.length - achievedAt - 1} か月を表示`}
            </button>
          </div>
        )}
        <div className="ac-line ac-line--limit">
          <span>
            ↓ ここまで判定対象（{result.scanWindow.start} まで）
            {relaxLabel && <em className="ac-line__relax">{relaxLabel}</em>}
          </span>
          <span className="ac-line__sub">
            これより前は判定対象外です（雇用保険・育児休業給付の規定により最長
            {result.relaxationDays > 0 ? ' 4 ' : ' 2 '}年）
          </span>
        </div>
      </section>

      {/* 詳細パネル：選択した対象月 */}
      {selectedMonth && (
        <section
          className="ac-detail"
          ref={detailRef}
          key={`detail-${selectedIdx}`}
          aria-live="polite"
        >
          <header className="ac-detail__head">
            <div>
              <span className="ac-detail__small">
                ↓ 選択中 ・ 対象月 M{String(selectedIdx + 1).padStart(2, '0')}
              </span>
              <h3>
                {selectedMonth.range.start} 〜 {selectedMonth.range.end}
              </h3>
              <span className="ac-detail__sub">
                {selectedMonth.attendance
                  ? `${selectedMonth.attendance.basicWageDays.toFixed(0)} 日入力 / ${selectedMonth.attendance.basicWageHours} 時間`
                  : '未入力'}{' '}
                ／{' '}
                {selectedMonth.reason === '雇用保険未加入'
                  ? '対象外'
                  : selectedMonth.counted === 1
                    ? `達成（${selectedMonth.reason}）`
                    : `未達（${selectedMonth.reason}）`}
              </span>
            </div>

            {selectedMonth.reason !== '雇用保険未加入' && (
              <div className="ac-detail__quick">
                <button
                  className="at-quick"
                  onClick={fillSelectedMonthWeekdaysWithWork}
                >
                  📌 平日を出勤に
                </button>
                <button
                  className="at-quick at-quick--ghost"
                  onClick={clearSelectedMonth}
                >
                  クリア
                </button>
              </div>
            )}
          </header>

          {selectedMonth.reason === '雇用保険未加入' ? (
            <p className="ac-detail__notice">
              この対象月は雇用保険被保険者期間に含まれていないため、出勤情報は使われません。
              Step 3 の加入期間／未加入期間の設定をご確認ください。
            </p>
          ) : (
            <div className="ac-detail__cal">
              <div className="ac-detail__cal-head">
                <span className="ac-dow ac-dow--sun">日</span>
                <span>月</span>
                <span>火</span>
                <span>水</span>
                <span>木</span>
                <span>金</span>
                <span className="ac-dow ac-dow--sat">土</span>
              </div>
              <div className="ac-detail__cal-grid">
                {Array.from({ length: getDay(parseISO(days[0]?.date ?? expected)) }).map(
                  (_, i) => (
                    <span key={`pad-${i}`} className="ac-cell ac-cell--pad" />
                  ),
                )}
                {days.map((d) => {
                  const dn = Number(d.date.slice(8, 10))
                  const klass = (() => {
                    switch (d.state.kind) {
                      case 'work':
                        return 'ac-cell ac-cell--work'
                      case 'paid_leave':
                        return 'ac-cell ac-cell--paid_leave'
                      case 'paid_special':
                        return 'ac-cell ac-cell--paid_special'
                      case 'absent':
                        return 'ac-cell ac-cell--absent'
                      case 'leave':
                        return 'ac-cell ac-cell--leave'
                      case 'out':
                        return 'ac-cell ac-cell--out'
                      case 'public_holiday':
                        return 'ac-cell ac-cell--holiday'
                      case 'unset':
                        return 'ac-cell ac-cell--unset'
                    }
                  })()
                  const label = (() => {
                    switch (d.state.kind) {
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
                      case 'out':
                        return '対象外'
                      case 'public_holiday':
                        return '公休'
                      case 'unset':
                        return ''
                    }
                  })()
                  const isSelectedDay = d.date === selectedDate
                  return (
                    <button
                      key={d.date}
                      className={`${klass} ${isSelectedDay ? 'is-selected' : ''}`}
                      onClick={() => {
                        if (isSelectedDay) cycleDay(d)
                        else setSelectedDate(d.date)
                      }}
                    >
                      <span className="ac-cell__day">{dn}</span>
                      {label && <span className="ac-cell__label">{label}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 選択日の詳細編集パネル */}
      {selectedDay && selectedMonth.reason !== '雇用保険未加入' && (
        <DayDetailPanel
          day={selectedDay}
          onSetStatus={(s) => setStatus(selectedDay.date, s)}
          onClear={() => {
            setStatus(selectedDay.date, null)
          }}
          onHoursChange={(h) => setHours(selectedDay.date, h)}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- */
/* 選択日の詳細編集（時間入力をここに分離）                              */
/* -------------------------------------------------------------------- */

interface DayDetailPanelProps {
  day: DayInfo
  onSetStatus: (status: AttendanceStatus) => void
  onClear: () => void
  onHoursChange: (hours: number | null) => void
}

function DayDetailPanel({
  day,
  onSetStatus,
  onClear,
  onHoursChange,
}: DayDetailPanelProps) {
  const currentStatus =
    day.state.kind === 'work' ||
    day.state.kind === 'paid_leave' ||
    day.state.kind === 'paid_special' ||
    day.state.kind === 'absent'
      ? day.state.kind
      : null

  const currentHours =
    day.state.kind === 'work' ||
    day.state.kind === 'paid_leave' ||
    day.state.kind === 'paid_special'
      ? day.state.hours
      : undefined

  const [, mm, dd] = day.date.split('-')

  return (
    <div className="ac-day-detail">
      <header className="ac-day-detail__head">
        <span className="ac-day-detail__small">選択した日</span>
        <strong>
          {Number(mm)} 月 {Number(dd)} 日
        </strong>
        <button
          className="ac-day-detail__clear"
          onClick={onClear}
          disabled={!day.overridden}
        >
          未入力に戻す
        </button>
      </header>

      <div className="ac-day-detail__choices">
        {STATUS_CYCLE.map((s) => (
          <button
            key={s}
            className={`ac-choice ac-choice--${s} ${currentStatus === s ? 'is-selected' : ''}`}
            onClick={() => onSetStatus(s)}
          >
            <span className="ac-choice__label">
              {s === 'work'
                ? '🟢 出勤'
                : s === 'paid_leave'
                  ? '🅿️ 有給'
                  : s === 'paid_special'
                    ? '✨ 特休'
                    : '✕ 欠勤'}
            </span>
          </button>
        ))}
      </div>

      {(currentStatus === 'work' ||
        currentStatus === 'paid_leave' ||
        currentStatus === 'paid_special') && (
        <div className="ac-day-detail__hours">
          <label htmlFor="day-hours">
            <span className="ac-day-detail__hours-label">この日の労働時間（任意）</span>
            <span className="ac-day-detail__hours-hint">
              80 時間ルール（11 日未満の月でも 80 時間以上で達成）に必要な人だけ入力。
              空欄でも 11 日以上を満たせば達成できます。
            </span>
          </label>
          <div className="ac-day-detail__hours-row">
            <input
              id="day-hours"
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={currentHours ?? ''}
              placeholder="—"
              onChange={(e) => {
                const v = e.target.value
                if (v === '') onHoursChange(null)
                else {
                  const n = Number(v)
                  if (Number.isFinite(n)) onHoursChange(n)
                }
              }}
            />
            <span>時間</span>
          </div>
        </div>
      )}
    </div>
  )
}
