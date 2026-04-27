import { useEffect, useState } from 'react'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { useAppState } from '../../state/AppState'
import { computeMaternityTimeline } from '../../domain/maternityTimeline'
import type { LeavePeriod } from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import './steps.css'

export const AUTO_MATERNITY_ID = 'auto:maternity'

function jpDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

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

  // 産前産後休業を Step2 (leavePeriods) に自動シード／追従
  // ユーザーが Step2 で削除した場合 (suppressAutoMaternity=true) は再追加しない。
  useEffect(() => {
    if (!expected) return
    if (state.meta.suppressAutoMaternity) return
    const t = computeMaternityTimeline(expected, state.input.isMultipleBirth)
    if (!t) return
    const desired: LeavePeriod = {
      id: AUTO_MATERNITY_ID,
      type: '産休',
      start: t.prenatalLeaveStart,
      end: t.postnatalLeaveEnd,
      hasWageDuringLeave: false,
    }
    const existing = state.input.leavePeriods.find(
      (p) => p.id === AUTO_MATERNITY_ID,
    )
    if (
      existing &&
      existing.start === desired.start &&
      existing.end === desired.end &&
      existing.type === desired.type &&
      existing.hasWageDuringLeave === desired.hasWageDuringLeave
    ) {
      return
    }
    const others = state.input.leavePeriods.filter(
      (p) => p.id !== AUTO_MATERNITY_ID,
    )
    dispatch({
      type: 'PATCH_INPUT',
      patch: { leavePeriods: [desired, ...others] },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expected, state.input.isMultipleBirth, state.meta.suppressAutoMaternity])

  return (
    <div className="st-section">
      <IssueBanner />
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

      {expected && (
        <ChildCareStartField
          expectedBirthDate={expected}
          isMultipleBirth={state.input.isMultipleBirth}
          customStart={state.input.customChildCareStart}
          onChange={(value) =>
            dispatch({
              type: 'PATCH_INPUT',
              patch: { customChildCareStart: value },
            })
          }
        />
      )}

      <div className="st-field">
        <label className="st-field__label" htmlFor="spread">
          <span>🔍</span> 予定日からのずれ幅（前後 何日まで試算する？）
        </label>
        <p className="st-field__hint">
          実際の出産日は予定日通りとは限らないので、前後何日分まで一緒に試算するかを指定します。
          デフォルトは ± 14 日（前 2 週間〜後 2 週間）。
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
        <>
          <Timeline
            expectedBirthDate={expected}
            isMultipleBirth={state.input.isMultipleBirth}
            suppressed={state.meta.suppressAutoMaternity}
            onRestore={() =>
              dispatch({
                type: 'PATCH_META',
                patch: { suppressAutoMaternity: false },
              })
            }
          />
          <div className="st-summary">
            <span>
              <strong>判定する範囲：</strong>
              {state.input.scanRange.start} 〜 {state.input.scanRange.end}
            </span>
            <span>
              <strong>候補日数：</strong>
              {Math.max(0, spread * 2 + 1)} 日
            </span>
          </div>
        </>
      )}
    </div>
  )
}

interface TimelineProps {
  expectedBirthDate: string
  isMultipleBirth: boolean
  suppressed: boolean
  onRestore: () => void
}

