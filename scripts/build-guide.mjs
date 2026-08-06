/**
 * ガイド記事・固定ページの静的HTML生成。
 *
 * - content/guide/*.md  → dist/guide/<slug>/index.html（記事。記事末にAmazon商品リンク）
 * - content/pages/*.md  → dist/<slug>/index.html（運営者情報・お問い合わせ等。広告なし）
 * - dist/guide/index.html（ガイド一覧。広告なし＝ナビ画面のため）
 * - dist/sitemap.xml を全URLで再生成
 *
 * Amazonアソシエイト運用:
 *  - 本文は静的HTML（JS不要で全文表示）
 *  - 記事ごとに固有の title/description/canonical/OGP/JSON-LD(Article)
 *  - 商品リンクは記事末に掲載。React側ではトップと判定結果の末尾にも掲載する
 *  - ツールの入力途中には載せない
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
const SITE = 'https://ikukyu.nkjzm.jp'
const OGP = `${SITE}/ogp.png`
const AUTHOR = 'なかじ'
const AUTHOR_URL = 'https://nkjzm.jp/'

const amazonCatalog = JSON.parse(
  readFileSync(join(root, 'src/data/amazon-products.json'), 'utf8'),
)
const AMAZON_ASSOCIATE_TAG =
  process.env.AMAZON_ASSOCIATE_TAG || amazonCatalog.associateTag
const AMAZON_PRODUCTS = amazonCatalog.products

const md = new MarkdownIt({ html: true, linkify: true, typographer: false })

/**
 * インライン注釈記法 `{{ラベル|URL}}` / `{{ラベル}}`。
 * 本文の主張のすぐ横に、目立たない小さな注釈（出典など）を置くための拡張。
 *  - URL ありなら別タブで開くリンク、なしなら span。
 *  - 注釈テキストは常時 DOM に存在（ホバーで隠さない＝JS不要・全文表示）。
 *  - 表示の地味さ（小さい/薄いグレー）は guide.css の .annot で制御。
 * 独自トークンにするため linkify は URL を二重リンク化しない。
 * 開始文字 `{`(0x7B) は markdown-it の text ルールが区切りとして扱うため確実に発火する。
 */
function annotPlugin(mdit) {
  mdit.inline.ruler.before('emphasis', 'annot', (state, silent) => {
    const src = state.src
    const start = state.pos
    if (src.charCodeAt(start) !== 0x7b || src.charCodeAt(start + 1) !== 0x7b) {
      return false
    }
    const close = src.indexOf('}}', start + 2)
    if (close < 0) return false
    const inner = src.slice(start + 2, close).trim()
    if (!inner) return false
    if (!silent) {
      const sep = inner.lastIndexOf('|')
      const hasUrl = sep >= 0 && /^https?:\/\//.test(inner.slice(sep + 1).trim())
      const token = state.push('annot', '', 0)
      token.meta = hasUrl
        ? { label: inner.slice(0, sep).trim(), url: inner.slice(sep + 1).trim() }
        : { label: inner, url: '' }
    }
    state.pos = close + 2
    return true
  })
  mdit.renderer.rules.annot = (tokens, idx) => {
    const { label, url } = tokens[idx].meta
    const e = mdit.utils.escapeHtml
    return url
      ? `<a class="annot" href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)}</a>`
      : `<span class="annot">${e(label)}</span>`
  }
}
md.use(annotPlugin)

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

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;700&family=Noto+Sans+JP:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">'

const GNAV = `<header class="gnav"><div class="gnav__inner">
      <a class="gnav__brand" href="/"><img class="mark" src="/icon.png" alt="" width="32" height="32" /> 育休もらえる？</a>
      <nav class="gnav__links">
        <a href="/">判定ツール</a>
        <a href="/guide/">ガイド</a>
        <a href="/about/">運営者情報</a>
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
      <a href="/sitemap/">サイトマップ</a>
    </div></footer>`

/**
 * 記事カテゴリ（第一階層タグ。1記事1カテゴリ）。
 * バッジ・タグ一覧ページ・ガイド一覧・sitemap・構造化データの単一の出典。
 * 新記事はここに slug を1行足す（金額・申請などの新カテゴリはこの配列に追加）。
 */
