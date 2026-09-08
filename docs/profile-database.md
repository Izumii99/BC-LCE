# 共用個資資料庫

LCE 固定使用 `bce-past-profiles` v31，與本機 WCE 原始碼對齊。
`profiles` 與 `notes` 的 keyPath 都是 `memberNumber`。
WCE 的 v30 → v31 變更是刪除舊索引，沒有新增個資或備註欄位。

未經使用者明確指定，不得調高版本。新增功能若需要 schema 變更，
必須先討論：推送較高版本會使仍指定舊版本的其他插件開庫失敗。
不得為了新增功能或補建缺少的 store 自動升版，也不得刪庫重建。

其他插件可查詢以下唯讀描述物件：

```js
window.Liko?.LCE?.profileDatabase
// { name: 'bce-past-profiles', version: 31 }
```

此 API 在個資模組載入時公開，即使保存功能關閉也可查詢；查詢不會開庫。
`version` 是 LCE 指定的相容版本，不是瀏覽器目前的資料庫版本。
既有 `Liko.LCE.pastProfiles.get/set` 備註 API 保持原用途。

FCM 保留 `indexedDB.open('bce-past-profiles')`，沿用現存版本，
不需要根據此 API 主動升版。資料庫不存在時，不指定版本會建立 v1。
讀取版本是相容性資訊，不是升版授權。
WCE 若沒有公開資料庫版本 API，不推測其版本，也不增加特殊處理。
