import './SwissTheme.css'
import { SAMPLE_HEATMAP } from '../sample'

export function SwissTheme() {
  const passCount = SAMPLE_HEATMAP.filter((c) => c.status === 'pass').length
  const borderCount = SAMPLE_HEATMAP.filter((c) => c.status === 'border').length
  const failCount = SAMPLE_HEATMAP.filter((c) => c.status === 'fail').length

  return (
    <div className="theme-swiss">
      <header className="sw-bar">
        <div className="sw-bar__l">
          <span className="sw-bar__mark">●</span>
          <span className="sw-bar__brand">Maternity Eligibility Tool</span>
        </div>
        <div className="sw-bar__c sw-mono">v0.1 / 2026 / build local</div>
        <div className="sw-bar__r">
          <button className="sw-bar__btn">Start</button>
        </div>
      </header>

      <main className="sw-grid">
        <section className="sw-hero">
          <div className="sw-hero__meta">
            <span className="sw-mono">DOC 001</span>
            <span className="sw-mono">育児休業給付金 / Type II</span>
            <span className="sw-mono sw-accent">REF: MHLW 2025-08-01</span>
          </div>

          <h1 className="sw-h1">
            Eligibility,
            <br />
            mapped against
            <br />
            <span className="sw-accent">every possible birth date.</span>
          </h1>

          <p className="sw-lede">
            雇用保険の育児休業給付金は、休業開始前 2 年において
            「賃金支払基礎日数 11 日以上の月が 12 か月」必要です。
            出産日は予定日通りには訪れません。本ツールは、ありうる出産日の一日ずつについて、要件の充足を計算し、
            <em>表として可視化</em>します。
          </p>

          <div className="sw-stats">
            <div>
              <span className="sw-stats__num sw-mono">{passCount}</span>
              <span className="sw-stats__lab">充足する候補日</span>
            </div>
            <div>
              <span className="sw-stats__num sw-mono">{borderCount}</span>
              <span className="sw-stats__lab">境界の日</span>
            </div>
            <div>
              <span className="sw-stats__num sw-mono">{failCount}</span>
              <span className="sw-stats__lab">不足の日</span>
            </div>
            <div>
              <span className="sw-stats__num sw-mono sw-accent">/30</span>
              <span className="sw-stats__lab">対象出産日</span>
            </div>
          </div>

          <div className="sw-cta">
            <button className="sw-btn">
              Start the assessment <span className="sw-mono">→</span>
            </button>
            <a className="sw-link" href="#">
              View methodology
            </a>
          </div>
        </section>

        <aside className="sw-side">
          <div className="sw-side__num sw-mono">01 / 03</div>
          <h3>Inputs</h3>
          <p>休職、雇用保険未加入期間、月別出勤日数、転職履歴。</p>
          <div className="sw-side__num sw-mono">02 / 03</div>
          <h3>Logic</h3>
          <p>完全月の生成、緩和事由による期間延長、前職通算。</p>
          <div className="sw-side__num sw-mono">03 / 03</div>
          <h3>Output</h3>
          <p>出産日 × 受給判定の二次元マップ、月別の判定根拠。</p>
        </aside>
      </main>

      <section className="sw-table">
        <header className="sw-table__head">
          <div>
            <span className="sw-mono sw-accent">FIG. 01</span>
            <h2>Birth-date sensitivity table</h2>
          </div>
          <span className="sw-mono">scan: 2026-09-01 → 2026-09-30 / step: 1d</span>
        </header>

        <table>
          <thead>
            <tr>
              <th>day</th>
              <th>date</th>
              <th>status</th>
              <th className="sw-num-col">counted months</th>
              <th>delta</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_HEATMAP.map((c) => (
              <tr key={c.index} className={`sw-row sw-row--${c.status}`}>
                <td className="sw-mono">
                  {String(c.index + 1).padStart(2, '0')}
                </td>
                <td className="sw-mono">2026-{c.label.replace('/', '-').padStart(5, '0')}</td>
                <td>
                  <span className={`sw-tag sw-tag--${c.status}`}>
                    {c.status === 'pass'
                      ? 'pass'
                      : c.status === 'border'
                        ? 'border'
                        : 'fail'}
                  </span>
                </td>
                <td className="sw-mono sw-num-col">{c.countedMonths.toFixed(1)}</td>
                <td className="sw-mono">
                  {(c.countedMonths - 12).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sw-strip">
        {SAMPLE_HEATMAP.map((c) => (
          <span key={c.index} className={`sw-strip__bar sw-strip__bar--${c.status}`} title={`${c.label} · ${c.countedMonths.toFixed(1)}`}>
            <span style={{ height: `${Math.min(100, (c.countedMonths / 14) * 100)}%` }} />
          </span>
        ))}
      </section>

      <footer className="sw-foot">
        <span className="sw-mono">© 2026 / built locally / no data leaves your browser</span>
        <span className="sw-mono">final ruling: hello-work / not this tool</span>
      </footer>
    </div>
  )
}
