/**
 * ガイド記事・固定ページの静的HTML生成。
 *
 * - content/guide/*.md  → dist/guide/<slug>/index.html（記事。本文内に広告枠）
 * - content/pages/*.md  → dist/<slug>/index.html（運営者情報・お問い合わせ等。広告なし）
 * - dist/guide/index.html（ガイド一覧。広告なし＝ナビ画面のため）
 * - dist/sitemap.xml を全URLで再生成
 *
 * AdSense 適合:
 *  - 本文は静的HTML（JS不要で全文表示）
 *  - 記事ごとに固有の title/description/canonical/OGP/JSON-LD(Article)
 *  - 広告は「記事本文」のみ。一覧・固定ページ・ツールの入力画面には載せない
 *
 * `pnpm build` から `tsc -b && vite build && node scripts/build-guide.mjs` の順で実行する
 * （vite build 後の dist/ に書き込む）。
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const DIST = join(root, 'dist')
const SITE = 'https://ikukyu-moraeru.github.io'
const OGP = `${SITE}/ogp.png`
const AUTHOR = 'Nakaji Kohki'
const AUTHOR_URL = 'https://nkjzm.jp/'

const CLIENT = process.env.VITE_ADSENSE_CLIENT || ''
const GUIDE_SLOT = process.env.VITE_ADSENSE_GUIDE_SLOT || ''

const md = new MarkdownIt({ html: true, linkify: true, typographer: false })

const esc = (s = '') =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function readMarkdownDir(dir) {
  const abs = join(root, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data, content } = matter(readFileSync(join(abs, f), 'utf8'))
      return { fm: data, body: content, file: f }
    })
    .filter((a) => !a.fm.draft)
}

/** AdSense ヘッダーローダ（クライアントIDがある時のみ） */
function adsenseHead() {
  if (!CLIENT) return ''
  return `\n    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}" crossorigin="anonymous"></script>`
}

/** 本文内広告枠（クライアントID・スロットIDが揃っている時のみ描画） */
function adUnit() {
  if (!CLIENT || !GUIDE_SLOT) return ''
  return `<div class="ad"><ins class="adsbygoogle" style="display:block" data-ad-client="${CLIENT}" data-ad-slot="${GUIDE_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
}

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">'

const GNAV = `<header class="gnav"><div class="gnav__inner">
      <a class="gnav__brand" href="/"><span class="mark">？</span> 育休もらえる</a>
      <nav class="gnav__links">
        <a href="/">判定ツール</a>
        <a href="/guide/">ガイド</a>
        <a href="/about/">運営者情報</a>
        <a href="/contact/">お問い合わせ</a>
      </nav>
    </div></header>`

const GFOOT = `<footer class="gfoot"><div class="gfoot__inner">
      <span>© 2026 育休もらえる？</span>
      <a href="/">判定ツール</a>
      <a href="/guide/">ガイド</a>
      <a href="/about/">運営者情報</a>
      <a href="/contact/">お問い合わせ</a>
      <a href="/privacy">プライバシー</a>
      <a href="/content-policy">コンテンツポリシー</a>
    </div></footer>`

function page({ title, description, canonical, head = '', body }) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#3a2e4f" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${OGP}" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    ${FONTS}
    <link rel="stylesheet" href="/guide.css" />${head}${adsenseHead()}
  </head>
  <body>
    ${GNAV}
    <main>
${body}
    </main>
    ${GFOOT}
  </body>
</html>
`
}

function articleJsonLd({ title, description, canonical, date, updated }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished: date,
    dateModified: updated || date,
    author: { '@type': 'Person', name: AUTHOR, url: AUTHOR_URL },
    publisher: { '@type': 'Person', name: AUTHOR },
    mainEntityOfPage: canonical,
    inLanguage: 'ja-JP',
  }
  return `\n    <script type="application/ld+json">${JSON.stringify(data)}</script>`
}

/** 本文HTMLに広告枠を挿入（導入直後＝最初のH2前、と本文末） */
function injectAds(html) {
  const ad = adUnit()
  if (!ad) return html
  const i = html.indexOf('<h2')
  const withMid = i > 0 ? html.slice(0, i) + ad + html.slice(i) : html
  return withMid + ad
}

