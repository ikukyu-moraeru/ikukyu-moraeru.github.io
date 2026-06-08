import { useAppState } from '../state/AppState'
import { SAMPLE_HEATMAP } from '../preview/sample'
import { SocialShare } from './components/SocialShare'
import { AdSlot } from './components/AdSlot'
import { formatMonths } from './shared/formatUtils'
import './Landing.css'

const SERVICE_NAME = '育休もらえる？'

export function Landing() {
  const { dispatch } = useAppState()
  return (
    <div className="ht-page">
      <div className="ht-blob ht-blob--1" />
      <div className="ht-blob ht-blob--2" />
      <div className="ht-blob ht-blob--3" />

      <header className="ht-nav">
        <div className="ht-logo">
          <span className="ht-logo__mark">？</span>
          <span>{SERVICE_NAME}</span>
        </div>
        <span className="ht-nav__sub">
          育休給付金の受給判定 — ブラウザで完結
        </span>
      </header>

      <main className="ht-main">
        <div className="ht-hero">
          <span className="ht-pill">
            転職・休職・シフト制で、ぎりぎりかもしれない方へ
          </span>

          <h1 className="ht-h1">
            <span className="ht-h1__line">出産日がずれても、</span>
            <span className="ht-h1__line ht-h1__accent">受け取れるか。</span>
          </h1>

          <p className="ht-lede">
            雇用保険の育児休業給付金は、休業前 2 年で
            <strong>「11 日以上 働いた月」が 12 か月以上</strong>{' '}
            必要です。微妙な人ほど、自分の場合に当てはめないと判断できません。
            このツールは、出産日のぶれや産休・育休・転職を全部考慮して、
            <strong>あなたの場合に受け取れるか</strong>を判定します。
          </p>

          <div className="ht-cta">
            <button
              className="ht-btn ht-btn--primary"
              onClick={() => dispatch({ type: 'GOTO_WIZARD' })}
            >
              <span>あなたの場合を判定する</span>
              <span className="ht-btn__chip">3 分</span>
            </button>
          </div>

          <div className="ht-target">
            <p className="ht-target__label">こんな方の自己診断に</p>
            <ul className="ht-target__list">
              <li>
                <span aria-hidden>🌀</span>
                <span>出産前に <strong>転職</strong> を経験した（前職と通算できる？）</span>
              </li>
              <li>
                <span aria-hidden>⏱</span>
                <span><strong>パート・シフト制</strong> で月の出勤日数が 11 日に届かない月がある</span>
              </li>
              <li>
                <span aria-hidden>🤒</span>
                <span><strong>つわり・病気休職</strong> で休んだ期間がある</span>
              </li>
              <li>
                <span aria-hidden>🍃</span>
                <span>出産前に <strong>退職・無職期間</strong> がある</span>
              </li>
              <li>
                <span aria-hidden>📅</span>
                <span><strong>出産予定日がぎりぎり</strong> で「あと数日生まれが遅かったら…」が不安</span>
              </li>
              <li>
                <span aria-hidden>💼</span>
                <span>ハローワーク・社労士に相談する前に <strong>自己診断したい</strong></span>
              </li>
            </ul>
          </div>

          <ul className="ht-points">
            <li>
              <span className="ht-points__ic">📅</span>
              <strong>出産日のぶれを考慮</strong>
              予定日 ± 任意日数を 1 日ずつ判定
            </li>
            <li>
              <span className="ht-points__ic">📒</span>
              <strong>制度をまるごと反映</strong>
              緩和（最長 4 年）／前職通算／80 時間ルールも自動計算
            </li>
            <li>
              <span className="ht-points__ic">🔒</span>
              <strong>送信しません</strong>
              すべてブラウザで完結。データは端末から外に出ません
            </li>
          </ul>
        </div>

        <aside className="ht-card">
          <div className="ht-card__head">
            <span className="ht-card__tag">こんな結果が出ます</span>
            <h3>出産日ごとに「もらえる？」</h3>
            <p>
              予定日の周辺で「実際にいつ生まれたら」を 1 日ずつ判定し、
              受け取れる日／届かない日を色で見せます。
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
                  {formatMonths(c.countedMonths)}
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

      <AdSlot slot="6704104793" className="ht-ad" />

      <section className="ht-share">
        <h2 className="ht-share__title">妊娠中のお友だちにも、おしえる</h2>
        <p className="ht-share__sub">
          受給できるか不安な人ほど、調べる前に時間が過ぎてしまいがち。
          ブラウザだけで動くので、気軽に試してもらえます。
        </p>
        <SocialShare
          variant="inline"
          label="シェア"
          text={`育休給付金、転職や時短があっても自分はもらえる？を 1 日ごとに判定できるツール。ブラウザだけで完結します。 #育休もらえる`}
        />
      </section>

      <footer className="ht-foot">
        <p>
          ※ 本ツールは参考用です。最終判定は管轄のハローワーク（公共職業安定所）で行われます。
        </p>
        <p className="ht-foot__sub">
          <a className="ht-foot__link" href="/guide/">育休給付金ガイド</a>
          {' · '}
          <a className="ht-foot__link" href="/about/">運営者情報</a>
          {' · '}
          <a className="ht-foot__link" href="/contact/">お問い合わせ</a>
        </p>
        <p className="ht-foot__sub">
          © 2026 {SERVICE_NAME} · ローカル動作 · 個人情報は送信しません
          {' · '}
          <a className="ht-foot__link" href="/privacy">プライバシーポリシー</a>
          {' · '}
          <a className="ht-foot__link" href="/content-policy">コンテンツポリシー</a>
        </p>
      </footer>
    </div>
  )
}
