import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  parseISO,
  startOfMonth,
} from 'date-fns'
import { useAppState } from '../../state/AppState'
import { scanBirthDates } from '../../domain/birthDateScan'
import { summarizeScan } from '../../domain/summary'
import type {
  EligibilityResult,
  InsuredEmploymentSegment,
  LeavePeriod,
  UserInput,
} from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import './steps.css'
import './Step5Result.css'

const POSTNATAL_DAYS = 56
const PRENATAL_DAYS_SINGLE = 42
const PRENATAL_DAYS_MULTIPLE = 98

/**
 * 不足ケースの「強さ」。`shortage <= 1.0` のときだけ「あと少し」と表現してよい。
 * それより不足が大きい場合は中立的な「受け取れません」系に統一する。
 */
const NEAR_THRESHOLD_MONTHS = 1.0

type Status = 'pass' | 'fail'

function classify(r: EligibilityResult): Status {
  return r.isEligible ? 'pass' : 'fail'
}

function isNearMiss(r: EligibilityResult): boolean {
  return !r.isEligible && r.shortage <= NEAR_THRESHOLD_MONTHS
}

function failVerdictLabel(r: EligibilityResult): string {
  return isNearMiss(r) ? 'あと少し届きません' : '受け取れません'
}

function jpDate(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`
}

export function Step5Result() {
  const { state } = useAppState()
  const results = useMemo(() => scanBirthDates(state.input), [state.input])
  const summary = useMemo(() => summarizeScan(results), [results])
  const [selected, setSelected] = useState<string | null>(null)

  if (!state.input.scanRange.start || !state.input.scanRange.end) {
    return (
      <div className="st-empty">
        <span className="st-empty__emoji" aria-hidden>
          📅
        </span>
        Step 1 で出産予定日と走査範囲を入力してください。
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="st-empty">
        <span className="st-empty__emoji" aria-hidden>
          🤔
        </span>
        判定できる出産日候補がありません。Step 1 をご確認ください。
      </div>
    )
  }

  const selectedResult = selected
    ? results.find((r) => r.birthDate === selected)
    : null

  const verdict =
    summary.passDays === summary.totalDays
      ? 'pass-all'
      : summary.failDays === summary.totalDays
        ? 'fail-all'
        : 'mixed'

  // fail-all のとき：全候補の中で最も惜しい (shortage 最小) ケースを基準に文言を決める。
  // 1.0 か月以内なら「あと少し」、それ超なら中立な「受け取れません」。
  const failAllNear = summary.shortfallMin <= NEAR_THRESHOLD_MONTHS
  const verdictTitle =
    verdict === 'pass-all'
      ? 'いつ生まれても、育休給付金を受け取れそうです'
      : verdict === 'fail-all'
        ? failAllNear
          ? 'いまの入力だと、条件にもう少し届かないようです'
          : 'いまの入力では、条件を満たしていないようです'
        : '出産日によって、結果が変わります'

  // mixed の Step5 ヒント文言：不足候補のうち最小 shortage で「あと少し」かどうか判定。
  const mixedNear = summary.shortfallMin <= NEAR_THRESHOLD_MONTHS

  return (
    <div className="st-section">
      <IssueBanner scope="all" />
      <div className={`r5-verdict r5-verdict--${verdict}`}>
        <div className="r5-verdict__emoji" aria-hidden>
          {verdict === 'pass-all' ? '🎉' : verdict === 'fail-all' ? '🌱' : '🤞'}
        </div>
        <div>
          <span className="r5-verdict__small">判定結果</span>
          <h2 className="r5-verdict__title">{verdictTitle}</h2>
        </div>
      </div>

      <div className="r5-stats">
        <div className="r5-stats__cell r5-stats__cell--pass">
          <span className="r5-stats__num">{summary.passDays}</span>
          <span className="r5-stats__lab">受け取れる日</span>
        </div>
        <div className="r5-stats__cell r5-stats__cell--fail">
          <span className="r5-stats__num">{summary.failDays}</span>
          <span className="r5-stats__lab">届かない日</span>
        </div>
      </div>

      {summary.failStreaks.length > 0 && (
        <p className="r5-hint">
          🌱 下の一覧で紫の日が「
          {mixedNear ? 'あと少し届かない日' : '受け取れない日'}
          」です。Step 4 で「11 日以上 働いた月」「80 時間以上 働いた月」をもう一度見直してみると、結果が変わるかもしれません。
        </p>
      )}

      <MissingMonthsHint input={state.input} results={results} />

      <section className="r5-heat">
        <header>
          <h3>出産日ごとの結果</h3>
          <p>各セルをタップすると、その日の判定根拠が下に表示されます。</p>
        </header>

        <div className="r5-heat__grid">
          {results.map((r) => {
            const status = classify(r)
            const isSelected = r.birthDate === selected
            const [, mm, dd] = r.birthDate.split('-')
            return (
              <button
                key={r.birthDate}
                className={`r5-cell r5-cell--${status} ${isSelected ? 'is-selected' : ''}`}
                onClick={() =>
                  setSelected(r.birthDate === selected ? null : r.birthDate)
                }
                title={`${r.birthDate}: ${r.countedMonths.toFixed(1)} か月（${
                  r.isEligible
                    ? '受け取れる'
                    : isNearMiss(r)
                      ? 'あと少し届かない'
                      : '受け取れない'
                }）`}
              >
                <span className="r5-cell__date">
                  {Number(mm)}/{Number(dd)}
                </span>
                <span className="r5-cell__num">
                  {r.countedMonths.toFixed(1)}
                </span>
              </button>
            )
          })}
        </div>

        <footer>
          <span className="r5-leg r5-leg--pass">受け取れる</span>
          <span className="r5-leg r5-leg--fail">受け取れない</span>
        </footer>
      </section>

      {selectedResult && (
        <section className="r5-detail">
          <header>
            <span className="r5-detail__small">選択した出産日</span>
            <h3>{jpDate(selectedResult.birthDate)}</h3>
            <span
              className={`r5-detail__badge r5-detail__badge--${classify(selectedResult)}`}
            >
              {selectedResult.isEligible
                ? '✓ 受け取れます'
                : `✕ ${failVerdictLabel(selectedResult)}`}
            </span>
          </header>

          <DetailTimeline
            result={selectedResult}
            isMultipleBirth={state.input.isMultipleBirth}
          />

          <dl className="r5-detail__meta">
            <div>
              <dt>判定対象期間</dt>
              <dd>
                {selectedResult.scanWindow.start} 〜 {selectedResult.scanWindow.end}
              </dd>
            </div>
            <div>
              <dt>緩和加算</dt>
              <dd>{selectedResult.relaxationDays} 日</dd>
            </div>
          </dl>

          <h4 className="r5-detail__subtitle">月別判定</h4>
          <ul className="r5-months">
            {[...selectedResult.monthBreakdown].reverse().map((m) => (
              <li
                key={m.range.index}
                className={`r5-month r5-month--${m.counted === 1 ? 'pass' : 'fail'}`}
              >
                <span className="r5-month__no">
                  {String(m.range.index).padStart(2, '0')}
                </span>
                <span className="r5-month__range">
                  {m.range.start} 〜 {m.range.end}
                </span>
                <span className="r5-month__att">
                  {m.attendance
                    ? `${m.attendance.basicWageDays.toFixed(1)} 日 / ${m.attendance.basicWageHours.toFixed(0)} 時間`
                    : '—'}
                </span>
                <span className="r5-month__reason">{m.reason}</span>
                <span className="r5-month__counted">
                  {m.counted === 1 ? '+1' : '0'}
                </span>
              </li>
            ))}
          </ul>

          {selectedResult.fragmentJudgment && (
            <>
              <h4 className="r5-detail__subtitle">
                端数月（先頭）
                <span className="r5-detail__inline-note">参考表示</span>
              </h4>
              <ul className="r5-months">
                <li
                  className={`r5-month r5-month--${selectedResult.fragmentJudgment.counted === 0.5 ? 'pass' : 'fail'}`}
                >
                  <span className="r5-month__no">FR</span>
                  <span className="r5-month__range">
                    {selectedResult.fragmentJudgment.range.start} 〜{' '}
                    {selectedResult.fragmentJudgment.range.end}
                    {' '}
                    （{selectedResult.fragmentJudgment.range.days} 日）
                  </span>
                  <span className="r5-month__att">
                    {selectedResult.fragmentJudgment.attendance
                      ? `${selectedResult.fragmentJudgment.attendance.basicWageDays.toFixed(1)} 日`
                      : '—'}
                  </span>
                  <span className="r5-month__reason">
                    {selectedResult.fragmentJudgment.reason}
                  </span>
                  <span className="r5-month__counted">
                    {selectedResult.fragmentJudgment.counted === 0.5
                      ? '+0.5'
                      : '0'}
                  </span>
                </li>
              </ul>
              <p className="r5-detail__caveat">
                ※ 端数月（1 か月未満の余り期間）の <strong>+0.5 か月</strong> は法令（業務取扱要領 59533）に定義されていますが、
                完全月のカウント（0 / 1 整数）と合算したとき、{' '}
                <strong>育児休業給付金の「12 か月以上」判定では結果に影響しません</strong>
                （N + 0.5 で 12 の境界を跨ぐケースが構造上存在しないため）。
                基本手当（50103）など <strong>「6 か月以上」</strong> の閾値を持つ給付の計算式を準用しているため記録としてだけ残しています。
              </p>
            </>
          )}
        </section>
      )}

      <p className="r5-disclaimer">
        ※ 本ツールは参考用です。最終判定は管轄のハローワーク（公共職業安定所）で行われます。
      </p>
    </div>
  )
}

interface DetailTimelineProps {
  result: EligibilityResult
  isMultipleBirth: boolean
}

function DetailTimeline({ result, isMultipleBirth }: DetailTimelineProps) {
  const prenatalDays = isMultipleBirth
    ? PRENATAL_DAYS_MULTIPLE
    : PRENATAL_DAYS_SINGLE
  const birth = parseISO(result.birthDate)
  const postnatalEnd = format(addDays(birth, POSTNATAL_DAYS), 'yyyy-MM-dd')
  const stops = [
    {
      key: 'prenatal',
      ic: '🌸',
      label: `産前 ${prenatalDays} 日`,
      date: result.leaveStartDate,
    },
    { key: 'birth', ic: '👶', label: '出産', date: result.birthDate },
    {
      key: 'postnatal',
      ic: '🌿',
      label: '産後 56 日 終了',
      date: postnatalEnd,
    },
    {
      key: 'childcare',
      ic: '🍼',
      label: '育休開始（判定基準日）',
      date: result.childCareStartDate,
      pivot: true as const,
    },
  ]
  return (
    <ol
      className="r5-timeline"
      aria-label="この出産日における産休・育休スケジュール"
    >
      {stops.map((s) => (
        <li
          key={s.key}
          className={`r5-timeline__stop${s.pivot ? ' is-pivot' : ''}`}
        >
          <span className="r5-timeline__ic" aria-hidden>
            {s.ic}
          </span>
          <span className="r5-timeline__label">{s.label}</span>
          <span className="r5-timeline__date">{jpDate(s.date)}</span>
        </li>
      ))}
    </ol>
  )
}

interface MissingMonthsHintProps {
  input: UserInput
  results: EligibilityResult[]
}

const MAX_MISSING_DISPLAY = 6

function MissingMonthsHint({ input, results }: MissingMonthsHintProps) {
  const missing = useMemo(
    () => detectMissingMonths(input, results),
    [input, results],
  )
  if (missing.length === 0) return null
  const head = missing.slice(0, MAX_MISSING_DISPLAY)
  const restCount = missing.length - head.length
  return (
    <div className="r5-missing">
      <span className="r5-missing__label">
        まだ出勤情報が入っていなさそうな月
      </span>
      <ul>
        {head.map((m) => (
          <li key={m}>{jpMonth(m)}</li>
        ))}
        {restCount > 0 && <li className="r5-missing__more">他 {restCount} か月</li>}
      </ul>
      <p className="r5-missing__hint">
        判定対象期間に含まれているのに、Step 4 でまだ何も入力していない月のようです。これらの月の出勤情報を入れると、結果がより正確になります。
      </p>
    </div>
  )
}

function jpMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y} 年 ${Number(m)} 月`
}

