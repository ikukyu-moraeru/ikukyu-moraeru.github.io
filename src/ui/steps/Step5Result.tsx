import { useMemo, useState } from 'react'
import { useAppState } from '../../state/AppState'
import { scanBirthDates } from '../../domain/birthDateScan'
import { summarizeScan } from '../../domain/summary'
import type { EligibilityResult } from '../../domain/types'
import './steps.css'
import './Step5Result.css'

type Status = 'pass' | 'border' | 'fail'

function classify(r: EligibilityResult): Status {
  if (r.countedMonths >= 12.5) return 'pass'
  if (r.countedMonths >= 11.5) return 'border'
  return 'fail'
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
      <div className={`r5-verdict r5-verdict--${verdict}`}>
        <div className="r5-verdict__emoji" aria-hidden>
          {verdict === 'pass-all' ? '🎉' : verdict === 'fail-all' ? '⚠️' : '🤞'}
        </div>
        <div>
          <span className="r5-verdict__small">判定結果</span>
          <h2 className="r5-verdict__title">
            {verdict === 'pass-all'
              ? 'いつ生まれても、受給できます'
              : verdict === 'fail-all'
                ? '現状の入力では受給要件に届きません'
                : '出産日次第で結果が変わります'}
          </h2>
          <p className="r5-verdict__sub">
            走査した {summary.totalDays} 候補のうち、
            <strong>{summary.passDays}</strong> 日で受給要件を充足
            {summary.borderDays > 0 && (
              <>
                、<strong>{summary.borderDays}</strong> 日が境界
              </>
            )}
            、<strong>{summary.failDays}</strong> 日が不足。
          </p>
        </div>
      </div>

      <div className="r5-stats">
        <div className="r5-stats__cell r5-stats__cell--pass">
          <span className="r5-stats__num">{summary.passDays}</span>
          <span className="r5-stats__lab">充足する日</span>
        </div>
        <div className="r5-stats__cell r5-stats__cell--border">
          <span className="r5-stats__num">{summary.borderDays}</span>
          <span className="r5-stats__lab">境界の日</span>
        </div>
        <div className="r5-stats__cell r5-stats__cell--fail">
          <span className="r5-stats__num">{summary.failDays}</span>
          <span className="r5-stats__lab">不足の日</span>
        </div>
        <div className="r5-stats__cell r5-stats__cell--best">
          <span className="r5-stats__num r5-stats__num--small">
            {bestCounted(results, summary)}
          </span>
          <span className="r5-stats__lab">
            最良：{jpDate(summary.bestBirthDate)}
          </span>
        </div>
      </div>

      {summary.passStreaks.length > 0 && (
        <div className="r5-streaks">
          <span className="r5-streaks__label">連続して充足する区間</span>
          <ul>
            {summary.passStreaks.map((s) => (
              <li key={`${s.start}_${s.end}`}>
                <span className="r5-streaks__range">
                  {jpDate(s.start)} 〜 {jpDate(s.end)}
                </span>
                <span className="r5-streaks__days">{s.days} 日連続</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.passDays < summary.totalDays && summary.shortfallMin > 0 && (
        <div className="r5-shortfall">
          🪧 不足候補のうち最小不足月数は
          <strong> {summary.shortfallMin.toFixed(1)} か月</strong>
          。あと少しで届きます。
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
                title={`${r.birthDate}: ${r.countedMonths.toFixed(1)} か月`}
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
          <span className="r5-leg r5-leg--pass">充足（12.5 以上）</span>
          <span className="r5-leg r5-leg--border">境界（11.5–12.5）</span>
          <span className="r5-leg r5-leg--fail">不足（11.5 未満）</span>
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
              {selectedResult.isEligible ? '✓ 充足' : '✕ 不足'} ／
              カウント {selectedResult.countedMonths.toFixed(1)} か月
              {selectedResult.shortage > 0 && (
                <> · 不足 {selectedResult.shortage.toFixed(1)} か月</>
              )}
            </span>
          </header>

          <dl className="r5-detail__meta">
            <div>
              <dt>産前休業開始</dt>
              <dd>{jpDate(selectedResult.leaveStartDate)}</dd>
            </div>
            <div>
              <dt>育休開始日（判定基準）</dt>
              <dd>{jpDate(selectedResult.childCareStartDate)}</dd>
            </div>
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
              <h4 className="r5-detail__subtitle">端数月（先頭）</h4>
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

function bestCounted(
  results: EligibilityResult[],
  summary: ReturnType<typeof summarizeScan>,
): string {
  if (!summary.bestBirthDate) return '—'
  const r = results.find((x) => x.birthDate === summary.bestBirthDate)
  return r ? r.countedMonths.toFixed(1) : '—'
}
