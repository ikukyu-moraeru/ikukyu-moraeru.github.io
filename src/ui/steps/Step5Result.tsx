import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns'
import { useAppState } from '../../state/AppState'
import { scanBirthDates } from '../../domain/birthDateScan'
import { summarizeScan } from '../../domain/summary'
import type { EligibilityResult, UserInput } from '../../domain/types'
import { IssueBanner } from '../components/IssueBanner'
import { DateInput } from '../components/DateInput'
import { computeMaternityTimeline } from '../../domain/maternityTimeline'
import { isInputableDay } from '../shared/dayClassification'
import { jpDate, formatMonths, deriveExpectedBirthDate } from '../shared/formatUtils'
import './steps.css'
import './Step5Result.css'

const POSTNATAL_DAYS = 56
const PRENATAL_DAYS_SINGLE = 42
const PRENATAL_DAYS_MULTIPLE = 98

/**
 * 不足ケースの「強さ」。`shortage <= 1.0` のときだけ「あと少し」と表現してよい。
 * それより不足が大きい場合は中立的な「受け取れません」系に統一する。
 */
const NEAR_THRESHOLD_MONTHS = 1.0

type Status = 'pass' | 'near' | 'fail'

function classify(r: EligibilityResult): Status {
  if (r.isEligible) return 'pass'
  if (r.shortage <= NEAR_THRESHOLD_MONTHS) return 'near'
  return 'fail'
}

function isNearMiss(r: EligibilityResult): boolean {
  return !r.isEligible && r.shortage <= NEAR_THRESHOLD_MONTHS
}

function failVerdictLabel(r: EligibilityResult): string {
  return isNearMiss(r) ? 'あと少し届きません' : '受け取れません'
}


/** 予定日前後の表示日数（試算幅）のドロップダウン候補 */
const SPREAD_CHOICES = [7, 14, 21, 30, 60, 90]

