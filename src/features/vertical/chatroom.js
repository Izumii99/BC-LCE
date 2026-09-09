// ════════════════════════════════════════════════════════════════════════════
// 直式聊天室（verticalChatRoom）—— 移植自 MPL 的 crXxx / drXxx
//
//   cr*  聊天室：人物 50%、選單 4%；聊天紀錄與輸入列共用剩餘空間。
//   dr*  聊天室內開啟對話框（自介、表情、衣物選單）時：canvas 右半用 mirror
//        canvas 複製到下半螢幕，點擊再換算座標注回 BC。
//
// 兩者互斥，由 index.js 的 checkScene() 依有無 CurrentCharacter 切換。
// ════════════════════════════════════════════════════════════════════════════

import { getCanvas, injectStyle, removeStyle, isPortrait, getLockedVH } from '../../core/util.js';
import { createScope } from '../../core/lifecycle.js';
import { Z, forceCanvasStyle, clearCanvasStyle } from './common.js';

const LOG = '🐈‍⬛ [LCE]';

// ───────────────────────── 聊天室本體 ─────────────────────────
let crActive = false;
let crLockedVH = 0;
let crLockedWidth = 0;
let crScope = null;

const CR_CANVAS_RATIO = 0.50;
const CR_MENU_RATIO = 0.04;

export const isCrActive = () => crActive;

/** Only the character and menu regions have fixed proportions. */
function crCalc() {
    const vh = crLockedVH || window.innerHeight;
    const cvH = Math.round(vh * CR_CANVAS_RATIO);
    const menuH = Math.round(vh * CR_MENU_RATIO);
    return { vh, cvH, menuH };
}

// ── 手機鍵盤 ──
// 使用 BC 原生 InputChat，鍵盤打開時只把輸入列移到 visual viewport 底部。
// 人物區仍採用鍵盤打開前的高度，因此不會被 resize 壓扁；也不需要第二個輸入框，
// 避免 focus/blur 互相觸發造成面板反覆閃爍。
let crInputFocused = false;
let crBlurTimer = null;

export const isKeyboardLayoutLocked = () => crActive && window.innerWidth === crLockedWidth && (crInputFocused ||
    (crLockedVH > 0 && getLockedVH() < crLockedVH - 80));

function crSetLayoutVars(L = crCalc()) {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const visualHeight = Number.isFinite(vv?.height) ? vv.height : L.vh;
    const visualOffsetTop = Number.isFinite(vv?.offsetTop) ? vv.offsetTop : 0;
    const visualBottom = visualOffsetTop + visualHeight;
    const bottom = isKeyboardLayoutLocked() ? Math.min(L.vh, visualBottom) : L.vh;
    // On very short keyboard viewports allow the chat panel to cover the character
    // region, keeping native input controls visible without resizing the canvas.
    const top = Math.min(L.cvH, Math.max(visualOffsetTop, bottom - L.menuH - 64));
    for (const [key, value] of Object.entries({
        'top': top, 'height': Math.max(0, bottom - top), 'menu-h': L.menuH,
    })) {
        const name = '--lce-cr-' + key;
        const next = value + 'px';
        if (root.style.getPropertyValue?.(name) !== next) root.style.setProperty(name, next);
    }
}

export function crUpdateViewport() {
    if (crActive) crSetLayoutVars();
}

function crHookChatInput() {
    const isChatInput = el => el?.id === 'InputChat';
    const focusHandler = (e) => {
        if (!crActive || !isPortrait() || !isChatInput(e.target)) return;
        if (crBlurTimer) clearTimeout(crBlurTimer);
        crBlurTimer = null;
        crInputFocused = true;
        crScope?.frame(crUpdateViewport);
    };
    const blurHandler = (e) => {
        if (!isChatInput(e.target)) return;
        if (crBlurTimer) clearTimeout(crBlurTimer);
        // 送出後 BC 可能重建並立刻 focus 新輸入框；延遲可避免中間一幀跳回底部。
        crBlurTimer = setTimeout(() => {
            crBlurTimer = null;
            crInputFocused = false;
            crUpdateViewport();
        }, 250);
    };
    crScope.listen(document, 'focusin', focusHandler, true);
    crScope.listen(document, 'focusout', blurHandler, true);
}