function Timeline({
  expectedBirthDate,
  isMultipleBirth,
  suppressed,
  onRestore,
}: TimelineProps) {
  const t = computeMaternityTimeline(expectedBirthDate, isMultipleBirth)
  if (!t) return null
  const stops = [
    {
      key: 'prenatal',
      ic: '🌸',
      label: '産前休業 開始',
      sub: `予定日 ${t.prenatalDays} 日前（最長）`,
      date: t.prenatalLeaveStart,
    },
    {
      key: 'birth',
      ic: '👶',
      label: '出産（予定日）',
      sub: '実出産日が前後すると以降の日付も自動でずれます',
      date: t.expectedBirthDate,
    },
    {
      key: 'postnatal',
      ic: '🌿',
      label: '産後休業 終了',
      sub: '出産日 + 56 日（労基法 65 条）',
      date: t.postnatalLeaveEnd,
    },
    {
      key: 'childcare',
      ic: '🍼',
      label: '育休開始 ＝ 判定基準日',
      sub: 'この日の前 2 年（緩和で最長 4 年）が判定対象',
      date: t.childCareStart,
      highlight: true as const,
    },
  ]
  return (
    <div className="st-timeline" aria-label="産休・育休スケジュール">
      <div className="st-timeline__head">
        <span className="st-timeline__title">📐 出産予定日から決まる日付</span>
        <span className="st-timeline__hint">
          産前 {t.prenatalDays} 日 ＋ 産後 56 日 → その翌日が「育休開始日」
        </span>
      </div>
      <p className="st-timeline__seed">
        {suppressed ? (
          <>
            <span>
              「産前産後休業」の自動入力は止めています。Step 2
              で個別に登録した内容が優先されます。
            </span>
            <button
              type="button"
              className="st-timeline__seed-restore"
              onClick={onRestore}
            >
              自動入力を再開
            </button>
          </>
        ) : (
          <>
            🍀 上の期間を <strong>Step 2「休職・休業」</strong>{' '}
            に「産休（賃金なし）」として自動登録しました。Step 2
            で削除すれば自動追加は止まります。
          </>
        )}
      </p>
      <ol className="st-timeline__list">
        {stops.map((s) => (
          <li
            key={s.key}
            className={`st-timeline__stop${s.highlight ? ' is-pivot' : ''}`}
          >
            <span className="st-timeline__ic" aria-hidden>
              {s.ic}
            </span>
            <div className="st-timeline__body">
              <span className="st-timeline__label">{s.label}</span>
              <span className="st-timeline__date">{jpDate(s.date)}</span>
              <span className="st-timeline__sub">{s.sub}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface ChildCareStartFieldProps {
  expectedBirthDate: string
  isMultipleBirth: boolean
  customStart: string | undefined
  onChange: (value: string | undefined) => void
}

function ChildCareStartField({
  expectedBirthDate,
  isMultipleBirth,
  customStart,
  onChange,
}: ChildCareStartFieldProps) {
  const t = computeMaternityTimeline(expectedBirthDate, isMultipleBirth)
  const defaultDate = t?.childCareStart ?? ''
  const useCustom = customStart !== undefined
  const earliestPostnatalEnd = t?.postnatalLeaveEnd
    ? format(addDays(parseISO(t.postnatalLeaveEnd), 1), 'yyyy-MM-dd')
    : undefined

  return (
    <div className="st-field">
      <label className="st-field__label">
        <span>🍼</span> 育休開始日
      </label>
      <p className="st-field__hint">
        産後休業の翌日にすぐ取得するなら、自動でかまいません。
        <strong>会社と合意した別の日</strong>から取る場合のみ、日付を指定してください。
      </p>
      <div className="st-radio-group">
        <label className="st-radio-card" data-selected={!useCustom}>
          <input
            type="radio"
            name="ccs"
            checked={!useCustom}
            onChange={() => onChange(undefined)}
          />
          <span className="st-radio-card__ic" aria-hidden>
            🌿
          </span>
          <span>
            産後休業の翌日に取る（自動）
            <span className="st-radio-card__sub">
              {defaultDate ? jpDate(defaultDate) : '出産日 + 産後 56 日 + 1 日'}
            </span>
          </span>
        </label>
        <label className="st-radio-card" data-selected={useCustom}>
          <input
            type="radio"
            name="ccs"
            checked={useCustom}
            onChange={() => onChange(customStart || defaultDate)}
          />
          <span className="st-radio-card__ic" aria-hidden>
            📌
          </span>
          <span>
            別の日から取る
            <span className="st-radio-card__sub">
              産後復職→数か月後に育休、などのケース
            </span>
          </span>
        </label>
      </div>
      {useCustom && (
        <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.4rem' }}>
          <input
            className="st-input"
            type="date"
            value={customStart ?? ''}
            min={earliestPostnatalEnd}
            onChange={(e) => onChange(e.target.value || defaultDate)}
          />
          {customStart && earliestPostnatalEnd && customStart < earliestPostnatalEnd && (
            <div className="lp-warn">
              ⚠ 産後休業（出産日 + 56 日）の翌日より前です。出産日次第では育休開始日が産後休業中になり、整合しません。
            </div>
          )}
        </div>
      )}
    </div>
  )
}
