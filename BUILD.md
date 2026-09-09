# 這個網站怎麼改

以前每一頁都各自複製了一份導覽列、頁尾和共用 JS，改一次要改 25 個檔案。
現在共用的部分只存在一份，用 `build.py` 組裝出根目錄的 HTML。

## 日常流程

1. 改 `src/` 底下的東西
2. 在專案資料夾執行：`python build.py`
3. 確認網站沒問題後 commit + push

> 根目錄的 `.html` 都是產生出來的，**不要直接編輯**，下次 build 會被覆蓋。

## 目錄結構

```
build.py                  組裝腳本（純 Python，不用裝任何套件）
src/
  site.json               全站設定：站名、網址、導覽列、社群連結、外部套件、舊網址轉址
  partials/
    head.html             每頁的 <head>
    nav.html              側邊導覽 + 手機版選單
    footer.html           頁尾
    back-to-top.html      回到頂端按鈕
    scripts.html          共用 JS（選單開關、回到頂端）
    scrollspy.js          長文頁的側邊目錄高亮（用 include 引入）
    redirect.html         舊網址轉址頁的樣板
  pages/                  每一頁獨有的內容
```

## 常見的改法

**改選單項目**：編輯 `src/site.json` 的 `nav`
**改頁尾社群連結**：編輯 `src/site.json` 的 `social`
**改年份 / 站名**：編輯 `src/site.json` 的 `year` / `site_name`
**新增一頁**：在 `src/pages/` 新增一個 `.html`，最上面放 meta 區塊即可

## 頁面 meta 可用的欄位

```html
<!--meta
title: 頁面標題              # 會自動接上「｜黃安睿 AN JUI」
description: 這頁的簡介       # 用於 SEO 與分享預覽
nav: project.html           # 導覽列要高亮哪一項（預設是自己）
main_class: main-stage scroll-layout   # 預設 main-stage
footer: false               # 不要頁尾（預設有）
back_to_top: false          # 不要回到頂端按鈕（預設有）
libs: lightbox              # 要載入的外部套件，逗號分隔（定義在 site.json）
include: scrollspy          # 要引入的共用 JS 片段
noindex: true               # 不要被搜尋引擎收錄
output: 別的檔名.html        # 產出的檔名（預設同 src 檔名）
-->
```

meta 之後就是這頁的內容。其中：

- `<style>` 區塊會自動搬到 `<head>`
- `<script>` 區塊會自動搬到 `</body>` 前
- `<!--body-prefix--> ... <!--/body-prefix-->` 會放在導覽列之前（首頁的自訂游標用這個）
- `<!--body-suffix--> ... <!--/body-suffix-->` 會放在 `</main>` 之後（燈箱、彈窗容器用這個）
- 其餘內容會被包進 `<main>`

## build.py 順便做的事

- 依 `site.json` 的 `redirects` 產生舊網址轉址頁（舊連結不會壞掉）
- 產生 `sitemap.xml` 與 `robots.txt`
- 導覽列的 active 狀態在 build 時就寫死，不再需要 jQuery

## 放圖片與影片的規矩

圖片和影片是這個站最大的重量來源，加新的時候照著做就不會又胖回去：

- **圖片最長邊不要超過 2000px**。手機直出的 4032px 照片請先縮過再放進來。
- `<img>` 一律要有 `alt`。除了每頁第一張（首屏主圖）之外，都要加
  `loading="lazy" decoding="async"` 和 `width` / `height`。
  width/height 是給瀏覽器算比例用的，載入時版面才不會跳動。
- **影片**：不要寫 `autoplay`。改成
  `preload="none" data-autoplay-in-view poster="assets/img/posters/xxx.jpg"`，
  共用 JS 會在它滑進畫面時才開始載入播放，離開畫面自動暫停。
  poster 首幀可以這樣抽：

  ```bash
  ffmpeg -ss 0.5 -i 影片.mp4 -frames:v 1 -q:v 4 assets/img/posters/影片.jpg
  ```

- 螢幕錄影請壓過再放：`-vf scale=960:-2 -crf 32 -an -movflags +faststart`，
  通常可以從 5MB 壓到 200KB 而且看不出差別。
- **檔名大小寫要跟引用完全一致**。Windows 不分大小寫，但 GitHub Pages 是 Linux，
  `video.MOV` 寫成 `video.mov` 在本機看起來正常、上線就 404。

## 還沒處理的事

- `assets/img/bowling/4.svg`（6.5MB）與 `assets/img/care/logo.svg`（4.2MB）都太大。
  前者是純向量、傳輸時會被 gzip 壓掉不少；後者裡面內嵌了 8 張 base64 點陣圖，
  要瘦身得把那些圖重新壓過。
- `assets/img/cards/card1~5.png`（約 19MB）目前沒有任何頁面引用，確認不要的話可以刪掉。
- 「打包帶走」目前只有 4 樣東西，其中人生賓果與「生活碎片」重複。
