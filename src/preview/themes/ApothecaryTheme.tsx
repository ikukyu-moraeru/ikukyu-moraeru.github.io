import './ApothecaryTheme.css'
import { SAMPLE_HEATMAP } from '../sample'

export function ApothecaryTheme() {
  return (
    <div className="theme-apothecary">
      <header className="ap-top">
        <span className="ap-mono">— maternity leave benefit · since 2026</span>
        <span className="ap-mono">No. 001 / 編集部</span>
      </header>

      <main className="ap-stage">
        <div className="ap-orn ap-orn--top" aria-hidden>
          ❦
        </div>

        <p className="ap-eyebrow">育児休業給付金 · 受給要件のしらべ</p>

        <h1 className="ap-h1">
          <span>「いつ生まれるか」で、</span>
          <span>受給は、</span>
          <span className="ap-italic">うごく。</span>
        </h1>

        <p className="ap-lede">
          雇用保険の<em>育児休業給付金</em>には、休業開始の前 2 年に
          「賃金支払基礎日数 11 日以上」の月が 12 か月以上必要とされます。
          けれど、出産日は予定日のとおりにはやってこない——だから、ありうる出産日を一日ずつしらべ、充足するか、しないかを、おだやかに見渡せるよう、こしらえました。
        </p>

        <div className="ap-cta">
          <button className="ap-btn">判定をはじめる</button>
          <a href="#" className="ap-quiet-link">
            判定ロジックを読む →
          </a>
        </div>

        <div className="ap-rule" />

        <section className="ap-feat">
          <article>
            <header>
              <span className="ap-num">壱</span>
              <h3>出産日を、一日ずつ</h3>
            </header>
            <p>予定日を中心に、ありうる出産日を走査します。一日のずれが結果を変える。</p>
          </article>
          <article>
            <header>
              <span className="ap-num">弐</span>
              <h3>緩和を、加える</h3>
            </header>
            <p>産休・育休・疾病など、賃金未払いの期間を 2 年に加算（最長 4 年）。</p>
          </article>
          <article>
            <header>
              <span className="ap-num">参</span>
              <h3>転職を、つなぐ</h3>
            </header>
            <p>離職後 1 年以内・失業給付未受給なら、前職の被保険者期間を合算。</p>
          </article>
        </section>

        <div className="ap-rule" />

        <section className="ap-heat">
          <header>
            <span className="ap-num ap-num--small">図 ①</span>
            <h2>九月の各日に、もし生まれたなら。</h2>
            <p>充足する月数を一日ずつしらべた版面。</p>
          </header>

          <div className="ap-heat__row">
            {SAMPLE_HEATMAP.map((c) => (
              <div key={c.index} className={`ap-tile ap-tile--${c.status}`}>
                <span className="ap-tile__date">{c.label}</span>
                <span className="ap-tile__num">{c.countedMonths.toFixed(1)}</span>
                <span className="ap-tile__unit">か月</span>
              </div>
            ))}
          </div>

          <footer className="ap-heat__legend">
            <span className="ap-key ap-key--pass">充足</span>
            <span className="ap-key ap-key--border">境界</span>
            <span className="ap-key ap-key--fail">不足</span>
          </footer>
        </section>

        <div className="ap-orn ap-orn--bot" aria-hidden>
          ❦
        </div>
      </main>

      <footer className="ap-foot">
        <span>本ツールは参考用。最終判定は管轄のハローワークで行われます。</span>
        <span>ローカル動作 · 個人情報は送信しません</span>
      </footer>
    </div>
  )
}
