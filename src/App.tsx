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

function useCurrentPathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  useEffect(() => {
    const sync = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  return pathname
}

function App() {
  const { state, dispatch } = useAppState()
  const pathname = useCurrentPathname()
  const [importPreview, setImportPreview] = useState<UserInput | null>(null)
  const [importParseError, setImportParseError] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    const handleImport = () => {
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
    handleImport()
    window.addEventListener('popstate', handleImport)
    return () => window.removeEventListener('popstate', handleImport)
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
      {pathname.endsWith('/privacy') ? (
        <Privacy />
      ) : pathname.endsWith('/content-policy') ? (
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
