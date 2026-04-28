import type { UserInput } from '../../domain/types'
import { ModalOverlay } from './ModalOverlay'
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
  return (
    <ModalOverlay open={open} onClose={onCancel}>
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
    </ModalOverlay>
  )
}

function ImportPreview({ input }: { input: UserInput }) {
  const segCount = input.insuredSegments?.length ?? 0
  const leaveCount = input.leavePeriods?.length ?? 0
  const attCount = input.attendances?.length ?? 0
  return (
    <dl className="import-modal__summary">
      <div>
        <dt>育休開始日</dt>
        <dd>{input.customChildCareStart ?? '自動'}</dd>
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
