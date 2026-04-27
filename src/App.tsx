import { Landing } from './ui/Landing'
import { Wizard } from './ui/Wizard'
import { useAppState } from './state/AppState'

function App() {
  const { state } = useAppState()
  return state.screen === 'landing' ? <Landing /> : <Wizard />
}

export default App