export function Step5Result() {
  const { state, dispatch } = useAppState()
  const results = useMemo(() => scanBirthDates(state.input), [state.input])
  const summary = useMemo(() => summarizeScan(results), [results])
  // 判定対象期間内で Step4 が未入力のままの月（アクション一覧の最優先項目に使う）
  const missingMonths = useMemo(
    () => detectMissingMonths(state.input, results),
    [state.input, results],
  )
  const [selected, setSelected] = useState<string | null>(() => {
    // 初期表示で出産予定日のセルを選択状態にする
    return (
      deriveExpectedBirthDate(
        state.input.scanRange.start,
        state.input.scanRange.end,
      ) || null
    )
  })

  const expectedBirthDate = deriveExpectedBirthDate(
    state.input.scanRange.start,
    state.input.scanRange.end,
  )

  // 育休開始日の自動既定値（産後休業翌日。手動指定された産休期間がある場合はその翌日）
  const ccsAutoDefault = useMemo(() => {
    if (!expectedBirthDate) return undefined
    const t = computeMaternityTimeline(
      expectedBirthDate,
      state.input.isMultipleBirth,
      {
        maternityStart: state.input.customMaternityStart,
        maternityEnd: state.input.customMaternityEnd,
      },
    )
    return t?.childCareStart
  }, [
    expectedBirthDate,
    state.input.isMultipleBirth,
    state.input.customMaternityStart,
    state.input.customMaternityEnd,
  ])

  // 育休は子が 2 歳になるまで取得可能（Step1 の ChildCareStartField と同じ上限）
  const customCcsMax = expectedBirthDate
    ? format(addDays(parseISO(expectedBirthDate), 365 * 2), 'yyyy-MM-dd')
    : undefined

  const customChildCareStart = state.input.customChildCareStart

  // マウント時に一度だけ評価：customChildCareStart が設定済みなら詳細を開いた状態にする
  const [ccsDetailsOpen] = useState<boolean>(
    () => customChildCareStart !== undefined,
  )

  if (!state.input.scanRange.start || !state.input.scanRange.end) {
    return (
      <div className="st-empty">
        <span className="st-empty__emoji" aria-hidden>
          📅
        </span>
        Step 1 で出産予定日と走査範囲を入力してください。
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="st-empty">
        <span className="st-empty__emoji" aria-hidden>
          🤔
        </span>
        判定できる出産日候補がありません。Step 1 をご確認ください。
      </div>
    )
  }

  const selectedResult = selected
    ? results.find((r) => r.birthDate === selected)
    : null

  // 予定日±何日を試算しているか（scanRange から逆算）
  const spreadDays = Math.round(
    (parseISO(state.input.scanRange.end).getTime() -
      parseISO(state.input.scanRange.start).getTime()) /
      (2 * 24 * 60 * 60 * 1000),
  )
  // 旧入力などで候補にない幅が設定されていても選択肢として表示する
  const spreadChoices = SPREAD_CHOICES.includes(spreadDays)
    ? SPREAD_CHOICES
    : [...SPREAD_CHOICES, spreadDays].sort((a, b) => a - b)

  const changeSpread = (n: number) => {
    if (!expectedBirthDate) return
    const exp = parseISO(expectedBirthDate)
    dispatch({
      type: 'PATCH_INPUT',
      patch: {
        scanRange: {
          start: format(subDays(exp, n), 'yyyy-MM-dd'),
          end: format(addDays(exp, n), 'yyyy-MM-dd'),
        },
      },
    })
  }

  const verdict =
    summary.passDays === summary.totalDays
      ? 'pass-all'
      : summary.failDays === summary.totalDays
        ? 'fail-all'
        : 'mixed'

  // fail-all のとき：全候補の中で最も惜しい (shortage 最小) ケースを基準に文言を決める。
  // 1.0 か月以内なら「あと少し」、それ超なら中立な「受け取れません」。
  const failAllNear = summary.shortfallMin <= NEAR_THRESHOLD_MONTHS
  const verdictTitle =
    verdict === 'pass-all'
      ? 'いつ生まれても、育休給付金を受け取れそうです'
      : verdict === 'fail-all'
        ? failAllNear
          ? 'いまの入力だと、条件にもう少し届かないようです'
          : 'いまの入力では、条件を満たしていないようです'
        : '出産日によって、結果が変わります'

  // 網掛け（指定した育休開始日が産後休業と重なる）セルが 1 つでもあるか。凡例の出し分けに使う
  const hasInvalidCells =
    !!customChildCareStart &&
    results.some(
      (r) =>
        customChildCareStart <=
        format(addDays(parseISO(r.birthDate), POSTNATAL_DAYS), 'yyyy-MM-dd'),
    )

  return (
    <div className="st-section">
      <IssueBanner scope="all" />
      <div className={`r5-verdict r5-verdict--${verdict}`}>
        <div className="r5-verdict__emoji" aria-hidden>
          {verdict === 'pass-all' ? '🎉' : verdict === 'fail-all' ? '🌱' : '📅'}
        </div>
        <div>
          <span className="r5-verdict__small">判定結果</span>
          <h2 className="r5-verdict__title">{verdictTitle}</h2>
        </div>
      </div>

      <div className="r5-stats">
        <div className="r5-stats__cell r5-stats__cell--pass">
          <span className="r5-stats__num">{summary.passDays}</span>
          <span className="r5-stats__lab">受け取れる日</span>
        </div>
        <div className="r5-stats__cell r5-stats__cell--fail">
          <span className="r5-stats__num">{summary.failDays}</span>
          <span className="r5-stats__lab">届かない日</span>
        </div>
      </div>

      <ActionSuggestions verdict={verdict} missingMonths={missingMonths} />

      <section className="r5-heat">
        <header>
          <div>
            <h3>出産日ごとの結果</h3>
            <p>各セルをタップすると、その日の判定根拠が下に表示されます。</p>
          </div>
          <label className="r5-spread">
            表示する範囲
            <select
              className="r5-spread__select"
              value={spreadDays}
              onChange={(e) => changeSpread(Number(e.target.value))}
            >
              {spreadChoices.map((n) => (
                <option key={n} value={n}>
                  予定日 ± {n} 日
                </option>
              ))}
            </select>
          </label>
        </header>
        {customChildCareStart && (
          <p className="r5-fixed-note">
            📌 育休開始日を {jpDate(customChildCareStart)} に固定しています。判定対象期間（基準日から遡る2年）は出産日に関わらず一定ですが、出産日によって産休期間（賃金のない休業）が伸び縮みするため、緩和加算などで結果が変わることがあります。
          </p>
        )}

        <div className="r5-heat__grid">
          {results.map((r) => {
            const status = classify(r)
            const isSelected = r.birthDate === selected
            const isExpected = r.birthDate === expectedBirthDate
            // customChildCareStart が産後56日終了日以前のセルは不整合
            const postnatalEnd56 = format(addDays(parseISO(r.birthDate), POSTNATAL_DAYS), 'yyyy-MM-dd')
            const isInvalid = !!customChildCareStart && customChildCareStart <= postnatalEnd56
            const [, mm, dd] = r.birthDate.split('-')
            const className = [
              'r5-cell',
              `r5-cell--${status}`,
              isSelected && 'is-selected',
              isExpected && 'is-expected',
              isInvalid && 'r5-cell--invalid',
            ]
              .filter(Boolean)
              .join(' ')
            const verdictLabel = r.isEligible
              ? '受け取れる'
              : isNearMiss(r)
                ? 'あと少し届かない'
                : '受け取れない'
            const invalidNote = isInvalid
              ? ` ⚠ 育休開始日が産後休業期間内（産後56日以内）のため不整合`
              : ''
            return (
              <button
                key={r.birthDate}
                className={className}
                onClick={() =>
                  setSelected(r.birthDate === selected ? null : r.birthDate)
                }
                title={`${r.birthDate}${isExpected ? '（出産予定日）' : ''}: ${formatMonths(r.countedMonths)} か月（${verdictLabel}）${invalidNote}`}
              >
                {isExpected && (
                  <span className="r5-cell__pin" aria-label="出産予定日">
                    予
                  </span>
                )}
                <span className="r5-cell__date">
                  {Number(mm)}/{Number(dd)}
                </span>
                <span className="r5-cell__num">
                  {formatMonths(r.countedMonths)}
                </span>
              </button>
            )
          })}
        </div>

        <footer>
          <span className="r5-leg r5-leg--pass">
            受け取れる
            <span className="r5-leg__sub">12 か月以上</span>
          </span>
          <span className="r5-leg r5-leg--near">
            あと少し届かない
            <span className="r5-leg__sub">11〜12 か月</span>
          </span>
          <span className="r5-leg r5-leg--fail">
            受け取れない
            <span className="r5-leg__sub">11 か月未満</span>
          </span>
          {hasInvalidCells && (
            <span className="r5-leg r5-leg--invalid">
              指定日から育休を取れない
              <span className="r5-leg__sub">産後休業と重なる</span>
            </span>
          )}
        </footer>

        <details className="r5-ccs-quiet" open={ccsDetailsOpen || undefined}>
          <summary className="r5-ccs-quiet__summary">
            <span className="r5-ccs-quiet__label">
              ⚙️ 育休開始日:{' '}
              {customChildCareStart
                ? `${jpDate(customChildCareStart)}（指定中）`
                : '自動（産後休業の翌日）'}
            </span>
            <span className="r5-ccs-quiet__change">変更する</span>
          </summary>
          <div className="r5-ccs-quiet__body">
            <p className="r5-ccs-quiet__hint">
              会社と合意した別の日から育休を取る場合に指定してください。指定すると、その日を基準に判定し直します。
            </p>
            <div className="r5-ccs-quiet__row">
              {/* min は付けない：自動値より前を指定したら強制補正せず、下の警告で伝える */}
              <DateInput
                className="st-input"
                value={customChildCareStart ?? ccsAutoDefault ?? ''}
                max={customCcsMax}
                onChange={(v) =>
                  dispatch({
                    type: 'PATCH_INPUT',
                    patch: { customChildCareStart: v || undefined },
                  })
                }
                aria-label="育休開始日を指定"
              />
              {customChildCareStart && (
                <button
                  type="button"
                  className="r5-ccs-quiet__reset"
                  onClick={() =>
                    dispatch({
                      type: 'PATCH_INPUT',
                      patch: { customChildCareStart: undefined },
                    })
                  }
                >
                  自動（産後休業の翌日）に戻す
                </button>
              )}
            </div>
            {customChildCareStart &&
              ccsAutoDefault &&
              customChildCareStart < ccsAutoDefault && (
                <p className="r5-ccs-quiet__warn">
                  ⚠ 予定日どおりに生まれた場合、産後休業は{' '}
                  {jpDate(format(subDays(parseISO(ccsAutoDefault), 1), 'yyyy-MM-dd'))}{' '}
                  まで続くため、この開始日では育休を取れません（上の一覧で、どの出産日なら取れるかを ⚠
                  の有無で確認できます）。産前産後休業のタイミング自体を変えたい場合は{' '}
                  <button
                    type="button"
                    className="r5-ccs-quiet__link"
                    onClick={() => dispatch({ type: 'SET_STEP', step: 1 })}
                  >
                    Step 1 の詳細設定
                  </button>{' '}
                  で調整してください。
                </p>
              )}
          </div>
        </details>
      </section>

      {selectedResult && (
        <section className="r5-detail">
          {(() => {
            const postnatalEnd56 = format(
              addDays(parseISO(selectedResult.birthDate), POSTNATAL_DAYS),
              'yyyy-MM-dd',
            )
            const isInvalid =
              !!customChildCareStart && customChildCareStart <= postnatalEnd56
            return isInvalid ? (
              <p className="r5-detail__invalid-warn">
                ⚠ 育休開始日（{jpDate(customChildCareStart!)}）が、この出産日の産後休業期間内（〜{jpDate(postnatalEnd56)}）です。育休は産後休業が終わってから開始できます。日付を修正してください。
              </p>
            ) : null
          })()}
          <header>
            <span className="r5-detail__small">選択した出産日</span>
            <h3>{jpDate(selectedResult.birthDate)}</h3>
            <span
              className={`r5-detail__badge r5-detail__badge--${classify(selectedResult)}`}
            >
              {selectedResult.isEligible
                ? '✓ 受け取れます'
                : `✕ ${failVerdictLabel(selectedResult)}`}
            </span>
          </header>

          <DetailTimeline
            result={selectedResult}
            isMultipleBirth={state.input.isMultipleBirth}
          />

          <dl className="r5-detail__meta">
            <div>
              <dt>判定対象期間</dt>
              <dd>
                {selectedResult.scanWindow.start} 〜 {selectedResult.scanWindow.end}
              </dd>
            </div>
            <div>
              <dt>緩和加算</dt>
              <dd>{selectedResult.relaxationDays} 日</dd>
            </div>
          </dl>

          <h4 className="r5-detail__subtitle">月別判定</h4>
          <ul className="r5-months">
            {[...selectedResult.monthBreakdown].reverse().map((m) => (
              <li
                key={m.range.index}
                className={`r5-month r5-month--${m.counted === 1 ? 'pass' : 'fail'}`}
              >
                <span className="r5-month__no">
                  {String(m.range.index).padStart(2, '0')}
                </span>
                <span className="r5-month__range">
                  {m.range.start} 〜 {m.range.end}
                </span>
                <span className="r5-month__att">
                  {m.attendance
                    ? `${m.attendance.basicWageDays.toFixed(1)} 日 / ${m.attendance.basicWageHours.toFixed(0)} 時間`
                    : '—'}
                </span>
                <span className="r5-month__reason">{m.reason}</span>
                <span className="r5-month__counted">
                  {m.counted === 1 ? '+1' : '0'}
                </span>
              </li>
            ))}
          </ul>

          {selectedResult.fragmentJudgment && (
            <>
              <h4 className="r5-detail__subtitle">
                端数月（先頭）
                <span className="r5-detail__inline-note">参考表示</span>
              </h4>
              <ul className="r5-months">
                <li
                  className={`r5-month r5-month--${selectedResult.fragmentJudgment.counted === 0.5 ? 'pass' : 'fail'}`}
                >
                  <span className="r5-month__no">FR</span>
                  <span className="r5-month__range">
                    {selectedResult.fragmentJudgment.range.start} 〜{' '}
                    {selectedResult.fragmentJudgment.range.end}
                    {' '}
                    （{selectedResult.fragmentJudgment.range.days} 日）
                  </span>
                  <span className="r5-month__att">
                    {selectedResult.fragmentJudgment.attendance
                      ? `${selectedResult.fragmentJudgment.attendance.basicWageDays.toFixed(1)} 日 / ${selectedResult.fragmentJudgment.attendance.basicWageHours.toFixed(0)} 時間`
                      : '—'}
                  </span>
                  <span className="r5-month__reason">
                    {selectedResult.fragmentJudgment.reason}
                  </span>
                  <span className="r5-month__counted">
                    {selectedResult.fragmentJudgment.counted === 0.5
                      ? '+0.5'
                      : '0'}
                  </span>
                </li>
              </ul>
              <p className="r5-detail__caveat">
                ※ 端数月（1 か月未満の余り期間）の <strong>+0.5 か月</strong> は法令どおり計算していますが、
                完全月が 0 / 1 の整数で数えられるため、本ツールの「12 か月以上」判定の合否を変えることはありません。
                <br />
                <a className="r5-actions__link" href="/guide/hasuu-tsuki-15nichi/">
                  📖 解説記事: 端数月の「+0.5か月」が合否を変えない理由
                </a>
              </p>
            </>
          )}
        </section>
      )}

      <p className="r5-disclaimer">
        ※ 本ツールは参考用です。最終判定は管轄のハローワーク（公共職業安定所）で行われます。
        {' '}
        <a className="r5-disclaimer__link" href="#/privacy">プライバシーポリシー</a>
      </p>
    </div>
  )
}

