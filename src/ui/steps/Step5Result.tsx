import { useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { useAppState } from '../../state/AppState'
import { scanBirthDates } from '../../domain/birthDateScan'
import { summarizeScan } from '../../domain/summary'
import type { EligibilityResult } from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import './steps.css'
import './Step5Result.css'

const POSTNATAL_DAYS = 56
const PRENATAL_DAYS_SINGLE = 42
const PRENATAL_DAYS_MULTIPLE = 98

type Status = 'pass' | 'fail'

function classify(r: EligibilityResult): Status {
  return r.isEligible ? 'pass' : 'fail'
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

  return (
    <div className="st-section">
      <IssueBanner scope="all" />
      <div className={`r5-verdict r5-verdict--${verdict}`}>
        <div className="r5-verdict__emoji" aria-hidden>
          {verdict === 'pass-all' ? '🎉' : verdict === 'fail-all' ? '🌱' : '🤞'}
        </div>
        <div>
          <span className="r5-verdict__small">判定結果</span>
          <h2 className="r5-verdict__title">
            {verdict === 'pass-all'
              ? 'いつ生まれても、育休給付金を受け取れそうです'
              : verdict === 'fail-all'
                ? 'いまの入力だと、条件にもう少し届かないようです'
                : '出産日によって、結果が変わります'}
          </h2>
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
        <div className="r5-fails">
          <span className="r5-fails__label">
            条件にあと少し届かない日
          </span>
          <ul>
            {summary.failStreaks.map((s) => (
              <li key={`${s.start}_${s.end}`}>
                <span className="r5-fails__range">
                  {jpDate(s.start)}
                  {s.start !== s.end && <> 〜 {jpDate(s.end)}</>}
                </span>
                <span className="r5-fails__days">{s.days} 日間</span>
              </li>
            ))}
          </ul>
          <p className="r5-fails__hint">
            Step 4 で「11 日以上 働いた月」「80 時間以上 働いた月」をもう一度見直してみると、結果が変わるかもしれません。
          </p>
        </div>
      )}

      <section className="r5-heat">
        <header>
          <h3>出産日 × 受給判定</h3>
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
                title={
                  r.isEligible
                    ? `${r.birthDate}: 受け取れる`
                    : `${r.birthDate}: あと少し届かない`
                }
              >
                <span className="r5-cell__date">
                  {Number(mm)}/{Number(dd)}
                </span>
                <span className="r5-cell__mark" aria-hidden>
                  {r.isEligible ? '○' : '△'}
                </span>
              </button>
            )
          })}
        </div>

        <footer>
          <span className="r5-leg r5-leg--pass">受け取れる</span>
          <span className="r5-leg r5-leg--fail">あと少し届かない</span>
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
                : '✕ あと少し届かないようです'}
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
