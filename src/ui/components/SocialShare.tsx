import './SocialShare.css'

/**
 * SNS シェアボタン（X / Threads / LINE）の共通 UI。
 *
 * ShareModal（入力データを URL に埋め込む共有）とは別レイヤー。こちらは
 * ツールそのものや結果サマリを「外向け」にシェアするためのもので、
 * 個人入力データは載せず、サイト URL（GitHub Pages のトップ）を貼る。
 */

const SITE_URL = 'https://nkjzm.github.io/MaternityLeaveCalculator/'

export interface SocialShareProps {
  /** 投稿テキスト本文（ハッシュタグ含めても良い）。URL は別パラメータで付与される。 */
  text: string
  /** 共有対象 URL。指定がなければサイトのトップ URL を使う。 */
  url?: string
  /** 「シェアする：」のラベルを変える場合に。 */
  label?: string
  /** 配置スタイル: 'inline'（横並び小型）/'block'（独立ブロック）。 */
  variant?: 'inline' | 'block'
}

export function SocialShare({
  text,
  url = SITE_URL,
  label = 'シェアする',
  variant = 'block',
}: SocialShareProps) {
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
  const threadsHref = `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}`
  const lineHref = `https://line.me/R/msg/text/?${encodeURIComponent(`${text} ${url}`)}`

  return (
    <div className={`ss-root ss-root--${variant}`}>
      <span className="ss-label">{label}</span>
      <div className="ss-buttons">
        <a
          className="ss-btn ss-btn--x"
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X (旧 Twitter) でシェア"
          title="X でシェア"
        >
          <XIcon />
          <span className="ss-btn__txt">X</span>
        </a>
        <a
          className="ss-btn ss-btn--threads"
          href={threadsHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Threads でシェア"
          title="Threads でシェア"
        >
          <ThreadsIcon />
          <span className="ss-btn__txt">Threads</span>
        </a>
        <a
          className="ss-btn ss-btn--line"
          href={lineHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LINE で送る"
          title="LINE で送る"
        >
          <LineIcon />
          <span className="ss-btn__txt">LINE</span>
        </a>
      </div>
    </div>
  )
}

function XIcon() {
  return (
    <svg
      className="ss-ic"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M18.244 2H21.5l-7.49 8.561L23 22h-6.828l-5.347-6.99L4.7 22H1.44l8.018-9.165L1 2h6.998l4.832 6.392L18.244 2Zm-1.197 18h1.882L7.05 4H5.07l11.977 16Z"
      />
    </svg>
  )
}

function ThreadsIcon() {
  return (
    <svg
      className="ss-ic"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12.18 21.6c-3.31 0-5.84-1.06-7.52-3.16C3.16 16.62 2.4 14.16 2.4 12.05v-.06c.02-2.12.79-4.55 2.28-6.4C6.36 3.5 8.89 2.4 12.18 2.4c2.81 0 5.07.84 6.71 2.5 1.43 1.45 2.34 3.49 2.7 6.07l.05.34-2.05.39-.06-.34c-.6-3.5-2.49-5.18-5.42-5.79-2.36-.49-4.85.13-6.34 1.59-1.32 1.29-1.95 3.21-1.95 5.04 0 1.83.62 3.74 1.95 5.04 1.49 1.46 3.98 2.07 6.34 1.59 1.66-.34 3.04-1.18 3.96-2.46-1.06-.48-2.34-.7-3.7-.6-1.85.13-3.18.95-3.43 2.16-.16.78.13 1.59.79 2.18.67.61 1.65.93 2.71.83.51-.05 1.05-.21 1.6-.49l.27.97c-.62.34-1.31.55-2 .61-1.42.13-2.78-.34-3.71-1.21-.96-.91-1.39-2.13-1.16-3.34.4-2.06 2.36-3.36 5.07-3.55 1.81-.13 3.5.21 4.84.94.39-.71.61-1.49.61-2.32 0-1.86-1.55-3.36-3.62-3.36-1.36 0-2.34.4-3.04 1.21l-1.6-1.34c1.12-1.34 2.7-2.05 4.64-2.05 3.18 0 5.78 2.34 5.78 5.54 0 1.32-.39 2.55-1.06 3.6.59.61.87 1.34.87 2.16 0 1.08-.42 2.13-1.21 3-.78.86-1.85 1.5-3.13 1.86-1.27.36-2.7.49-4.21.34Z"
      />
    </svg>
  )
}

function LineIcon() {
  return (
    <svg
      className="ss-ic"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 3.2C6.7 3.2 2.4 6.66 2.4 10.93c0 3.83 3.4 7.04 8.01 7.66.31.07.74.21.85.48.1.24.06.62.03.86l-.14.83c-.04.24-.2.95.83.52 1.04-.43 5.6-3.3 7.64-5.65 1.41-1.55 2.18-3.27 2.18-5.16C21.6 6.66 17.3 3.2 12 3.2Zm-3.83 9.95H6.27a.4.4 0 0 1-.4-.4V8.97c0-.22.18-.4.4-.4.22 0 .4.18.4.4v3.4h1.5c.22 0 .4.18.4.4 0 .22-.18.4-.4.4Zm1.69-.4a.4.4 0 0 1-.81 0V8.97c0-.22.18-.4.4-.4.22 0 .4.18.4.4v3.78Zm4.61 0a.4.4 0 0 1-.4.4.4.4 0 0 1-.32-.16l-1.94-2.63v2.4a.4.4 0 0 1-.81 0V8.97a.4.4 0 0 1 .4-.4c.13 0 .25.06.32.16l1.94 2.62V8.97a.4.4 0 0 1 .81 0v4.18Zm3-2.3c.22 0 .4.18.4.4 0 .22-.18.4-.4.4h-1.5v.91h1.5c.22 0 .4.18.4.4 0 .22-.18.4-.4.4h-1.9a.4.4 0 0 1-.4-.4V8.97c0-.22.18-.4.4-.4h1.9c.22 0 .4.18.4.4 0 .22-.18.4-.4.4h-1.5v.9h1.5Z"
      />
    </svg>
  )
}
