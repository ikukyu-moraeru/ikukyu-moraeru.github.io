---
title: "転職した人の「12か月」はどう数える？完全月の区切りは会社ごとに変わる"
description: "育休給付金の完全月は、現職は育休開始日から、前職はその離職日から遡って区切ります。転職をまたぐ月を合成したり、2社の勤務日数を合算したりはしません。入社月に19日働いても完全月にならない理由と、頭の半端が0.5か月になる仕組みを図解します。"
slug: "tenshoku-kanzengetsu-kugiri"
date: "2026-06-11"
updated: "2026-06-11"
tags: ["受給要件", "転職", "みなし被保険者期間"]
related: ["tenshoku-tsuusan", "hasuu-tsuki-15nichi", "jukyu-youken"]
draft: false
---

A社の最後の月に6日、B社の最初の月に6日。合わせて12日働いたから「11日以上の月」が1つできる——とはなりません。転職をまたぐ月は、そもそも作られないからです。育休給付金の「12か月」を数える物差しは1本の直線ではなく、**会社ごとに右端を合わせて当て直されます**。

転職して間もない人の受給判定はここで結果が動くのに、通算できる「条件」の解説はあっても「数え方」まで踏み込んだ説明はほとんど見当たりません。仕組みを図で押さえておきましょう。

## 区切りの起点は「その会社にいた期間の終わりの日」

