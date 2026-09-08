# Responsive／LCE 表情與口型分工

## 已採用方案

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
