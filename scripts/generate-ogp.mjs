import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../public/ogp.png')

// OGP standard size: 1200x630
const W = 1200
const H = 630

// Sample heatmap cells (mimics the landing page grid)
const cells = [
  { status: 'fail', months: '10.5', label: '5/3' },
  { status: 'fail', months: '11.0', label: '5/4' },
  { status: 'near', months: '11.5', label: '5/5' },
  { status: 'near', months: '11.5', label: '5/6' },
  { status: 'pass', months: '12.0', label: '5/7', expected: true },
  { status: 'pass', months: '12.0', label: '5/8' },
  { status: 'pass', months: '12.5', label: '5/9' },
  { status: 'pass', months: '12.5', label: '5/10' },
  { status: 'pass', months: '13.0', label: '5/11' },
  { status: 'pass', months: '13.0', label: '5/12' },
  { status: 'pass', months: '13.5', label: '5/13' },
  { status: 'pass', months: '13.5', label: '5/14' },
]

const COLOR = {
  bg: '#fff7f3',
  plum: '#3a2e4f',
  plumDeep: '#1c1428',
  pink: '#ec8aa3',
  pinkDeep: '#c45c7a',
  mint: '#6cbe9a',
  mintDeep: '#3f8e6c',
  gold: '#f3cf76',
  goldDeep: '#8a6a1a',
  bg2: '#fde6df',
  bg3: '#cee9d6',
  white: '#ffffff',
}

