import './Privacy.css'

const SERVICE_NAME = '育休もらえる？'
const CONTACT_EMAIL = 'boomerang.cube@gmail.com'

export function Privacy() {
  return (
    <div className="pv-page">
      <header className="pv-header">
        <a className="pv-back" href="#/" aria-label="トップに戻る">
          ← トップに戻る
        </a>
        <h1 className="pv-title">プライバシーポリシー</h1>
        <p className="pv-meta">最終更新: 2026年4月27日</p>
      </header>

      <main className="pv-main">
        <section>
          <h2>1. 基本方針</h2>
          <p>
            本サービス「{SERVICE_NAME}」（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報を適切に取り扱います。
          </p>
        </section>

        <section>
          <h2>2. データの収集と利用</h2>
          <p>
            本サービスへの入力情報（出産予定日・雇用情報・出勤実績など）は、お使いのブラウザ内のみで処理され、外部サーバーには送信されません。
          </p>
          <ul>
            <li>入力データはブラウザの localStorage に保存されます。</li>
            <li>
              「入力データ付き URL」でシェアした場合は、URL 文字列に入力内容が含まれます。シェア先の相手のみが閲覧できます。
            </li>
          </ul>
        </section>

        <section>
          <h2>3. 広告について（Google AdSense）</h2>
          <p>
            本サービスでは、Google の広告配信サービス「Google AdSense」を利用しています。Google は Cookie を使用してユーザーに関連性の高い広告を表示します。
          </p>
          <ul>
            <li>
              Google の Cookie の利用により、ユーザーが本サービスや他のサイトを訪問した際の情報を基に広告が表示されます。
            </li>
            <li>
              広告のパーソナライズを無効化したい場合は{' '}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google 広告設定
              </a>{' '}
              からオプトアウトできます。
            </li>
            <li>
              詳細は{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google プライバシーポリシー
              </a>{' '}
              をご覧ください。
            </li>
          </ul>
        </section>

        <section>
          <h2>4. アクセス解析</h2>
          <p>
            現時点では、サードパーティのアクセス解析ツールは導入していません。
          </p>
        </section>

        <section>
          <h2>5. Cookie について</h2>
          <p>
            本サービス自体は Cookie を直接利用しません。ただし、Google AdSense が広告配信のために Cookie を利用することがあります。
          </p>
        </section>

        <section>
          <h2>6. お問い合わせ</h2>
          <p>
            本プライバシーポリシーに関するお問い合わせは下記までご連絡ください。
          </p>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>
      </main>
    </div>
  )
}
