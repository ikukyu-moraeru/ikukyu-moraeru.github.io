/**
 * Landing のプレビュー用ダミーデータ。Step5 の実装と整合させる:
 *  - status は 3 段階: pass（受け取れる） / near（あと少し届かない） / fail（受け取れない）
 *  - 出産予定日（中央 = 9/15 想定）にだけ「予」バッジを立てる
 *  - countedMonths は判定対象期間内に積めた月数（小数）。near は 11.0〜11.5 の範囲
 */
export type CellStatus = 'pass' | 'near' | 'fail'

export interface HeatmapCell {
  index: number
  label: string
  status: CellStatus
  countedMonths: number
  isExpected: boolean
}

const EXPECTED_INDEX = 14 // 9/15 を予定日に固定

const buildSample = (): HeatmapCell[] => {
  const cells: HeatmapCell[] = []
  const base = new Date(2026, 8, 1) // Sep 1
  for (let i = 0; i < 30; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const m = d.getMonth() + 1
    const day = d.getDate()
    let status: CellStatus
    let months: number
    if (i < 12) {
      status = 'pass'
      months = 13.6 - i * 0.08
    } else if (i < 17) {
      status = 'near'
      months = 11.5 - (i - 12) * 0.1
    } else {
      status = 'fail'
      months = 10.8 - (i - 17) * 0.18
    }
    cells.push({
      index: i,
      label: `${m}/${day}`,
      status,
      countedMonths: Math.round(months * 10) / 10,
      isExpected: i === EXPECTED_INDEX,
    })
  }
  return cells
}

export const SAMPLE_HEATMAP: HeatmapCell[] = buildSample()