/** 每幀維護（由 DrawProcess / ChatRoomResize 呼叫）。 */
export function crMaintain() {
    if (!crActive) return;
    if (!isKeyboardLayoutLocked()) {
        crLockedVH = getLockedVH();
        crLockedWidth = window.innerWidth;
    }
    const L = crCalc();
    crSetLayoutVars(L);
    forceCanvasStyle(L.cvH, true);
}

export function crApply() {
    if (crActive) return;
    crActive = true;
    crScope = createScope();
    crLockedVH = getLockedVH();
    crLockedWidth = window.innerWidth;

    injectStyle('lce-v-cr', `
        html, body { overflow-x: hidden !important }
        #chat-room-div {
            position:fixed !important; left:0 !important; top:var(--lce-cr-top) !important;
            width:100vw !important; height:var(--lce-cr-height) !important;
            display:flex !important; flex-direction:column !important;
            min-height:0 !important; box-sizing:border-box !important;
            z-index:${Z.CHAT_DIV} !important;
        }
        #chat-room-top-menu {
            flex:0 0 var(--lce-cr-menu-h) !important;
            height:var(--lce-cr-menu-h) !important; min-height:0 !important;
            box-sizing:border-box !important;
        }
        #TextAreaChatLog {
            flex:1 1 0 !important; height:auto !important; min-height:0 !important;
            overflow-y:auto !important;
        }
        #chat-room-bot, #chat-room-reply-indicator {
            flex:0 0 auto !important;
        }
        #InputChat {
            font-size:16px !important;
        }
    `);

    crHookChatInput();
    crMaintain();
}

export function crRemove() {
    if (!crActive) return;
    crActive = false;
    crLockedVH = 0;
    crLockedWidth = 0;
    crInputFocused = false;
    if (crBlurTimer) clearTimeout(crBlurTimer);
    crBlurTimer = null;
    crScope?.dispose();
    crScope = null;
    clearCanvasStyle();
    removeStyle('lce-v-cr');

    for (const prop of ['--lce-cr-top', '--lce-cr-height', '--lce-cr-menu-h']) {
        document.documentElement.style.removeProperty(prop);
    }

    if (typeof ChatRoomResize === 'function') { try { ChatRoomResize(false); } catch { /* ignore */ } }
}

// ───────────────────────── 對話框（Dialog）─────────────────────────
// 不搬 canvas 的右半，而是「複製」一份到下半螢幕；點擊下半時把螢幕座標換算回
// BC 的虛擬座標，設好 MouseX/MouseY 再 dispatch 事件，讓 BC 自己處理點擊邏輯。

let drActive = false;
let drMirrorRAF = null;
let drCapture = null;

export const isDrActive = () => drActive;

export function getDialogRect() {
    const half = Math.round(window.innerHeight / 2);
    const size = Math.min(window.innerWidth, half);
    return { left: (window.innerWidth - size) / 2, top: half + (half - size) / 2,
        width: size, height: size, scale: size / 1000 };
}

