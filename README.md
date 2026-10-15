# PokéSurvivor · 不可思議的迷宮

以《寶可夢 不可思議的迷宮》圖像呈現的生存遊戲，玩法類似 Survivor.io，結合隨機成長、**九個世代共 966 隻寶可夢**、異色收集、地區轉蛋與最多 4 人合作。

使用原生 HTML、CSS、JavaScript 與 Canvas 2D 開發，遊玩不需安裝套件。遊戲素材存於本機；雲端帳號、排行榜與多人連線需要網路。

此分支預設使用**繁體中文**。可在「設定 → 畫面 → 語言」切換繁體中文、English 或 Español，切換後會重新載入，並記住選擇。既有語言偏好會保留，`en/` 入口仍支援英文。

## 開始遊玩

直接開啟 `index.html`，或在專案目錄啟動本機伺服器：

```sh
python3 -m http.server 8080
```

然後開啟 `http://localhost:8080`。建立帳號或以訪客身分進入，完成性格測驗並選擇夥伴，即可進入迷宮。訪客模式不保留進度。

| 按鍵 | 動作 |
|---|---|
| `W` `A` `S` `D`／方向鍵 | 移動 |
| `1` `2` `3` `4` | 選擇啟用的招式 |
| `Q`／`E` | 切換招式 |
| `Esc`／`P` | 暫停 |

手機或平板請橫向遊玩。在任意位置按住並拖曳即可移動，點擊下方招式切換，右上角按鈕暫停。「設定 → 操作」可調整按鈕與搖桿位置。也可使用瀏覽器的「加入主畫面」安裝為應用程式。

第一次點擊後才會播放音樂，這是瀏覽器的音訊限制。右上角喇叭按鈕或設定畫面可調整音量、靜音、畫質、傷害數字、震動與 FPS。

## 玩法

- 夥伴會自動使用目前招式攻擊。擊敗傳說寶可夢可解鎖招式連結，最多將 4 個招式放在同一欄位，同時施放。
- 岩石、寶箱與高草可破壞；牆壁與樹木會阻擋敵方投射物。水面使移動變慢，熔岩會灼傷玩家與敵人。
- 地圖上有力量祭壇、治療泉水、上鎖寶箱與陷阱。待在上鎖寶箱旁數秒即可開啟；陷阱也能傷害敵人。
- 神秘裂隙通往獨立競技場，可挑戰傳說寶可夢。屬性相剋與晴天、下雨、沙暴、降雪、濃霧等天氣會影響戰鬥。
- 每日與每週任務提供抽獎券和金幣；成就提供獎章與稱號。個人資料可展示 3 隻最愛寶可夢、紀錄與獎章。
- 局內可獲得吃剩的東西、講究頭帶等道具，招式達到最高等級後可進化。敵人可能治療、施放護盾、召喚同伴或使出帶地面預警的攻擊。
- 每隻寶可夢都有獨立的永久強化。轉蛋使用遊玩取得的抽獎券，首領與裂隙傳說寶可夢有機會掉落十連抽獎券。
- 野生敵人有 1/4096 機率為異色。畫面邊緣會以箭頭指示位置，擊敗後即可獲得；轉蛋的異色機率為 1/100。可在收藏或主選單切換夥伴的一般與異色版本。
- 第 30 分鐘會觸發阿爾宙斯的制裁。牠無法被擊敗，目標是盡可能存活。

## 存檔、雲端與多人連線

本機存檔位於瀏覽器 `localStorage`，清除網站資料會使本機進度遺失。

- **Firebase 雲端存檔：**支援名稱／密碼及 Google 登入，設定步驟見 [Firebase 文件](docs/FIREBASE.md)。未設定時只使用本機存檔。
- **好友與合作：**使用雲端帳號後，可透過暱稱新增好友、邀請加入房間，最多 4 人合作。
- **排行榜：**依存活時間排名，支援單人、多人、日期、好友與寶可夢篩選。
- **跨裝置合併：**收藏取聯集，不會失去寶可夢或異色；強化與統計保留最大值，金幣與夥伴使用較新的版本。其他裝置變更會即時同步。
- **發布：**參閱 [GitHub Pages 發布文件](docs/PUBLICAR.md)。雲端、部署與網站參考頁面的原始文件目前保留西班牙文／英文。

