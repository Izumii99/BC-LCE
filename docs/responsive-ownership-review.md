# Responsive／LCE 表情與口型分工

更新：2026-09-09。下方「既有方案」記錄目前 Responsive 實作；新增追蹤項目尚未實作，不代表已完成三插件協調。

## 既有方案

依使用者確認，兩套表情功能各自維護，不建立表情事件橋接、不自動改設定。

- Responsive 設定頁首頁的 rl-panel 底部、規則頁的 rl-editor 底部顯示表情衝突提醒。
- Responsive 的 enabled 與 reactions 都開啟時，才檢查外部功能；不要求目前人格已有表情規則。
- 即時讀取 WCE fbcSettingValue 與 LCE getFeature 的 animationEngine、activityExpressions，對方兩個開關都開啟才列入警告。按結果顯示 WCE、LCE 或 WCE/LCE。
- 提示：「偵測到WCE/LCE的表情引擎，請關閉其中一方，否則可能發生衝突」。實際插件名稱依偵測結果替換。
- Responsive 不要求 LCE 暫停表情引擎；表情功能由使用者自行選擇關閉哪一方。
- 口型不提示。LCE autoMouthOnTalk 啟用時 Responsive 直接避讓；停用後 Responsive 可恢復。檢查涵蓋協調狀態、訊息入口、動畫回呼與繪圖 hook。
- 本機 WCE 未找到對等口型功能，不以 animationEngine 代替口型開關。

## 保留的實作差異

Responsive 使用原生表情函式和還原計時器；LCE 使用表情／姿勢佇列。此次不複製或合併演算法，也不將 Responsive 表情轉交 WCE 內部 API。

口型都使用暫時覆蓋繪圖、完成後還原的方式，Responsive 使用逐字交替，LCE 有字母映射與 CJK 後備節奏。

## 驗證

Responsive 67 項測試通過；建置後重新執行 bundle 載入測試通過，git diff --check 通過。
新增測試涵蓋即時功能開關、讀取失敗、口型優先順序與解除 LCE 表情避讓。
面板提示的遊戲內顯示及同時切換兩插件仍需實機驗證。

## 2026-09-09：表情覆蓋與還原問題追蹤

狀態：已檢查與局部重現，待修改。使用者本輪要求先留下項目供後續追蹤，未修改 Responsive 功能。

### 已確認問題

1. **同值新效果被舊計時器提前撤銷。** `BC-Responsive/src/features/output.js` 的 `expression()` 只比對物品實例與目前表情值，沒有效果識別碼。以原始函式在 Node VM 執行兩個相同值效果，先觸發舊計時器，新效果即被還原為 null。
2. **已過期表情復活。** 同一函式先套用 Happy、再套用 Closed；第一個計時器到期時不動 Closed，第二個到期卻還原為已過期的 Happy，而非原始 null。兩個案例是函式層重現，尚非遊戲內整合驗收。
3. **Responsive 與 LCE 對期限的理解不同。** Responsive 呼叫 `CharacterSetFacialExpression` 時不傳 Timer，另用自己的 `setTimeout` 還原；LCE 把這類呼叫當作無限期 ManualOverride。Responsive 的 `src/core/api.js` 對 LCE consumer 固定傳 `expressions: false`，目前不是暫時效果層級的接管協議。
4. **Responsive 尚未讀取 HSC 表情狀態。** 與新版 LCE 同用時，LCE 雖阻止 HSC 受控部位被寫入，Responsive 仍會排入自己的還原計時器；沒有 LCE 時，也沒有 HSC 優先保護。實際跨插件到期干擾情境待整合測試。
5. **口型有獨立繪圖路徑。** `BC-Responsive/src/features/mouth.js` 在繪圖期間暫改 Mouth 並於 finally 還原資料；沒有 HSC 檢查，可能在畫面上覆蓋催眠嘴型。不能只修一般表情入口而漏掉此路徑。

### 待修改項目

- [ ] Responsive 每個表情效果使用獨立識別碼，按部位管理覆蓋層；Eyes 的雙眼展開與 Eyes1／Eyes2 單眼需一致處理。
- [ ] 到期僅撤銷自己的效果；最新同級有效效果顯示，全部結束才還原基底。已過期或取消的效果不得重新出現。
- [ ] 統一清理流程：停用、離房、切換帳號／人格及錯誤中止後，舊回呼不得影響新效果。
- [ ] 設計 Responsive／LCE 暫時表情的狀態與期限協調，避免一邊視為永久手動覆寫、另一邊自行還原。這是待設計方向，尚未取代上面的既有方案。
- [ ] Responsive 讀取 HSC 已公開的 `Liko.HSC.expressions`（`apiVersion: 1`、`getState()` 回傳 active／count／groups）；催眠控制期間讓位，不建立稍後可能誤還原的低優先表情效果。
- [ ] 口型繪圖也遵守 HSC 受控部位；只影響相關角色與 Mouth，不停用其他玩家的口型。
- [ ] 保留插件各自單獨運作；處理不同載入順序、缺少 API、舊版本及效果結束交還，不自動修改使用者設定。

建議驗收規則：HSC 高於一般自動表情；Responsive／LCE 同級採最後有效事件優先。跨插件協調方式仍待實作前收斂，不能只調整 hook 順位或提高刷新頻率。

### 驗收案例

- [ ] 第 0 秒與第 9 秒各啟動一個持續 10 秒的相同表情：第 10 秒不能撤掉第二個，第 19 秒才回到基底。
- [ ] 相同時序改成不同表情：第二個結束不能復活已過期的第一個。
- [ ] 新效果先結束時回到仍有效的舊效果；舊效果先結束時保持新效果；重複／過期回呼無副作用。
- [ ] HSC 作用期間觸發 Responsive／LCE：不搶臉、不在催眠結束後補播或誤還原；新互動在交還後正常生效。
- [ ] HSC 重疊、強控、清除及 LCE／Responsive 在催眠中途載入；原版眼睛、Luzi、雙眼／單眼、嘴型分別驗證。
- [ ] Responsive 單獨、LCE＋Responsive、HSC＋Responsive、三者同用，以及 WCE 存在時各別驗證；確認本地和其他玩家所見一致。

### 與已完成工作的界線

2026-09-09 已修改 HSC 公開唯讀表情狀態，LCE 依受控部位讓位並丟棄期間低優先表情；LCE 47 項測試與 HSC 表情測試通過，兩邊已建置，尚待遊戲內實測。這不代表 Responsive 已完成同樣修正。

先前「完全未載入 WCE／Responsive，LCE 單獨使用仍沒有互動表情」的玩家回報，根因尚未確認，須獨立追蹤，不能用本次 HSC／Responsive 衝突結案。
