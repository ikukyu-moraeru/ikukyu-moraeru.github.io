import { addDays, format, parseISO } from 'date-fns'
import { useAppState } from '../../state/AppState'
import type { InsuredEmploymentSegment } from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import { DateInput } from '../components/DateInput'
import { deriveExpectedBirthDate } from '../shared/formatUtils'
import './steps.css'
import './Step2LeavePeriods.css'
import './Step3Segments.css'

/** 雇用保険加入期間の現実的下限（運用上の現職実績として 1990 年以前は対象外で十分）。 */
const SEGMENT_MIN = '1990-01-01'

function segmentMax(expected: string): string | undefined {
  if (!expected) return undefined
  const exp = parseISO(expected)
  if (Number.isNaN(exp.getTime())) return undefined
  // 育休開始（出産予定日 + 産後 56 日 + 1 日）以降の入退社は判定に影響しないため、出産予定日 +1 年で十分。
  return format(addDays(exp, 365), 'yyyy-MM-dd')
}

/** 表示用ラベル：会社名は実名を求めず、現職/前職/N つ前 の通称で識別できるようにする。 */
function employerLabel(index: number): string {
  if (index === 0) return '現職'
  if (index === 1) return '前職'
  if (index === 2) return '前々職'
  return `${index} つ前の職場`
}

function uid(prefix: string) {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function newSegment(): InsuredEmploymentSegment {
  return { id: uid('seg'), start: '', end: null, employerName: '' }
}

export function Step3Segments() {
  const { state, dispatch } = useAppState()
  const segments = state.input.insuredSegments
  const segMax = segmentMax(
    deriveExpectedBirthDate(
      state.input.scanRange.start,
      state.input.scanRange.end,
    ),
  )

  const updateSegments = (next: InsuredEmploymentSegment[]) =>
    dispatch({ type: 'PATCH_INPUT', patch: { insuredSegments: next } })
  const patchSegment = (id: string, patch: Partial<InsuredEmploymentSegment>) =>
    updateSegments(segments.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const removeSegment = (id: string) =>
    updateSegments(segments.filter((s) => s.id !== id))

  const ids = segments.map((s) => s.id)

  return (
    <div className="st-section">
      <IssueBanner scopeIds={ids} />
      <p className="st-field__hint">
        雇用保険に加入していた期間（在職した会社）を新しい順に登録してください。
        会社の間に空白期間（無職・短時間労働で未加入など）があった場合も、
        <strong>会社ごとに 1 件ずつ</strong>登録すれば自動で空白として扱われます。
        <br />
        <span className="lp-note">
          ※ 判定上、会社名は不要です。<strong>「現職」「前職」</strong>のままで OK。
          結果を共有するときに個人情報が漏れないよう、実名は入れないことをおすすめします。
        </span>
      </p>

      <section className="sg-section">
        <header className="sg-section__head">
          <span className="sg-section__icon" aria-hidden>
            🏢
          </span>
          <div>
            <h3 className="sg-section__title">雇用保険に加入していた期間</h3>
            <p className="sg-section__sub">
              一番上が現職。複数あれば下に前職を追加してください。
            </p>
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
              const isPrev = !isCurrent
              return (
                <li key={s.id} className="lp-card">
                  <header className="lp-card__head">
                    <span className="lp-card__index">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="lp-card__emoji" aria-hidden>
                      🏢
                    </span>
                    <input
                      className="st-input lp-card__type sg-card__name"
                      type="text"
                      placeholder={employerLabel(i)}
                      aria-label={`${employerLabel(i)}（表示名・任意）`}
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
                      <label
                        className="st-field__label"
                        htmlFor={`ss-${s.id}`}
                      >
                        入社日
                      </label>
                      <DateInput
                        id={`ss-${s.id}`}
                        className="st-input"
                        value={s.start}
                        min={SEGMENT_MIN}
                        max={s.end ?? segMax}
                        onChange={(v) => patchSegment(s.id, { start: v })}
                      />
                    </div>
                    <div className="st-field">
                      <label
                        className="st-field__label"
                        htmlFor={`se-${s.id}`}
                      >
                        退職日
                      </label>
                      <DateInput
                        id={`se-${s.id}`}
                        className="st-input"
                        value={s.end ?? ''}
                        min={s.start || SEGMENT_MIN}
                        max={segMax}
                        disabled={isCurrent && s.end === null}
                        onChange={(v) =>
                          patchSegment(s.id, {
                            end: v || (isCurrent ? null : ''),
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

                  {isPrev && (
                    <>
                      <label className="lp-toggle">
                        <input
                          type="checkbox"
                          checked={s.claimedBasicAllowanceAfterEnd === true}
                          onChange={(e) =>
                            patchSegment(s.id, {
                              claimedBasicAllowanceAfterEnd: e.target.checked,
                            })
                          }
                        />
                        <span className="lp-toggle__pill" aria-hidden>
                          <span />
                        </span>
                        <span className="lp-toggle__txt">
                          この会社の離職後、
                          <strong>失業給付（基本手当）の受給資格決定</strong>を受けた
                          <span className="lp-toggle__sub">
                            ハローワークで <strong>受給資格者証</strong>{' '}
                            が交付された／給付を申請した場合のみチェックしてください。
                          </span>
                        </span>
                      </label>

                      <details className="sg-why">
                        <summary>なぜチェックを入れると通算対象外になるの？／傷病手当との関係</summary>
                        <div className="sg-why__body">
                          <p>
                            雇用保険の被保険者期間は「失業給付（基本手当）」を受給するときに
                            <strong>消費される</strong>仕組みになっています（雇用保険法 14 条 2 項）。
                          </p>
                          <p>
                            一度<strong>受給資格を決定</strong>すると、それ以前の被保険者期間は
                            「使った」扱いになり、その後の他の給付（育休給付金など）の判定には
                            <strong>もう使えません</strong>。
                          </p>
                          <p className="sg-why__note">
                            ※ 実際に給付金を 1 円でも受け取ったかどうかは関係なく、
                            ハローワークで <strong>受給資格者証が交付された時点</strong> で消費されます。
                            何もせず再就職した場合は、このチェックは不要です。
                          </p>
                          <p>
                            <strong>傷病手当（雇用保険）</strong>を離職後に受給した場合も、
                            前提として基本手当の受給資格決定が必要なので、このチェックを入れてください。
                          </p>
                          <p>
                            一方で <strong>傷病手当金（健康保険）</strong>
                            （つわりや病気で在職中に受給）は、雇用保険の被保険者期間とは
                            <strong>無関係</strong>です。Step 2 で「病気・けがの休職」として
                            期間を登録するだけで OK（このチェックは不要）。
                          </p>
                        </div>
                      </details>

                      {s.claimedBasicAllowanceAfterEnd === true && (
                        <div className="sg-alert">
                          ⚠ この会社およびそれ以前の期間は通算対象から外れます。
                        </div>
                      )}
                    </>
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
          <span aria-hidden>＋</span> 加入期間を追加（前職）
        </button>
      </section>
    </div>
  )
}
