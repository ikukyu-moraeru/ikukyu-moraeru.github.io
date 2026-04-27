import { useEffect } from 'react'
import type { UserInput } from '../../domain/types'
import './ShareModal.css'
import './ImportModal.css'

interface Props {
  open: boolean
  preview: UserInput | null
  parseError: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ImportModal({
  open,
  preview,
  parseError,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="share-mask"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="share-modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <header className="share-modal__head">
          <h2 id="import-title" className="share-modal__title">
            📥 共有された入力データを読み込みますか？
          </h2>
        </header>

        {parseError ? (
          <div className="share-modal__warn">
            <strong>⚠️ 読み込みに失敗しました</strong>
            <p>
              共有 URL が壊れているか、互換性のない形式のようです。
              送信元にもう一度 URL を発行してもらってください。
            </p>
          </div>
        ) : (
          <>
            <p className="import-modal__lede">
              共有 URL から、以下の入力情報を読み込みます。
              <strong>現在ブラウザに保存されている入力は上書きされます。</strong>
            </p>
            {preview && <ImportPreview input={preview} />}
            <p className="share-modal__note">
              ※ 信頼できる相手から受け取った URL かを確認してください。
              心当たりがない場合は「キャンセル」を押してください。
            </p>
          </>
        )}

        <div className="import-modal__actions">
          <button
            type="button"
            className="import-modal__cancel"
            onClick={onCancel}
          >
            キャンセル
          </button>
          {!parseError && (
            <button
              type="button"
              className="import-modal__confirm"
              onClick={onConfirm}
            >
              読み込む（既存を上書き）
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ImportPreview({ input }: { input: UserInput }) {
  const segCount = input.insuredSegments?.length ?? 0
  const leaveCount = input.leavePeriods?.length ?? 0
  const attCount = input.attendances?.length ?? 0
  const scan =
    input.scanRange?.start && input.scanRange?.end
      ? `${input.scanRange.start} 〜 ${input.scanRange.end}`
      : '未設定'
  return (
    <dl className="import-modal__summary">
      <div>
        <dt>多胎</dt>
        <dd>{input.isMultipleBirth ? 'はい' : 'いいえ'}</dd>
      </div>
      <div>
        <dt>出産日候補</dt>
        <dd>{scan}</dd>
      </div>
      <div>
        <dt>育休開始日</dt>
        <dd>
          {input.customChildCareStart
            ? `${input.customChildCareStart}（カスタム）`
            : '自動（産後休業の翌日）'}
        </dd>
      </div>
      <div>
        <dt>加入期間</dt>
        <dd>{segCount} 件</dd>
      </div>
      <div>
        <dt>休業期間</dt>
        <dd>{leaveCount} 件</dd>
      </div>
      <div>
        <dt>出勤入力</dt>
        <dd>{attCount} 日</dd>
      </div>
    </dl>
  )
}
