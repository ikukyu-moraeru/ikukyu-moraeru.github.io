# Search Console サイトマップ「取得できませんでした」問題の調査記録

2026-06-23 作成。Google Search Console（GSC）で `sitemap.xml` が「取得できませんでした」のまま解消しない件の調査ログ。

## 症状

- GSC のサイトマップ画面で `/sitemap.xml` が **「取得できませんでした」**・検出ページ数 0・**最終読み込み日時が空欄**（一度も読み込み成功していない）。
- GSC プロパティの登録は **2026-06-08 ごろ**（新規プロパティのラグでは説明できない経過時間）。
- 数日〜2週間待っても解消しない。
- `?1` クエリ付与（`/sitemap.xml?1`）を試したが同じく失敗。

## 結論（重要）

**サイト側は完全に正常。これは GitHub Pages（`*.github.io` 無料版）× Google の構造的な既知問題で、無料 github.io のままでは確実な特効薬がない。** ただし**ページ自体は通常クロールで正常にインデックス済み**（`site:ikukyu-moraeru.github.io` で複数ヒット確認）なので、実害は小さい。

## 検証で確認した事実（サイト側はすべて正常）

| 項目 | 結果 |
|---|---|
| 公開 URL の取得 | HTTP 200 |
| Content-Type | `application/xml`（通常・`?1`付き・Googlebot UA・gzip要求・別エッジ5回、**全条件で正常**） |
| XML 妥当性 | well-formed（`xmllint` OK） |
| BOM | なし |
| URL 件数 | 39件、すべて https・同一ホストに統一 |
| robots.txt | `Allow: /` ＋ `Sitemap:` 行あり（正しい） |
| 所有権確認 | `index.html` に `google-site-verification` メタタグあり |
| **Bing Webmaster Tools** | **同じ sitemap を取得成功**（＝サーバー/ファイルは健全） |
| 実 Google での `site:` | **複数ページがインデックス済み** |

→ ネット事例で多数派の原因である **Content-Type バグ（XML を `text/plain`/`text/html` で返す）には該当しない**。設定面はやれることを全部やった状態。

## 効かなかった / 効かない対処

- `?1` などクエリ付与 … 試して失敗
- robots.txt への `Sitemap:` 記載 … 既に実施済み（効果頭打ち）
- Google ping … 廃止済みで無効
- `.nojekyll` 追加 … Content-Type 問題に無関係（そもそも今回は該当せず）

## 今後の選択肢

1. **現状維持 ＋ 新規記事は URL 検査で個別インデックス申請**（推奨・低コスト）
   - 小規模（39URL）＆内部リンク整備済みのため、sitemap 未読でも通常クロールで発見される。
   - 失う実利は「新規ページ発見がやや遅れる」「lastmod が伝わらない」程度で、個別申請でほぼ相殺できる。
2. **カスタムドメイン化**（根本策）
   - 配信経路が変わり解消報告が多数。SEO・ブランディング面でも github.io より有利。
   - 実施時は CNAME 追加 ＋ robots/sitemap/構造化データの絶対 URL 書き換えが必要。

## 参考リンク

- [Github Pages (free version) - sitemap.xml not being fetched by Google (community #199426)](https://github.com/orgs/community/discussions/199426)
- [GitHub Pages sitemap.xml not being fetched in GSC, while working on Bing (Google Search Central)](https://support.google.com/webmasters/thread/333035076/)
- [Google Search Console can't fetch sitemap on GitHub Pages (DEV)](https://dev.to/stankukucka/google-search-console-cant-fetch-sitemap-on-github-pages-31kn)
- [GitHub Pages の Content-Type バグ解説 (Zenn)](https://zenn.dev/uv/articles/github-pages-sitemap-content-type-bug)
