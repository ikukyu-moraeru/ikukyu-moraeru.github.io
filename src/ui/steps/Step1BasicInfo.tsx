import { useEffect, useState } from 'react'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { useAppState } from '../../state/AppState'
import { computeMaternityTimeline } from '../../domain/maternityTimeline'
import type { LeavePeriod } from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import { DateInput } from '../components/DateInput'
import { jpDate, deriveExpectedBirthDate } from '../shared/formatUtils'
import './steps.css'

export const AUTO_MATERNITY_ID = 'auto:maternity'

const DEFAULT_SPREAD = 14

/** 出産予定日として現実的な範囲（過去 2 年〜未来 1 年） */
function expectedBirthDateBounds(): { min: string; max: string } {
  const today = new Date()
  return {
    min: format(subDays(today, 365 * 2), 'yyyy-MM-dd'),
    max: format(addDays(today, 365), 'yyyy-MM-dd'),
  }
}

function isoDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
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
  const initialExpected = deriveExpectedBirthDate(
    state.input.scanRange.start,
    state.input.scanRange.end,
  )
  const initialSpread = deriveSpread(
    initialExpected,
    state.input.scanRange.start,
  )

  const [expected, setExpected] = useState<string>(initialExpected)
  // 予定日前後の試算幅。Step5 のドロップダウンで変更でき、ここでは
  // 既存の scanRange から引き継ぐ（初回は DEFAULT_SPREAD）。
  const [spread] = useState<number>(initialSpread || DEFAULT_SPREAD)
  // 詳細設定にデフォルト以外の値が入っているときは展開した状態で表示する
  const [advancedOpen] = useState<boolean>(
    () =>
      state.input.isMultipleBirth ||
      state.input.customChildCareStart !== undefined ||
      state.input.customMaternityStart !== undefined ||
      state.input.customMaternityEnd !== undefined,
  )

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
    const t = computeMaternityTimeline(expected, state.input.isMultipleBirth, {
      maternityStart: state.input.customMaternityStart,
      maternityEnd: state.input.customMaternityEnd,
    })
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
  }, [
    expected,
    state.input.isMultipleBirth,
    state.input.customMaternityStart,
    state.input.customMaternityEnd,
    state.meta.suppressAutoMaternity,
  ])

  return (
    <div className="st-section">
      <IssueBanner />
      <div className="st-field">
        <label className="st-field__label" htmlFor="expectedDate">
          <span>📅</span> 出産予定日
        </label>
        <p className="st-field__hint">
          母子手帳に書かれている予定日を入力してください。
        </p>
        <DateInput
          id="expectedDate"
          className="st-input"
          value={expected}
          onChange={setExpected}
          min={expectedBirthDateBounds().min}
          max={expectedBirthDateBounds().max}
        />
      </div>

      <details className="st-more" open={advancedOpen}>
        <summary>
          ⚙️ 詳細設定 — 双子以上の妊娠・産休/育休の日付を指定する場合
        </summary>
        <div className="st-more__body">
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

      {expected && (
        <MaternityPeriodField
          expectedBirthDate={expected}
          isMultipleBirth={state.input.isMultipleBirth}
          customStart={state.input.customMaternityStart}
          customEnd={state.input.customMaternityEnd}
          onChange={(maternityStart, maternityEnd) =>
            dispatch({
              type: 'PATCH_INPUT',
              patch: {
                customMaternityStart: maternityStart,
                customMaternityEnd: maternityEnd,
              },
            })
          }
        />
      )}

      {expected && (
        <ChildCareStartField
          expectedBirthDate={expected}
          isMultipleBirth={state.input.isMultipleBirth}
          customMaternityStart={state.input.customMaternityStart}
          customMaternityEnd={state.input.customMaternityEnd}
          customStart={state.input.customChildCareStart}
          onChange={(value) =>
            dispatch({
              type: 'PATCH_INPUT',
              patch: { customChildCareStart: value },
            })
          }
        />
      )}
        </div>
      </details>

      {expected && (
        <Timeline
          expectedBirthDate={expected}
          isMultipleBirth={state.input.isMultipleBirth}
          customMaternityStart={state.input.customMaternityStart}
          customMaternityEnd={state.input.customMaternityEnd}
          customChildCareStart={state.input.customChildCareStart}
          suppressed={state.meta.suppressAutoMaternity}
          onRestore={() =>
            dispatch({
              type: 'PATCH_META',
              patch: { suppressAutoMaternity: false },
            })
          }
        />
      )}
    </div>
  )
}