## 開發與中文翻譯

**請修改 `dev.html`，不要直接修改產生的 `index.html` 或 `js/app.min.js`。** 開發時可直接開啟 `dev.html`，分別載入各 JavaScript 檔案。

```sh
node tools/test_i18n.js
node tools/build.js
node tools/export_data.js
python3 tools/make_seo_pages.py
```

標準建置需要 Node.js，並由 `npx` 取得 Terser 5 與 javascript-obfuscator 4.1.1。無法取得混淆套件時，可執行 `node tools/build.js --minify-only`，保留壓縮與私有作用域，略過混淆。`--expose` 僅供測試，會將遊戲物件公開至主控台。

建置會產生 `index.html`、`js/app.min.js` 與 `version.json`。請保留更新機制：選單中的玩家會在新版本推出後更新，遊玩中的玩家則於本局結束並儲存後更新。

翻譯沿用原專案機制，以西班牙文原文為鍵：

- [js/data/lang-zh-Hant.js](js/data/lang-zh-Hant.js)：繁體中文介面、招式、道具、任務、成就與更新消息。
- [js/data/pokemon-zh-Hant.js](js/data/pokemon-zh-Hant.js)：966 隻寶可夢的中文顯示名稱，不更動原始名稱、圖鑑編號或存檔。
- [js/core/i18n.js](js/core/i18n.js)：處理 DOM、Canvas、確認視窗及動態文字。`{x}` 的數量及順序必須與原文一致；玩家暱稱等內容以 `translate="no"` 保護。
- 中文名稱與原始名稱都可用於排行榜及最愛寶可夢的搜尋。字型使用系統繁體中文後備字型，不需下載額外字型。

```text
index.html              產生的遊戲入口
dev.html               開發用來源頁面
css/style.css           不可思議的迷宮風格介面
assets/pokemon/{dex}/    寶可夢圖像；s/ 為異色版本
assets/fonts/           Pixelify Sans 字型
js/
  core/                 共用工具、存檔、音效、輸入、翻譯與自動更新
  data/                 圖鑑、招式、道具、任務、翻譯與更新消息
  net/                  好友、房間、WebRTC、合作模式與排行榜
  world/                地形、物件與碰撞
  entities/             玩家、敵人、投射物與特效
  systems/              戰鬥、生怪、升級、轉蛋、裂隙與天氣
  ui/                   選單、HUD、登入、設定與其他畫面
  game.js               遊戲流程與主迴圈
tools/                  建置、資料產生與驗證工具
docs/                   雲端與發布文件
```

重新取得圖像或圖鑑需 Python 3、Pillow 與網路；僅更新素材時才需要：

```sh
python3 tools/fetch_sprites.py
python3 tools/fetch_pokedex.py
python3 tools/fetch_credits.py
```

下載圖像約需 20 分鐘，可中斷後繼續，快取位於 `tools/cache/`。遊戲資料使用 JavaScript 而非 JSON，以便直接透過 `file://` 開啟。

## 授權與製作名單

程式碼自 2026-10-14 起採用 [PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md)，可使用、研究及修改，但**不得用於商業用途**，包含販售遊戲或在遊戲內收費。截至 commit `b297089` 的版本採 MIT 授權。

圖像來自 [SpriteCollab](https://github.com/PMDCollab/SpriteCollab)，採 **CC BY-NC 4.0**，須署名且僅限非商業用途；完整創作者名單見 [CREDITS.md](CREDITS.md)。Pixelify Sans 字型採 OFL 授權，寶可夢及相關商標屬 Nintendo、Creatures Inc. 與 GAME FREAK。完整說明見 [LICENSE](LICENSE)。本專案為非營利同人作品。

**唯一官方網站為 [pokesurvivor.com](https://pokesurvivor.com)。** 此中文化分支並非新增官方網站。原遊戲永遠免費，任何要求付款的人都不代表原作者。

PokéSurvivor **沒有官方加密貨幣、代幣或 NFT**，原作者也未發行過。使用遊戲名稱的代幣由第三方建立；原作者不對相關買賣或投資負責，專案內容也不構成投資建議。
