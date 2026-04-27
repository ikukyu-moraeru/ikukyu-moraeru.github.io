import { useEffect, useState } from 'react'
import { Landing } from './ui/Landing'
import { Wizard } from './ui/Wizard'
import { ImportModal } from './ui/components/ImportModal'
import { useAppState } from './state/AppState'
import {
  clearImportFromHash,
  deserializeInput,
  readImportDataFromHash,
} from './state/share'
import type { UserInput } from './domain/types'

function App() {
  const { state, dispatch } = useAppState()
  const [importPreview, setImportPreview] = useState<UserInput | null>(null)
  const [importParseError, setImportParseError] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    const handleHashImport = () => {
      const data = readImportDataFromHash()
      if (!data) return
      const parsed = deserializeInput(data)
      if (parsed) {
        setImportPreview(parsed)
        setImportParseError(false)
      } else {
        setImportPreview(null)
        setImportParseError(true)
      }
      setImportOpen(true)
    }
    handleHashImport()
    window.addEventListener('hashchange', handleHashImport)
    return () => window.removeEventListener('hashchange', handleHashImport)
  }, [])

  const onImportConfirm = () => {
    if (importPreview) {
      dispatch({ type: 'LOAD_INPUT', input: importPreview })
      dispatch({ type: 'GOTO_WIZARD' })
      dispatch({ type: 'SET_STEP', step: 5 })
    }
    clearImportFromHash()
    setImportOpen(false)
  }
  const onImportCancel = () => {
    clearImportFromHash()
    setImportOpen(false)
  }

  return (
    <>
      {state.screen === 'landing' ? <Landing /> : <Wizard />}
      <ImportModal
        open={importOpen}
        preview={importPreview}
        parseError={importParseError}
        onConfirm={onImportConfirm}
        onCancel={onImportCancel}
      />
    </>
  )
}

export default App
