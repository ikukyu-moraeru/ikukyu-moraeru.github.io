import { addDays, format, parseISO, subDays } from 'date-fns'
import { useAppState } from '../../state/AppState'
import type { LeavePeriod, LeaveType } from '../../domain/types'
import { AUTO_MATERNITY_ID } from './Step1BasicInfo'
import { IssueBanner } from '../components/IssueBanner'
import { DateInput } from '../components/DateInput'
import { deriveExpectedBirthDate } from '../shared/formatUtils'
import './steps.css'
import './Step2LeavePeriods.css'

/**
 * 休業種別ごとの妥当な範囲を出産予定日基準で算出する。
 * 範囲は「明らかに変な日付を弾く」ガードであり、医師判断や会社規定で
 * 実際の取得日が前後してもおかしくない幅を残してある。
 */
function leaveBounds(
  type: LeaveType,
  expected: string,
  isMultipleBirth: boolean,
): { min?: string; max?: string } {
  if (!expected) return {}
  const exp = parseISO(expected)
  if (Number.isNaN(exp.getTime())) return {}
  switch (type) {
    case '産休': {
      // 産前休業は単胎 42 日／多胎 98 日。早めに休業に入る人も想定して +30 日の余裕。
      const prenatalMax = isMultipleBirth ? 98 : 42
      return {
        min: format(subDays(exp, prenatalMax + 30), 'yyyy-MM-dd'),
        max: format(addDays(exp, 90), 'yyyy-MM-dd'),
      }
    }
    case '育休':
      // 出産予定日の 30 日前 〜 子の 2 歳
      return {
        min: format(subDays(exp, 30), 'yyyy-MM-dd'),
        max: format(addDays(exp, 365 * 2), 'yyyy-MM-dd'),
      }
    default:
      // 病気休職/介護等は雇用期間内であれば任意。判定対象期間（最長 4 年）を超える設定は不要。
      return {
        min: format(subDays(exp, 365 * 4 + 200), 'yyyy-MM-dd'),
        max: format(addDays(exp, 365 * 2), 'yyyy-MM-dd'),
      }
  }
}

const LEAVE_OPTIONS: { value: LeaveType; emoji: string; label: string }[] = [
  { value: '産休', emoji: '🤰', label: '産前産後休業（労基法 65 条）' },
  { value: '育休', emoji: '🍼', label: '育児休業' },
  {
    value: '病気休職',
    emoji: '🤒',
    label: '病気・けがの休職（つわり休業含む）',
  },
  { value: '介護休業', emoji: '🧓', label: '介護休業' },
  { value: '事業所休業', emoji: '🏚', label: '事業所の休業' },
  { value: '組合専従', emoji: '✊', label: '組合専従' },
  { value: '配偶者海外同行', emoji: '✈️', label: '配偶者海外同行' },
  { value: 'その他', emoji: '📌', label: 'その他' },
]

function newPeriod(): LeavePeriod {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `lp-${Math.random().toString(36).slice(2)}-${Date.now()}`
  return {
    id,
    type: '産休',
    start: '',
    end: '',
    hasWageDuringLeave: false,
  }
}

