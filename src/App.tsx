import './App.css'

function App() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>育児休業給付金 支給要件判定</h1>
      <p>
        本アプリは、雇用保険の育児休業給付金における「みなし被保険者期間 12 か月」の充足を判定するためのツールです。
      </p>
      <p style={{ color: '#888' }}>
        UI は順次実装予定。判定ロジックは <code>src/domain/</code> に実装済み。
      </p>
    </main>
  )
}

export default App
