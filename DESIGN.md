# ROG FUTURE GAMER — 視覺重設計規範（v2，2026-11-03）

本文件是「深色未來科技電競風」重設計的設計依據，取代 `src/ui/design-system/DESIGN.md` 的視覺章節；
執行階段的 token 仍以 `src/ui/design-system/tokens.css` 為準（本文定義的新 token 會以 `--rog-*` 前綴加入，不覆寫舊值，其他頁面不受影響）。

> 參考圖位置：任務說明寫 `docs/references/`，專案中實際不存在該資料夾；七張參考圖在 `webUIUX_Ref/`（待機／選角／教學／遊戲／通關／結算／再來一場）。
> 另有 `webUIUX_Ref/stitch_image_to_web_ui_ux_converter/*/code.html`（Tailwind + CDN 字型的 AI 轉譯稿），僅作色票與字型線索，**不得**直接搬進專案（違反「不新增框架」與離線 Kiosk 需求）。

---

## 1. 七張參考圖分析

| # | 檔案 | 對應階段 | 構圖重點 | 可抽取的規則 |
|---|---|---|---|---|
| 1 | `待機.png` | P0 待機牆 | 上方 ROG FUTURE GAMER 大字；中段四張玩家卡（紅／藍／紫／紅）；右側 TOP 20 面板；底部狀態列 | 卡片 = 直式海報，角色滿版、底部名牌 + 稱號標籤；紅藍交替作為「霓虹分色」而非語意 |
| 2 | `選角.png` | **P1 選角（本次目標）** | 左：標題「選擇角色 SELECT YOUR CHARACTER」+ 四張直式角色卡（拳手／駭客／特務／自訂）；中下：PLAYER 名牌 + 「按任意鍵開始」六角 CTA；右：超大 hero 立繪壓在紅色斜切光板上 | 選中卡 = 紅色霓虹框 + 內部紅暈；未選 = 藍/紫冷色細框；CTA = 六角形紅底白字 + 雙語；名牌 = 深底 + 鉛筆圖示 |
| 3 | `教學.png` | P3 新手訓練 | 左 PLAYER 面板 + 角色縮圖直列；右 Sandbox 視窗；下方 CONTROLS / CHECKLIST 兩列卡 | 面板 = 黑金屬底 + 單側紅色斜切標題條；小卡 = 1px 冷灰框 + 選中紅框 |
| 4 | `遊戲.png` | P4 HUD | 左上徽章、中上時間、右上分數三個切角面板；左 COMBO 大字；左下速度條 | HUD 面板切角（clip-path）、數字用寬體無襯線、紅色警示 |
| 5 | `通關.png` | P5 GOAL | 左大字 GOAL! 斜體火焰；右成績面板；下三顆並排按鈕（主鍵紅底） | 主鍵 = 紅底，次鍵 = 透明黑 + 灰框；成績列 = 圖示 + 雙語標籤 + 右對齊數字 |
| 6 | `結算.png` | P6 結算 | 三欄：戰鬥數據 / RESULT（CLEAR! + 角色 + 稱號 + 分數）/ RANKING | 三欄固定寬度；金色只用在稱號與分數 |
| 7 | `再來一場.png` | P7 再玩一次 | 中央黑玻璃面板，「再來一場？」大字，紅／黑兩鍵；右下 NEXT 玩家名牌 | 二選一時主鍵紅、副鍵黑；下一位資訊獨立膠囊 |

**共通語彙（整理後的設計語言）**
1. **黑色金屬介面**：底色近黑帶冷藍（非純 #000），面板為半透明黑玻璃 + 1px 冷灰邊 + 單側霓虹條。
2. **紅藍霓虹**：紅 = 品牌／主要行動／已選取；藍 = 系統資訊／次要／未選取霓虹。兩色不混用在同一元件上（除品牌字 ROG 紅 + FUTURE GAMER 白藍）。
3. **發光邊框**：選取／聚焦元件用「邊框 + 外暈 + 內暈」三層，並非只有 box-shadow。
4. **切角幾何**：面板、按鈕、標籤用 clip-path 斜切 12–24px，而不是圓角。
5. **Q 版角色**：角色立繪永遠是畫面主角，不裁切、不變形；放大時用 drop-shadow 紅光把角色從背景分離。
6. **16:9 展場視覺**：1920×1080 設計畫布，安全區 x96–1824 / y54–1026（沿用既有 manifest），字級下限 22px（3 公尺外可讀）。
7. **雙語標籤**：中文為主、英文為副（小字、字距 +0.2em、全大寫）。

