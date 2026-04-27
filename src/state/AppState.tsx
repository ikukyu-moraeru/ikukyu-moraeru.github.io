import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { UserInput } from '../domain/types'

const STORAGE_KEY = 'maternity-ledger:v1'

export type Screen = 'landing' | 'wizard'

export interface AppState {
  screen: Screen
  currentStep: number // 1..5
  input: UserInput
}

export const emptyInput: UserInput = {
  isMultipleBirth: false,
  scanRange: { start: '', end: '' },
  insuredSegments: [],
  nonInsuredGaps: [],
  leavePeriods: [],
  attendances: [],
}

const initial: AppState = {
  screen: 'landing',
  currentStep: 1,
  input: emptyInput,
}

function loadInitial(): AppState {
  if (typeof window === 'undefined') return initial
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initial
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      screen: parsed.screen ?? 'landing',
      currentStep: parsed.currentStep ?? 1,
      input: { ...emptyInput, ...(parsed.input ?? {}) },
    }
  } catch {
    return initial
  }
}

export type Action =
  | { type: 'GOTO_WIZARD' }
  | { type: 'GOTO_LANDING' }
  | { type: 'SET_STEP'; step: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'PATCH_INPUT'; patch: Partial<UserInput> }
  | { type: 'RESET' }

const clamp = (n: number) => Math.max(1, Math.min(5, n))

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GOTO_WIZARD':
      return { ...state, screen: 'wizard' }
    case 'GOTO_LANDING':
      return { ...state, screen: 'landing' }
    case 'SET_STEP':
      return { ...state, currentStep: clamp(action.step) }
    case 'NEXT_STEP':
      return { ...state, currentStep: clamp(state.currentStep + 1) }
    case 'PREV_STEP':
      return { ...state, currentStep: clamp(state.currentStep - 1) }
    case 'PATCH_INPUT':
      return { ...state, input: { ...state.input, ...action.patch } }
    case 'RESET':
      return initial
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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* quota / privacy mode は黙殺 */
    }
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppState must be used within AppStateProvider')
  return v
}
