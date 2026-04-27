import { useAppState } from '../state/AppState'
import { SAMPLE_HEATMAP } from '../preview/sample'
import { SocialShare } from './components/SocialShare'
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
        <span className="ht-nav__sub">育休給付の受給判定 — ローカル動作</span>
      </header>

      <main className="ht-main">
        <div className="ht-hero">
          <span className="ht-pill">育休給付の受給判定 · 2026 年版</span>

          <h1 className="ht-h1">
            <span className="ht-h1__line">出産日がずれても、</span>
            <span className="ht-h1__line ht-h1__accent">受け取れるか。</span>
          </h1>

          <p className="ht-lede">
            育児休業給付金を受け取るには、休業前 2 年で
            <strong>「11 日以上 働いた月」が 12 か月以上</strong>{' '}
            あること。出産日が動くと結果も変わるので、
            <strong>あり得る日付すべてをまとめて判定</strong>します。
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
              <span className="ht-points__ic">📅</span>
              <strong>出産日のゆらぎを考慮</strong>
              予定日 ± 14 日を 1 日ずつ判定
            </li>
            <li>
              <span className="ht-points__ic">📒</span>
              <strong>制度を反映</strong>
              緩和事由（最長 4 年）・前職通算もまるごと自動計算
            </li>
            <li>
              <span className="ht-points__ic">🔒</span>
              <strong>送信しません</strong>
              すべてブラウザの中で完結。データは端末に残るだけ
            </li>
          </ul>
        </div>

        <aside className="ht-card">
          <div className="ht-card__head">
            <span className="ht-card__tag">サンプル</span>
            <h3>出産日ごとの結果</h3>
            <p>
              予定日の前後 1 か月分を 1 日ずつ判定し、
              受け取れる日／届かない日を色で見せます。数字は積み上がった月数です。
            </p>
          </div>

          <div className="ht-grid">
            {SAMPLE_HEATMAP.map((c) => (
              <div
                key={c.index}
                className={`ht-bubble ht-bubble--${c.status}${c.isExpected ? ' is-expected' : ''}`}
              >
                {c.isExpected && (
                  <span className="ht-bubble__pin" aria-label="出産予定日">
                    予
                  </span>
                )}
                <span className="ht-bubble__date">{c.label}</span>
                <span className="ht-bubble__num">
                  {c.countedMonths.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          <div className="ht-card__legend">
            <span className="ht-leg ht-leg--pass">受け取れる</span>
            <span className="ht-leg ht-leg--near">あと少し届かない</span>
            <span className="ht-leg ht-leg--fail">受け取れない</span>
          </div>
        </aside>
      </main>

      <section className="ht-share">
        <h2 className="ht-share__title">妊娠中の友だちにも、おしえる</h2>
        <p className="ht-share__sub">
          受給できるか不安な人ほど、調べる前に時間が過ぎてしまいがち。
          ブラウザだけで動くので気軽に試せます。
        </p>
        <SocialShare
          variant="inline"
          label="シェア"
          text={
            '出産日がずれても、育休給付金を受け取れるかを 1 日ごとに判定するツールを見つけたよ。ブラウザの中で完結するみたい。 #マタニティ手帖'
          }
        />
      </section>

      <footer className="ht-foot">
        <p>※ 本ツールは参考用です。最終判定は管轄のハローワークで行われます。</p>
        <p className="ht-foot__sub">© 2026 マタニティ手帖 · ローカル動作</p>
      </footer>
    </div>
  )
}
