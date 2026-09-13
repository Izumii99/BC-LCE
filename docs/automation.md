# 自動檢查

- PR：`LCE checks` → `Test and build`，執行測試、建置及 JS／gzip 大小報告，不部署、不需額外 secrets。
- main：保留既有 GitHub Pages 測試、建置與部署流程。
- 手動：Actions 頁可執行 `LCE checks`。

## 管理者設定

1. 提交並推送 workflow；本地建立檔案不會啟用遠端檢查。
2. 確认 repository 允許 GitHub Actions，且 `assets` 分支可讀。
3. 執行一次檢查後，將 `Test and build` 加入 main 的 required status checks，要求 PR 合併前通過。
4. 保留現有 Pages 的 GitHub Actions 部署來源與 environment 權限。

目前大小報告為本次絕對值，不是與基準分支比較。尚未加入瀏覽器截圖回歸；模擬測試不能代替 iPhone 實測。

## 共存界線

筆記維持 WCE 共用資料庫與 schema。只合併進行中的讀取，不快取已完成讀取；WCE 接管時不由 LCE 背景更新旗標。LCE 明確儲存成功仍立即發布旗標。

徽章仍由 LCE 優先控制，保留現有暫藏 FBC 的相容方式；已測試 WCE hook 先／後註冊。這仍依賴已知 WCE hook 優先序，不代表所有第三方版本皆已驗證。
