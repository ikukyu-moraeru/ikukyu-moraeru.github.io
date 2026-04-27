import { useState } from 'react'
import { useAppState } from '../state/AppState'
import { Step1BasicInfo } from './steps/Step1BasicInfo'
import { Step2LeavePeriods } from './steps/Step2LeavePeriods'
import { Step3Segments } from './steps/Step3Segments'
import { Step4Attendance } from './steps/Step4Attendance'
import { Step5Result } from './steps/Step5Result'
import { ShareModal } from './components/ShareModal'
import './Wizard.css'

interface StepDef {
  num: number
  title: string
  caption: string
  emoji: string
}

const STEPS: StepDef[] = [
  { num: 1, title: '基本情報', caption: 'まず、あなたのこと', emoji: '🤰' },
  { num: 2, title: '休職・休業', caption: '産休・育休・病気休職など', emoji: '🛏' },
  { num: 3, title: '雇用保険', caption: '在職と空白を整理', emoji: '🏢' },
  { num: 4, title: '出勤の記録', caption: '月ごとの働いた日数', emoji: '📔' },
  { num: 5, title: '判定結果', caption: '出産日 × 受給判定', emoji: '✨' },
]

export function Wizard() {
  const { state, dispatch } = useAppState()
  const cur = STEPS.find((s) => s.num === state.currentStep) ?? STEPS[0]
  const [shareOpen, setShareOpen] = useState(false)

  const canProceed = isStepValid(state.currentStep, state.input)
  const isResult = state.currentStep === 5

  return (
    <div className="ht-page">
      <div className="ht-blob ht-blob--1" />
      <div className="ht-blob ht-blob--2" />

      <header className="ht-nav wz-nav">
        <button
          className="wz-back"
          onClick={() => dispatch({ type: 'GOTO_LANDING' })}
        >
          ← 表紙へ
        </button>
        <div className="wz-progress">
          <span className="wz-progress__num">
            {String(state.currentStep).padStart(2, '0')}
          </span>
          <span className="wz-progress__sep">／</span>
          <span className="wz-progress__total">05</span>
        </div>
      </header>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />

      <ol className="wz-stepper" aria-label="ステップ">
        {STEPS.map((s) => {
          const status =
            s.num === state.currentStep
              ? 'current'
              : s.num < state.currentStep
                ? 'done'
                : 'todo'
          return (
            <li key={s.num} className={`wz-step wz-step--${status}`}>
              <button
                onClick={() => dispatch({ type: 'SET_STEP', step: s.num })}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span className="wz-step__bubble">
                  {status === 'done' ? '✓' : s.num}
                </span>
                <span className="wz-step__label">{s.title}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <main className="wz-main">
        <header className="wz-page-head">
          <span className="wz-page-emoji" aria-hidden>
            {cur.emoji}
          </span>
          <div>
            <span className="wz-page-num">Step {cur.num}</span>
            <h1 className="wz-page-title">{cur.title}</h1>
            <p className="wz-page-caption">{cur.caption}</p>
          </div>
          {isResult && (
            <button
              type="button"
              className="wz-page-head__share"
              onClick={() => setShareOpen(true)}
              aria-label="結果をシェア"
            >
              <span aria-hidden>📤</span>
              <span>シェア</span>
            </button>
          )}
        </header>

        <section className="wz-card" key={state.currentStep}>
          {state.currentStep === 1 && <Step1BasicInfo />}
          {state.currentStep === 2 && <Step2LeavePeriods />}
          {state.currentStep === 3 && <Step3Segments />}
          {state.currentStep === 4 && <Step4Attendance />}
          {state.currentStep === 5 && <Step5Result />}
        </section>
      </main>

      <nav className="wz-foot">
        <button
          className="wz-foot__prev"
          onClick={() => dispatch({ type: 'PREV_STEP' })}
          disabled={state.currentStep === 1}
        >
          ← 前のステップ
        </button>
        <span className="wz-foot__hint">
          {state.currentStep < 5
            ? canProceed
              ? '入力できました。次のステップへ進めます。'
              : '必要な項目を入力してください。'
            : '判定結果を確認してください。'}
        </span>
        {state.currentStep < 5 && (
          <button
            className="ht-btn ht-btn--primary wz-foot__next"
            onClick={() => dispatch({ type: 'NEXT_STEP' })}
            disabled={!canProceed}
          >
            <span>次へすすむ</span>
            <span className="wz-foot__arrow">→</span>
          </button>
        )}
      </nav>
    </div>
  )
}

function isStepValid(step: number, input: ReturnType<typeof useAppState>['state']['input']): boolean {
  switch (step) {
    case 1:
      return Boolean(input.scanRange.start && input.scanRange.end)
    case 2:
    case 3:
    case 4:
      return true // 任意ステップ。後で粒度を上げる
    case 5:
      return true
    default:
      return false
  }
}