interface DetailTimelineProps {
  result: EligibilityResult
  isMultipleBirth: boolean
}

function DetailTimeline({ result, isMultipleBirth }: DetailTimelineProps) {
  const prenatalDays = isMultipleBirth
    ? PRENATAL_DAYS_MULTIPLE
    : PRENATAL_DAYS_SINGLE
  const birth = parseISO(result.birthDate)
  const postnatalEnd = format(addDays(birth, POSTNATAL_DAYS), 'yyyy-MM-dd')
  const stops = [
    {
      key: 'prenatal',
      ic: '🌸',
      label: `産前 ${prenatalDays} 日`,
      date: result.leaveStartDate,
    },
    { key: 'birth', ic: '👶', label: '出産', date: result.birthDate },
    {
      key: 'postnatal',
      ic: '🌿',
      label: '産後 56 日 終了',
      date: postnatalEnd,
    },
    {
      key: 'childcare',
      ic: '🍼',
      label: '育休開始（判定基準日）',
      date: result.childCareStartDate,
      pivot: true as const,
    },
  ]
  return (
    <ol
      className="r5-timeline"
      aria-label="この出産日における産休・育休スケジュール"
    >
      {stops.map((s) => (
        <li
          key={s.key}
          className={`r5-timeline__stop${s.pivot ? ' is-pivot' : ''}`}
        >
          <span className="r5-timeline__ic" aria-hidden>
            {s.ic}
          </span>
          <span className="r5-timeline__label">{s.label}</span>
          <span className="r5-timeline__date">{jpDate(s.date)}</span>
        </li>
      ))}
    </ol>
  )
}

