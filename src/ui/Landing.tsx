import { useAppState } from '../state/AppState'
import { SAMPLE_HEATMAP } from '../preview/sample'
import './Landing.css'

export function Landing() {
  const { dispatch } = useAppState()
  return (
    <div className="ht-page">
      <div className="ht-blob ht-blob--1" />
      <div className="ht-blob ht-blob--2" />
      <div className="ht-blob ht-blob--3" />

      <header className="ht-nav">
        <div className="ht-logo">
          <span className="ht-logo__mark">◐</span>
          <span>マタニティ手帖</span>
        </div>
        <nav>
          <a href="#">使い方</a>
          <a href="#">よくある質問</a>
          <a href="#">出典</a>
        </nav>
      </header>

      <main className="ht-main">
        <div className="ht-hero">
          <span className="ht-pill">育休給付の受給判定 · 2026 年版</span>

          <h1 className="ht-h1">
            出産日が
            <br />
            すこしずれても、
            <br />
            <span className="ht-h1__accent">大丈夫かどうか。</span>
          </h1>

          <p className="ht-lede">
            雇用保険の育児休業給付金は、休業前 2 年で
            <strong>「11 日以上働いた月」が 12 か月以上</strong>
            必要です。出産日が動くと結果も変わるから、ありうる日付ぜんぶをまとめてしらべます。
          </p>

          <div className="ht-cta">
            <button
              className="ht-btn ht-btn--primary"
              onClick={() => dispatch({ type: 'GOTO_WIZARD' })}
            >
              <span>判定をはじめる</span>
              <span className="ht-btn__chip">3 分</span>
            </button>
          </div>

          <ul className="ht-points">
            <li>
              <span className="ht-points__ic">🍼</span>
              <strong>かんたん入力</strong>休職や転職の期間を選ぶだけ
            </li>
            <li>
              <span className="ht-points__ic">📒</span>
              <strong>自動で計算</strong>緩和事由・前職通算もまるごと
            </li>
            <li>
              <span className="ht-points__ic">🔒</span>
              <strong>送信しません</strong>すべてブラウザの中で完結
            </li>
          </ul>
        </div>

        <aside className="ht-card">
          <div className="ht-card__head">
            <span className="ht-card__tag">プレビュー</span>
            <h3>9 月の判定マップ</h3>
            <p>各日に出産した場合の充足月数を、まる印で。</p>
          </div>

          <div className="ht-grid">
            {SAMPLE_HEATMAP.map((c) => (
              <div key={c.index} className={`ht-bubble ht-bubble--${c.status}`}>
                <span className="ht-bubble__date">{c.label}</span>
                <span className="ht-bubble__num">
                  {c.countedMonths.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          <div className="ht-card__legend">
            <span className="ht-leg ht-leg--pass">充足</span>
            <span className="ht-leg ht-leg--border">あと少し</span>
            <span className="ht-leg ht-leg--fail">不足</span>
          </div>
        </aside>
      </main>

      <footer className="ht-foot">
        <p>※ 本ツールは参考用です。最終判定は管轄のハローワークで行われます。</p>
        <p className="ht-foot__sub">© 2026 マタニティ手帖 · ローカル動作</p>
      </footer>
    </div>
  )
}
