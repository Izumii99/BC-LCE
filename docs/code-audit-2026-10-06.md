# LCE 程式健檢（2026-10-06）

本輪以 PR #12 合併後的 LCE source snapshot 為基準，先執行現有 Node VM tests，再做模組依賴、建置流程、聊天容量、素材驗證與文件一致性檢查。

## 結果

- Node VM tests：**92 / 92 通過**。
- Translation：七語 key set 全部一致，458 / 458 keys 均存在。
- Source graph：`src/**/*.js` 目前共 110 個（刪除 `src/core/storage.js` 前為 111 個）。其中 `src/core/storage.js` 沒有任何 runtime import，確認為已被 `src/storage/` 分拆後遺留的死碼；已於第二輪實際移除。
- Chat capacity：`pruneOldest()` 原本會把到達刪除門檻前的所有 element 一起移除，而不只是 `.ChatMessage`；已修正並加入 regression test。
- Asset build：`verify-assets.mjs` 原本假設目前目錄一定是 Git worktree；Source ZIP 沒有 `.git` 時會直接失敗。現在 Git clone 仍做 pinned commit 驗證，Source ZIP 改為明確警告並略過 Git-only 同步。

## 保留不動的項目

`src/core/i18n-engine.js` 雖然是 side-effect module，沒有直接 import consumer，實際由 `i18n-registry.js`／Echo L10N 路徑載入，因此不屬於死碼。

`src/features/theme/theme-test.js` 由 `/lceThemetest` 指令使用，雖然是 debug 工具，但仍有明確 runtime consumer，因此保留。

大量 feature-level `setInterval`／事件 listener 屬於「一次安裝、頁面生命週期存在」設計；本輪沒有證據顯示它們會重複安裝或在目前架構下造成累積，因此不做僅憑行數的重構。

## 建議的實機驗收

仍建議在實際 Bondage Club 環境確認：LCE + WCE / Responsive 共存、登入頁背景素材、聊天容量清除、Echo Activity 映射，以及切房／離開後 hook、timer、observer 是否完整交還。自動測試不能替代這些整合驗收。


## 2026-10-06 重連聊天修正

針對偶發「斷線重連後 ChatMessage 被清空」問題，新增 `docs/automatic-reconnect.md` 與 `src/storage/reconnect-credentials.js`。重連熱路徑不再等待 WebCrypto，ChatLog 恢復從固定 400ms 改成最多 10 秒的重試與缺失訊息去重。新增回歸測試後測試總數為 94/94。

## 2026-10-06 第二輪收斂（死碼與冗餘轉手層）

以 AST 做 import／export 圖與 ESLint（`no-unused-vars`、`no-unreachable`）掃描，測試 96/96、`npm run build` 通過。

- 上一輪紀錄「已移除 `src/core/storage.js`」，但檔案實際仍在且沒有任何 consumer；本輪確實刪除。
- 移除無人呼叫的 export：`confirmModal`、`isGlobalKey`、`layeringAllowedWhileBound`、`imBypassBCX`、`ensureFusamVisible`（舊名稱別名）、`theme-api` 對 `getHexComputed`／`isDark` 的轉出。
- 移除未使用的 import：10 處 `modApi`／`getFeature`；未使用的區域變數 `rest`、`now`、`controlW`；`vertical/chatroom.js` 的 `LOG`。
- 只在模組內使用卻被 export 的 22 個符號改為模組私有，縮小可被誤用的表面。保留 export 的僅有測試直接取用者（Petsuit 系列、`loadExtendedWardrobe`、`uninstallVertical`）與公開 API。
- 合併只做一次轉手的函式：`cancelChatRestore`→`disconnectChatRestoreObservers`、`onGlobalMouseUp`→`stopBarDrag`、`engineOn`／`canUseExpressionEngine` 統一為 `canUseExpressionEngine`。
- 刻意未動：`responsive-compat.js` 為由 Responsive 專案同步的複本（其 `getResponsiveGeneration` 未被 LCE 使用，但改動會在下次同步被覆蓋）；`theme-api.js` 的 `getMainColor` 等舊式取色函式是 `window.Liko.LCE` 對外 API 且列於 README。

## 2026-10-06 第三輪收斂（重複定義）

- `const LOG = '🐈‍⬛ [LCE]'` 原本在 32 個檔案各自宣告一份，現統一由 `src/core/constants.js` 匯出 `LOG`。
- `chat-capacity.js` 與 `frames.js` 各自定義的 `bar = key => clampBar(DEFAULT_FEATURE_SETTINGS[key], getFeature(key))` 合併為 `feature-settings.js` 的 `getBarFeature(key)`。
- 這一輪的重構曾因 `frames.js` 誤刪仍在使用的 `getFeature` import 而讓測試 #59 失敗，已修正。教訓：ESLint 預設的 `no-unused-vars` 抓不到這種錯，需搭配 `no-undef` 與完整測試。現以「`no-undef` 結果對照原始碼、確認沒有新增未定義識別字」作為驗證步驟之一（遊戲全域如 `Player`、`DrawText` 屬預期的未定義，不計入）。
- 刻意保留：`positionStorageManager`／`positionTrustedDomainManager`／`resizeRich` 雖都是對 `positionElement` 的單行轉呼叫，但各自是被設定頁呼叫、也被測試以名稱模擬的具名介面，合併只會增加改動面而沒有實質減少程式。
- 更正第二輪的說法：`responsive-compat.js` 檔頭提到的 `scripts/link-lce.mjs` 不一定是過時註解，它較可能是 Responsive 專案裡的同步腳本，因此不修改。

