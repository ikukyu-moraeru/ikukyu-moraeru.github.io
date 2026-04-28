import { format, parseISO } from 'date-fns'

export function jpDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

/** countedMonths は 0.5 刻み。整数のときは ".0" を省いて表示する。 */
export function formatMonths(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** scanRange の中央日 = 出産予定日として扱う（Step1 の deriveExpected と整合）。 */
export function deriveExpectedBirthDate(start: string, end: string): string {
  if (!start || !end) return ''
  try {
    const s = parseISO(start).getTime()
    const e = parseISO(end).getTime()
    return format(new Date((s + e) / 2), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}