/** 届かない日があるときに試せるアクション。上から順に確認を促す。 */
interface ActionItem {
  icon: string
  title: string
  desc: string
  href: string
  linkLabel: string
  /** 入力を見直す Step 番号。指定すると「Step n を開く」ボタンを表示する */
  step?: number
}

const ACTION_ITEMS: ActionItem[] = [
  {
    icon: '✏️',
    title: '働いた月の入力を見直す',
    desc: '月11日に届かなくても80時間以上働いた月はカウントされます（2020年8月以降）。Step 4 で月ごとの入力を見直してください。',
    href: '/guide/80jikan-rule/',
    linkLabel: '80時間ルールの解説',
    step: 4,
  },
  {
    icon: '🛌',
    title: '過去の休業の入力漏れを確認する',
    desc: '病気や前の子の産休育休などで連続30日以上無給だった期間があれば、判定対象が最長4年まで広がります。Step 2 に登録してください。',
    href: '/guide/kanwa-saichou-4nen/',
    linkLabel: '2年→最長4年に延びる仕組み',
    step: 2,
  },
  {
    icon: '💼',
    title: '前職の雇用保険を通算する',
    desc: '離職から1年以内の転職で、失業給付の手続きをしていなければ前職分も足せます。Step 3 に登録してください。',
    href: '/guide/tenshoku-tsuusan/',
    linkLabel: '前職通算の条件と落とし穴',
    step: 3,
  },
  {
    icon: '🍼',
    title: '育休開始日をずらして試す',
    desc: '開始日を動かすと判定対象の2年間が丸ごと動き、結果が変わることがあります。このページ下部の「⚙️ 育休開始日」から変更できます。',
    href: '/guide/ikukyuu-kaishi-zure/',
    linkLabel: '開始日で判定が変わる仕組み',
  },
  {
    icon: '🌸',
    title: '産前休業を短くして働く',
    desc: '出産直前まで働くと、働いた月が積み増せることがあります。Step 1 の詳細設定で試算できます。',
    href: '/guide/sanzen-kyuugyou-mijikaku/',
    linkLabel: '直前まで働く損得の解説',
    step: 1,
  },
  {
    icon: '🏥',
    title: 'つわりの休みを連続の休職に整える',
    desc: 'とびとびの無給欠勤がいちばん不利です。医師の診断のもと連続30日以上の休職にすれば緩和の対象になります。',
    href: '/guide/tsuwari-kyuushoku-otoshiana/',
    linkLabel: '妊娠中の休み方の解説',
  },
  {
    icon: '🤝',
    title: 'それでも届かないとき',
    desc: '給付金がなくても育休自体は取得でき、社会保険料免除や出産育児一時金は別に受けられます。',
    href: '/guide/moraenai-baai/',
    linkLabel: 'もらえない場合にできること',
  },
]

