import { useMemo, useState } from 'react'
import { useAppState } from '../../state/AppState'
import { validateUserInput } from '../../domain/validate'
import './IssueBanner.css'

interface Props {
  /** 表示する issue の itemId 範囲。指定されたらその範囲の itemId を持つもの＋ itemId なしの全体エラーを表示 */
  scopeIds?: string[]
  /** 'all' なら全 issue を表示（Step5 など全体ビュー用） */
  scope?: 'all' | 'scoped'
  className?: string
}

export function IssueBanner({ scopeIds, scope = 'scoped', className }: Props) {
  const { state } = useAppState()
  const issues = useMemo(() => validateUserInput(state.input), [state.input])
  const [open, setOpen] = useState(true)

  const filtered = useMemo(() => {
    if (scope === 'all') return issues
    if (!scopeIds) return issues.filter((i) => !i.itemId)
    const set = new Set(scopeIds)
    return issues.filter((i) => !i.itemId || set.has(i.itemId))
  }, [issues, scopeIds, scope])

  if (filtered.length === 0) return null

  const errors = filtered.filter((i) => i.severity === 'error')
  const warnings = filtered.filter((i) => i.severity === 'warning')

  const tone = errors.length > 0 ? 'error' : 'warning'

  return (
    <aside className={`ib-banner ib-banner--${tone} ${className ?? ''}`}>
      <button
        className="ib-banner__head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="ib-banner__icon" aria-hidden>
          {tone === 'error' ? '⚠️' : 'ℹ️'}
        </span>
        <span className="ib-banner__title">
          {errors.length > 0 && (
            <strong>
              {errors.length} 件の確認が必要
              {warnings.length > 0 && '・'}
            </strong>
          )}
          {warnings.length > 0 && (
            <span className="ib-banner__warn-count">
              {warnings.length} 件の注意
            </span>
          )}
        </span>
        <span className="ib-banner__chev" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <ul className="ib-banner__list">
          {filtered.map((i, idx) => (
            <li
              key={idx}
              className={`ib-issue ib-issue--${i.severity}`}
            >
              <span className="ib-issue__sev">
                {i.severity === 'error' ? 'エラー' : '注意'}
              </span>
              <span className="ib-issue__msg">{i.message}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