interface TimelineProps {
  expectedBirthDate: string
  isMultipleBirth: boolean
  customMaternityStart: string | undefined
  customMaternityEnd: string | undefined
  customChildCareStart: string | undefined
  suppressed: boolean
  onRestore: () => void
}

function Timeline({
  expectedBirthDate,
  isMultipleBirth,
  customMaternityStart,
  customMaternityEnd,
  customChildCareStart,
  suppressed,
  onRestore,
}: TimelineProps) {
  const t = computeMaternityTimeline(expectedBirthDate, isMultipleBirth, {
    maternityStart: customMaternityStart,
    maternityEnd: customMaternityEnd,
  })
  if (!t) return null
  const isCustomStart = customChildCareStart !== undefined
  const isCustomPrenatal = customMaternityStart !== undefined
  const isCustomPostnatal = customMaternityEnd !== undefined
  const pivotDate = customChildCareStart ?? t.childCareStart
  const md = (iso: string) =>
    `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
  return (
    <div className="st-pivot" aria-label="判定の基準日">
      <span className="st-pivot__label">
        <span aria-hidden>🍼</span> 判定の基準日（育休開始）
      </span>
      <strong className="st-pivot__date">{jpDate(pivotDate)}</strong>
      <p className="st-pivot__note">
        この日の前 2 年（緩和で最長 4 年）の働き方を判定します。
        {!isCustomStart && '実際の出産日がずれると、自動で追従します。'}
      </p>
      <p className="st-pivot__basis">
        {isCustomStart ? (
          <>根拠: 「詳細設定」で指定した育休開始日</>
        ) : (
          <>
            根拠: 🌸 {md(t.prenatalLeaveStart)} 産前休業
            {isCustomPrenatal ? '（手動指定）' : `（予定日 ${t.prenatalDays} 日前）`}
            → 👶 {md(t.expectedBirthDate)} 出産 → 🌿 {md(t.postnatalLeaveEnd)}{' '}
            産後休業 終了{isCustomPostnatal ? '（手動指定）' : '（出産 + 56 日）'}→
            その翌日
          </>
        )}
      </p>
      {suppressed && (
        <p className="st-pivot__seed">
          <span>
            「産前産後休業」の自動入力は止めています。Step 2
            で個別に登録した内容が優先されます。
          </span>
          <button
            type="button"
            className="st-pivot__seed-restore"
            onClick={onRestore}
          >
            自動入力を再開
          </button>
        </p>
      )}
    </div>
  )
}

interface ChildCareStartFieldProps {
  expectedBirthDate: string
  isMultipleBirth: boolean
  customMaternityStart: string | undefined
  customMaternityEnd: string | undefined
  customStart: string | undefined
  onChange: (value: string | undefined) => void
}

function ChildCareStartField({
  expectedBirthDate,
  isMultipleBirth,
  customMaternityStart,
  customMaternityEnd,
  customStart,
  onChange,
}: ChildCareStartFieldProps) {
  const t = computeMaternityTimeline(expectedBirthDate, isMultipleBirth, {
    maternityStart: customMaternityStart,
    maternityEnd: customMaternityEnd,
  })
  const defaultDate = t?.childCareStart ?? ''
  const useCustom = customStart !== undefined
  const earliestPostnatalEnd = t?.postnatalLeaveEnd
    ? format(addDays(parseISO(t.postnatalLeaveEnd), 1), 'yyyy-MM-dd')
    : undefined
  // 育休は子が 2 歳になるまで取得可能（雇用保険法）。便宜上、出産予定日 + 2 年を上限。
  const latestChildCareStart = expectedBirthDate
    ? format(addDays(parseISO(expectedBirthDate), 365 * 2), 'yyyy-MM-dd')
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
        <div
          style={{
            marginTop: '0.7rem',
            display: 'grid',
            gap: '0.4rem',
            minWidth: 0,
          }}
        >
          {/* min は付けない：産後休業より前を指定したら強制補正せず、下の警告で伝える */}
          <DateInput
            className="st-input"
            value={customStart ?? ''}
            max={latestChildCareStart}
            onChange={(v) => onChange(v || defaultDate)}
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

interface MaternityPeriodFieldProps {
  expectedBirthDate: string
  isMultipleBirth: boolean
  customStart: string | undefined
  customEnd: string | undefined
  onChange: (
    maternityStart: string | undefined,
    maternityEnd: string | undefined,
  ) => void
}

function MaternityPeriodField({
  expectedBirthDate,
  isMultipleBirth,
  customStart,
  customEnd,
  onChange,
}: MaternityPeriodFieldProps) {
  // 法定最長（オーバーライドなし）の自動値。min/max とラジオの自動サブテキストに使う。
  const auto = computeMaternityTimeline(expectedBirthDate, isMultipleBirth)
  const autoStart = auto?.prenatalLeaveStart ?? ''
  const autoEnd = auto?.postnatalLeaveEnd ?? ''
  const useCustom = customStart !== undefined || customEnd !== undefined

  // 現在の指定値（手動時）。自動値で初期化されているので fallback も自動値。
  const startValue = customStart ?? autoStart
  const endValue = customEnd ?? autoEnd

  // 産後 6 週（出産日 + 42 日）。終了日が早すぎる警告の閾値。
  const sixWeeksEnd =
    expectedBirthDate &&
    format(addDays(parseISO(expectedBirthDate), 42), 'yyyy-MM-dd')
  // 出産予定日の翌日。開始日が後ろすぎる警告の閾値。
  const dayAfterBirth =
    expectedBirthDate &&
    format(addDays(parseISO(expectedBirthDate), 1), 'yyyy-MM-dd')

  return (
    <div className="st-field">
      <label className="st-field__label">
        <span>🌸</span> 産前産後休業の期間
      </label>
      <p className="st-field__hint">
        産前 {auto?.prenatalDays ?? 42} 日・産後 56
        日をフルに取るなら、自動でかまいません。
        <strong>出産直前まで働く</strong>など、別の期間で取る場合のみ指定してください。
      </p>
      <div className="st-radio-group">
        <label className="st-radio-card" data-selected={!useCustom}>
          <input
            type="radio"
            name="mat"
            checked={!useCustom}
            onChange={() => onChange(undefined, undefined)}
          />
          <span className="st-radio-card__ic" aria-hidden>
            🌸
          </span>
          <span>
            法定の最長で取得（自動）
            <span className="st-radio-card__sub">
              {autoStart && autoEnd
                ? `${jpDate(autoStart)} 〜 ${jpDate(autoEnd)}`
                : ''}
            </span>
          </span>
        </label>
        <label className="st-radio-card" data-selected={useCustom}>
          <input
            type="radio"
            name="mat"
            checked={useCustom}
            onChange={() => onChange(autoStart, autoEnd)}
          />
          <span className="st-radio-card__ic" aria-hidden>
            📌
          </span>
          <span>
            期間を指定する
            <span className="st-radio-card__sub">
              出産直前まで働いた場合など
            </span>
          </span>
        </label>
      </div>
      {useCustom && (
        <div
          style={{
            marginTop: '0.7rem',
            display: 'grid',
            gap: '0.6rem',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'grid', gap: '0.3rem', minWidth: 0 }}>
            <label className="st-field__label">産前休業の開始日</label>
            <DateInput
              className="st-input"
              value={startValue}
              min={autoStart || undefined}
              max={endValue || undefined}
              onChange={(v) => onChange(v || autoStart, endValue)}
            />
          </div>
          <div style={{ display: 'grid', gap: '0.3rem', minWidth: 0 }}>
            <label className="st-field__label">産後休業の終了日</label>
            <DateInput
              className="st-input"
              value={endValue}
              min={startValue || undefined}
              max={autoEnd || undefined}
              onChange={(v) => onChange(startValue, v || autoEnd)}
            />
          </div>
          {endValue && sixWeeksEnd && endValue < sixWeeksEnd && (
            <div className="lp-warn">
              ⚠ 産後 6 週間（出産日 + 42
              日）は法律上就業できません。終了日が早すぎる可能性があります。
            </div>
          )}
          {startValue && dayAfterBirth && startValue > dayAfterBirth && (
            <div className="lp-warn">
              ⚠
              開始日が出産予定日の翌日より後です。産後休業（出産日の翌日から）と整合しません。
            </div>
          )}
        </div>
      )}
    </div>
  )
}
