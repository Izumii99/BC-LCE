# R132Beta3 相容性修補

日期：2026-09-16。分支：`fix/r132`。依本機 Bondage-College-Mirror-bondageclub R132Beta3 原始碼修正；正式 R132 發布後仍需核對。

## WCE 指定 commit 核對

來源：[KittenApps/WCE e276826ff408c8321bef1860c821bdc17fd8b43f](https://github.com/KittenApps/WCE/commit/e276826ff408c8321bef1860c821bdc17fd8b43f)。此 commit 只有兩項修改，並非完整的 R132 衣櫃遷移：

1. `automaticExpressions.js`：以 `Player.ExpressionQueue = []` 取代刪除屬性。
2. `commonPatches.ts`：對掙扎函式迭代佇列加入 `?? []`；上游註解預期 R132 修正後移除暫時補丁，參照 BC MR 6649。

LCE 同樣有刪除佇列的程式，已改為空陣列。本機 Beta3 的 `StruggleMinigameHandleExpression` 仍直接迭代佇列，因此另外以函式 hook 正規化缺失佇列；不使用第二組文字替換，保留已有事件與原生計時加速行為。即使表情引擎未啟用，也不應讓缺失佇列造成原生掙扎例外。WCE 來源與既有授權記錄見專案 `THIRD-PARTY-NOTICES.md`。

## 已修改

| 範圍 | 問題與處理 |
| --- | --- |
| 衣櫃入口 | 舊 LCE 直接切畫面，跳過 `Wardrobe.selectedCharacter`／`returnScreen`。偵測到 R132 原生衣櫃時，交回原生入口，由 `WardrobeOpenCharacter` 初始化 |
| DOM 衣櫃 | 跳過舊 canvas 手繪按鈕、固定座標點擊、暫時替換 Player、舊退出及載入後改身體的邏輯；使用原生 DOM、目標角色、預覽與不含身體選項 |
| 覆蓋確認 | 原生 `WardrobeSaveSelectedOutfit` 已確認，避免再問一次；直接 `WardrobeFastSave` 覆蓋仍保留 LCE 確認，例外後會解除跳過狀態 |
| 擴充衣櫃 | 保留 `FBCWardrobe` 額外 72 格與前 24 格分開保存，不改資料鍵、不重建既有衣櫃 |
| 主題 | R132 分層／調色圖示由 `Icons/Small/` 改成 `Icons/`，更新 `AppearanceRun` 的兩個失配文字目標及替換內容 |
| 表情 | 套用上述 WCE 佇列修正及 Beta3 掙扎防護 |

R132 原生衣櫃已提供角色預覽與身體部位選項，LCE 舊「私人衣櫃」設定不再另外接管此畫面；舊介面 fallback 仍保留，但這個分支的主題補丁以 R132 為目標，未宣告完整向下相容。

## 驗證

- `tests/r132.test.mjs` 覆蓋原生衣櫃角色／返回狀態、DOM hook 放行、預覽載入選項、退出、覆蓋確認、額外槽位存取、缺失／既有表情佇列及主題補丁匹配。
- `tests/fixtures/r132-runtime.txt` 保留真實 R132Beta3 原生入口、掙扎及 `AppearanceRun` 函式，附來源與 SHA256。測試執行原生入口／掙扎，並驗證替換後函式可解析；非完整遊戲 DOM 測試。
- 執行 `npm test`、`npm run build`，含既有 HSC 表情及 WCE 共存回歸測試。

本輪結果：69/69 測試通過，正式建置通過；已更新追蹤中的 `dist/assets/app.js`。測試使用 Node VM modules，會輸出該功能的實驗性提示。

## 尚需遊戲內驗收

1. 本人／他人衣櫃、返回更衣室、預覽、取消、搜尋、排序、兩種顯示模式與身體部位保留。
2. 第 25–96 格讀寫、WCE 既有資料、WCE 先載入／後載入、覆蓋與重新登入。
3. 掙扎時變更其他玩家物品、停止掙扎、計時表情，以及 WCE／HSC 表情共存。
4. `layering-hide.js` 的兩個文字目標仍存在，`wceOverrideHide` 在 Beta3 仍受保留，未確認需要改寫；仍需與 WCE 實測。
5. 衣櫃可能載入其他插件寫出的舊未命名圖層鍵，尚未實作跨插件服裝資料遷移；不因此自動改寫所有服裝。

本分支沒有推送或部署正式版本。