/** 把下半螢幕的點擊換算成 BC 虛擬座標並注入。 */
function drInjectClick(screenX, screenY, pointerType = 'touch') {
    const cv = getCanvas();
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dest = getDialogRect();
    if (screenX < dest.left || screenX > dest.left + dest.width ||
        screenY < dest.top || screenY > dest.top + dest.height) return;
    const x = (screenX - dest.left) / dest.scale;
    const y = (screenY - dest.top) / dest.scale;

    // BC 虛擬座標系：右半是 x 1000~2000
    if (typeof MouseX !== 'undefined') window.MouseX = 1000 + x;
    if (typeof MouseY !== 'undefined') window.MouseY = y;

    const eventOpts = {
        bubbles: true, cancelable: true,
        clientX: rect.left + (1000 + x) * rect.width / 2000,
        clientY: rect.top + y * rect.height / 1000,
        pointerType, isPrimary: true,
    };

    if (typeof PointerEvent === 'function') {
        // 合成事件的 pointerId 沒有對應的真實 pointer，setPointerCapture 會丟
        // NotFoundError，先暫時擋掉
        const origSet = cv.setPointerCapture.bind(cv);
        const origRelease = cv.releasePointerCapture.bind(cv);
        cv.setPointerCapture = () => {};
        cv.releasePointerCapture = () => {};
        try {
            cv.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
            cv.dispatchEvent(new PointerEvent('pointerup', eventOpts));
        } finally {
            cv.setPointerCapture = origSet;
            cv.releasePointerCapture = origRelease;
        }
    }

    cv.dispatchEvent(new MouseEvent('mousedown', eventOpts));
    cv.dispatchEvent(new MouseEvent('mouseup', eventOpts));
    cv.dispatchEvent(new MouseEvent('click', eventOpts));

    // 兩幀後歸位，避免殘留座標影響 BC 後續判斷
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (typeof MouseX !== 'undefined') window.MouseX = -1;
        if (typeof MouseY !== 'undefined') window.MouseY = -1;
    }));
}

const DIALOG_SEL = '.dialog-root, #color-picker, #layering';

// 記住每個元素「上次我們設的位置」。BC 沒重新定位它就別再動，否則位移會一直
// 疊加，畫面會漂移抖動。
const drMovedElements = new WeakMap();

// AEE owns its React DOM; LCE owns the source-to-destination layout mapping.
// Pass the native header's mapped horizontal bounds, never the full canvas width.
let mappedPickerApi = null;
function drMapColorPicker() {
    const api = window.Liko?.AEE?.ColorPickerLayout;
    if (mappedPickerApi && mappedPickerApi !== api) mappedPickerApi.setMapping(null);
    mappedPickerApi = api?.version === 1 ? api : null;
    if (!mappedPickerApi) return;
    const header = document.getElementById('color-picker-header');
    const menu = document.getElementById('color-picker-menu');
    if (!drActive || !header || !menu) { mappedPickerApi.setMapping(null); return; }
    const area = getDialogRect();
    const h = header.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const heading = document.getElementById('color-picker-hgroup')
        || document.getElementById('color-picker-h1')?.closest('hgroup');
    const left = Math.max(0, h.width > 0 ? h.left : area.left);
    const right = Math.min(window.innerWidth, h.width > 0 ? h.right : area.left + area.width);
    const headingTop = Math.max(area.top, m.bottom) + 4;
    mappedPickerApi.setMapping({left, width: right - left, headingTop,
        top: headingTop + (heading?.getBoundingClientRect().height || 30) + 4,
        bottom: window.innerHeight});
}

/** 每幀把 dialog 頂層容器搬到下半螢幕（只動頂層，子元素相對定位不變）。 */
export function drMoveDomElements() {
    if (!drActive) return;
    const vw = window.innerWidth;
    const cvH = Math.round(window.innerHeight * 0.5);

    document.querySelectorAll(DIALOG_SEL).forEach((el) => {
        if (el.parentElement?.closest(DIALOG_SEL)) return;
        const r = el.getBoundingClientRect();
        const prev = drMovedElements.get(el);
        if (prev && Math.abs(r.left - prev.lastSetLeft) < 1 && Math.abs(r.top - prev.lastSetTop) < 1) return;
        if (r.left < vw * 0.5) return;   // 只處理 BC 定位在螢幕右側（被擠出去）的元素

        const newLeft = r.left - getDialogRect().width;
        const newTop = r.top + cvH;
        el.style.setProperty('left', newLeft + 'px', 'important');
        el.style.setProperty('top', newTop + 'px', 'important');
        el.style.setProperty('z-index', String(Z.DIALOG_ROOT), 'important');
        if (el.classList.contains('dialog-root')) el.style.setProperty('width', getDialogRect().width + 'px', 'important');
        drMovedElements.set(el, { lastSetLeft: newLeft, lastSetTop: newTop });
    });
    drMapColorPicker();
}