function renderArticle(a) {
  const { fm, body } = a
  const slug = fm.slug
  const canonical = `${SITE}/guide/${slug}/`
  const bodyHtml = injectAds(md.render(body))
  const related = (fm.related || [])
    .map((s) => `<li><a href="/guide/${s}/">${esc(slugTitle(s))}</a></li>`)
    .join('\n        ')
  const relatedBlock = related
    ? `<section class="related"><h2>関連記事</h2><ul>\n        ${related}\n      </ul></section>`
    : ''
  const inner = `      <nav class="breadcrumb"><a href="/">ホーム</a> › <a href="/guide/">ガイド</a> › ${esc(fm.title)}</nav>
      <article>
        <h1>${esc(fm.title)}</h1>
        <p class="meta">公開 ${fm.date}${fm.updated ? ` ・ 更新 ${fm.updated}` : ''}</p>
        ${bodyHtml}
        <a class="tool-cta" href="/">あなたの場合をツールで判定する<small>出産日と勤務状況を入れるだけ・ブラウザ内で完結・登録不要</small></a>
        ${relatedBlock}
        <div class="author"><strong>運営者</strong>：${AUTHOR}（<a href="${AUTHOR_URL}">nkjzm.jp</a>）。本サイトの解説は雇用保険法および厚生労働省の資料に基づいて作成しています。詳しくは<a href="/about/">運営者情報</a>をご覧ください。</div>
        <p class="disclaimer">※ 本記事は参考情報です。個別の受給可否の最終判定は、管轄のハローワーク（公共職業安定所）で行われます。</p>
      </article>`
  return page({
    title: `${fm.title} | 育休もらえる？`,
    description: fm.description,
    canonical,
    head: articleJsonLd({
      title: fm.title,
      description: fm.description,
      canonical,
      date: fm.date,
      updated: fm.updated,
    }),
    body: inner,
  })
}

function renderPage(p) {
  const { fm, body } = p
  const slug = fm.slug
  const canonical = `${SITE}/${slug}/`
  const inner = `      <nav class="breadcrumb"><a href="/">ホーム</a> › ${esc(fm.title)}</nav>
      <div class="page">
        <h1>${esc(fm.title)}</h1>
        ${md.render(body)}
      </div>`
  return page({
    title: `${fm.title} | 育休もらえる？`,
    description: fm.description || fm.title,
    canonical,
    body: inner,
  })
}

// slug → タイトルの索引（関連記事リンク表示用）
let titleIndex = {}
function slugTitle(slug) {
  return titleIndex[slug] || slug
}

function write(outRel, html) {
  const dir = join(DIST, outRel)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
}

function buildSitemap(articleSlugs, pageSlugs) {
  const today = '2026-06-08'
  const urls = [
    { loc: `${SITE}/`, pri: '1.0', freq: 'monthly' },
    { loc: `${SITE}/guide/`, pri: '0.8', freq: 'weekly' },
    ...articleSlugs.map((s) => ({
      loc: `${SITE}/guide/${s}/`,
      pri: '0.7',
      freq: 'monthly',
    })),
    ...pageSlugs.map((s) => ({ loc: `${SITE}/${s}/`, pri: '0.3', freq: 'yearly' })),
    { loc: `${SITE}/privacy`, pri: '0.3', freq: 'yearly' },
    { loc: `${SITE}/content-policy`, pri: '0.3', freq: 'yearly' },
  ]
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`,
    )
    .join('\n')
  writeFileSync(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
  )
}

// ---- main ----
const articles = readMarkdownDir('content/guide').sort((a, b) =>
  (a.fm.date < b.fm.date ? 1 : -1),
)
const pages = readMarkdownDir('content/pages')

titleIndex = Object.fromEntries(articles.map((a) => [a.fm.slug, a.fm.title]))

if (!existsSync(DIST)) {
  console.error('[build-guide] dist/ が無い。先に vite build を実行してください。')
  process.exit(1)
}

for (const a of articles) write(`guide/${a.fm.slug}`, renderArticle(a))
for (const p of pages) write(p.fm.slug, renderPage(p))

// ガイド一覧（広告なし）
const listItems = articles
  .map(
    (a) =>
      `        <li><a class="guide-card" href="/guide/${a.fm.slug}/"><h2>${esc(a.fm.title)}</h2><p>${esc(a.fm.description)}</p></a></li>`,
  )
  .join('\n')
write(
  'guide',
  page({
    title: '育休給付金ガイド | 育休もらえる？',
    description:
      '育児休業給付金の受給要件・延長・転職・勤務形態など、もらえるか微妙なケースをやさしく解説するガイド集。',
    canonical: `${SITE}/guide/`,
    body: `      <nav class="breadcrumb"><a href="/">ホーム</a> › ガイド</nav>
      <div class="page">
        <h1>育休給付金ガイド</h1>
        <p>「自分の場合はもらえる？」が微妙な人向けに、受給要件・延長・転職・勤務形態などをやさしく解説します。</p>
        <ul class="guide-list">
${listItems || '        <li>準備中です。</li>'}
        </ul>
      </div>`,
  }),
)

buildSitemap(
  articles.map((a) => a.fm.slug),
  pages.map((p) => p.fm.slug),
)

console.log(
  `[build-guide] 記事 ${articles.length} 本・固定ページ ${pages.length} 件・一覧・sitemap を生成しました${CLIENT && GUIDE_SLOT ? '（広告枠あり）' : '（広告枠なし: VITE_ADSENSE_CLIENT/VITE_ADSENSE_GUIDE_SLOT 未設定）'}`,
)
