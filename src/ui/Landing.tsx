import { useAppState } from '../state/AppState'
import { SAMPLE_HEATMAP } from '../preview/sample'
import { SocialShare } from './components/SocialShare'
import { formatMonths } from './shared/formatUtils'
import './Landing.css'

const SERVICE_NAME = '育休もらえる？'

// トップに出す注目記事。記事を増やしたらここに追記する（一覧は /guide/）。
const FEATURED_GUIDES = [
  {
    href: '/guide/jukyu-youken/',
    title: '育児休業給付金は誰がもらえる？受給要件をやさしく全部',
    desc: 'みなし被保険者期間12か月・最長4年の緩和・前職通算まで、受給要件の全体像をまとめて整理します。',
  },
  {
    href: '/guide/part-time-shift-jitan/',
    title: '週5正社員じゃなくても育休手当はもらえる？',
    desc: 'パート・週3・時短・契約社員でも対象に。「出勤日数」でなく賃金支払基礎日数と80時間ルールで判定します。',
  },
  {
    href: '/guide/kanwa-saichou-4nen/',
    title: '「2年→最長4年」延長の正確な仕組み',
    desc: '「出産前まで一律に遡れる」は誤解。無給で連続30日以上休んだ日数のぶんだけ判定期間が過去へ延びます。',
  },
  {
    href: '/guide/tsuwari-kyuushoku-otoshiana/',
    title: 'つわり・妊娠中の休みが条件を崩す“落とし穴”',
    desc: '無給欠勤は基礎日数に入らず条件を崩すことも。有給の活用や連続30日で味方にする方法を解説します。',
  },
]

