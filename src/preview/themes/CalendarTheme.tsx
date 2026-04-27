import './CalendarTheme.css'
import { SAMPLE_HEATMAP } from '../sample'

const MONTHS = [
  '24/04', '24/06', '24/08', '24/10', '24/12',
  '25/02', '25/04', '25/06', '25/08', '25/10', '25/12',
  '26/02', '26/04', '26/06', '26/08',
]

interface PhaseBar {
  name: string
  short: string
  start: number // 0..100
  end: number // 0..100
  status: 'insured' | 'leave' | 'gap' | 'target' | 'birth'
  detail: string
}

const PHASES: PhaseBar[] = [
  { name: '雇用保険 被保険者', short: 'insured', start: 0, end: 56, status: 'insured', detail: '前職 (24/04 → 不明)' },
  { name: '雇用保険 被保険者', short: 'insured #2', start: 60, end: 100, status: 'insured', detail: '現職 (25/02 → 在職中)' },
  { name: '無職期間', short: 'gap', start: 56, end: 60, status: 'gap', detail: '空白 28 日 — 通算可' },
  { name: '判定対象期間 (2年)', short: 'window', start: 50, end: 95, status: 'target', detail: '2024-09 → 2026-09' },
  { name: '産前産後休業 (予定)', short: 'leave', start: 88, end: 95, status: 'leave', detail: '緩和加算: +98 日' },
  { name: '出産日候補', short: 'birth', start: 92, end: 95, status: 'birth', detail: '9/01 — 9/30 を走査' },
]

export function CalendarTheme() {
  return (
    <div className="theme-calendar">
      <header className="ca-bar">
        <div className="ca-bar__l">
          <span className="ca-bar__dot" />
          <span className="ca-bar__title">project · maternity</span>
        </div>
        <nav className="ca-bar__nav">
          <a className="is-active">timeline</a>
          <a>scenarios</a>
          <a>refs</a>
        </nav>
        <div className="ca-bar__r">
          <span className="ca-mono">v0.1 · build local</span>
        </div>
      </header>

      <main className="ca-main">
        <section className="ca-hero">
          <div>
            <span className="ca-tag">timeline view · 縦に観る、受給</span>
            <h1 className="ca-h1">
              受給の可否は、
              <br />
              <span className="ca-h1__line">期間と日数の <em>並び方</em> で決まる。</span>
            </h1>
            <p className="ca-lede">
              判定対象期間（2年、最長 4 年）にどれだけ「11 日以上の月」があったか——
              文字で読むより、ガントで見る方が早い。出産日 30 候補のすべてについて、
              タイムライン上で観測します。
            </p>
          </div>

          <div className="ca-meta">
            <dl>
              <div>
                <dt>project</dt>
                <dd>Maternity Eligibility</dd>
              </div>
              <div>
                <dt>scan range</dt>
                <dd className="ca-mono">2026-09-01 → 2026-09-30</dd>
              </div>
              <div>
                <dt>window</dt>
                <dd className="ca-mono">2 yrs (max 4 yrs)</dd>
              </div>
              <div>
                <dt>method</dt>
                <dd className="ca-mono">MHLW 2025-08-01</dd>
              </div>
              <div>
                <dt>status</dt>
                <dd className="ca-mono ca-mono--ok">ready ●</dd>
              </div>
            </dl>
            <button className="ca-run">RUN ASSESSMENT →</button>
          </div>
        </section>

        <section className="ca-gantt">
          <div className="ca-gantt__axis">
            {MONTHS.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>

          <ol className="ca-gantt__rows">
            {PHASES.map((p, i) => (
              <li key={i} className={`ca-row ca-row--${p.status}`}>
                <div className="ca-row__label">
                  <span className="ca-row__name">{p.name}</span>
                  <span className="ca-row__detail">{p.detail}</span>
                </div>
                <div className="ca-row__track">
                  <span
                    className="ca-row__bar"
                    style={{ left: `${p.start}%`, width: `${p.end - p.start}%` }}
                  >
                    <em>{p.short}</em>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ca-strip">
          <header>
            <span className="ca-mono ca-mono--accent">FIG. 02</span>
            <h2>Birth-date scan / 30 candidates</h2>
            <span className="ca-mono">bar height = counted months</span>
          </header>

          <div className="ca-strip__chart">
            <div className="ca-strip__threshold" data-label="12 months">
              <span />
            </div>
            {SAMPLE_HEATMAP.map((c) => {
              const h = Math.min(100, (c.countedMonths / 14) * 100)
              return (
                <div
                  key={c.index}
                  className={`ca-strip__col ca-strip__col--${c.status}`}
                  style={{ '--h': `${h}%` } as React.CSSProperties}
                  title={`${c.label}: ${c.countedMonths.toFixed(1)} 月`}
                >
                  <span className="ca-strip__bar" />
                  <span className="ca-strip__lab ca-mono">{c.label}</span>
                </div>
              )
            })}
          </div>

          <footer>
            <span className="ca-key ca-key--pass">充足</span>
            <span className="ca-key ca-key--border">境界</span>
            <span className="ca-key ca-key--fail">不足</span>
          </footer>
        </section>
      </main>

      <footer className="ca-foot">
        <span className="ca-mono">© 2026 maternity ledger</span>
        <span className="ca-mono">all calculation runs locally</span>
      </footer>
    </div>
  )
}