/**
 * 判定対象期間の各暦月のうち、
 * - 出勤情報が 1 件も入っておらず、
 * - その月の中に「入力されるべき日」（雇用保険加入中・休業期間外・育休開始日より前）が
 *   1 日でも残っている
 * を満たす月を「未入力候補」として返す。
 *
 * 月途中で産休に入る月や、月途中で育休開始日を迎える月でも、
 * 入力対象の日が残っているなら警告する。逆に月内の全日が
 * 「休業中／加入外／育休開始日以降」で埋まっているなら警告しない。
 */
function detectMissingMonths(
  input: UserInput,
  results: EligibilityResult[],
): string[] {
  if (results.length === 0) return []
  const earliest = results
    .map((r) => r.scanWindow.start)
    .reduce((a, b) => (a < b ? a : b))
  const latest = results
    .map((r) => r.scanWindow.end)
    .reduce((a, b) => (a > b ? a : b))

  const inputMonthKeys = new Set(
    input.attendances.map((a) => a.date.slice(0, 7)),
  )

  const out: string[] = []
  let cursor = startOfMonth(parseISO(earliest))
  const last = startOfMonth(parseISO(latest))
  while (!isAfter(cursor, last)) {
    const ym = format(cursor, 'yyyy-MM')
    if (!inputMonthKeys.has(ym) && monthHasInputableDay(cursor, input, latest)) {
      out.push(ym)
    }
    cursor = addMonths(cursor, 1)
  }
  return out
}

/**
 * 月内に「ユーザーが入力すべき日」が 1 日でも残っているか。
 * 入力すべき日 = 加入中 かつ 休業期間外 かつ 判定窓内（育休開始日より前）
 */
function monthHasInputableDay(
  cursor: Date,
  input: UserInput,
  scanWindowEnd: string,
): boolean {
  const monthEnd = endOfMonth(cursor)
  let cur = cursor
  while (cur.getTime() <= monthEnd.getTime()) {
    const date = format(cur, 'yyyy-MM-dd')
    if (date > scanWindowEnd) {
      cur = addDays(cur, 1)
      continue
    }
    if (!isInsuredDay(date, input.insuredSegments)) {
      cur = addDays(cur, 1)
      continue
    }
    if (isInLeave(date, input.leavePeriods)) {
      cur = addDays(cur, 1)
      continue
    }
    return true
  }
  return false
}

function isInsuredDay(
  date: string,
  segments: InsuredEmploymentSegment[],
): boolean {
  if (segments.length === 0) return true
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