interface ActionSuggestionsProps {
  verdict: 'pass-all' | 'fail-all' | 'mixed'
  /** Step4 が未入力のままの月（yyyy-MM）。あれば最優先アクションとして表示する */
  missingMonths: string[]
}

/** 未入力月の先頭数件を「2026年5月・2026年6月 他3か月」形式に圧縮する */
function missingMonthsLabel(months: string[]): string {
  const head = months.slice(0, 3).map(jpMonth).join('・')
  const rest = months.length - 3
  return rest > 0 ? `${head} 他${rest}か月` : head
}

/**
 * 結果を良くするために試せるアクションの一覧。全候補が受給可でも常時表示する。
 * fail-all（全滅）と、届かない日がありかつ未入力月が残っている場合は
 * デフォルトで展開する。
 */
function ActionSuggestions({ verdict, missingMonths }: ActionSuggestionsProps) {
  const { dispatch } = useAppState()
  const hasFail = verdict !== 'pass-all'
  const defaultOpen =
    verdict === 'fail-all' || (hasFail && missingMonths.length > 0)
  return (
    <details className="r5-actions" open={defaultOpen}>
      <summary className="r5-actions__summary">
        🌱 届かない日があるときに、できること
      </summary>
      <p className="r5-actions__intro">
        {hasFail
          ? 'あきらめる前に、次の順で確認してみてください。入力の見直しで結果が変わることもあります。'
          : 'いまは全候補で受け取れる見込みです。入力や予定が変わったときの見直しに使ってください。'}
      </p>
      <ul className="r5-actions__list">
        {missingMonths.length > 0 && (
          <li className="r5-actions__item">
            <span className="r5-actions__icon" aria-hidden>
              ⏳
            </span>
            <span className="r5-actions__title">未入力の月を埋める</span>
            <span className="r5-actions__desc">
              {missingMonthsLabel(missingMonths)}
              の出勤情報がまだ入っていないようです。入力した月はカウントに加わるため、結果が変わる可能性が高いです。
            </span>
            <span className="r5-actions__links">
              <button
                type="button"
                className="r5-actions__step"
                onClick={() => dispatch({ type: 'SET_STEP', step: 4 })}
              >
                ✏️ Step 4 を開く
              </button>
            </span>
          </li>
        )}
        {ACTION_ITEMS.map((item) => (
          <li key={item.href} className="r5-actions__item">
            <span className="r5-actions__icon" aria-hidden>
              {item.icon}
            </span>
            <span className="r5-actions__title">{item.title}</span>
            <span className="r5-actions__desc">{item.desc}</span>
            <span className="r5-actions__links">
              {item.step !== undefined && (
                <button
                  type="button"
                  className="r5-actions__step"
                  onClick={() =>
                    dispatch({ type: 'SET_STEP', step: item.step! })
                  }
                >
                  ✏️ Step {item.step} を開く
                </button>
              )}
              <a className="r5-actions__link" href={item.href}>
                📖 解説記事: {item.linkLabel}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function jpMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}年${Number(m)}月`
}

/**
 * 判定対象期間の各暦月のうち、
 * - 出勤情報が 1 件も入っておらず、
 * - その月の中に「入力されるべき日」（雇用保険加入中・休業期間外・育休開始日より前）が
 *   1 日でも残っている
 * を満たす月を「未入力候補」として返す。
 *
 * 月途中で産休に入る月や、月途中で育休開始日を迎える月でも、
 * 入力対象の日が残っているなら警告する。逆に月内の全日が
 * 「休業中／加入外／育休開始日以降」で埋まっているなら警告しない。
 */
function detectMissingMonths(
  input: UserInput,
  results: EligibilityResult[],
): string[] {
  if (results.length === 0) return []
  // Step4 のカレンダー表示は中央候補日（scanRange 中央 = 出産予定日）の
  // scanWindow を基準に組み立てている。Step5 の警告判定もこれに合わせる
  // ことで「Step4 で入力できる月」と「未入力警告される月」を一致させる。
  const center = results[Math.floor(results.length / 2)]
  const startBound = center.scanWindow.start
  const endBound = center.scanWindow.end

  const inputMonthKeys = new Set(
    input.attendances.map((a) => a.date.slice(0, 7)),
  )

  const out: string[] = []
  let cursor = startOfMonth(parseISO(startBound))
  const last = startOfMonth(parseISO(endBound))
  while (!isAfter(cursor, last)) {
    const ym = format(cursor, 'yyyy-MM')
    if (
      !inputMonthKeys.has(ym) &&
      monthHasInputableDay(cursor, input, endBound)
    ) {
      out.push(ym)
    }
    cursor = addMonths(cursor, 1)
  }
  return out
}

/**
 * 月内に「ユーザーが入力すべき日」が 1 日でも残っているか。
 * Step4 のカレンダーで unset（平日・未入力）になる日と同じ判定。
 */
function monthHasInputableDay(
  cursor: Date,
  input: UserInput,
  scanWindowEnd: string,
): boolean {
  const monthEnd = endOfMonth(cursor)
  let cur = cursor
  while (cur.getTime() <= monthEnd.getTime()) {
    const date = format(cur, 'yyyy-MM-dd')
    if (isInputableDay(date, input, scanWindowEnd)) return true
    cur = addDays(cur, 1)
  }
  return false
}
