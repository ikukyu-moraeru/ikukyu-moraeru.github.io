import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { UserInput } from '../domain/types'

const STORAGE_KEY = 'maternity-ledger:v1'

export type Screen = 'landing' | 'wizard'

export interface AppMeta {
  /**
   * Step1 から「産前産後休業」を leavePeriods に自動シードする機能を、
   * ユーザーが Step2 で削除したことで明示的に止めた状態。
   * true の間は Step1 が再追加しない。
   */
  suppressAutoMaternity: boolean
}

export interface AppState {
  screen: Screen
  currentStep: number // 1..5
  input: UserInput
  meta: AppMeta
}

const emptyMeta: AppMeta = {
  suppressAutoMaternity: false,
}

export const emptyInput: UserInput = {
  isMultipleBirth: false,
  scanRange: { start: '', end: '' },
  insuredSegments: [],
  leavePeriods: [],
  attendances: [],
}

const clamp = (n: number) => Math.max(1, Math.min(5, n))

/* ---------------- routing helpers (hash-based) ----------------------- */

const BASE = '/MaternityLeaveCalculator'

function pathFromState(s: { screen: Screen; currentStep: number }): string {
  if (s.screen === 'landing') return `${BASE}/`
  return s.currentStep === 1 ? `${BASE}/start` : `${BASE}/start/${s.currentStep}`
}

function stateFromPathname(pathname: string): { screen: Screen; currentStep: number } {
  const path = pathname.replace(BASE, '') || '/'
  if (path === '' || path === '/') return { screen: 'landing', currentStep: 1 }
  const m = path.match(/^\/start(?:\/(\d+))?\/?$/)
  if (m) {
    const step = m[1] ? clamp(parseInt(m[1], 10)) : 1
    return { screen: 'wizard', currentStep: step }
  }
  return { screen: 'landing', currentStep: 1 }
}

function readCurrentPathState(): { screen: Screen; currentStep: number } {
  if (typeof window === 'undefined')
    return { screen: 'landing', currentStep: 1 }
  return stateFromPathname(window.location.pathname)
}

function navigateTo(
  next: { screen: Screen; currentStep: number },
  mode: 'push' | 'replace' = 'push',
) {
  if (typeof window === 'undefined') return
  const target = pathFromState(next)
  const cur = window.location.pathname
  if (cur === target) return
  if (mode === 'replace') {
    window.history.replaceState(null, '', target)
  } else {
    window.history.pushState(null, '', target)
  }
}

/* ---------------- state ---------------------------------------------- */

const initial: AppState = {
  screen: 'landing',
  currentStep: 1,
  input: emptyInput,
  meta: emptyMeta,
}

function loadInitial(): AppState {
  if (typeof window === 'undefined') return initial
  let inputFromStorage: UserInput = emptyInput
  let metaFromStorage: AppMeta = emptyMeta
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as {
        input?: Partial<UserInput>
        meta?: Partial<AppMeta>
      }
      const candidate = { ...emptyInput, ...(parsed.input ?? {}) }
      // 旧形式 (MonthlyAttendance with monthKey) は破棄
      if (Array.isArray(candidate.attendances)) {
        candidate.attendances = candidate.attendances.filter(
          (a: unknown): a is UserInput['attendances'][number] => {
            if (!a || typeof a !== 'object') return false
            const obj = a as Record<string, unknown>
            return typeof obj.date === 'string' && typeof obj.status === 'string'
          },
        )
      }
      inputFromStorage = candidate
      metaFromStorage = { ...emptyMeta, ...(parsed.meta ?? {}) }
    }
  } catch {
    /* ignore */
  }
  const fromPath = readCurrentPathState()
  return { ...fromPath, input: inputFromStorage, meta: metaFromStorage }
}

export type Action =
  | { type: 'GOTO_WIZARD' }
  | { type: 'GOTO_LANDING' }
  | { type: 'SET_STEP'; step: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SYNC_FROM_HASH'; screen: Screen; currentStep: number }
  | { type: 'PATCH_INPUT'; patch: Partial<UserInput> }
  | { type: 'PATCH_META'; patch: Partial<AppMeta> }
  | { type: 'LOAD_INPUT'; input: UserInput }
  | { type: 'RESET' }

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GOTO_WIZARD':
      return { ...state, screen: 'wizard' }
    case 'GOTO_LANDING':
      return { ...state, screen: 'landing' }
    case 'SET_STEP':
      return { ...state, screen: 'wizard', currentStep: clamp(action.step) }
    case 'NEXT_STEP':
      return { ...state, currentStep: clamp(state.currentStep + 1) }
    case 'PREV_STEP':
      return { ...state, currentStep: clamp(state.currentStep - 1) }
    case 'SYNC_FROM_HASH':
      return {
        ...state,
        screen: action.screen,
        currentStep: action.currentStep,
      }
    case 'PATCH_INPUT':
      return { ...state, input: { ...state.input, ...action.patch } }
    case 'PATCH_META':
      return { ...state, meta: { ...state.meta, ...action.patch } }
    case 'LOAD_INPUT':
      return { ...state, input: { ...emptyInput, ...action.input } }
    case 'RESET':
      return {
        screen: 'landing',
        currentStep: 1,
        input: emptyInput,
        meta: emptyMeta,
      }
    default:
      return state
  }
}

interface CtxValue {
  state: AppState
  dispatch: Dispatch<Action>
}

const Ctx = createContext<CtxValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial)

  // 初回マウントで URL を state に揃える（hash が空のままの場合に備えて replace）
  useEffect(() => {
    navigateTo({ screen: state.screen, currentStep: state.currentStep }, 'replace')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // state → URL（履歴に積む）
  useEffect(() => {
    navigateTo({ screen: state.screen, currentStep: state.currentStep }, 'push')
  }, [state.screen, state.currentStep])

  // URL → state（戻る/進む、リンク踏み替え）
  useEffect(() => {
    const sync = () => {
      const next = readCurrentPathState()
      dispatch({
        type: 'SYNC_FROM_HASH',
        screen: next.screen,
        currentStep: next.currentStep,
      })
    }
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('popstate', sync)
    }
  }, [])

  // 入力値・メタを localStorage に永続化（画面位置は URL を真実とする）
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ input: state.input, meta: state.meta }),
      )
    } catch {
      /* ignore */
    }
  }, [state.input, state.meta])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppState must be used within AppStateProvider')
  return v
}
