// ════════════════════════════════════════════════════════════════════════════
// LCE 設定頁共用版面（畫布座標 2000×1000）
// 主題 / UI / 沉浸 / 動物（canvas 面板）與 容量 / 域名（DOM 面板）共用同一個外框位置，
// 切換分類時面板不會跳動。單一來源：要調整位置只改這裡。
// ════════════════════════════════════════════════════════════════════════════

export const PANEL_X = 200;
export const PANEL_Y = 180;
export const PANEL_W = 1600;
/** 所有面板上方分頁列的高度（canvas 分頁、容量分頁、域名標題列一致）。 */
export const PANEL_TAB_H = 65;
/** 主題 / UI / 沉浸 / 動物 面板高度。 */
export const PANEL_H = 650;
/** 容量 / 域名 面板高度（DOM，內容可捲動）。 */
export const PANEL_OVERLAY_H = 750;
/** 主題 / UI / 沉浸 / 動物 預設每欄列數（超過就換到下一欄；個別分頁可特殊處理）。 */
export const PANEL_ROWS = 7;

// ── 動物頁右側「擺動預覽」專屬區塊 ──────────────────────────────────────────
// 與面板同一個 Y / 高度（180 / 650），貼著 1800 右緣；左側設定面板相應縮窄。
// 人物 600 高（BC 角色 500×1000，zoom 0.6 → 300 寬），底部 50 留給左「測試」右「前往衣櫃」。
export const ANIMAL_SIDE_W = 320;
export const ANIMAL_SIDE_GAP = 20;
export const ANIMAL_PANEL_W = PANEL_W - ANIMAL_SIDE_W - ANIMAL_SIDE_GAP;   // 1260
export const ANIMAL_SIDE_X = PANEL_X + PANEL_W - ANIMAL_SIDE_W;            // 1480
export const ANIMAL_CHAR_H = 600;
export const ANIMAL_CHAR_ZOOM = ANIMAL_CHAR_H / 1000;
export const ANIMAL_BTN_H = 50;