const CATEGORIES = [
  {
    key: 'kiso',
    label: '受給要件の基礎',
    emoji: '📘',
    desc: '誰がもらえるか、「12か月」の数え方、もらえないときの備え。',
    slugs: ['jukyu-youken', 'moraenai-baai', 'hasuu-tsuki-15nichi'],
  },
  {
    key: 'kinmu',
    label: '勤務形態と日数',
    emoji: '🕒',
    desc: 'パート・週3・時短・契約社員。賃金支払基礎日数11日と80時間ルール。',
    slugs: ['part-time-shift-jitan', '80jikan-rule', 'chingin-shiharai-kiso-nissu'],
  },
  {
    key: 'kyuugyou',
    label: '妊娠中の休みと緩和',
    emoji: '🌸',
    desc: 'つわり・産前産後休業と、2年→最長4年の緩和のしくみ。',
    slugs: [
      'tsuwari-kyuushoku-otoshiana',
      'kanwa-saichou-4nen',
      'sankyuu-ikukyuu-kanwa',
      'sanzen-kyuugyou-mijikaku',
    ],
  },
  {
    key: 'tenshoku',
    label: '転職と期間の通算',
    emoji: '💼',
    desc: '前職の雇用保険を通算する条件と、会社ごとの完全月の数え方。',
    slugs: ['tenshoku-tsuusan', 'tenshoku-kanzengetsu-kugiri'],
  },
  {
    key: 'kaishi',
    label: '出産日と育休開始日',
    emoji: '📅',
    desc: '出産日や育休開始日のずれで、判定の2年窓が動くしくみ。',
    slugs: ['yoteibi-bure', 'ikukyuu-kaishi-zure', 'tatai'],
  },
  {
    key: 'kingaku',
    label: '金額・計算',
    emoji: '💰',
    desc: 'いくらもらえる？計算式・上限額と、社会保険料免除で手取りが増えるしくみ。',
    slugs: ['ikukyu-okane-kingaku', 'ikukyu-jitan-kyufu'],
  },
  {
    key: 'tsukaikata',
    label: '制度の使い方',
    emoji: '👨‍🍼',
    desc: '産後パパ育休・延長・分割取得。制度をどう組み合わせて取るか。',
    slugs: ['sango-papa-ikukyu', 'ikukyu-encho'],
  },
  {
    key: 'okane-naka',
    label: '育休中のお金',
    emoji: '🏦',
    desc: '社会保険料の免除・税金・住民税。育休中の家計に効くお金の話。',
    slugs: ['ikukyu-shahoken-menjo', 'ikukyu-zeikin'],
  },
  {
    key: 'shinsei',
    label: '申請手続き',
    emoji: '📋',
    desc: '申請は誰が・いつ・どの書類で。受給資格の確認から2か月ごとの申請まで。',
    slugs: ['ikukyu-shinsei', 'ikukyu-furikomi'],
  },
  {
    key: 'story',
    label: '開発ストーリー',
    emoji: '💡',
    desc: 'この判定ツールを作った理由。',
    slugs: ['naze-tsukutta'],
  },
]
const TAG_MIN = 2 // この本数以上のカテゴリだけタグ一覧ページを生成（薄いページを作らない）
const FEATURED = 'jukyu-youken' // 一覧で大型表示するピラー記事

const slugToCat = {}
for (const c of CATEGORIES) for (const s of c.slugs) slugToCat[s] = c
const hasTagPage = (cat) => cat.slugs.length >= TAG_MIN
const tagUrl = (key) => `/guide/tag/${key}/`

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
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
    <link rel="icon" type="image/png" sizes="256x256" href="/icon.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${OGP}" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    ${FONTS}
    <link rel="stylesheet" href="/guide.css" />${head}
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

function articleJsonLd({ title, description, canonical, date, updated, keywords }) {
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
    ...(keywords ? { keywords } : {}),
  }
  return `\n    <script type="application/ld+json">${JSON.stringify(data)}</script>`
}

function amazonUrl(asin) {
  return `https://www.amazon.co.jp/dp/${asin}?tag=${encodeURIComponent(AMAZON_ASSOCIATE_TAG)}`
}

function productsForArticle(slug, categoryKey) {
  if (slug === 'ikukyu-shinsei') {
    return [AMAZON_PRODUCTS['sekisei-document-file'], AMAZON_PRODUCTS['working-mother-money']]
  }
  if (slug === 'ikukyu-encho') {
    return [AMAZON_PRODUCTS['sekisei-document-file'], AMAZON_PRODUCTS['kingjim-document-file']]
  }
  if (categoryKey === 'shinsei' || categoryKey === 'kinmu') {
    return [AMAZON_PRODUCTS['sekisei-document-file'], AMAZON_PRODUCTS['kingjim-document-file']]
  }
  return [AMAZON_PRODUCTS['working-mother-money']]
}

