import './App.css'

function App() {
  const today = new Date()
  const issue = `Vol. ${String(today.getFullYear()).slice(-2)} · ${String(
    today.getMonth() + 1,
  ).padStart(2, '0')}`

  return (
    <div className="landing">
      <header className="masthead">
        <div className="left">The Maternity Ledger</div>
        <div className="center">育休給付 · 受給判定</div>
        <div className="right">
          {issue} · 編集部
          <br />
          <span style={{ color: 'var(--vermillion)' }}>NO. 001</span>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="hero__edition">
            <span className="vol">Issue 001 — for working mothers</span>
            <span>—</span>
            <span>厚労省パンフレット 2025-08-01 改訂版 準拠</span>
          </div>

          <h1 className="hero__title">
            出産は<span className="accent">うごく</span>。<br />
            だから受給も、<br />
            ひと目で<span style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif-en)', fontWeight: 500 }}>視る</span>。
          </h1>

          <p className="hero__lede">
            雇用保険の<em>育児休業給付金</em>は、休業開始前 2 年のあいだに「賃金支払基礎日数 11 日以上」の月が 12 か月以上必要——
            けれど、出産日は予定日どおりにはやってこない。本ツールは、ありうる出産日を一日ずつ走査し、
            <em>充足するか／しないか</em>を版面のように一覧化する、編集部発の判定機です。
          </p>

          <div className="cta-row">
            <a className="btn-primary" href="#start">
              判定をはじめる <span className="arrow">→</span>
            </a>
            <a className="btn-ghost" href="#about">
              判定ロジックを読む
            </a>
          </div>

          <div className="features">
            <div>
              <div className="num">i.</div>
              <h4>出産日を走査</h4>
              <p>予定日を中心に前後の候補をすべて判定し、充足する範囲をひと目で可視化します。</p>
            </div>
            <div>
              <div className="num">ii.</div>
              <h4>緩和事由を加味</h4>
              <p>産休・育休・疾病など、賃金未払いだった期間を 2 年に加算（最長 4 年）。</p>
            </div>
            <div>
              <div className="num">iii.</div>
              <h4>転職と通算</h4>
              <p>離職後 1 年以内かつ失業給付未受給なら、前職の被保険者期間を合算します。</p>
            </div>
          </div>
        </div>

        <aside className="hero__sidecard">
          <h3>From the editor</h3>
          <h2>「いつ生まれるか」で<br />受給は変わる。</h2>
          <p>
            出産は人為的に動かせない。けれど、判定は <strong>一日ずれただけ</strong> で結果が変わる。
            だからこそ、ひと目で見渡せる版面が要ります。
          </p>
          <p>
            入力した情報はあなたのブラウザにのみ保存され、サーバへは送信されません。
            最終判定は管轄のハローワークで行われます——本誌は <em>編集部の参考読本</em>。
          </p>
          <footer>
            <span>本ツールについて</span>
            <span>v0.1 · 2026</span>
          </footer>
        </aside>
      </section>

      <footer className="foot">
        <span>© The Maternity Ledger · ローカル動作 · 個人情報は送信しません</span>
        <span className="stamp">参考用</span>
      </footer>
    </div>
  )
}

export default App
