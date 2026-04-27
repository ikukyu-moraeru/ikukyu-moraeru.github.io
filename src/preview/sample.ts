export type CellStatus = 'pass' | 'border' | 'fail'

export interface HeatmapCell {
  index: number
  label: string
  status: CellStatus
  countedMonths: number
}

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
    if (i < 11) {
      status = 'pass'
      months = 13.5 - i * 0.08
    } else if (i < 15) {
      status = 'border'
      months = 12.1 - (i - 11) * 0.15
    } else {
      status = 'fail'
      months = 11.4 - (i - 15) * 0.12
    }
    cells.push({
      index: i,
      label: `${m}/${day}`,
      status,
      countedMonths: Math.round(months * 10) / 10,
    })
  }
  return cells
}

export const SAMPLE_HEATMAP: HeatmapCell[] = buildSample()
