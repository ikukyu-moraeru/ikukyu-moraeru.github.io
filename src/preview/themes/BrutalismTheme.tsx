import './BrutalismTheme.css'
import { SAMPLE_HEATMAP } from '../sample'

export function BrutalismTheme() {
  return (
    <div className="theme-brutalism">
      <div className="br-tape" />

      <header className="br-top">
        <div className="br-top__brand">
          <span className="br-top__star">✦</span>
          <span>Maternity Bureau</span>
          <span className="br-top__star">✦</span>
        </div>
        <span className="br-top__alert">
          ▶ ALERT: birth dates do not stay still
        </span>
      </header>

      <main className="br-main">
        <section className="br-hero">
          <span className="br-tag br-tag--pink">育休給付</span>
          <span className="br-tag br-tag--lemon">2026 edition</span>

          <h1 className="br-h1">
            <span className="br-h1__row">
              <em>あ</em>なたの
            </span>
            <span className="br-h1__row br-h1__row--mid">
              受給は <span className="br-blob">うごく</span>
            </span>
            <span className="br-h1__row">
              <span className="br-h1__under">出産日次第</span>。
            </span>
          </h1>

          <div className="br-hero__btm">
            <p className="br-lede">
              ぐにゃっと動く出産日に、表をぴたっとあわせる装置。
              休業前 2 年で「11 日以上」の月が 12 か月——その充足を、ありうる出産日 30 候補ぜんぶに対して計算します。
            </p>

            <div className="br-cta">
              <button className="br-btn">
                <span>判定を、はじめる</span>
                <span className="br-btn__arrow">↗</span>
              </button>
              <a className="br-link" href="#">
                <span>ロジックを読む</span>
              </a>
            </div>
          </div>

          <div className="br-counter">
            <span className="br-counter__num">30</span>
            <span className="br-counter__lab">candidate births</span>
            <span className="br-counter__num br-counter__num--magenta">12</span>
            <span className="br-counter__lab">months required</span>
            <span className="br-counter__num br-counter__num--turq">4yr</span>
            <span className="br-counter__lab">scan window max</span>
          </div>
        </section>

        <section className="br-board">
          <header>
            <span className="br-tag br-tag--turq">FIG. 01</span>
            <h2>SCAN: 9月の各日</h2>
            <span className="br-board__sub">▶ all candidate births &nbsp;/&nbsp; counted months</span>
          </header>

          <div className="br-tiles">
            {SAMPLE_HEATMAP.map((c) => (
              <div key={c.index} className={`br-tile br-tile--${c.status}`}>
                <span className="br-tile__date">{c.label}</span>
                <span className="br-tile__num">
                  {c.countedMonths.toFixed(1)}
                </span>
                <span className="br-tile__unit">mo</span>
              </div>
            ))}
          </div>

          <footer className="br-board__foot">
            <span className="br-key br-key--pass">充足 / pass</span>
            <span className="br-key br-key--border">境界 / border</span>
            <span className="br-key br-key--fail">不足 / fail</span>
          </footer>
        </section>

        <section className="br-strip">
          <div className="br-strip__title">★ 入力は 3 ステップのみ ★ ★ 入力は 3 ステップのみ ★ 入力は 3 ステップのみ ★ </div>
          <div className="br-pillar-row">
            <article className="br-pillar br-pillar--pink">
              <span className="br-pillar__no">01</span>
              <h3>休職を、登録</h3>
              <p>産休・育休・病気休職を、複数まとめて。</p>
            </article>
            <article className="br-pillar br-pillar--lemon">
              <span className="br-pillar__no">02</span>
              <h3>転職を、つなぐ</h3>
              <p>離職後 1 年以内・失業給付未受給なら通算。</p>
            </article>
            <article className="br-pillar br-pillar--turq">
              <span className="br-pillar__no">03</span>
              <h3>出勤を、書く</h3>
              <p>月別の支払基礎日数 / 時間数を入力。</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="br-foot">
        <span>© 2026 ▴ Maternity Bureau ▴ runs locally</span>
        <span>★ final ruling: hello-work, not us</span>
      </footer>
    </div>
  )
}