function cellSvg(cell, x, y, size) {
  const r = 14
  const pad = 4

  let bg1, bg2, border, textColor
  if (cell.status === 'pass') {
    bg1 = COLOR.bg3; bg2 = COLOR.mint; border = COLOR.mint; textColor = '#1f3a2c'
  } else if (cell.status === 'near') {
    bg1 = '#fff5d4'; bg2 = COLOR.gold; border = COLOR.gold; textColor = COLOR.goldDeep
  } else {
    bg1 = COLOR.bg2; bg2 = COLOR.pink; border = COLOR.pink; textColor = '#4a1924'
  }

  const gradId = `g${x}_${y}`
  const parts = []

  parts.push(`<defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>`)

  parts.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="url(#${gradId})" stroke="${border}" stroke-width="1.5"/>`)

  // date label
  const dateY = y + size * 0.36
  parts.push(`<text x="${x + size / 2}" y="${dateY}" text-anchor="middle" font-family="'DM Mono', monospace" font-size="11" fill="${textColor}" opacity="0.8">${cell.label}</text>`)

  // months number
  const numY = y + size * 0.68
  parts.push(`<text x="${x + size / 2}" y="${numY}" text-anchor="middle" font-family="'Zen Maru Gothic', sans-serif" font-weight="900" font-size="18" fill="${textColor}">${cell.months}</text>`)

  // "予" pin for expected date
  if (cell.expected) {
    const px = x + size - pad - 10
    const py = y + pad + 10
    parts.push(`<circle cx="${px}" cy="${py}" r="12" fill="${COLOR.plum}" stroke="${COLOR.white}" stroke-width="2"/>`)
    parts.push(`<text x="${px}" y="${py + 4}" text-anchor="middle" font-family="'Zen Maru Gothic', sans-serif" font-weight="900" font-size="10" fill="white">予</text>`)
  }

  return parts.join('\n')
}

// Build grid
const COLS = 6
const CELL_SIZE = 72
const CELL_GAP = 8
const GRID_W = COLS * CELL_SIZE + (COLS - 1) * CELL_GAP
const ROWS = Math.ceil(cells.length / COLS)
const GRID_H = ROWS * CELL_SIZE + (ROWS - 1) * CELL_GAP

// Right side starts at x=640
const RIGHT_X = 620
const GRID_START_X = RIGHT_X + (W - RIGHT_X - GRID_W) / 2
const GRID_START_Y = (H - GRID_H) / 2 + 20

const gridCells = cells.map((cell, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const cx = GRID_START_X + col * (CELL_SIZE + CELL_GAP)
  const cy = GRID_START_Y + row * (CELL_SIZE + CELL_GAP)
  return cellSvg(cell, cx, cy, CELL_SIZE)
}).join('\n')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLOR.bg}"/>
      <stop offset="60%" stop-color="#fef0f5"/>
      <stop offset="100%" stop-color="#e8f6ef"/>
    </linearGradient>
    <!-- decorative blobs -->
    <radialGradient id="blob1" cx="50%" cy="50%">
      <stop offset="0%" stop-color="${COLOR.pink}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${COLOR.pink}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob2" cx="50%" cy="50%">
      <stop offset="0%" stop-color="${COLOR.mint}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${COLOR.mint}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- background -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <!-- decorative blobs -->
  <ellipse cx="80" cy="80" rx="220" ry="220" fill="url(#blob1)"/>
  <ellipse cx="520" cy="580" rx="280" ry="280" fill="url(#blob2)"/>
  <ellipse cx="1150" cy="550" rx="180" ry="180" fill="url(#blob1)" opacity="0.4"/>

  <!-- left side divider -->
  <line x1="600" y1="60" x2="600" y2="${H - 60}" stroke="${COLOR.plum}" stroke-width="1" stroke-opacity="0.1"/>

  <!-- logo mark -->
  <circle cx="56" cy="52" r="22" fill="${COLOR.plum}"/>
  <text x="56" y="59" text-anchor="middle" font-family="'Zen Maru Gothic', sans-serif" font-weight="900" font-size="18" fill="white">？</text>
  <text x="88" y="60" font-family="'Zen Maru Gothic', sans-serif" font-weight="700" font-size="16" fill="${COLOR.plum}">育休もらえる？</text>

  <!-- pill badge -->
  <rect x="48" y="108" width="246" height="30" rx="15" fill="${COLOR.bg3}"/>
  <text x="171" y="128" text-anchor="middle" font-family="'Zen Maru Gothic', sans-serif" font-weight="700" font-size="12" fill="${COLOR.mintDeep}">転職・休職・シフト制で、ぎりぎりかもしれない方へ</text>

  <!-- main headline line 1 -->
  <text x="48" y="230" font-family="'Zen Maru Gothic', sans-serif" font-weight="900" font-size="72" fill="${COLOR.plum}">育休給付金、</text>

  <!-- main headline line 2 (gradient) -->
  <defs>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${COLOR.pink}"/>
      <stop offset="100%" stop-color="${COLOR.pinkDeep}"/>
    </linearGradient>
  </defs>
  <text x="48" y="330" font-family="'Zen Maru Gothic', sans-serif" font-weight="900" font-size="88" fill="url(#accentGrad)">もらえる？</text>

  <!-- sub copy -->
  <text x="48" y="400" font-family="'Zen Maru Gothic', sans-serif" font-size="18" fill="${COLOR.ink ?? '#2b2233'}" opacity="0.75">出産日のぶれや産休・転職・シフトを全部考慮して、</text>
  <text x="48" y="428" font-family="'Zen Maru Gothic', sans-serif" font-size="18" fill="${COLOR.ink ?? '#2b2233'}" opacity="0.75">あなたの場合に受け取れるかを１日ずつ判定します。</text>

  <!-- CTA badge -->
  <rect x="48" y="468" width="220" height="48" rx="24" fill="${COLOR.plum}"
    filter="drop-shadow(0 6px 0 ${COLOR.plumDeep})"/>
  <text x="158" y="499" text-anchor="middle" font-family="'Zen Maru Gothic', sans-serif" font-weight="700" font-size="17" fill="white">あなたの場合を判定する</text>

  <!-- right side: card background -->
  <rect x="${RIGHT_X + 10}" y="40" width="${W - RIGHT_X - 30}" height="${H - 80}" rx="24"
    fill="white" opacity="0.7"
    filter="drop-shadow(0 20px 40px rgba(58,46,79,0.12))"/>

  <!-- card header -->
  <text x="${RIGHT_X + (W - RIGHT_X) / 2}" y="100" text-anchor="middle"
    font-family="'Zen Maru Gothic', sans-serif" font-weight="900" font-size="16"
    fill="${COLOR.plum}">出産日ごとに「もらえる？」</text>
  <text x="${RIGHT_X + (W - RIGHT_X) / 2}" y="124" text-anchor="middle"
    font-family="'Zen Maru Gothic', sans-serif" font-size="12"
    fill="${COLOR.plum}" opacity="0.5">予定日の周辺を 1 日ずつ判定</text>

  <!-- heatmap grid -->
  ${gridCells}

  <!-- legend -->
  <rect x="${RIGHT_X + 40}" y="${H - 80}" width="76" height="24" rx="12" fill="${COLOR.bg3}"/>
  <text x="${RIGHT_X + 78}" y="${H - 63}" text-anchor="middle" font-family="'Zen Maru Gothic', sans-serif" font-weight="700" font-size="11" fill="${COLOR.mintDeep}">受け取れる</text>

  <rect x="${RIGHT_X + 130}" y="${H - 80}" width="86" height="24" rx="12" fill="#fff5d4"/>
  <text x="${RIGHT_X + 173}" y="${H - 63}" text-anchor="middle" font-family="'Zen Maru Gothic', sans-serif" font-weight="700" font-size="11" fill="${COLOR.goldDeep}">あと少し届かない</text>

  <rect x="${RIGHT_X + 230}" y="${H - 80}" width="76" height="24" rx="12" fill="${COLOR.bg2}"/>
  <text x="${RIGHT_X + 268}" y="${H - 63}" text-anchor="middle" font-family="'Zen Maru Gothic', sans-serif" font-weight="700" font-size="11" fill="${COLOR.pinkDeep}">受け取れない</text>
</svg>`

// Write SVG for inspection
writeFileSync(resolve(__dirname, '../.claude/tmp/ogp-preview.svg'), svg)
console.log('SVG written to .claude/tmp/ogp-preview.svg')

// Convert to PNG via sharp
await sharp(Buffer.from(svg))
  .png()
  .toFile(OUT_PATH)

console.log(`OGP PNG generated: ${OUT_PATH}`)
console.log(`Size: 1200x630`)