---

## 2. 色彩 Token（v2，新增 `--rog-*`，不覆寫舊 token）

| Token | 值 | 用途 |
|---|---|---|
| `--rog-bg-0` | `#07080c` | 畫面底色（近黑，冷調） |
| `--rog-bg-1` | `#0d1016` | 第二層底／面板暗部 |
| `--rog-metal` | `#151923` | 金屬面板實色 |
| `--rog-glass` | `rgba(10,12,18,.84)` | 黑玻璃面板（配合 backdrop-filter） |
| `--rog-red` | `#ff0a3c` | 品牌紅／主要行動／已選取 |
| `--rog-red-deep` | `#8a0a24` | 紅色漸層暗端 |
| `--rog-blue` | `#3aa0ff` | 次要霓虹／未選取框／系統資訊 |
| `--rog-cyan` | `#00e5ff` | 極少量的高亮點（掃描線、分隔） |
| `--rog-gold` | `#ffc75a` | 獎勵／稱號（P1 不使用） |
| `--rog-text` | `#f2f5fa` | 主文字 |
| `--rog-muted` | `#94a0b4` | 次文字／英文副標 |
| `--rog-line` | `#2a3140` | 1px 面板邊 |
| `--rog-line-hi` | `#4b5668` | hover 時的邊 |
| `--rog-glow-red` | `0 0 0 1px #ff0a3c, 0 0 18px rgba(255,10,60,.55), inset 0 0 14px rgba(255,10,60,.22)` | 紅色發光邊框（選取） |
| `--rog-glow-blue` | `0 0 0 1px rgba(58,160,255,.7), 0 0 14px rgba(58,160,255,.3), inset 0 0 10px rgba(58,160,255,.12)` | 藍色發光邊框（可用） |
| `--rog-focus` | `0 0 0 4px #fff, 0 0 0 8px #ff0a3c` | 鍵盤／搖桿焦點環（白 + 紅，與「選取」明確區分） |

**對比檢查**：`--rog-text` on `--rog-bg-0` ≈ 17:1；`--rog-muted` on `--rog-glass` ≈ 6.4:1；紅色僅用於 ≥ 28px 粗體或非文字元件（紅字 on 黑 ≈ 4.6:1，只允許大字）。

**灰階**：全部冷調（藍灰），不混暖灰。

---

## 3. 字體

| 角色 | 建議 | 備援 |
|---|---|---|
| 顯示字（英文標題、數字、ROG 字樣） | **Orbitron**（OFL，幾何寬體，最接近 ROG 字感） | `Segoe UI` 900 italic |
| 英文標籤／副標 | **Rajdhani**（OFL，窄體科技感，適合全大寫 + 字距） | `Segoe UI` 600 |
| 中文 | **Noto Sans TC** 700/900 | `Microsoft JhengHei` |

- 展場機台可能離線：正式實作 **必須自行託管字型檔**（`public/assets/fonts/*.woff2` + `@font-face`，`font-display: swap`），不可用 Google Fonts CDN。這是待決事項（見 §8）。
- 數字一律 `font-variant-numeric: tabular-nums`。
- 字級（1920 畫布）：品牌字 44 / 頁標題 40 / 卡片角色名 30 / 卡片副標 18 / 名牌輸入 48 / CTA 中文 48・英文 20 / 按鍵提示 22。
- 大標題字距 −0.02em；英文副標字距 +0.2em。

---

## 4. 版面與安全區