function amazonProductsBlock(slug, categoryKey) {
  const cards = productsForArticle(slug, categoryKey)
    .slice(0, 2)
    .map((product) => {
      const url = amazonUrl(product.asin)
      return `<article class="amazon-product" data-product-id="${esc(product.id)}" data-image-retrieved-at="${esc(product.imageRetrievedAt)}">
          <a class="amazon-product__image-link" href="${esc(url)}" target="_blank" rel="nofollow sponsored noopener noreferrer">
            <img class="amazon-product__image" src="${esc(product.imageUrl)}" alt="${esc(product.name)}" loading="lazy" onerror="this.closest('.amazon-product').hidden=true" />
          </a>
          <div class="amazon-product__body">
            <h3 class="amazon-product__name">${esc(product.name)}</h3>
            <p class="amazon-product__reason">${esc(product.reason)}</p>
            <a class="amazon-product__link" href="${esc(url)}" target="_blank" rel="nofollow sponsored noopener noreferrer">Amazonで見る →</a>
          </div>
        </article>`
    })
    .join('\n        ')
  return `<section class="amazon-products" aria-labelledby="amazon-products-title">
        <p class="amazon-products__label">広告・Amazonアソシエイトリンク</p>
        <h2 id="amazon-products-title">手続きや家計管理に役立つもの</h2>
        <div class="amazon-products__grid">
        ${cards}
        </div>
        <p class="amazon-products__disclosure">Amazonのアソシエイトとして、育休もらえる？は適格販売により収入を得ています。</p>
      </section>`
}

