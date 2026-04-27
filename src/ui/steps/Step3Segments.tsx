import { useAppState } from '../../state/AppState'
import type {
  InsuredEmploymentSegment,
  NonInsuredGap,
} from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import './steps.css'
import './Step2LeavePeriods.css'
import './Step3Segments.css'

const GAP_REASONS: { value: NonInsuredGap['reason']; label: string; emoji: string }[] = [
  { value: '転職の空白', label: '転職の空白', emoji: '🌀' },
  { value: '退職後無職', label: '退職後の無職', emoji: '🍃' },
  { value: '短時間労働で未加入', label: '短時間労働で未加入', emoji: '⏱' },
  { value: 'その他', label: 'その他', emoji: '📌' },
]

function uid(prefix: string) {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function newSegment(): InsuredEmploymentSegment {
  return { id: uid('seg'), start: '', end: null, employerName: '' }
}

function newGap(): NonInsuredGap {
  return {
    id: uid('gap'),
    start: '',
    end: '',
    reason: '転職の空白',
    basicAllowanceClaimed: false,
  }
}

export function Step3Segments() {
  const { state, dispatch } = useAppState()
  const segments = state.input.insuredSegments
  const gaps = state.input.nonInsuredGaps

  const updateSegments = (next: InsuredEmploymentSegment[]) =>
    dispatch({ type: 'PATCH_INPUT', patch: { insuredSegments: next } })
  const patchSegment = (id: string, patch: Partial<InsuredEmploymentSegment>) =>
    updateSegments(segments.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const removeSegment = (id: string) =>
    updateSegments(segments.filter((s) => s.id !== id))

  const updateGaps = (next: NonInsuredGap[]) =>
    dispatch({ type: 'PATCH_INPUT', patch: { nonInsuredGaps: next } })
  const patchGap = (id: string, patch: Partial<NonInsuredGap>) =>
    updateGaps(gaps.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const removeGap = (id: string) =>
    updateGaps(gaps.filter((g) => g.id !== id))

  const ids = [...segments.map((s) => s.id), ...gaps.map((g) => g.id)]

  return (
    <div className="st-section">
      <IssueBanner scopeIds={ids} />
      <p className="st-field__hint">
        雇用保険の<strong>加入していた期間</strong>と
        <strong>加入していなかった期間</strong>を分けて記録します。
        転職の空白は「未加入期間」に。失業給付（基本手当）を一度でも受給資格決定した場合、それ以前の期間は通算外になります。
      </p>

      <section className="sg-section">
        <header className="sg-section__head">
          <span className="sg-section__icon" aria-hidden>
            🏢
          </span>
          <div>
            <h3 className="sg-section__title">雇用保険に加入していた期間</h3>
            <p className="sg-section__sub">在職中の場合は「現在も在職中」にチェック。</p>
          </div>
        </header>

        {segments.length === 0 ? (
          <div className="st-empty lp-empty">
            <span className="st-empty__emoji" aria-hidden>
              📭
            </span>
            まだ登録された加入期間はありません。
          </div>
        ) : (
          <ul className="lp-list">
            {segments.map((s, i) => {
              const isCurrent = i === 0
              return (
                <li key={s.id} className="lp-card">
                  <header className="lp-card__head">
                    <span className="lp-card__index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lp-card__emoji" aria-hidden>
                      🏢
                    </span>
                    <input
                      className="st-input lp-card__type sg-card__name"
                      type="text"
                      placeholder="会社名（任意）"
                      value={s.employerName ?? ''}
                      onChange={(e) =>
                        patchSegment(s.id, { employerName: e.target.value })
                      }
                    />
                    <button
                      className="lp-card__del"
                      onClick={() => removeSegment(s.id)}
                      aria-label={`${i + 1} 番目を削除`}
                    >
                      ✕
                    </button>
                  </header>

                  <div className="st-row st-row--two">
                    <div className="st-field">
                      <label className="st-field__label" htmlFor={`ss-${s.id}`}>
                        入社日
                      </label>
                      <input
                        id={`ss-${s.id}`}
                        type="date"
                        className="st-input"
                        value={s.start}
                        max={s.end ?? undefined}
                        onChange={(e) =>
                          patchSegment(s.id, { start: e.target.value })
                        }
                      />
                    </div>
                    <div className="st-field">
                      <label className="st-field__label" htmlFor={`se-${s.id}`}>
                        退職日
                      </label>
                      <input
                        id={`se-${s.id}`}
                        type="date"
                        className="st-input"
                        value={s.end ?? ''}
                        min={s.start || undefined}
                        disabled={isCurrent && s.end === null}
                        onChange={(e) =>
                          patchSegment(s.id, {
                            end: e.target.value || (isCurrent ? null : ''),
                          })
                        }
                      />
                    </div>
                  </div>

                  {isCurrent && (
                    <label className="lp-toggle">
                      <input
                        type="checkbox"
                        checked={s.end === null}
                        onChange={(e) =>
                          patchSegment(s.id, {
                            end: e.target.checked ? null : '',
                          })
                        }
                      />
                      <span className="lp-toggle__pill" aria-hidden>
                        <span />
                      </span>
                      <span className="lp-toggle__txt">
                        現在も<strong>在職中</strong>
                        <span className="lp-toggle__sub">
                          （育休開始予定日まで継続して被保険者）
                        </span>
                      </span>
                    </label>
                  )}

                  {s.start && s.end && s.end !== null && s.start > s.end && (
                    <div className="lp-warn">
                      入社日が退職日より後になっています。
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <button
          className="st-add"
          onClick={() => updateSegments([...segments, newSegment()])}
        >
          <span aria-hidden>＋</span> 加入期間を追加
        </button>
      </section>

      <hr className="sg-divider" />

      <section className="sg-section">
        <header className="sg-section__head">
          <span className="sg-section__icon sg-section__icon--alt" aria-hidden>
            🌀
          </span>
          <div>
            <h3 className="sg-section__title">雇用保険に加入していなかった期間</h3>
            <p className="sg-section__sub">
              転職の空白・退職後の無職・短時間労働など。
              <strong>失業給付（基本手当）の受給資格決定</strong>
              があれば、それ以前の被保険者期間は通算外になります。
            </p>
          </div>
        </header>

        {gaps.length === 0 ? (
          <div className="st-empty lp-empty">
            <span className="st-empty__emoji" aria-hidden>
              ☁️
            </span>
            未加入期間はありません。
            <br />
            （転職や離職を挟まなかった方は追加不要です）
          </div>
        ) : (
          <ul className="lp-list">
            {gaps.map((g, i) => {
              const opt = GAP_REASONS.find((r) => r.value === g.reason) ?? GAP_REASONS[0]
              return (
                <li key={g.id} className="lp-card">
                  <header className="lp-card__head">
                    <span className="lp-card__index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lp-card__emoji" aria-hidden>
                      {opt.emoji}
                    </span>
                    <select
                      className="st-input lp-card__type"
                      value={g.reason}
                      onChange={(e) =>
                        patchGap(g.id, {
                          reason: e.target.value as NonInsuredGap['reason'],
                        })
                      }
                    >
                      {GAP_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.emoji} {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="lp-card__del"
                      onClick={() => removeGap(g.id)}
                      aria-label={`${i + 1} 番目を削除`}
                    >
                      ✕
                    </button>
                  </header>

                  <div className="st-row st-row--two">
                    <div className="st-field">
                      <label className="st-field__label" htmlFor={`gs-${g.id}`}>
                        開始日
                      </label>
                      <input
                        id={`gs-${g.id}`}
                        type="date"
                        className="st-input"
                        value={g.start}
                        max={g.end || undefined}
                        onChange={(e) =>
                          patchGap(g.id, { start: e.target.value })
                        }
                      />
                    </div>
                    <div className="st-field">
                      <label className="st-field__label" htmlFor={`ge-${g.id}`}>
                        終了日
                      </label>
                      <input
                        id={`ge-${g.id}`}
                        type="date"
                        className="st-input"
                        value={g.end}
                        min={g.start || undefined}
                        onChange={(e) => patchGap(g.id, { end: e.target.value })}
                      />
                    </div>
                  </div>

                  <label className="lp-toggle">
                    <input
                      type="checkbox"
                      checked={g.basicAllowanceClaimed}
                      onChange={(e) =>
                        patchGap(g.id, {
                          basicAllowanceClaimed: e.target.checked,
                        })
                      }
                    />
                    <span className="lp-toggle__pill" aria-hidden>
                      <span />
                    </span>
                    <span className="lp-toggle__txt">
                      この期間に<strong>失業給付の受給資格決定</strong>を受けた
                      <span className="lp-toggle__sub">
                        （ハローワークで受給資格者証が交付された／受給を始めた）
                      </span>
                    </span>
                  </label>

                  {g.basicAllowanceClaimed && (
                    <div className="sg-alert">
                      ⚠ それ以前の被保険者期間は通算対象外になります。
                    </div>
                  )}

                  {g.start && g.end && g.start > g.end && (
                    <div className="lp-warn">
                      開始日が終了日より後になっています。
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <button
          className="st-add sg-add--alt"
          onClick={() => updateGaps([...gaps, newGap()])}
        >
          <span aria-hidden>＋</span> 未加入期間を追加
        </button>
      </section>
    </div>
  )
}