- 設計畫布 1920×1080，`#station-root` 以 `scale(min(w/1920,h/1080))` 等比縮放（沿用）。
- 安全區 x 96–1824、y 54–1026。所有可互動元素與文字都在安全區內；背景光暈、斜切光板可出血。
- 版面骨架（P1）：
  - 頂列 y54–140：品牌（左）、狀態／佇列（右）。
  - 步驟列 y170–215：三段切角步驟指示（01 角色・02 道具・03 暱稱）。
  - 主區 y250–900：依變體 A/B。
  - 底列 y940–1026：按鍵提示（左）、主 CTA（中或右）。
- 游標／搖桿：主 CTA 固定位置，不隨步驟移動（避免焦點跳動）。

---

## 5. 元件規格（P1 用到的）

### 5.1 角色卡 `.character-card`
- 尺寸：A 版 236×352；B 版 800×640。
- 結構：索引「01」(左上，Rajdhani 20)、角色立繪（object-fit contain，底部對齊）、名牌區（中文名 30 / 英文代號 18、小圖示）。
- 狀態：
  - default：`--rog-glass` 底、1px `--rog-line`、立繪 opacity .85。
  - hover：邊 `--rog-line-hi`、立繪 translateY(−4px)（200ms）。
  - **selected**（`aria-pressed=true`）：`--rog-glow-red`、底部加紅色漸層暈、立繪 opacity 1、整卡 translateY(−8px)、名牌出現「已選擇 SELECTED」紅字。
  - **focus-visible**：`--rog-focus` 白紅雙環（與 selected 可同時存在、可分辨）。
- 未選取但可用的卡用 `--rog-glow-blue` 細框（紅藍對比即「選中／可選」語意）。
- 不放「敬請期待」鎖定卡（PO 2026-11-03 決定）；只有兩位角色時卡片列靠左，右側留給 hero。

### 5.2 人物呈現 `.character-hero`
- A 版：右側 hero 立繪高 680，底部落在 y900；後方紅色斜切光板（`clip-path: polygon(18% 0,100% 0,82% 100%,0 100%)`，`linear-gradient(160deg,#ff0a3c,#8a0a24)` + 對角細線紋理），光板上直排「ROG FUTURE GAMER / PLAY BEYOND」白字。
- 立繪 `filter: drop-shadow(0 0 40px rgba(255,10,60,.45)) drop-shadow(0 24px 30px #000)`。
- 切換角色時：舊圖 opacity 0 + translateX(20px) → 新圖進場 240ms（reduced-motion 時直接替換）。

### 5.3 玩家暱稱 `.name-plate` / `#nickname`
- 外框：黑玻璃 + 左側 4px 紅條 + 右側鉛筆圖示（SVG 幾何，非 icon font）。
- 標籤「PLAYER 玩家」Rajdhani 18、字距 +0.25em、`--rog-muted`。
- 輸入：Orbitron 48，`maxlength=8`，字距 +0.08em；focus 時外框 `--rog-focus`、底線變紅。
- 步驟 1 僅顯示（唯讀名牌，提示「步驟 3 可修改」）；步驟 3 為可編輯大輸入框。IME 保護沿用既有 `focusin` 清鍵邏輯。

### 5.4 主行動鍵 `[data-action=ready]`
- 六角切角（`clip-path: polygon(28px 0,calc(100% - 28px) 0,100% 50%,calc(100% - 28px) 100%,28px 100%,0 50%)`），紅底，白字。
- 內容：中文 48 粗 + 英文 20 全大寫；左右各一個「‹‹ ››」裝飾。
- 狀態：hover 亮 6%；active translateY(2px)；focus-visible `--rog-focus`；disabled 灰底 `#1b1f28`、字 `#6b7383`、無暈；`generating` 時 disabled + 文字「角色準備中」。
- 呼吸光（`box-shadow` 2.2s 循環）僅在 focus 且非 reduced-motion。

### 5.5 步驟指示 `.steps`
- 三段切角片段（平行四邊形），todo 灰／active 紅底白字／done 紅框紅字 + ✓。

### 5.6 攻擊道具卡 `.item-card`（步驟 2）
- 300×400 直式卡，頂部 4px 模式色條（AREA `#ffb347`／PIERCE `#4dd9ff`／RAPID `#c6ff4d`，沿用 `attack-items.json` 的 color）、產品圖 200、產品名 26、特色 18、模式標籤 Orbitron 24。
- selected / focus 規則同角色卡（紅暈 + 白紅焦點環）。

