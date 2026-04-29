import { useEffect, useRef, useState } from 'react'

interface Props {
  id?: string
  className?: string
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  disabled?: boolean
  /** ブラウザのネイティブ "year > 9999" 入力を抑止するための上限（既定 9999-12-31） */
  hardMax?: string
  'aria-label'?: string
}

const DEFAULT_HARD_MAX = '9999-12-31'

function clamp(v: string, min?: string, max?: string, hardMax?: string): string {
  if (!v) return v
  const upper = max ?? hardMax ?? DEFAULT_HARD_MAX
  if (v > upper) return upper
  if (min && v < min) return min
  return v
}

/**
 * 日付入力の UX を改善するラッパー。
 *
 * - 入力中はローカル state で保持し、blur または有効な YYYY-MM-DD になった瞬間にだけ親へ commit
 *   → 西暦が `0` / `02` / `202` のような中間状態で親 state が書き換わらず、min/max クランプや
 *     派生計算が中途半端な値で走るのを防ぐ。
 * - `min` / `max` を渡すとブラウザのスピナーがその範囲でクランプされる。
 *   さらに blur 時にも JS 側で clamp して、5 桁西暦などの不正値を弾く。
 * - 親が外から value を更新した（保存データのロード等）場合は同期する。
 */
export function DateInput({
  id,
  className,
  value,
  onChange,
  min,
  max,
  disabled,
  hardMax,
  'aria-label': ariaLabel,
}: Props) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  const commit = (next: string) => {
    const clamped = clamp(next, min, max, hardMax)
    setDraft(clamped)
    if (clamped !== value) onChange(clamped)
  }

  return (
    <input
      id={id}
      className={className}
      type="date"
      value={draft}
      min={min}
      max={max ?? hardMax ?? DEFAULT_HARD_MAX}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => {
        const v = e.target.value
        setDraft(v)
        // 完全な YYYY-MM-DD（10 文字）になったら即 commit、それ以外は blur まで保留
        if (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) {
          if (v === '' || (v >= '0001-01-01' && v <= (hardMax ?? DEFAULT_HARD_MAX))) {
            const clamped = clamp(v, min, max, hardMax)
            if (clamped !== value) onChange(clamped)
          }
        }
      }}
      onBlur={() => {
        focused.current = false
        commit(draft)
      }}
    />
  )
}
