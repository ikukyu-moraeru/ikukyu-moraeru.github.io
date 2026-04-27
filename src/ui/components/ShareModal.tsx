import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildShareUrl } from '../../state/share'
import { useAppState } from '../../state/AppState'
import './ShareModal.css'

interface Props {
  open: boolean
  onClose: () => void
}

export function ShareModal({ open, onClose }: Props) {
  const { state } = useAppState()
  const [agreed, setAgreed] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = open ? buildShareUrl(state.input) : ''

  useEffect(() => {
    if (!open) {
      setAgreed(false)
      setCopied(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const onCopy = async () => {
    if (!agreed) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      /* 古いブラウザ */
    }
  }

  return createPortal(
    <div
      className="share-mask"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <header className="share-modal__head">
          <h2 id="share-title" className="share-modal__title">
            📤 結果を URL でシェア
          </h2>
          <button
            type="button"
            className="share-modal__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ✕
          </button>
        </header>

        <div className="share-modal__warn">
          <strong>⚠️ 共有 URL に含まれる情報</strong>
          <ul>
            <li>出産予定日 / 育休開始日</li>
            <li>会社名・入社/退職日</li>
            <li>産休・育休・病気休職などの期間</li>
            <li>月別・日別の出勤情報</li>
          </ul>
          <p>
            これらは <strong>医療・雇用に関わる個人情報</strong> です。
          </p>
          <ul className="share-modal__rules">
            <li>SNS など不特定多数への投稿は <strong>避けてください</strong></li>
            <li>
              社労士・家族・ハローワーク担当者など
              <strong>信頼できる相手のみ</strong>に送ってください
            </li>
            <li>受け取った相手にも同様の扱いを伝えてください</li>
          </ul>
        </div>

        <label className="share-modal__agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>上記の注意点を理解しました（チェックでコピーが有効化）</span>
        </label>

        <div className="share-modal__url">
          <input
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="share-modal__copy"
            onClick={onCopy}
            disabled={!agreed}
          >
            {copied ? '✓ コピー済み' : '📋 コピー'}
          </button>
        </div>
        <p className="share-modal__note">
          ※ URL の情報は外部サーバには送信されず、URL 文字列の中に直接埋め込まれています。
          受信した相手も自分のブラウザだけで結果を再現できます。
        </p>
      </div>
    </div>,
    document.body,
  )
}
