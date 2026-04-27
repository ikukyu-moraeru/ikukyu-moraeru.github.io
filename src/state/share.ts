import type { UserInput } from '../domain/types'

/**
 * UserInput を URL ハッシュに載せられる文字列に変換する。
 * - JSON → UTF-8 → base64url
 * - 受信側で zod 的バリデーションは行わず、形だけパース成功すれば採用する
 *   （domain 側のロジックが UserInput の構造変化に強い前提）
 */
export function serializeInput(input: UserInput): string {
  const json = JSON.stringify(input)
  const utf8 = unescape(encodeURIComponent(json))
  const b64 = btoa(utf8)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function deserializeInput(data: string): UserInput | null {
  try {
    let padded = data.replace(/-/g, '+').replace(/_/g, '/')
    while (padded.length % 4 !== 0) padded += '='
    const utf8 = atob(padded)
    const json = decodeURIComponent(escape(utf8))
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as UserInput
  } catch {
    return null
  }
}

/**
 * 共有 URL を組み立てる。受信側で `#/import?data=...` を検知してインポート確認モーダルを出す。
 */
export function buildShareUrl(input: UserInput): string {
  if (typeof window === 'undefined') return ''
  const data = serializeInput(input)
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`
  return `${base}#/import?data=${data}`
}

/**
 * 現在のハッシュから import data を取り出す（あれば）。
 */
export function readImportDataFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash || ''
  const match = hash.match(/^#\/import\?data=([^&]+)$/)
  return match ? match[1] : null
}

/**
 * URL から import パラメータを取り除く（履歴に残らないよう replaceState）。
 * 取り除いた後はトップ（表紙）へ戻すのが安全。
 */
export function clearImportFromHash() {
  if (typeof window === 'undefined') return
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}#/`
  window.history.replaceState(null, '', url)
}
