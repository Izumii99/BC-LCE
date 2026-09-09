// ════════════════════════════════════════════════════════════════════════════
// 直式版面共用層（移植自 MPL）
//
// 直式版面的核心手法：BC 的畫面是 2000×1000 的 canvas，橫向時左半是角色、右半是
// 選單／對話。直向時把 canvas 撐成兩倍寬（vw*2）並固定在上半螢幕，等於「只讓左半
// 露出來」，右半被擠出畫面外；下半螢幕再用 HTML 或 mirror canvas 補上右半的內容。
// ════════════════════════════════════════════════════════════════════════════

import { getCanvas } from '../../core/util.js';

/**
 * 與主 canvas 共享同一個 stacking context 的 z-index，集中管理。
 *
 * CANVAS 故意設 0：canvas 不需要疊在任何東西之上。實測 .dialog-root 的 z-index
 * 會被 BC 重建時沖掉（寫 CSS 規則或 JS 強制 inline style 都留不住），所以讓
 * canvas 待在最底，靠「DOM 後面的畫在上面」這條規則讓彈出視窗穩定蓋住它。
 */
export const Z = {
    CANVAS:      0,
    DR_MIRROR:   1,
    CHAT_DIV:    2,
    DR_OVERLAY:  2,
    TOP_MENU:    3,
    DIALOG_ROOT: 4,
};

// 上次強制的 canvas 樣式，相同就跳過（forceCanvasStyle 每幀被呼叫，不能每次都寫 style）
let lastForced = null;

/** 把主 canvas 固定在上半螢幕，並只露出左半的人物畫面。 */
export function forceCanvasStyle(cvH, preserveLeftSquare = false) {
    const cv = getCanvas();
    if (!cv) return;
    const vw = window.innerWidth;
    if (lastForced && lastForced.cv === cv && lastForced.vw === vw
        && lastForced.cvH === cvH && lastForced.preserveLeftSquare === preserveLeftSquare) return;

    // Canvas 左半是 1000×1000 人物畫面。裝置不一定正好是 1:2，聊天室用 contain
    // 保留正方形比例；多出的空間留白，避免拉長、壓扁或裁掉人物。
    const scale = preserveLeftSquare ? Math.min(vw, cvH) / 1000 : null;
    const width = preserveLeftSquare ? 2000 * scale : vw * 2;
    const height = preserveLeftSquare ? 1000 * scale : cvH;
    const left = preserveLeftSquare ? (vw - 1000 * scale) / 2 : 0;
    const top = preserveLeftSquare ? (cvH - 1000 * scale) / 2 : 0;

    lastForced = { cv, vw, cvH, preserveLeftSquare };
    cv.style.setProperty('position',  'fixed',           'important');
    cv.style.setProperty('top',       top + 'px',        'important');
    cv.style.setProperty('left',      left + 'px',       'important');
    cv.style.setProperty('transform', 'none',            'important');
    cv.style.setProperty('width',     width + 'px',      'important');
    cv.style.setProperty('height',    height + 'px',     'important');
    cv.style.setProperty('clip-path', preserveLeftSquare ? 'inset(0 50% 0 0)' : 'none', 'important');
    cv.style.setProperty('z-index',   String(Z.CANVAS),  'important');
    cv.style.setProperty('margin',    '0',               'important');
}

/** 清掉 canvas 的 inline style，交還給 BC 控制。 */
export function clearCanvasStyle() {
    const cv = getCanvas();
    lastForced = null;
    if (!cv) return;
    for (const p of ['position', 'top', 'left', 'transform', 'width', 'height', 'clip-path', 'z-index', 'margin']) {
        cv.style.removeProperty(p);
    }
}
