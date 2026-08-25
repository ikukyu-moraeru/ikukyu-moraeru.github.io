import { useAppState } from '../state/AppState'
import { SAMPLE_HEATMAP } from '../preview/sample'
import { AmazonProductLinks } from './components/AmazonProductLinks'
import { formatMonths } from './shared/formatUtils'
import './Landing.css'

const SERVICE_NAME = '育休もらえる？'
const FEATURED_GUIDES = [
  { href: '/guide/jukyu-youken/', emoji: '📘', title: '育児休業給付金は誰がもらえる？受給要件をやさしく全部', desc: '12か月要件・最長4年の緩和・前職通算まで、受給要件の全体像を整理します。' },
  { href: '/guide/tenshoku-tsuusan/', emoji: '🔗', title: '転職しても前職の雇用保険は通算できる', desc: '前職分を足せる条件と、失業給付の手続きによるリセット条件を解説します。' },
  { href: '/guide/part-time-shift-jitan/', emoji: '🕒', title: '週5正社員じゃなくても育休手当はもらえる？', desc: 'パート・週3・時短・契約社員にも関わる、11日・80時間ルールを整理します。' },
]

export function Landing() {
  const { dispatch } = useAppState()
  return (
    <div className="ht-page">
      <div className="ht-blob ht-blob--1" /><div className="ht-blob ht-blob--2" /><div className="ht-blob ht-blob--3" />
      <header className="ht-nav">
        <a className="ht-logo" href="/"><img className="ht-logo__mark" src="/icon.png" alt="" width={32} height={32} /><span>{SERVICE_NAME}</span></a>
        <nav className="ht-nav__links"><a href="/guide/">ガイド</a><a href="/about/">運営者情報</a></nav>
      </header>

      <main className="ht-main">
        <div className="ht-hero">
          <span className="ht-pill">転職・休職・シフト制で、ぎりぎりかもしれない方へ</span>
          <h1 className="ht-h1"><span className="ht-h1__line">出産日がずれても、</span><span className="ht-h1__line ht-h1__accent">受け取れるか。</span></h1>
          <p className="ht-lede">産休・育休・転職も考慮して、予定日の前後を1日ずつ判定。<strong>どの日に生まれたら受け取れるか</strong>を可視化します。</p>
          <div className="ht-cta"><button className="ht-btn ht-btn--primary" onClick={() => dispatch({ type: 'GOTO_WIZARD' })}><span>あなたの場合を判定する</span><span className="ht-btn__chip">約10分</span></button></div>
        </div>

        <aside className="ht-card">
          <div className="ht-card__head"><span className="ht-card__tag">こんな結果が出ます</span><h2>出産日ごとに「もらえる？」</h2><p>予定日の周辺を1日ずつ、色で分かりやすく表示します。</p></div>
          <div className="ht-grid">{SAMPLE_HEATMAP.map((cell) => <div key={cell.index} className={`ht-bubble ht-bubble--${cell.status}${cell.isExpected ? ' is-expected' : ''}`}>{cell.isExpected && <span className="ht-bubble__pin" aria-label="出産予定日">予定日</span>}<span className="ht-bubble__date">{cell.label}</span><span className="ht-bubble__num">{formatMonths(cell.countedMonths)}</span></div>)}</div>
          <div className="ht-card__legend"><span className="ht-leg ht-leg--pass">受け取れる</span><span className="ht-leg ht-leg--near">あと少し届かない</span><span className="ht-leg ht-leg--fail">受け取れない</span></div>
          <p className="ht-card__note">※ 表示はイメージです</p>
        </aside>

        <section className="ht-start" aria-label="判定を始める前に">
          <div className="ht-prep"><h2 className="ht-start__title">用意するもの</h2><ul className="ht-prep__list"><li>給与明細・シフト表などの勤務記録</li><li>産休・育休・休職などの期間</li><li>雇用保険の加入期間（転職した方は前職分も）</li></ul></div>
          <div className="ht-flow"><h2 className="ht-start__title">ツールでやること</h2><ol className="ht-flow__steps"><li>出産予定日と休業期間を入力</li><li>月ごとの勤務日数・時間を入力</li><li>出産日ごとの受給見込みを確認</li></ol></div>
          <p className="ht-start__note">2026年4月時点の制度に基づき、入力と判定はすべてブラウザ内で完結します。</p>
        </section>
      </main>

      <section className="ht-guide">
        <h2 className="ht-guide__title">迷っている点から確認する</h2><p className="ht-guide__sub">気になる条件だけ、詳しく確認できます。</p>
        <div className="ht-guide__grid">{FEATURED_GUIDES.map((guide) => <a key={guide.href} className="ht-guide__card" href={guide.href}><span className="ht-guide__emoji" aria-hidden>{guide.emoji}</span><span className="ht-guide__body"><h3>{guide.title}</h3><p>{guide.desc}</p></span></a>)}</div>
        <a className="ht-guide__more" href="/guide/">育休給付金ガイドをすべて見る →</a>
      </section>

      <section className="ht-story" aria-label="開発のきっかけ">
        <p className="ht-story__eyebrow">開発のきっかけ</p><blockquote className="ht-story__quote">妻は正社員の週3勤務で、副業もしていました。当てはまる解説が見つからず、自分で条件を一つずつ見積もった経験から、このツールを作りました。</blockquote>
        <div className="ht-story__sign"><img className="ht-story__avatar" src="/author.jpg" alt="このサイトを作った なかじ" width="48" height="48" loading="lazy" /><span className="ht-story__who"><span className="ht-story__name">なかじ</span><span className="ht-story__handle">このサイトを作った人 ／ @nkjzm</span></span></div>
        <a className="ht-story__link" href="/guide/naze-tsukutta/">このサイトを作った理由を読む →</a>
      </section>

      <AmazonProductLinks />
      <footer className="ht-foot">
        <p>※ 本ツールは参考用です。最終判定は管轄のハローワーク（公共職業安定所）で行われます。</p>
        <p className="ht-foot__sub"><a className="ht-foot__link" href="/guide/">育休給付金ガイド</a>{' · '}<a className="ht-foot__link" href="/about/">運営者情報</a>{' · '}<a className="ht-foot__link" href="/contact/">お問い合わせ</a></p>
        <p className="ht-foot__sub">© 2026 {SERVICE_NAME} · ローカル動作 · 個人情報は送信しません{' · '}<a className="ht-foot__link" href="/privacy">プライバシーポリシー</a>{' · '}<a className="ht-foot__link" href="/content-policy">コンテンツポリシー</a></p>
      </footer>
    </div>
  )
}