---

## 6. 互動與按鍵

| 輸入 | 行為（沿用 `StationUI.input()`） |
|---|---|
| ← → / 左搖桿 / D-pad | 焦點在卡片與 CTA 間循環（`focus()`） |
| Z / Enter / ○ | 觸發焦點元素：卡片 → 選取並留在卡片；CTA → 下一步 |
| Backspace / Back 鍵 | 上一步（步驟 > 0） |
| H / Start | 系統選單（既有） |
| Tab / Shift+Tab | 原生循環（既有攔截） |
| 滑鼠／觸控 | click 卡片 = 選取；click CTA = 下一步 |
- 預設焦點：進入 P1 每步都落在 CTA（既有行為，連按三次確認即可開始）。
- 「選取」與「焦點」必須視覺可分（紅暈 vs 白紅環），避免手把玩家不知道游標在哪。

---

## 7. 動態

- 快速回饋 120–160ms（hover／press）；卡片選取 240ms；hero 切換 240ms；CTA 呼吸光 2.2s。
- 只動 `transform` / `opacity` / `box-shadow`。
- `prefers-reduced-motion: reduce`：移除位移與呼吸光，保留顏色狀態。
- 背景：固定的細掃描線 + 對角微紋理（CSS gradient，無圖片、無雜訊 PNG）；兩個大半徑光暈（左上紅、右下藍）靜態。

---

## 8. 約束與待決

**不可變**：Phaser 3.90 / TypeScript / Vite / 24Hz 固定步 / 960×540 世界座標 / `GameplaySession` 計分碰撞 / `InputAdapter` 鍵盤搖桿 / 三步驟 P1 流程與 `data-action`、`#nickname`、`aria-pressed` 等測試選擇器。

**範圍（PO 2026-11-03 決定）**：除 Phaser 關卡世界（地形、敵人、角色動畫、關卡美術）外，Station 全部 DOM 畫面 P0–P7 與系統選單一次改為 v2；關卡世界維持現狀。

**已決定事項（PO 2026-11-03）**
1. P1 版型採 **A「卡片列 + Hero」**；B 版不進正式程式。
2. 字型 **核准自行託管** Orbitron + Rajdhani + Noto Sans TC（OFL），放 `public/assets/fonts/`，系統字體為備援。
3. 「敬請期待」鎖定卡 **移除**。
4. 角色名稱用代號 S3WW／S2AM 加「角色 A／B」，字串集中於 `catalog.ts`，企劃提供中文名後一處替換。
5. 品牌只用文字字樣，不自製 ROG 眼徽；取得官方 SVG 後再置換。
6. P0、P3、P4 HUD、P5、P6、P7（含排行榜子畫面）與系統選單一併實作。

---

## 9. P5 通關／P6 結算／P7 再來一場（prototype：`docs/prototypes/end-screens.html`）

與 P1 共用同一套 token、頂列、按鍵提示與按鈕語言；資料欄位對應既有 `GameplayResult`，不捏造「S 評價」「受傷次數」等沒有的統計。按鍵：5／6／7 切畫面、T 切 GOAL／TIME UP。