/** 建立 mirror canvas，持續把主 canvas 右半複製到下半螢幕（每 2 幀一次，30fps 夠用）。 */
function drStartMirror() {
    const cvH = Math.round(window.innerHeight * 0.5);
    const vw = window.innerWidth;

    document.getElementById('lce-dr-mirror')?.remove();
    if (drMirrorRAF) { cancelAnimationFrame(drMirrorRAF); drMirrorRAF = null; }

    const mirror = document.createElement('canvas');
    mirror.id = 'lce-dr-mirror';
    mirror.width = vw;
    mirror.height = cvH;
    mirror.style.cssText = `
        position:fixed !important; top:${cvH}px !important; left:0 !important;
        width:${vw}px !important; height:${cvH}px !important;
        z-index:${Z.DR_MIRROR} !important; pointer-events:none !important;
    `;
    document.body.appendChild(mirror);

    const ctx = mirror.getContext('2d');
    const src = getCanvas();
    let frame = 0;

    const loop = () => {
        drMirrorRAF = requestAnimationFrame(loop);
        if (!drActive || !src) return;
        if (++frame % 2 === 0) {
            ctx.clearRect(0, 0, vw, cvH);
            const d = getDialogRect();
            try { ctx.drawImage(src, 1000, 0, 1000, 1000, d.left, d.top - cvH, d.width, d.height); } catch { /* ignore */ }
        }
        drMoveDomElements();
    };
    loop();
}

export function drApply() {
    if (drActive) return;
    drActive = true;

    const cvH = Math.round(window.innerHeight * 0.5);
    forceCanvasStyle(cvH, true);

    injectStyle('lce-v-dr', `
        html, body { overflow-x:hidden !important }
        #lce-dr-overlay {
            position:fixed; top:${cvH}px; left:0;
            width:100vw; height:calc(100vh - ${cvH}px);
            z-index:${Z.DR_OVERLAY} !important;
            cursor:pointer; -webkit-tap-highlight-color:transparent; background:transparent;
        }
        .dialog-root { pointer-events:auto !important; overflow-y:auto !important }
    `);

    drStartMirror();

    document.getElementById('lce-dr-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'lce-dr-overlay';

    const onPointer = (e) => {
        if (!drActive) return;
        e.preventDefault();
        e.stopPropagation();
        const x = e.clientX ?? e.changedTouches?.[0]?.clientX;
        const y = e.clientY ?? e.changedTouches?.[0]?.clientY;
        if (x != null && y != null) drInjectClick(x, y, e.type === 'touchstart' ? 'touch' : 'mouse');
    };
    overlay.addEventListener('mousedown', onPointer, { passive: false });
    overlay.addEventListener('touchstart', onPointer, { passive: false });
    document.body.appendChild(overlay);

    drCapture = { overlay, onPointer };
    drMoveDomElements();
}

export function drRemove() {
    if (!drActive) return;
    drActive = false;
    mappedPickerApi?.setMapping(null);
    mappedPickerApi = null;

    if (drMirrorRAF) { cancelAnimationFrame(drMirrorRAF); drMirrorRAF = null; }
    document.getElementById('lce-dr-mirror')?.remove();

    document.querySelectorAll(DIALOG_SEL).forEach((el) => {
        for (const p of ['left', 'top', 'z-index', 'width']) el.style.removeProperty(p);
        drMovedElements.delete(el);
    });

    clearCanvasStyle();
    removeStyle('lce-v-dr');

    if (drCapture) {
        drCapture.overlay.removeEventListener('mousedown', drCapture.onPointer);
        drCapture.overlay.removeEventListener('touchstart', drCapture.onPointer);
        drCapture.overlay.remove();
        drCapture = null;
    }
}

/** 每幀維護（mirror 由自己的 rAF loop 維持，這裡只顧 canvas）。 */
export function drMaintain() {
    if (!drActive) return;
    forceCanvasStyle(Math.round(window.innerHeight * 0.5), true);
}

export { LOG };
