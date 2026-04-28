import { useEffect, useMemo, useState } from 'react'
import { buildShareUrl } from '../../state/share'
import { useAppState } from '../../state/AppState'
import { scanBirthDates } from '../../domain/birthDateScan'
import { summarizeScan } from '../../domain/summary'
import { ModalOverlay } from './ModalOverlay'
import './ShareModal.css'

interface Props {
  open: boolean
  onClose: () => void
}

const APP_URL = 'https://nkjzm.github.io/MaternityLeaveCalculator/'

export function ShareModal({ open, onClose }: Props) {
  const { state } = useAppState()
  const [agreed, setAgreed] = useState(false)
  const [copiedKind, setCopiedKind] = useState<'sns' | 'url' | null>(null)

  const url = open ? buildShareUrl(state.input) : ''

  const snsText = useMemo(() => {
    if (!open) return ''
    if (!state.input.scanRange.start || !state.input.scanRange.end) return ''
    try {
      const results = scanBirthDates(state.input)
      if (results.length === 0) return ''
      const summary = summarizeScan(results)
      const verdict =
        summary.passDays === summary.totalDays
          ? 'pass-all'
          : summary.failDays === summary.totalDays
            ? 'fail-all'
            : 'mixed'
      const headline =
        verdict === 'pass-all'
          ? '🎉 育休給付金、いつ生まれても受け取れる判定でした。'
          : verdict === 'fail-all'
            ? '🌱 育休給付金、いまの入力では条件に届かない判定でした。'
            : `📅 育休給付金、出産日次第で結果が変わる判定でした（受け取れる日 ${summary.passDays} / ${summary.totalDays} 日）。`
      return `${headline}\n出産日と勤務状況を入れるだけ、ブラウザの中だけで判定できます。\n${APP_URL}\n#育休もらえる`
    } catch {
      return ''
    }
  }, [open, state.input])

  useEffect(() => {
    if (!open) {
      setAgreed(false)
      setCopiedKind(null)
    }
  }, [open])

  const copy = async (kind: 'sns' | 'url', text: string) => {
    if (kind === 'url' && !agreed) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKind(kind)
      setTimeout(() => setCopiedKind((k) => (k === kind ? null : k)), 2200)
    } catch {
      /* ignore */
    }
  }

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(snsText)}`
  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(snsText)}`
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(snsText)}`

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <header className="share-modal__head">
          <h2 id="share-title" className="share-modal__title">
            シェアする
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

        {/* セクション 1: SNS シェア（安全） */}
        <section className="share-section share-section--safe">
          <header className="share-section__head">
            <span className="share-section__pill share-section__pill--safe">
              ✓ 個人情報なし
            </span>
            <h3 className="share-section__title">📱 結果を SNS に投稿する</h3>
          </header>
          <p className="share-section__lede">
            判定結果のサマリ + アプリの URL だけを投稿します。
            出産予定日や会社名などの個人情報は<strong>含まれません</strong>。
          </p>
          <textarea
            className="share-section__text"
            value={snsText}
            readOnly
            rows={4}
          />
          <div className="share-section__actions">
            <button
              type="button"
              className="share-section__btn share-section__btn--primary"
              onClick={() => copy('sns', snsText)}
            >
              {copiedKind === 'sns' ? '✓ コピー済み' : '📋 テキストをコピー'}
            </button>
            <a
              className="share-section__btn share-section__btn--x"
              href={xUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              𝕏 で投稿
            </a>
            <a
              className="share-section__btn share-section__btn--threads"
              href={threadsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Threads で投稿
            </a>
            <a
              className="share-section__btn share-section__btn--line"
              href={lineUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              LINE で送る
            </a>
          </div>
        </section>

        <hr className="share-modal__divider" />

        {/* セクション 2: URL シェア（個人情報あり） */}
        <section className="share-section share-section--danger">
          <header className="share-section__head">
            <span className="share-section__pill share-section__pill--danger">
              ⚠ 個人情報を含む
            </span>
            <h3 className="share-section__title">🔗 入力データごと URL で送る</h3>
          </header>
          <p className="share-section__lede">
            家族・社労士・ハローワーク担当者など <strong>信頼できる相手だけ</strong> に
            送ってください。受け取った相手も同じ判定結果を再現できます。
          </p>
          <div className="share-modal__warn">
            <strong>含まれる情報</strong>
            <ul>
              <li>出産予定日 / 育休開始日</li>
              <li>会社名・入社/退職日</li>
              <li>産休・育休・病気休職などの期間</li>
              <li>月別・日別の出勤情報</li>
            </ul>
          </div>

          <label className="share-modal__agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>
              個人情報を含むことを理解した（チェックでコピーが有効化）
            </span>
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
              onClick={() => copy('url', url)}
              disabled={!agreed}
            >
              {copiedKind === 'url' ? '✓ コピー済み' : '📋 コピー'}
            </button>
          </div>
          <p className="share-modal__note">
            ※ URL の情報は外部サーバには送信されず、URL 文字列の中に直接埋め込まれています。
          </p>
        </section>
      </div>
    </ModalOverlay>
  )
}
