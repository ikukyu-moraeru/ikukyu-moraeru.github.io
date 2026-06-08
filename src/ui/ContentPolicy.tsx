import './Privacy.css'

const SERVICE_NAME = '育休もらえる？'
const CONTACT_EMAIL = 'boomerang.cube@gmail.com'

export function ContentPolicy() {
  return (
    <div className="pv-page">
      <header className="pv-header">
        <a className="pv-back" href="/" aria-label="トップに戻る">
          ← トップに戻る
        </a>
        <h1 className="pv-title">コンテンツポリシー</h1>
        <p className="pv-meta">最終更新: 2026年4月27日</p>
      </header>

      <main className="pv-main">
        <section>
          <h2>1. サービス概要</h2>
          <p>
            「{SERVICE_NAME}」は、日本の育児休業給付金（雇用保険）の受給要件をブラウザ上でセルフ判定できる無料ツールです。入力情報はすべてブラウザ内で処理され、外部サーバーには送信されません。
          </p>
        </section>

        <section>
          <h2>2. コンテンツの性質</h2>
          <ul>
            <li>言語：日本語</li>
            <li>カテゴリ：法律・社会保障 / 妊娠・育児 / 行政手続き</li>
            <li>対象読者：日本在住の妊娠中・育休取得予定の方およびその家族</li>
            <li>形式：インタラクティブ判定ツール（フォーム入力 → 結果表示）</li>
          </ul>
        </section>

        <section>
          <h2>3. 掲載しないコンテンツ</h2>
          <p>本サービスは以下のコンテンツを掲載しません。</p>
          <ul>
            <li>アダルト・性的なコンテンツ</li>
            <li>暴力・差別的な表現</li>
            <li>違法行為を助長する情報</li>
            <li>虚偽・誇大な医療・法律情報</li>
            <li>ギャンブル・賭博関連コンテンツ</li>
            <li>政治的な主張・選挙運動</li>
          </ul>
        </section>

        <section>
          <h2>4. 広告について（Google AdSense）</h2>
          <p>
            本サービスは Google AdSense による広告を掲載しています。広告はコンテンツの可読性を妨げない位置に配置し、コンテンツと混同されないよう視覚的に区別します。
          </p>
          <p>
            Google によるパーソナライズ広告を希望されない場合は{' '}
            <a
              href="https://adssettings.google.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google 広告設定
            </a>{' '}
            からオプトアウトできます。
          </p>
        </section>

        <section>
          <h2>5. 参照情報について</h2>
          <p>
            判定ロジックの根拠となる法令・制度情報は、厚生労働省・ハローワークの公的情報に基づいています。最終的な受給可否の判断はハローワーク（公共職業安定所）が行います。本サービスの結果は参考情報であり、その正確性を保証するものではありません。
          </p>
        </section>

        <section>
          <h2>6. お問い合わせ</h2>
          <p>コンテンツに関するご意見・ご質問は下記までご連絡ください。</p>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>
      </main>
    </div>
  )
}
