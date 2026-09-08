# WCE／LCE 共存檢查

比對日期：2026-09-05。來源：本機 `D:/_Data/Documents/GitHub/liko/WCE`，`src/util/constants.ts` 標示 WCE 6.3.19。僅修改 LCE，不修改 WCE。以下為原始碼檢查與模擬測試，不代表雙插件實機驗收已完成。

## 原則

相同操作以 WCE 已載入且該功能即時開啟時優先；WCE 關閉該功能，LCE 才接手。不能只判斷插件存在，也不能以 hook 優先權代替事件所有權。保留使用者兩邊的設定，只抑制重複執行。WCE_OVERLAPS 是說明表，不會自動套用避讓；執行點仍須呼叫相容判斷。

## 本次修正

| 功能 | 原本問題 | LCE 處理 |
| --- | --- | --- |
| 手動角色快取 | WCE 插入 clearCache，LCE 插入 lceClearCache，產生兩顆按鈕 | WCE manualCacheClear 開啟時不插入 LCE 按鈕，重建選單清除自己的舊按鈕；舊按鈕事件亦重新檢查 |
| 自動角色快取 | 兩邊各自每小時清理 | LCE 每次計時及等待安全時機時重查 WCE automateCacheClear，交接後不執行舊任務 |
| 私聊目標解除 | whisperTargetReset 與 WCE whisperTargetFixes 各掛 60 秒計時 | 事件入口與逾時回呼均避讓 WCE |
| 好友離線通知 | WCE 只開上線通知也會壓掉 LCE 離線通知 | 僅 WCE friendPresenceNotifications＋friendOfflineNotifications 同時開啟時避讓離線通知 |
| 好友查詢 | WCE 通知或 IM 已每 20 秒查詢，LCE 仍可能查第二次 | LCE 共用 socket 查詢回應，不再發自己的重複查詢 |
| Uwall | LCE 關閉值可能覆寫 WCE 已開啟的共享保護旗標 | 共享旗標使用 LCE 或 WCE 任一啟用；此為狀態合併，不套用一般「避讓後 false」公式 |
| 聊天對比色 | 兩套 CSS class 同時套用 | WCE chatColors 開啟時移除 LCE 自己的 class |
| 私聊輸入斜體 | whisperItalic 與 whisperInput 重疊 | WCE whisperInput 開啟時不套用 LCE 自己的 class |

WCE 對應實作：`functions/cacheClearer.ts`、`chatRoomWhisperFixes.ts`、`friendPresenceNotifications.js`、`util/settings.ts`。貼圖品質調整所需的 reloadTextures 不屬於週期清理，仍保留，否則改畫質不生效。

## 已有避讓，仍需共存實測

- 聊天嵌入、pending 訊息、IM、歷史 Profile、富文字 Profile。
- 延伸衣櫃、私人衣櫃、保存確認、圖層隱藏。
- 重連、離房確認、自訂內容來源檢查、自動屏蔽新玩家。
- 防亂碼、防聾、口吃、撬鎖、自動掙扎、綁縛時分層、物品反作弊。
- 通用指令在註冊時依 WCE 狀態過濾；WCE 晚載入或後續啟停的交接未完整保證。

部分 LCE 名稱與 WCE 不同：`antiCheatLevelEnabled` 對 `itemAntiCheat`，上／下線通知需組合判斷。不要直接遍歷同名表就假設已避讓。

## 表情與圖層整合（後續修正）

- 表情計時與驗證已改為 hook，不再 patch `TimerInventoryRemove`、`ValidationSanitizeProperties`。
- 表情引擎統一查詢 Responsive／WCE 所有權，WCE animationEngine 啟用時 LCE 避讓。
- 保留 `lceAnimationEngineEnabled`、`lcePushEvent` 公開入口；不覆寫已存在的 `bceAnimationEngineEnabled`。
- 圖層隱藏與玩家外觀同步仍需兩處 patch；替換字串與本機 WCE 完全一致，共用 `wceServerAppearance` 入口。
- 修正首次表情事件遭清除、姿勢清理無限迴圈、初始化清除表情及計時事件被活動開關阻擋。
- 使用者已回報不再出現 patch 警告，表情修正後測試正常；尚不代表所有動態切換與載入順序均已實機驗收。
- 仍需驗證：WCE 引擎中途關閉後，LCE 接手的臉部／姿勢基準，以及共用旗標對第三方模組的影響。

## 啟動分流

登入介面與帳號記憶不避讓 WCE。主題 hook 在 BC 核心就緒時安裝，避免錯過按鈕建立。
帳號設定載入後先安裝獨立功能與可即時避讓的混合模組，再等待 WCE 就緒（最多 3 秒），安裝其餘共存模組。
`src/app.js` 的 immediateSteps／sharedSteps 是實際安裝清單；3 秒等待不取代執行時功能判斷或 patch 共存。

## 非完全相同，不自動關閉

- LCE arousalGrowthAmount 是增長倍率；WCE alternateArousal 是整套慾望演算法，可能疊加，需要先決定預期效果。
- LCE 圖像染色、直式介面、容量管理與 WCE 不應按名稱相似就停用。
- allowIMBypassBCX 同時存在，但各自 IM 原則上已有避讓；BCX 攔截的整體順序仍需檢查。
- LCE urlAsOoc 在這份 WCE 設定表找不到同名 key；現有同名判斷不能證明 WCE 有此功能，也不能與 ctrlEnterOoc 視為等價。

## 驗收

1. 快取設定四種組合：僅 LCE、僅 WCE、兩者開、兩者關；兩者開時只保留 WCE 按鈕。
2. 等待自動清理期間改 WCE 開關；私聊目標離開後、計時完成前改 WCE 開關。
3. WCE 上線開／離線關時，LCE 離線通知仍工作；查詢只由一方送出。
4. LCE Uwall 關、WCE 開，玩家同步後共享旗標不得變 false。
5. 兩種載入顺序、重連、各自設定頁即時啟停；檢查通知、CSS 與 hooks 是否重複。