function renderArticle(a) {
  const { fm, body } = a
  const slug = fm.slug
  const canonical = `${SITE}/guide/${slug}/`
  const bodyHtml = md.render(body)
  const cat = slugToCat[slug]
  const catBadge = cat
    ? hasTagPage(cat)
      ? `<div class="cat-row"><a class="cat-badge" href="${tagUrl(cat.key)}"><span aria-hidden="true">${cat.emoji}</span>${esc(cat.label)}</a></div>`
      : `<div class="cat-row"><span class="cat-badge"><span aria-hidden="true">${cat.emoji}</span>${esc(cat.label)}</span></div>`
    : ''
  const related = (fm.related || [])
    .map((s) => `<li><a href="/guide/${s}/">${esc(slugTitle(s))}</a></li>`)
    .join('\n        ')
  const relatedBlock = related
    ? `<section class="related"><h2>関連記事</h2><ul>\n        ${related}\n      </ul></section>`
    : ''
  const inner = `      <nav class="breadcrumb"><a href="/">ホーム</a> › <a href="/guide/">ガイド</a> › ${esc(fm.title)}</nav>
      <article>
        ${catBadge}
        <h1>${esc(fm.title)}</h1>
        <p class="meta">公開 ${fm.date}${fm.updated ? ` ・ 更新 ${fm.updated}` : ''}</p>
        ${bodyHtml}
        <a class="tool-cta" href="/">
          <span class="tool-cta__body">
            <span class="tool-cta__label">無料の判定ツール</span>
            <span class="tool-cta__title">あなたの場合、もらえる？を確かめる</span>
            <span class="tool-cta__sub">出産日と勤務状況を入れるだけ。ブラウザ内で完結・登録不要。</span>
          </span>
          <span class="tool-cta__btn">判定する →</span>
        </a>
        ${amazonProductsBlock(slug, cat?.key)}
        ${relatedBlock}
        <div class="author"><strong>運営者</strong>：${AUTHOR}（<a href="${AUTHOR_URL}">nkjzm.jp</a>）。このサイトは、妻の「週3＋副業」という働き方で育休給付金をもらえるか分からず悩んだ経験から作りました（<a href="/guide/naze-tsukutta/">作った理由</a>）。本サイトの解説は雇用保険法および厚生労働省の資料に基づいて作成しています。詳しくは<a href="/about/">運営者情報</a>をご覧ください。</div>
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
      keywords: cat ? cat.label : undefined,
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

/** カテゴリのタグ一覧ページ（記事カードを並べる）。CollectionPage 構造化データ付き。 */
function renderTagPage(cat) {
  const canonical = `${SITE}/guide/tag/${cat.key}/`
  const cards = cat.slugs
    .map((s) => bySlug[s])
    .filter(Boolean)
    .map((a) => guideCard(a, a.fm.slug === FEATURED))
    .join('\n')
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${cat.label}｜育休もらえる？`,
    description: cat.desc,
    url: canonical,
    inLanguage: 'ja-JP',
  }
  return page({
    title: `${cat.label}の記事一覧 | 育休もらえる？`,
    description: cat.desc,
    canonical,
    head: `\n    <script type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
    body: `      <nav class="breadcrumb"><a href="/">ホーム</a> › <a href="/guide/">ガイド</a> › ${esc(cat.label)}</nav>
      <div class="page guide-index">
        <h1>${cat.emoji} ${esc(cat.label)}</h1>
        <p>${esc(cat.desc)}</p>
        <ul class="guide-list">
${cards}
        </ul>
        <p class="tag-back"><a href="/guide/">← ガイド一覧へ戻る</a></p>
      </div>`,
  })
}

/**
 * HTMLサイトマップ（人間が読める全ページ一覧）。`/sitemap/` に出力。
 * GitHub Pages の sitemap.xml が Search Console で取得されない問題の迂回策。
 * クロール可能な実HTMLページなので、通常クロールでのページ発見を補強する。
 * 記事のグルーピングは sitemap.xml・一覧と同じ CATEGORIES を単一出典に使う。
 * （調査記録: docs/sitemap-fetch-issue.md）
 */
function renderHtmlSitemap(pageList) {
  const canonical = `${SITE}/sitemap/`
  const link = (href, text) => `<li><a href="${href}">${esc(text)}</a></li>`
  const mainLinks = [
    link('/', '判定ツール（トップ）'),
    link('/guide/', '育休給付金ガイド（記事一覧）'),
  ].join('\n          ')
  const catSections = CATEGORIES.map((cat) => {
    const items = cat.slugs.map((s) => bySlug[s]).filter(Boolean)
    if (!items.length) return ''
    const heading = hasTagPage(cat)
      ? `<a href="${tagUrl(cat.key)}">${cat.emoji} ${esc(cat.label)}</a>`
      : `${cat.emoji} ${esc(cat.label)}`
    const lis = items
      .map((a) => link(`/guide/${a.fm.slug}/`, a.fm.title))
      .join('\n          ')
    return `        <h3>${heading}</h3>\n        <ul>\n          ${lis}\n        </ul>`
  })
    .filter(Boolean)
    .join('\n')
  const pageLinks = [
    ...pageList.map((p) => link(`/${p.fm.slug}/`, p.fm.title)),
    link('/privacy', 'プライバシーポリシー'),
    link('/content-policy', 'コンテンツポリシー'),
  ].join('\n          ')
  return page({
    title: 'サイトマップ | 育休もらえる？',
    description: '「育休もらえる？」の全ページ一覧（HTMLサイトマップ）。',
    canonical,
    body: `      <nav class="breadcrumb"><a href="/">ホーム</a> › サイトマップ</nav>
      <div class="page">
        <h1>サイトマップ</h1>
        <p>「育休もらえる？」の全ページ一覧です。</p>
        <h2>メイン</h2>
        <ul>
          ${mainLinks}
        </ul>
        <h2>ガイド記事</h2>
${catSections}
        <h2>運営情報</h2>
        <ul>
          ${pageLinks}
        </ul>
      </div>`,
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

function buildSitemap(articleList, pageSlugs, tagKeys = []) {
  // lastmod は記事ごとに updated（無ければ date）を使う。トップ・一覧・タグ・固定ページは
  // 最新の記事更新日（siteLastmod）を当てる。Search Console に更新が正しく伝わるようにするため。
  const lastmodOf = (fm) => fm.updated || fm.date
  const siteLastmod =
    articleList
      .map((a) => lastmodOf(a.fm))
      .filter(Boolean)
      .sort()
      .at(-1) || '2026-06-20'
  const urls = [
    { loc: `${SITE}/`, pri: '1.0', freq: 'monthly', lastmod: siteLastmod },
    { loc: `${SITE}/guide/`, pri: '0.8', freq: 'weekly', lastmod: siteLastmod },
    ...tagKeys.map((k) => ({
      loc: `${SITE}/guide/tag/${k}/`,
      pri: '0.5',
      freq: 'weekly',
      lastmod: siteLastmod,
    })),
    ...articleList.map((a) => ({
      loc: `${SITE}/guide/${a.fm.slug}/`,
      pri: '0.7',
      freq: 'monthly',
      lastmod: lastmodOf(a.fm),
    })),
    ...pageSlugs.map((s) => ({
      loc: `${SITE}/${s}/`,
      pri: '0.3',
      freq: 'yearly',
      lastmod: siteLastmod,
    })),
    { loc: `${SITE}/privacy`, pri: '0.3', freq: 'yearly', lastmod: siteLastmod },
    { loc: `${SITE}/content-policy`, pri: '0.3', freq: 'yearly', lastmod: siteLastmod },
    { loc: `${SITE}/sitemap/`, pri: '0.3', freq: 'monthly', lastmod: siteLastmod },
  ]
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`,
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

// ガイド一覧（広告なし）。カテゴリ（CATEGORIES）をそのままセクションに使う。
function guideCard(a, featured = false) {
  const emoji = a.fm.emoji || '📄'
  return `        <li><a class="guide-card${featured ? ' guide-card--featured' : ''}" href="/guide/${a.fm.slug}/"><span class="guide-card__emoji" aria-hidden="true">${emoji}</span><span class="guide-card__body"><h3>${esc(a.fm.title)}</h3><p>${esc(a.fm.description)}</p></span></a></li>`
}

const bySlug = Object.fromEntries(articles.map((a) => [a.fm.slug, a]))

// カテゴリ未登録の記事があれば警告（一覧から漏れる）。CATEGORIES に slug を足して解消する。
const unplaced = articles.filter((a) => !slugToCat[a.fm.slug]).map((a) => a.fm.slug)
if (unplaced.length) {
  console.warn(
    `[build-guide] カテゴリ未登録の記事: ${unplaced.join(', ')}（CATEGORIES に追加してください）`,
  )
}

const sectionsHtml = CATEGORIES.map((cat) => {
  const items = cat.slugs.map((s) => bySlug[s]).filter(Boolean)
  if (!items.length) return ''
  const cards = items.map((a) => guideCard(a, a.fm.slug === FEATURED)).join('\n')
  const heading = hasTagPage(cat)
    ? `<a href="${tagUrl(cat.key)}">${cat.emoji} ${esc(cat.label)}</a>`
    : `${cat.emoji} ${esc(cat.label)}`
  return `      <section class="guide-section">
        <h2>${heading}</h2>
        <p class="guide-section__desc">${esc(cat.desc)}</p>
        <ul class="guide-list">
${cards}
        </ul>
      </section>`
}).join('\n')

// カテゴリのタグ一覧ページ（記事 TAG_MIN 本以上のカテゴリのみ＝薄いページを作らない）
const tagKeys = []
for (const cat of CATEGORIES) {
  if (!hasTagPage(cat)) continue
  if (!cat.slugs.some((s) => bySlug[s])) continue
  write(`guide/tag/${cat.key}`, renderTagPage(cat))
  tagKeys.push(cat.key)
}

write(
  'guide',
  page({
    title: '育休給付金ガイド | 育休もらえる？',
    description:
      '育児休業給付金の受給要件・延長・転職・勤務形態など、もらえるか微妙なケースをやさしく解説するガイド集。',
    canonical: `${SITE}/guide/`,
    body: `      <nav class="breadcrumb"><a href="/">ホーム</a> › ガイド</nav>
      <div class="page guide-index">
        <h1>育休給付金ガイド</h1>
        <p>「自分の場合はもらえる？」が微妙な人向けに、受給要件・延長・転職・勤務形態などをやさしく解説します。</p>
${sectionsHtml || '        <p>準備中です。</p>'}
      </div>`,
  }),
)

// HTMLサイトマップ（/sitemap/）。フッターから全ページ到達可能にしてある。
write('sitemap', renderHtmlSitemap(pages))

buildSitemap(
  articles,
  pages.map((p) => p.fm.slug),
  tagKeys,
)

console.log(
  `[build-guide] 記事 ${articles.length} 本・固定ページ ${pages.length} 件・タグ一覧 ${tagKeys.length} 件・一覧・sitemap を生成しました（Amazon商品リンクあり）`,
)