export function Landing() {
  const { dispatch } = useAppState()
  return (
    <div className="ht-page">
      <div className="ht-blob ht-blob--1" />
      <div className="ht-blob ht-blob--2" />
      <div className="ht-blob ht-blob--3" />

      <header className="ht-nav">
        <a className="ht-logo" href="/">
          <span className="ht-logo__mark">？</span>
          <span>{SERVICE_NAME}</span>
        </a>
        <nav className="ht-nav__links">
          <a href="/guide/">ガイド</a>
          <a href="/about/">運営者情報</a>
        </nav>
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
              <span className="ht-btn__chip">約10分</span>
            </button>
            <span className="ht-cta__note">
              所要時間は勤務状況によって前後します（不規則な勤務だともう少しかかります）
            </span>
          </div>

          <div className="ht-flow">
            <p className="ht-flow__label">ツールでやること</p>
            <ol className="ht-flow__steps">
              <li>出産予定日と、産休・育休・休職などの期間を入力</li>
              <li>実際に働いた日を月ごとに入力していく</li>
              <li>
                月ごとに条件（11日／80時間）を満たすかが分かり、12か月に届くか・出産日が前後した場合まで判定できます
              </li>
            </ol>
          </div>

          <div className="ht-prep">
            <p className="ht-prep__label">はじめる前に用意するとスムーズなもの</p>
            <ul className="ht-prep__list">
              <li>
                <strong>給与明細・シフト表など</strong>（実際の勤務日数や労働時間が分かるもの）。
                <strong>休業開始前のおよそ2年分</strong>あると安心です（産休などで延びる場合はそれ以上）
              </li>
              <li>
                <strong>休職・休業した期間</strong>（産休・育休・病気休職・つわりでの休みなど）があればその時期
              </li>
              <li>
                <strong>雇用保険の加入期間</strong>（こちらも<strong>休業開始前のおよそ2年分</strong>。転職した方は<strong>前職の在籍期間</strong>も）
              </li>
            </ul>
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
                    予定日
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

          <p className="ht-card__detail-label">
            実際のツールでは、日付ごとに月別の内訳まで確認できます
          </p>
          <div className="ht-detail" aria-hidden="true">
            <div className="ht-detail__head">
              <span className="ht-detail__date">
                9/15 <em>予定日</em>
              </span>
              <span className="ht-detail__badge">✓ 受け取れます</span>
            </div>
            <dl className="ht-detail__meta">
              <div>
                <dt>判定対象期間</dt>
                <dd>休業開始前の2年間（＋緩和）</dd>
              </div>
              <div>
                <dt>緩和加算</dt>
                <dd>98 日</dd>
              </div>
            </dl>
            <span className="ht-detail__subtitle">月別判定（一部）</span>
            <ul className="ht-detail__months">
              <li className="ht-detail__month ht-detail__month--pass">
                <div className="ht-detail__month-top">
                  <span className="ht-detail__no">1か月目</span>
                  <span className="ht-detail__range">2025-09-16 〜 10-15</span>
                  <span className="ht-detail__cnt">+1</span>
                </div>
                <div className="ht-detail__month-bottom">
                  <span className="ht-detail__att">11.0 日 / 88 時間</span>
                  <span className="ht-detail__reason">11日以上</span>
                </div>
              </li>
              <li className="ht-detail__month ht-detail__month--pass">
                <div className="ht-detail__month-top">
                  <span className="ht-detail__no">2か月目</span>
                  <span className="ht-detail__range">2025-08-16 〜 09-15</span>
                  <span className="ht-detail__cnt">+1</span>
                </div>
                <div className="ht-detail__month-bottom">
                  <span className="ht-detail__att">9.0 日 / 84 時間</span>
                  <span className="ht-detail__reason">80時間以上</span>
                </div>
              </li>
              <li className="ht-detail__month ht-detail__month--fail">
                <div className="ht-detail__month-top">
                  <span className="ht-detail__no">3か月目</span>
                  <span className="ht-detail__range">2025-07-16 〜 08-15</span>
                  <span className="ht-detail__cnt">0</span>
                </div>
                <div className="ht-detail__month-bottom">
                  <span className="ht-detail__att">9.0 日 / 58 時間</span>
                  <span className="ht-detail__reason">条件未達</span>
                </div>
              </li>
            </ul>
            <p className="ht-detail__note">※ 表示はイメージです</p>
          </div>
        </aside>
      </main>

      <section className="ht-guide">
        <h2 className="ht-guide__title">育休給付金を知る</h2>
        <p className="ht-guide__sub">
          「自分の場合はもらえる？」が微妙な方へ。受給のしくみをやさしく解説しています。
        </p>
        <div className="ht-guide__grid">
          {FEATURED_GUIDES.map((g) => (
            <a key={g.href} className="ht-guide__card" href={g.href}>
              <h3>{g.title}</h3>
              <p>{g.desc}</p>
            </a>
          ))}
        </div>
        <a className="ht-guide__more" href="/guide/">
          育休給付金ガイドをすべて見る →
        </a>
      </section>

      <section className="ht-story" aria-label="開発のきっかけ">
        <p className="ht-story__eyebrow">開発のきっかけ</p>
        <blockquote className="ht-story__quote">
          妻は正社員の週3勤務で、副業もしていました。いわゆるダブルワークです。
          いざ「育休給付金をもらえるのか」を調べても、当てはまる解説が見つからない。
          しかも細かい条件は、<strong>ハローワークに申請するまで確定しない</strong>。
          その心細さから、自分で一つずつ当てはめて見積もったのが、このサイトの出発点です。
          かつての私たちと同じように不安な方に、申請の前に使ってほしくて作りました。
        </blockquote>
        <div className="ht-story__sign">
          <img
            className="ht-story__avatar"
            src="/author.jpg"
            alt="このサイトを作った なかじ"
            width="48"
            height="48"
            loading="lazy"
          />
          <span className="ht-story__who">
            <span className="ht-story__name">なかじ</span>
            <span className="ht-story__handle">このサイトを作った人 ／ @nkjzm</span>
          </span>
        </div>
        <a className="ht-story__link" href="/guide/naze-tsukutta/">
          このサイトを作った理由を読む →
        </a>
      </section>

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
