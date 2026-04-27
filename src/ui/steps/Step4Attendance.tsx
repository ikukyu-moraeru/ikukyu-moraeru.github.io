import { useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDay,
  isAfter,
  parseISO,
  startOfMonth,
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
import { classifyDay } from '../shared/dayClassification'
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

/**
 * セルクリックでサイクルさせる主要 3 状態。
 * 有給 / 特別休暇は判定上「出勤と同じ扱い」（賃金支払基礎日数にカウント、
 * 時間は所定労働時間相当）なので、サイクルからは外し、必要な人だけ
 * 詳細パネルから明示的に選べるようにする。
 */
const STATUS_CYCLE: AttendanceStatus[] = ['work', 'absent']

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

/**
 * Step4 の表示用 DayInfo を、共通の classifyDay 結果から組み立てる。
 * Step5 の未入力検知も同じ classifyDay を使うので両者の判定が一致する。
 */
function deriveDay(
  date: string,
  override: DailyAttendance | undefined,
  input: UserInput,
  scanWindowEnd?: string,
): DayInfo {
  const c = classifyDay(date, override, input, scanWindowEnd)
  let state: DayState
  switch (c.kind) {
    case 'work':
    case 'paid_leave':
    case 'paid_special':
      state = { kind: c.kind, hours: c.hours }
      break
    case 'absent':
    case 'out':
    case 'leave':
    case 'public_holiday':
    case 'unset':
      state = { kind: c.kind }
      break
  }
  return {
    date,
    state,
    isBasic: c.isBasic,
    overridden: c.overridden,
  }
}

function nextStatus(current: AttendanceStatus | null): AttendanceStatus | null {
  // 未入力 → 出勤 → 有給 → 特休 → 欠勤 → 未入力 のサイクル
  if (current === null) return STATUS_CYCLE[0]
  const idx = STATUS_CYCLE.indexOf(current)
  if (idx < 0 || idx === STATUS_CYCLE.length - 1) return null
  return STATUS_CYCLE[idx + 1]
}

/* -------------------------------------------------------------------- */
/* メイン                                                                */
/* -------------------------------------------------------------------- */

const SPREAD_DAYS_FOR_VOLATILITY = 14 // 注釈に出す scanRange ±N 日（実際の値は scanRange から）

interface CalendarMonth {
  ym: string // "YYYY-MM"
  start: string
  end: string
  basicWageDays: number
  basicWageHours: number
  status: 'pass' | 'fail' | 'out' | 'leave'
  volatile: boolean
  hasInputs: boolean
}

export function Step4Attendance() {
  const { state, dispatch } = useAppState()
  const [selectedYm, setSelectedYm] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const detailRef = useRef<HTMLElement>(null)

  const selectMonth = (ym: string, scroll = true) => {
    setSelectedYm(ym)
    setSelectedDate(null)
    if (scroll) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    }
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

  /* 暦月リスト生成（最新月から逆順） */
  const calendarMonths: CalendarMonth[] = (() => {
    const list: CalendarMonth[] = []
    let cursor = startOfMonth(parseISO(result.scanWindow.start))
    const stop = startOfMonth(parseISO(result.scanWindow.end))
    while (!isAfter(cursor, stop)) {
      const ym = format(cursor, 'yyyy-MM')
      const monthStart = format(cursor, 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(cursor), 'yyyy-MM-dd')

      let days = 0
      let hours = 0
      let hasInputs = false
      for (const a of state.input.attendances) {
        if (a.date >= monthStart && a.date <= monthEnd) {
          hasInputs = true
          if (
            a.status === 'work' ||
            a.status === 'paid_leave' ||
            a.status === 'paid_special'
          ) {
            days += 1
            if (typeof a.hours === 'number' && Number.isFinite(a.hours)) {
              hours += a.hours
            }
          }
        }
      }

      // status: 月の 1 日 〜 末日 の自動推論を見て判定
      // 全日が「out」(加入前/退職後/未加入) → 'out'
      // 全日が「leave」 → 'leave'
      // それ以外 → days/hours で達成判定
      let outCount = 0
      let leaveCount = 0
      let totalCount = 0
      let cur = parseISO(monthStart)
      const last = parseISO(monthEnd)
      while (cur.getTime() <= last.getTime()) {
        const date = format(cur, 'yyyy-MM-dd')
        const info = deriveDay(
          date,
          overrideMap.get(date),
          state.input,
          result.scanWindow.end,
        )
        if (info.state.kind === 'out') outCount += 1
        else if (info.state.kind === 'leave') leaveCount += 1
        totalCount += 1
        cur = addDays(cur, 1)
      }
      let status: CalendarMonth['status']
      if (outCount === totalCount) status = 'out'
      else if (leaveCount + outCount === totalCount) status = 'leave'
      else if (days >= 11) status = 'pass'
      else if (hours >= 80) status = 'pass'
      else status = 'fail'

      const volatile =
        status !== 'out' && status !== 'leave' && days >= 8 && days <= 13

      list.push({
        ym,
        start: monthStart,
        end: monthEnd,
        basicWageDays: days,
        basicWageHours: hours,
        status,
        volatile,
        hasInputs,
      })
      cursor = addMonths(cursor, 1)
    }
    return list.reverse() // 直近順
  })()

  // 達成ラインを暦月ベースで計算（直近順に pass を数えて 12 に達した暦月）
  let calAchievedAt = -1
  let calCumulative = 0
  for (let i = 0; i < calendarMonths.length; i++) {
    if (calendarMonths[i].status === 'pass') calCumulative += 1
    if (calCumulative >= 12 && calAchievedAt === -1) {
      calAchievedAt = i
      break
    }
  }

  const currentSelectedYm =
    selectedYm && calendarMonths.some((m) => m.ym === selectedYm)
      ? selectedYm
      : calendarMonths[0]?.ym ?? null
  const selectedCalMonth = calendarMonths.find(
    (m) => m.ym === currentSelectedYm,
  )

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

  /* 緩和加算の根拠（賃金未払いの休業期間 × baseWindow との重複） */
  interface RelaxBreakdown {
    id: string
    type: string
    start: string
    end: string
    overlapStart: string
    overlapEnd: string
    days: number
    eligible: boolean // 連続 30 日以上ある「重なり」かどうか
  }
  const relaxBreakdown: RelaxBreakdown[] = state.input.leavePeriods
    .filter(
      (lp) => lp.start && lp.end && lp.start <= lp.end,
    )
    .map((lp) => {
      const overlapStart =
        lp.start > result.baseWindowStart ? lp.start : result.baseWindowStart
      const overlapEnd =
        lp.end < result.scanWindow.end ? lp.end : result.scanWindow.end
      let days = 0
      if (overlapStart <= overlapEnd) {
        days =
          differenceInCalendarDays(
            parseISO(overlapEnd),
            parseISO(overlapStart),
          ) + 1
      }
      return {
        id: lp.id,
        type: lp.type,
        start: lp.start,
        end: lp.end,
        overlapStart,
        overlapEnd,
        days: Math.max(0, days),
        eligible: !lp.hasWageDuringLeave && days >= 30,
      }
    })
    .filter((b) => b.days > 0)

  /* 詳細パネル: 選択された暦月の日リスト */
  const days: DayInfo[] = []
  if (selectedCalMonth) {
    let d = parseISO(selectedCalMonth.start)
    const end = parseISO(selectedCalMonth.end)
    while (d.getTime() <= end.getTime()) {
      const date = format(d, 'yyyy-MM-dd')
      days.push(
        deriveDay(date, overrideMap.get(date), state.input, result.scanWindow.end),
      )
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
    if (!selectedCalMonth) return
    const next = state.input.attendances.filter(
      (a) =>
        a.date < selectedCalMonth.start || a.date > selectedCalMonth.end,
    )
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
    if (!selectedCalMonth) return
    const next = state.input.attendances.filter(
      (a) =>
        a.date < selectedCalMonth.start || a.date > selectedCalMonth.end,
    )
    dispatch({ type: 'PATCH_INPUT', patch: { attendances: next } })
  }

  const selectedDay = selectedDate
    ? days.find((d) => d.date === selectedDate) ?? null
    : null

  const monthLabel = (ym: string) =>
    `${ym.slice(0, 4)} 年 ${Number(ym.slice(5))} 月`

  return (
    <div className="st-section">
      <IssueBanner />

      {/* 進捗カウンタ（予測値） */}
      <div
        className={`ac-progress ac-progress--${achieved ? 'pass' : 'work'}`}
      >
        <div className="ac-progress__head">
          <div>
            <span className="ac-progress__small">
              <span className="ac-progress__chip">予測</span>
              入力からの達成見込み
            </span>
            <strong className="ac-progress__title">
              <span className="ac-progress__approx">およそ</span>
              <span className="ac-progress__num">
                {result.countedMonths.toFixed(1)}
              </span>
              <span className="ac-progress__den"> / 12 か月</span>
            </strong>
            <span className="ac-progress__sub">
              {achieved ? (
                <>
                  入力からは <strong>12 か月達成の見込み</strong>。
                  ただし実際の出産日が予定日（{expected}）から ± {scanSpreadDays} 日ずれると数値が変動するため、
                  最終判定は <strong>Step 5（結果ヒートマップ）</strong> で全候補日を確認してください。
                </>
              ) : (
                <>
                  あと <strong>およそ {remainingNeeded.toFixed(1)} か月分</strong> の入力で要件に届きそうです。
                  この値は予定日（{expected}）を中央にした代表値で、出産日が ± {scanSpreadDays} 日ずれると前後します。
                </>
              )}
            </span>
          </div>
        </div>
        <div
          className="ac-progress__bar"
          aria-label={`達成見込み ${result.countedMonths.toFixed(1)} / 12 か月`}
        >
          <div
            className="ac-progress__fill"
            style={{ width: `${Math.min(100, (result.countedMonths / 12) * 100)}%` }}
          />
          <span className="ac-progress__bar-marker">12</span>
        </div>
      </div>

      {/* 概念ガイダンス */}
      <details className="ac-guide">
        <summary>判定の仕組みと曖昧さについて</summary>
        <div className="ac-guide__body">
          <p>
            この画面は <strong>暦月（4 月、5 月…）</strong> ごとに入力できますが、
            実際の判定は <strong>育休開始日（出産予定日 + 産後 56 日 + 1 日）からひと月ずつ遡った区間</strong>
            （例: <code>2026-03-15 〜 2026-04-14</code>）で行われます。
            暦月の境界とずれるため、暦月で「11 日達成」していても判定上の月で未達になることがあります。
          </p>
          <p className="ac-guide__caveat">
            <strong>※ 曖昧さの注意：</strong>
            実際の出産日が予定日 ± {scanSpreadDays} 日ずれると、判定上の月の区切りも前後します。
            このページの<strong>「達成見込み」</strong>は予定日（{expected}）を中央とした代表値で、
            ぎりぎりの月（出勤 8〜13 日付近）は実際の出産日次第で結果が変わる可能性があるため
            <span className="ac-volatile-mark">⚠</span> マークを付けています。
            最終判定は Step 5（結果ヒートマップ）で全候補日について計算します。
          </p>
        </div>
      </details>

      {/* 暦月の年ビュー */}
      <section className="ac-year">
        <header className="ac-year__head">
          <div>
            <h3>暦月ごとの入力（直近順）</h3>
            <p className="ac-year__hint">
              暦月をタップしてその月の出勤情報を入力。日数は「達成見込み」を表します。
            </p>
          </div>
          <div className="ac-year__legend">
            <span className="ac-pill ac-pill--pass">達成見込み</span>
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
          {calendarMonths.map((m, i) => {
            const isSelected = m.ym === currentSelectedYm
            const isOptional =
              calAchievedAt >= 0 && i > calAchievedAt
            return (
              <li
                key={m.ym}
                className={`ac-month ac-month--${m.status} ${
                  isSelected ? 'is-selected' : ''
                } ${isOptional ? 'is-optional' : ''}`}
              >
                <button onClick={() => selectMonth(m.ym)}>
                  <span className="ac-month__no">
                    {m.ym.slice(0, 4)}
                  </span>
                  <span className="ac-month__range">
                    {Number(m.ym.slice(5))} 月
                  </span>
                  <span className="ac-month__counter">
                    {m.status === 'leave' ? (
                      <span className="ac-month__missing">休業中</span>
                    ) : m.status === 'out' ? (
                      <span className="ac-month__missing">対象外</span>
                    ) : m.hasInputs ? (
                      <>
                        <span className="ac-month__num">{m.basicWageDays}</span>
                        <span className="ac-month__unit">日</span>
                      </>
                    ) : (
                      <span className="ac-month__missing">未入力</span>
                    )}
                  </span>
                  <span className="ac-month__statusrow">
                    {m.status === 'pass' && (
                      <span className="ac-month__check">✓ 達成見込</span>
                    )}
                    {m.status === 'fail' && (
                      <span className="ac-month__x">未達</span>
                    )}
                    {m.status === 'out' && (
                      <span className="ac-month__out-mark">対象外</span>
                    )}
                    {m.status === 'leave' && (
                      <span className="ac-month__out-mark">休業中</span>
                    )}
                    {m.volatile && (
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

        <div className="ac-line ac-line--limit">
          <span>
            ↓ ここまで判定対象（{result.scanWindow.start} まで）
            {relaxLabel && <em className="ac-line__relax">{relaxLabel}</em>}
          </span>
          <span className="ac-line__sub">
            これより前は判定対象外です（雇用保険・育児休業給付の規定により最長
            {result.relaxationDays > 0 ? ' 4 ' : ' 2 '}年）
          </span>

          {result.relaxationDays > 0 && (
            <details className="ac-relax-detail">
              <summary>
                緩和加算 +{result.relaxationDays} 日の根拠を見る
              </summary>
              <div className="ac-relax-detail__body">
                <p>
                  Step 2 で登録した
                  <strong>賃金支払のない休業（連続 30 日以上）</strong>が判定対象期間
                  ({result.baseWindowStart} 〜 {result.scanWindow.end})
                  と重なる日数を、最長 +730 日（2 年）まで加算しています。
                </p>
                {relaxBreakdown.length === 0 ? (
                  <p className="ac-relax-detail__empty">
                    対象期間と重なる休業期間が見つかりません。
                  </p>
                ) : (
                  <ul className="ac-relax-detail__list">
                    {relaxBreakdown.map((b) => {
                      const lp = state.input.leavePeriods.find(
                        (x) => x.id === b.id,
                      )
                      const hasWage = lp?.hasWageDuringLeave ?? false
                      return (
                        <li
                          key={b.id}
                          className={`ac-relax-item ac-relax-item--${b.eligible ? 'eligible' : 'excluded'}`}
                        >
                          <span className="ac-relax-item__type">{b.type}</span>
                          <span className="ac-relax-item__range">
                            {b.start} 〜 {b.end}
                          </span>
                          <span className="ac-relax-item__overlap">
                            判定期間と重なる: {b.days} 日
                          </span>
                          <span className="ac-relax-item__verdict">
                            {hasWage
                              ? '✕ 賃金支払あり → 加算対象外'
                              : b.days >= 30
                                ? `✓ +${b.days} 日 加算`
                                : '✕ 連続 30 日未満 → 加算対象外'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className="ac-relax-detail__caveat">
                  ※ 加算合計は 730 日（2 年）を上限としてクランプされます。
                  実際の判定（Step 5）では出産日候補ごとに対象期間の境界が動くため、
                  加算日数も若干変動することがあります。
                </p>
              </div>
            </details>
          )}
        </div>
      </section>

      {/* 詳細パネル：選択した暦月 */}
      {selectedCalMonth && (
        <section
          className="ac-detail"
          ref={detailRef}
          key={`detail-${currentSelectedYm}`}
          aria-live="polite"
        >
          <header className="ac-detail__head">
            <div>
              <span className="ac-detail__small">
                ↓ 選択中 ・ {monthLabel(selectedCalMonth.ym)}
              </span>
              <h3>
                {selectedCalMonth.start.slice(5)} 〜 {selectedCalMonth.end.slice(5)}
              </h3>
              <span className="ac-detail__sub">
                {selectedCalMonth.hasInputs
                  ? `${selectedCalMonth.basicWageDays} 日入力 / ${selectedCalMonth.basicWageHours} 時間`
                  : '未入力'}{' '}
                ／{' '}
                {selectedCalMonth.status === 'out'
                  ? '対象外'
                  : selectedCalMonth.status === 'leave'
                    ? '休業中'
                    : selectedCalMonth.status === 'pass'
                      ? '達成見込み'
                      : '未達'}
              </span>
            </div>

            {selectedCalMonth.status !== 'out' && (
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

          {(() => {
            const curIdx = calendarMonths.findIndex(
              (m) => m.ym === currentSelectedYm,
            )
            // calendarMonths は直近順（idx 0 が最新）。
            // 「前の月」は古い方 = idx +1、「次の月」は新しい方 = idx -1。
            const prevYm =
              curIdx >= 0 && curIdx + 1 < calendarMonths.length
                ? calendarMonths[curIdx + 1].ym
                : null
            const nextYm =
              curIdx > 0 ? calendarMonths[curIdx - 1].ym : null
            return (
              <nav className="ac-detail__cal-nav" aria-label="月の切替">
                <button
                  className="ac-cal-nav__btn"
                  onClick={() => prevYm && selectMonth(prevYm, false)}
                  disabled={!prevYm}
                  aria-label="前の月へ"
                >
                  ← 前の月
                </button>
                <span className="ac-cal-nav__label">
                  {monthLabel(selectedCalMonth.ym)}
                </span>
                <button
                  className="ac-cal-nav__btn"
                  onClick={() => nextYm && selectMonth(nextYm, false)}
                  disabled={!nextYm}
                  aria-label="次の月へ"
                >
                  次の月 →
                </button>
              </nav>
            )
          })()}

          {selectedCalMonth.status === 'out' ? (
            <p className="ac-detail__notice">
              この月は雇用保険被保険者期間に含まれていないため、出勤情報は使われません。
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
                  const hasHours =
                    (d.state.kind === 'work' ||
                      d.state.kind === 'paid_leave' ||
                      d.state.kind === 'paid_special') &&
                    typeof d.state.hours === 'number'
                  return (
                    <button
                      key={d.date}
                      className={`${klass} ${isSelectedDay ? 'is-selected' : ''}`}
                      title="クリック: 状態を切替 / Shift+クリック・右クリック: 未入力に戻す"
                      onClick={(e) => {
                        if (e.shiftKey) {
                          setStatus(d.date, null)
                          setSelectedDate(d.date)
                          return
                        }
                        cycleDay(d)
                        setSelectedDate(d.date)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setStatus(d.date, null)
                        setSelectedDate(d.date)
                      }}
                    >
                      <span className="ac-cell__day">{dn}</span>
                      {label && <span className="ac-cell__label">{label}</span>}
                      {hasHours && (
                        <span className="ac-cell__hours-mark" aria-hidden>
                          ⏱
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 選択日の詳細編集パネル */}
      {selectedDay && selectedCalMonth && selectedCalMonth.status !== 'out' && (
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

  const statusLabel = (() => {
    switch (currentStatus) {
      case 'work':
        return '🟢 出勤'
      case 'paid_leave':
        return '🅿️ 有給'
      case 'paid_special':
        return '✨ 特別休暇'
      case 'absent':
        return '✕ 欠勤'
      default:
        return '— 未入力'
    }
  })()

  const allowsHours =
    currentStatus === 'work' ||
    currentStatus === 'paid_leave' ||
    currentStatus === 'paid_special'

  return (
    <div className="ac-day-detail">
      <header className="ac-day-detail__head">
        <div>
          <span className="ac-day-detail__small">選択した日</span>
          <strong>
            {Number(mm)} 月 {Number(dd)} 日
          </strong>
          <span className="ac-day-detail__status">{statusLabel}</span>
        </div>
        <button
          className="ac-day-detail__clear"
          onClick={onClear}
          disabled={!day.overridden}
        >
          未入力に戻す
        </button>
      </header>

      <p className="ac-day-detail__hint">
        セルをタップで <strong>出勤 → 欠勤 → 未入力</strong> の順に切替。Shift+クリック / 右クリックで未入力に戻せます。
      </p>

      <details className="ac-day-detail__sub">
        <summary>
          有給休暇 / 賃金が出る特別休暇として記録する
        </summary>
        <div className="ac-day-detail__sub-body">
          <p>
            判定上は<strong>出勤と同じ扱い</strong>です（賃金支払基礎日数にカウント、時間は所定労働時間相当）。
            記録としてだけ区別したい場合に選択してください。
          </p>
          <div className="ac-day-detail__sub-row">
            <button
              className={`ac-sub-btn ${currentStatus === 'paid_leave' ? 'is-selected' : ''}`}
              onClick={() => onSetStatus('paid_leave')}
              disabled={currentStatus === null || currentStatus === 'absent'}
            >
              🅿️ 有給
            </button>
            <button
              className={`ac-sub-btn ${currentStatus === 'paid_special' ? 'is-selected' : ''}`}
              onClick={() => onSetStatus('paid_special')}
              disabled={currentStatus === null || currentStatus === 'absent'}
            >
              ✨ 特別休暇
            </button>
            <button
              className={`ac-sub-btn ${currentStatus === 'work' ? 'is-selected' : ''}`}
              onClick={() => onSetStatus('work')}
              disabled={currentStatus === null || currentStatus === 'absent'}
            >
              🟢 出勤に戻す
            </button>
          </div>
        </div>
      </details>

      <div className="ac-day-detail__hours">
        <label htmlFor="day-hours">
          <span className="ac-day-detail__hours-label">この日の労働時間（任意）</span>
          <span className="ac-day-detail__hours-hint">
            80 時間ルール（11 日未満の月でも 80 時間以上で達成）を狙う方だけ入力すれば OK。
            <br />
            シフト制の方は <strong>その日のシフト時間</strong>、有給・特休の方は <strong>所定労働時間</strong> を入れてください。
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
            placeholder={allowsHours ? 'その日の所定時間（任意）' : '出勤系の状態のみ'}
            disabled={!allowsHours}
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
    </div>
  )
}
