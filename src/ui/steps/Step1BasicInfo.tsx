import { useEffect, useState } from 'react'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { useAppState } from '../../state/AppState'
import './steps.css'

const DEFAULT_SPREAD = 14

function isoDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function deriveExpected(scanStart: string, scanEnd: string): string {
  if (!scanStart || !scanEnd) return ''
  try {
    const s = parseISO(scanStart).getTime()
    const e = parseISO(scanEnd).getTime()
    const mid = new Date((s + e) / 2)
    return isoDate(mid)
  } catch {
    return ''
  }
}

function deriveSpread(expected: string, scanStart: string): number {
  if (!expected || !scanStart) return DEFAULT_SPREAD
  try {
    const exp = parseISO(expected).getTime()
    const start = parseISO(scanStart).getTime()
    return Math.round((exp - start) / (24 * 60 * 60 * 1000))
  } catch {
    return DEFAULT_SPREAD
  }
}

export function Step1BasicInfo() {
  const { state, dispatch } = useAppState()
  const initialExpected = deriveExpected(
    state.input.scanRange.start,
    state.input.scanRange.end,
  )
  const initialSpread = deriveSpread(
    initialExpected,
    state.input.scanRange.start,
  )

  const [expected, setExpected] = useState<string>(initialExpected)
  const [spread, setSpread] = useState<number>(initialSpread || DEFAULT_SPREAD)

  // 入力変化を scanRange に反映
  useEffect(() => {
    if (!expected) return
    try {
      const exp = parseISO(expected)
      const start = isoDate(subDays(exp, spread))
      const end = isoDate(addDays(exp, spread))
      if (
        state.input.scanRange.start !== start ||
        state.input.scanRange.end !== end
      ) {
        dispatch({
          type: 'PATCH_INPUT',
          patch: { scanRange: { start, end } },
        })
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expected, spread])

  return (
    <div className="st-section">
      <div className="st-field">
        <label className="st-field__label">
          <span>👶</span> 妊娠の人数
        </label>
        <p className="st-field__hint">
          多胎（双子以上）の場合、産前休業が 42 日 → 98 日に延びます。
        </p>
        <div className="st-radio-group">
          <label
            className="st-radio-card"
            data-selected={!state.input.isMultipleBirth}
          >
            <input
              type="radio"
              name="multi"
              checked={!state.input.isMultipleBirth}
              onChange={() =>
                dispatch({
                  type: 'PATCH_INPUT',
                  patch: { isMultipleBirth: false },
                })
              }
            />
            <span className="st-radio-card__ic" aria-hidden>
              🤰
            </span>
            <span>
              単胎（おひとり）
              <span className="st-radio-card__sub">産前休業 42 日</span>
            </span>
          </label>
          <label
            className="st-radio-card"
            data-selected={state.input.isMultipleBirth}
          >
            <input
              type="radio"
              name="multi"
              checked={state.input.isMultipleBirth}
              onChange={() =>
                dispatch({
                  type: 'PATCH_INPUT',
                  patch: { isMultipleBirth: true },
                })
              }
            />
            <span className="st-radio-card__ic" aria-hidden>
              👯
            </span>
            <span>
              多胎（双子・三つ子など）
              <span className="st-radio-card__sub">産前休業 98 日</span>
            </span>
          </label>
        </div>
      </div>

      <div className="st-field">
        <label className="st-field__label" htmlFor="expectedDate">
          <span>📅</span> 出産予定日
        </label>
        <p className="st-field__hint">
          母子手帳に書かれている予定日を入力してください。
        </p>
        <input
          id="expectedDate"
          className="st-input"
          type="date"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
      </div>

      <div className="st-field">
        <label className="st-field__label" htmlFor="spread">
          <span>🔍</span> 走査する範囲（予定日 ± 何日）
        </label>
        <p className="st-field__hint">
          実際の出産日が予定からずれた場合に備え、この範囲内すべての日について判定します。デフォルトは ± 14 日。
        </p>
        <input
          id="spread"
          className="st-input"
          type="number"
          min={1}
          max={120}
          value={spread}
          onChange={(e) => setSpread(Number(e.target.value) || DEFAULT_SPREAD)}
        />
      </div>

      {expected && (
        <div className="st-summary">
          <span>
            <strong>走査範囲：</strong>
            {state.input.scanRange.start} 〜 {state.input.scanRange.end}
          </span>
          <span>
            <strong>候補日数：</strong>
            {Math.max(0, spread * 2 + 1)} 日
          </span>
        </div>
      )}
    </div>
  )
}
