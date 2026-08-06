/**
 * iPhone 13 相当の viewport で本番サイト（または http://localhost:5173/MaternityLeaveCalculator/）の
 * スクリーンショットを撮るデバッグ用スクリプト。
 *
 *   pnpm exec node scripts/screenshot.mjs <url> <out.png> [step2|step3]
 *
 * 例:
 *   pnpm exec node scripts/screenshot.mjs https://ikukyu.nkjzm.jp/ /tmp/landing.png
 *   pnpm exec node scripts/screenshot.mjs http://localhost:5173/MaternityLeaveCalculator/ /tmp/step2.png step2
 *
 * 初回は `pnpm exec playwright install chromium` が必要。
 */
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'https://ikukyu.nkjzm.jp/'
const out = process.argv[3] ?? '.claude/tmp/shot.png'
const goto = process.argv[4] // step2 | step3

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1',
})
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle' })

// シナリオ: ヒーローから「やってみる」ボタンを押して Step1 へ。Step2 まで進めてサンプル状態を作る。
if (goto === 'step2' || goto === 'step3') {
  // 「あなたの場合を判定する」ボタン
  const startBtn = page.locator('button', { hasText: /判定する|早速|試算|はじめる/ }).first()
  if (await startBtn.count()) await startBtn.click({ force: true }).catch(() => {})
  await page.waitForTimeout(800)
  // 出産予定日を入れる
  const expected = page.locator('#expectedDate')
  if (await expected.count()) {
    await expected.fill('2026-06-09').catch(() => {})
  }
  await page.waitForTimeout(400)
  // 「次へ」ボタンを押して Step2 に進む
  const goNext = async () => {
    const next = page.locator('button.wz-foot__next, button', { hasText: /次へ/ }).first()
    if (await next.count()) {
      await next.scrollIntoViewIfNeeded().catch(() => {})
      await next.click({ force: true }).catch(() => {})
      await page.waitForTimeout(400)
    }
  }
  await goNext()
  if (goto === 'step3') {
    await goNext()
    // Step3 で「+ 加入期間を追加」ボタンを押して入力カードを生やす
    const addBtn = page.locator('button.st-add', { hasText: /追加/ }).first()
    if (await addBtn.count()) await addBtn.click({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
    // 入社日を入れて表示確認
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count()) {
      await dateInputs.nth(0).fill('2024-04-01').catch(() => {})
      await dateInputs.nth(1).fill('2025-12-31').catch(() => {})
    }
  }
  // 自動入力された産休カードあたりまでスクロール
  await page.evaluate(() => window.scrollTo(0, 380))
  await page.waitForTimeout(300)
}

await page.screenshot({ path: out, fullPage: false })
await browser.close()
console.log('saved', out)