完全月は1か月ごとの区切りですが、どこから遡って区切るかが会社ごとに違います。いま在籍している会社は**育休開始日**から{{みなし被保険者期間の区切りは業務取扱要領（育児休業給付）59523|https://www.mhlw.go.jp/content/001684266.pdf}}、通算する前職は**その会社を辞めた日（離職日）の翌日**から、それぞれ左へ1か月ずつ遡ります{{被保険者期間は離職票ごとに離職日から区切って通算する・行政手引50103・50104|https://www.mhlw.go.jp/content/001689746.pdf}}。

<svg viewBox="0 0 720 240" role="img" aria-label="完全月の区切りの図。前職は離職日から、現職は育休開始日から、それぞれ左へ1か月ずつ区切る。会社の変わり目をまたぐ月は作らない。" style="max-width:100%;height:auto;">
  <defs>
    <pattern id="hatchA" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fdf6fa"/><line x1="0" y1="0" x2="0" y2="6" stroke="#cfa3ba" stroke-width="1.6"/></pattern>
    <pattern id="hatchB" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f3faf6"/><line x1="0" y1="0" x2="0" y2="6" stroke="#92bfa9" stroke-width="1.6"/></pattern>
  </defs>
  <text x="180" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="#8a4a68">前職（A社）</text>
  <text x="485" y="30" text-anchor="middle" font-size="14" font-weight="bold" fill="#3f7a60">現職（B社）</text>
  <text x="296" y="92" text-anchor="end" font-size="12" fill="#8a4a68">離職日 ▼</text>
  <text x="640" y="92" text-anchor="middle" font-size="12" fill="#3f7a60">▼ 育休開始日</text>
  <rect x="60" y="100" width="240" height="34" fill="#fbeef5" stroke="#b88aa0"/>
  <rect x="60" y="100" width="80" height="34" fill="url(#hatchA)" stroke="#b88aa0"/>
  <line x1="140" y1="94" x2="140" y2="140" stroke="#8a4a68" stroke-width="1.5"/>
  <line x1="220" y1="94" x2="220" y2="140" stroke="#8a4a68" stroke-width="1.5"/>
  <line x1="300" y1="88" x2="300" y2="140" stroke="#8a4a68" stroke-width="3"/>
  <rect x="330" y="100" width="310" height="34" fill="#ecf6f0" stroke="#7fae97"/>
  <rect x="330" y="100" width="70" height="34" fill="url(#hatchB)" stroke="#7fae97"/>
  <line x1="400" y1="94" x2="400" y2="140" stroke="#3f7a60" stroke-width="1.5"/>
  <line x1="480" y1="94" x2="480" y2="140" stroke="#3f7a60" stroke-width="1.5"/>
  <line x1="560" y1="94" x2="560" y2="140" stroke="#3f7a60" stroke-width="1.5"/>
  <line x1="640" y1="88" x2="640" y2="140" stroke="#3f7a60" stroke-width="3"/>
  <line x1="315" y1="52" x2="315" y2="146" stroke="#c0392b" stroke-width="1.2" stroke-dasharray="4 3"/>
  <text x="315" y="44" text-anchor="middle" font-size="12" fill="#c0392b">ここをまたぐ完全月は作らない</text>
  <text x="100" y="158" text-anchor="middle" font-size="12" fill="#8a4a68">端数</text>
  <text x="180" y="158" text-anchor="middle" font-size="12" fill="#555">完全月</text>
  <text x="260" y="158" text-anchor="middle" font-size="12" fill="#555">完全月</text>
  <text x="365" y="158" text-anchor="middle" font-size="12" fill="#3f7a60">端数</text>
  <text x="440" y="158" text-anchor="middle" font-size="12" fill="#555">完全月</text>
  <text x="520" y="158" text-anchor="middle" font-size="12" fill="#555">完全月</text>
  <text x="600" y="158" text-anchor="middle" font-size="12" fill="#555">完全月</text>
  <text x="180" y="186" text-anchor="middle" font-size="13" fill="#8a4a68">← 離職日から1か月ずつ遡る</text>
  <text x="485" y="186" text-anchor="middle" font-size="13" fill="#3f7a60">← 育休開始日から1か月ずつ遡る</text>
  <text x="360" y="216" text-anchor="middle" font-size="12" fill="#888">区切り切れなかった各社の頭（斜線部）が「端数」になる</text>
</svg>

たとえば育休開始日が4月15日なら、現職の完全月は3月15日〜4月14日、2月15日〜3月14日……と「15日区切り」。一方、前職を10月10日に辞めていたら、前職の完全月は9月11日〜10月10日、8月11日〜9月10日……と「11日区切り」です。同じ人の経歴の中に、区切り日の違う2本の物差しが並びます。離職した翌日にすぐ再就職した場合でも、雇用保険の資格はいったん切り替わるため、この数え方は変わりません。

## 入社した月に19日働いても、1か月に数えられない

区切りが会社ごとである以上、会社の変わり目をまたぐ完全月は存在せず、2社の賃金支払基礎日数を1つの月に合算することもありません。「通算」とは、**会社ごとに数えた月数を足し算すること**です。

このルールがいちばん効くのが、各社の「頭」、つまり入社直後です。ハローワークの記入見本には、入社月の頭の19日間に賃金支払基礎日数が19日あるケースについて「完全な1か月となっていないため、11日以上ある月としてカウントすることはできません」と明記されています{{東京ハローワーク「休業開始時賃金月額証明書 記入見本【例3】」|https://jsite.mhlw.go.jp/tokyo-hellowork/content/contents/001531745.pdf}}。どれだけ働いていても、区切りに収まらない半端は完全月にならないのです。

## そのかわり、頭の半端は0.5か月になることがある

切り捨てられるだけでは不公平なので、救済があります。各社の頭に残った半端は、日数が15日以上あり、その中の賃金支払基礎日数が11日以上（届かなければ賃金支払基礎時間数80時間以上）なら、**0.5か月**として数えられます{{端数の取扱いは業務取扱要領59523・行政手引50103に準拠|https://www.mhlw.go.jp/content/001684266.pdf}}。これは会社ごとに発生するので、転職した人は0.5が2つ、つまり1か月分まで積み上がる余地があります。

数字で見ると、現職で7完全月＋頭の半端0.5、前職で4完全月＋頭の半端0.5なら、合計12.0か月でちょうど要件に到達します。完全月だけ数えて「11か月で足りない」と諦める前に、各社の頭の半端を確かめる価値があります。端数の条件の詳細は[端数月「0.5か月」が数えられる条件](/guide/hasuu-tsuki-15nichi/)にまとめています。ただし端数込みでぎりぎり届くケースは窓口の運用で差が出やすいので、最終判断は必ずハローワークで確認してください。

## 休職は区切りを動かさない（動くのは「辞めた」ときだけ）

紛らわしいのが休職との違いです。病気や産前産後で長く休んでも、在籍したままなら雇用保険の資格は続いているので、区切りは1日も動きません。休みがかかった月の賃金支払基礎日数が減って0カウントになるだけで、無給の休みが連続30日以上あれば[判定対象期間を延ばす緩和](/guide/kanwa-saichou-4nen/)の対象になります。物差しが当て直されるのは、退職して資格が途切れたときだけです。

自分の経歴で区切りがどこに入り、どの月が数えられるかを手で追うのは大変です。本サイトの判定ツールは、勤務先ごとに区切りを作り、完全月と端数を法令どおりに数えて12か月に届くかを計算します。前職の入社日・離職日まで含めて入力して試してみてください。通算できる条件（離職から1年以内・失業給付の受給資格を決定していない）は[前職通算の解説](/guide/tenshoku-tsuusan/)、要件の全体像は[受給要件のまとめ](/guide/jukyu-youken/)へ。
