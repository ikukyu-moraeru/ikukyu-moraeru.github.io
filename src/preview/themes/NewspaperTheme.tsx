import './NewspaperTheme.css'
import { SAMPLE_HEATMAP } from '../sample'

export function NewspaperTheme() {
  const today = new Date()
  const issue = `Vol. ${String(today.getFullYear()).slice(-2)} · ${String(today.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="theme-newspaper">
      <div className="np-grain" />
      <div className="np-frame">
        <header className="np-masthead">
          <div className="np-masthead__l">The Maternity Ledger</div>
          <div className="np-masthead__c">育休給付 · 受給判定</div>
          <div className="np-masthead__r">
            {issue} · 編集部
            <br />
            <span className="np-masthead__no">NO. 001</span>
          </div>
        </header>

        <section className="np-hero">
          <div>
            <div className="np-eyebrow">
              <span className="np-eyebrow__vol">Issue 001 — for working mothers</span>
              <span>—</span>
              <span>厚労省パンフレット 2025-08-01 改訂版 準拠</span>
            </div>

            <h1 className="np-title">
              出産は<span className="np-accent">うごく</span>。<br />
              だから受給も、
              <br />
              ひと目で<em>視る</em>。
            </h1>

            <p className="np-lede">
              雇用保険の<em>育児休業給付金</em>は、休業開始前 2
              年で「賃金支払基礎日数 11 日以上」の月が 12
              か月以上必要——けれど、出産日は予定どおりにはやってこない。本ツールは、ありうる出産日を一日ずつ走査し、
              <em>充足するか／しないか</em>を版面のように一覧化する、編集部発の判定機です。
            </p>

            <div className="np-cta">
              <button className="np-btn">
                判定をはじめる <span className="np-btn__arrow">→</span>
              </button>
              <a className="np-link" href="#">
                判定ロジックを読む
              </a>
            </div>

            <div className="np-features">
              <div>
                <div className="np-features__num">i.</div>
                <h4>出産日を走査</h4>
                <p>予定日を中心に前後の候補をすべて判定。</p>
              </div>
              <div>
                <div className="np-features__num">ii.</div>
                <h4>緩和を加算</h4>
                <p>産休・育休・疾病などを最長 4 年へ拡張。</p>
              </div>
              <div>
                <div className="np-features__num">iii.</div>
                <h4>転職と通算</h4>
                <p>離職後 1 年以内なら前職分も合算。</p>
              </div>
            </div>
          </div>

          <aside className="np-sidecard">
            <h3>From the editor</h3>
            <h2>
              「いつ生まれるか」で
              <br />
              受給は変わる。
            </h2>
            <p>
              出産は人為的に動かせない。けれど、判定は <strong>一日ずれただけ</strong>{' '}
              で結果が変わる。だからこそ、ひと目で見渡せる版面が要る。
            </p>
            <p>
              入力した情報はあなたのブラウザにのみ保存され、サーバへは送信されません。最終判定は管轄のハローワークで行われます——本誌は{' '}
              <em>編集部の参考読本</em>。
            </p>
            <footer>
              <span>本ツールについて</span>
              <span>v0.1 · 2026</span>
            </footer>
          </aside>
        </section>

        <section className="np-heatmap">
          <header>
            <span className="np-heatmap__no">FIG. 01</span>
            <h3>出産日 × 受給判定</h3>
            <span className="np-heatmap__cap">9月の各日に出産した場合の充足月数</span>
          </header>
          <div className="np-heatmap__grid">
            {SAMPLE_HEATMAP.map((c) => (
              <div key={c.index} className={`np-cell np-cell--${c.status}`}>
                <span className="np-cell__date">{c.label}</span>
                <span className="np-cell__num">{c.countedMonths.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <footer>
            <span className="np-legend np-legend--pass">充足</span>
            <span className="np-legend np-legend--border">境界</span>
            <span className="np-legend np-legend--fail">不足</span>
          </footer>
        </section>

        <footer className="np-foot">
          <span>© The Maternity Ledger · ローカル動作 · 個人情報は送信しません</span>
          <span className="np-stamp">参考用</span>
        </footer>
      </div>
    </div>
  )
}