export function Step2LeavePeriods() {
  const { state, dispatch } = useAppState()
  const periods = state.input.leavePeriods
  const expectedForBounds = deriveExpectedBirthDate(
    state.input.scanRange.start,
    state.input.scanRange.end,
  )

  const update = (next: LeavePeriod[]) =>
    dispatch({ type: 'PATCH_INPUT', patch: { leavePeriods: next } })

  const add = () => update([...periods, newPeriod()])
  const patch = (id: string, patch: Partial<LeavePeriod>) =>
    update(periods.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const remove = (id: string) => {
    if (id === AUTO_MATERNITY_ID) {
      // 自動シードを意図的に消したと記録 → Step1 が再追加しない
      dispatch({
        type: 'PATCH_META',
        patch: { suppressAutoMaternity: true },
      })
    }
    update(periods.filter((p) => p.id !== id))
  }

  const ids = periods.map((p) => p.id)

  return (
    <div className="st-section">
      <IssueBanner scopeIds={ids} />

      {periods.some((p) => p.id === AUTO_MATERNITY_ID) && (
        <p className="lp-skip-ok">
          ✅ Step 1 の出産予定日から<strong>産前産後休業を自動登録済み</strong>です。
          ほかに心当たりの休職（病気休職・つわりでの休みなど）がなければ、
          <strong>このまま次へ進めます</strong>。
        </p>
      )}

      <p className="st-field__hint" style={{ marginBottom: '0.4rem' }}>
        いままで取得した産休・育休・病気休職などを、思い出せる範囲で登録してください。
      </p>

      <details className="st-more">
        <summary>💡 休職期間を登録すると判定対象が延びる仕組み・給付金の扱い</summary>
        <div className="st-more__body">
          <p>
            育休給付金は <strong>「休業前 2 年で 11 日以上の月が 12 か月」</strong>{' '}
            必要ですが、
            <strong>会社から賃金が出なかった休職期間</strong>
            （産休・育休・病気休職など、連続 30 日以上）の日数分だけ、
            判定対象期間が前にずれて <strong>最長 4 年</strong> まで延びます。
            例：産休 98 日 + 育休 1 年 ＝ 約 463 日が加算 → 過去
            <strong>2 年 + 463 日 ≒ 3 年 3 か月</strong>前まで遡って判定。
          </p>
          <p>
            ※ <strong>出産手当金</strong>（健保）／<strong>育児休業給付金</strong>
            （雇用保険）／<strong>傷病手当金</strong>（健保）は「賃金」ではないため、
            これらだけが支給されている期間は「賃金が支払われた」を{' '}
            <strong>「いいえ」</strong>のままで OK です。
          </p>
          <p>
            ※ <strong>つわり</strong>で休業し傷病手当金を受給した期間は{' '}
            <strong>「病気・けがの休職」</strong>で登録します（産休とは別制度）。
          </p>
        </div>
      </details>

      {periods.length === 0 ? (
        <div className="st-empty lp-empty">
          <span className="st-empty__emoji" aria-hidden>
            🛏
          </span>
          まだ登録された休業期間はありません。
          <br />
          下のボタンで追加できます。
        </div>
      ) : (
        <ul className="lp-list">
          {periods.map((p, i) => {
            const opt =
              LEAVE_OPTIONS.find((o) => o.value === p.type) ?? LEAVE_OPTIONS[0]
            const isAuto = p.id === AUTO_MATERNITY_ID
            const bounds = leaveBounds(
              p.type,
              expectedForBounds,
              state.input.isMultipleBirth,
            )
            return (
              <li
                key={p.id}
                className={`lp-card${isAuto ? ' lp-card--auto' : ''}`}
              >
                <header className="lp-card__head">
                  <span className="lp-card__index">{String(i + 1).padStart(2, '0')}</span>
                  {isAuto && (
                    <span
                      className="lp-card__auto-badge"
                      title="Step1 の出産予定日から自動入力された産前産後休業。Step1 を変更すると追従します。削除すると自動追加は止まります。"
                    >
                      自動入力
                    </span>
                  )}
                  <span className="lp-card__emoji" aria-hidden>
                    {opt.emoji}
                  </span>
                  <select
                    className="st-input lp-card__type"
                    value={p.type}
                    onChange={(e) =>
                      patch(p.id, { type: e.target.value as LeaveType })
                    }
                  >
                    {LEAVE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.emoji} {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="lp-card__del"
                    onClick={() => remove(p.id)}
                    aria-label={`${i + 1} 番目を削除`}
                  >
                    ✕
                  </button>
                </header>

                <div className="st-row st-row--two">
                  <div className="st-field">
                    <label className="st-field__label" htmlFor={`s-${p.id}`}>
                      開始日
                    </label>
                    <DateInput
                      id={`s-${p.id}`}
                      className="st-input"
                      value={p.start}
                      min={bounds.min}
                      max={p.end || bounds.max}
                      onChange={(v) => patch(p.id, { start: v })}
                    />
                  </div>
                  <div className="st-field">
                    <label className="st-field__label" htmlFor={`e-${p.id}`}>
                      終了日
                    </label>
                    <DateInput
                      id={`e-${p.id}`}
                      className="st-input"
                      value={p.end}
                      min={p.start || bounds.min}
                      max={bounds.max}
                      onChange={(v) => patch(p.id, { end: v })}
                    />
                  </div>
                </div>

                <label className="lp-toggle">
                  <input
                    type="checkbox"
                    checked={p.hasWageDuringLeave}
                    onChange={(e) =>
                      patch(p.id, { hasWageDuringLeave: e.target.checked })
                    }
                  />
                  <span className="lp-toggle__pill" aria-hidden>
                    <span />
                  </span>
                  <span className="lp-toggle__txt">
                    この期間中、<strong>会社から賃金（給与）が支払われた</strong>
                    <span className="lp-toggle__sub">
                      会社規定で休業中も給与が支給される場合のみ「はい」。
                      出産手当金・育休給付金・傷病手当金だけが支給されている場合は「いいえ」のままで大丈夫です。
                    </span>
                  </span>
                </label>

                {p.start && p.end && p.start > p.end && (
                  <div className="lp-warn">
                    開始日が終了日より後になっています。
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <button className="st-add" onClick={add}>
        <span aria-hidden>＋</span> 休業期間を追加
      </button>
    </div>
  )
}
