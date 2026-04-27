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

/**
 * countedMonths は完全月（整数加算）＋端数月（最大 +0.5）で構成されるため、
 * 実装上 0.5 刻みの値しか取らない。サンプルもそれに揃える。
 */
const halfStep = (n: number): number => Math.round(n * 2) / 2

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
    if (i < 22) {
      // pass: 30 日中 22 日を「受け取れる」に。15.0 → 12.5 を 0.5 刻みで穏やかに
      status = 'pass'
      months = halfStep(15 - i * 0.12)
    } else if (i < 25) {
      // near: 11.5 と 11.0 を交互に（3 日分）
      status = 'near'
      months = i % 2 === 0 ? 11.5 : 11.0
    } else {
      // fail: 10.5 → 8.0 を 0.5 刻みで
      status = 'fail'
      months = halfStep(10.5 - (i - 25) * 0.5)
    }
    cells.push({
      index: i,
      label: `${m}/${day}`,
      status,
      countedMonths: months,
      isExpected: i === EXPECTED_INDEX,
    })
  }
  return cells
}

export const SAMPLE_HEATMAP: HeatmapCell[] = buildSample()