| 畫面 | 版面 | 資料對應 | 互動 |
|---|---|---|---|
| P5 通關 | 左：GOAL! 230px 斜體紅字 + 放射光暈 + 跳躍影格立繪；右：「本次成績」面板（分數金色、通關時間 + NEW RECORD 標籤、持有徽章／總數、最高連擊、稱號金框）；底：三顆矩形切角鍵 | `score`、`duration−remainingTime`、`heldBadgeCount`／關卡總數、`maxCombo`、`titles[0]`；TIME UP 版改白字藍光、待機影格、「遊玩時間」 | 再挑戰依 Replay 開關 disabled；下一關固定 disabled（COMING SOON）；返回選單為紅色主鍵、預設焦點；5／3 秒自動進 P6 |
| P6 結算 | 三欄 470／640／594：戰鬥數據（頭像 + 六列統計）／本場結果（CLEAR! + 立繪 + 稱號列 + 分數明細 + 金色大分數）／排行榜（前五 + 自己鄰近列，藍色名次、紅色自己列） | `playerStatistics.*`、`scoreBreakdown`、`titles`、`board()` | 完整排行（次鍵）、繼續（紅色主鍵、預設焦點） |
| P7 再來一場 | 中央黑玻璃面板（頂條紅藍分色）：「再來一場？」104px + 兩顆 440×120 大鍵 + 「查看排行榜」文字鍵；左立繪、右機器狗（既有 `enemy-dog.png`）；右下「下一位」膠囊（藍框 + 頭像 + 暱稱） | `queue[1].nickname`、`replayEnabled` | Replay 關（預設）：再玩一場 disabled、結束為紅色主鍵；Replay 開：再玩一場變主鍵；倒數時全畫面金色 3-2-1 |

NEW RECORD 標籤需比對本機排行榜，實作時只在 `score` 高於該榜第一名時顯示。

---

## 10. P0 待機／P3 新手訓練／P4 HUD／系統選單（prototype：`docs/prototypes/station-screens.html`）

按鍵：0／3／4 切畫面、L 切低時間 HUD。

| 畫面 | 版面 | 資料對應 | 互動與規則 |
|---|---|---|---|
| P0 待機牆 | 標題 CYBER RUN 120px（紅＋白）＋「電域狂奔 FOR THOSE WHO DARE」；左四張玩家牆卡 300×520（紅藍交替霓虹、索引、立繪、暱稱、金色稱號）；右 TOP 20 面板 424×520（10 列＋頁碼）；底部資訊膠囊（藍框）；左下「加入示範佇列」文字鍵 | `adapter.wall`（最近玩家）、`board(tier)`；無人時第一張卡為虛線「成為下一位 Future Gamer」 | 牆與榜同時顯示，取代現行 20 秒／8 秒輪替；牆每 20 秒水平捲動一輪、榜每 10 秒換頁；60 秒無操作播 attract 影片（沿用）；任意鍵喚醒 |
| P3 新手訓練 | 左玩家面板 420×570（立繪、暱稱、角色／道具、載入中％＋藍色進度條）；右透明沙盒視窗 1284×570（藍色角標、LIVE TRAINING 膠囊、右上金色倒數）；底部九格訓練清單（中文＋英文＋按鍵＋狀態） | `loadProgress`、`assetsReady`、`lessons()` 動態數量、`progress` 集合、`countdownAt` | 清單格數依 `lessons()` 長度自動排版；完成＝金框、練習中＝紅框發光、尚未開始＝灰框；沙盒區 `pointer-events:none` 讓 Phaser 畫面透出 |
| P4 HUD | 三個切角島：左上徽章 440×112（徽章圖＋持有／總數）、中上時間 400×160（藍色頂條、84px 數字、狀態小字）、右上分數 360×150；左 COMBO 96px 斜體紅字＋倍率金字（y242）；無敵指示 380 寬藍色左條＋進度（x560,y240）；攻擊道具框 340 寬模式色左條（右上 y240）；右下 SEGMENT 區段名 | `updateHud()` 既有欄位全部沿用；低時間（≤15 秒）時間島轉紅、文字「⚠ 剩餘時間不足」 | 所有島 `pointer-events:none`；數字變化沿用既有 `feedback()` 彈跳；無敵剩 3 秒閃爍沿用 |
| 系統選單（H） | 中央 650 寬黑玻璃面板，紅色頂條，標題「系統選單 SYSTEM MENU」，直排按鈕（繼續＝主鍵、重新開始、回到主畫面、Replay 設定） | 既有 `menu` 狀態 | Tab／方向鍵焦點限制在面板內，關閉後焦點回原位（沿用） |
| P7 排行榜子畫面 | 左三張領獎台卡（金／藍／紫頂條、立繪、暱稱、分數）；右 TOP 20 表 660 寬（每頁 10 列、頁碼鍵）；返回鍵 | `leaderboard()` | 沿用分頁與焦點還原 |
