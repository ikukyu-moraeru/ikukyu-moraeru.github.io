import { useEffect, useState } from 'react'
import { Landing } from './ui/Landing'
import { Wizard } from './ui/Wizard'
import { Privacy } from './ui/Privacy'
import { ContentPolicy } from './ui/ContentPolicy'
import { ImportModal } from './ui/components/ImportModal'
import { useAppState } from './state/AppState'
import {
  clearImportFromHash,
  deserializeInput,
  readImportDataFromHash,
} from './state/share'
import type { UserInput } from './domain/types'

function useCurrentPage() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return hash
}

function App() {
  const { state, dispatch } = useAppState()
  const currentPage = useCurrentPage()
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
      {currentPage === '#/privacy' ? (
        <Privacy />
      ) : currentPage === '#/content-policy' ? (
        <ContentPolicy />
      ) : state.screen === 'landing' ? (
        <Landing />
      ) : (
        <Wizard />
      )}
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
