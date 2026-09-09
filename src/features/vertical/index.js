import { createScope } from '../../core/lifecycle.js';
import { createHook } from '../../core/hooks.js';
// ════════════════════════════════════════════════════════════════════════════
// 直式版面（UI 替換）—— 移植自 MPL
//
//   verticalChatRoom    聊天室 + 對話框（chatroom.js 的 cr* / dr*）
//   verticalChatSearch  房間清單 + 房間類型選擇（chatsearch.js 的 csh* / cs*）
//   verticalLogin       登入頁 —— 不在這裡，見 loginpage/（登入前讀不到 DB 設定）
//
// 與 MPL 的差異：MPL 只看螢幕方向就套用，LCE 是「直向 且 該項設定開啟」才套用。
// 每個模組都必須能隨時 remove 還原，因為使用者可能隨時轉螢幕或關設定。
// ════════════════════════════════════════════════════════════════════════════

import { getFeature } from '../../core/feature-settings.js';
import { isPortrait } from '../../core/util.js';
import { SETTING_CHANGED_EVENT } from '../../core/constants.js';
import {
    crApply, crRemove, crMaintain, crUpdateViewport, isCrActive, isKeyboardLayoutLocked, getDialogRect,
    drApply, drRemove, drMaintain, isDrActive,
} from './chatroom.js';
import {
    csApply, csRemove, buildCsBg, isCsActive,
    cshApply, cshRemove, renderCshList, isCshActive, cshMarkNeedSync, cshSyncIfNeeded,
} from './chatsearch.js';

const LOG = '🐈‍⬛ [LCE]';

const registerHook = createHook('vertical');
let scope = null;
function hook(name, priority, fn) { scope.add(registerHook(name, priority, fn)); }

const wantCr = () => (isPortrait() || isKeyboardLayoutLocked()) && getFeature('verticalChatRoom');
const wantCsh = () => isPortrait() && getFeature('verticalChatSearch');

export const Vertical = Object.freeze({
    getState: () => ({
        version: 1,
        active: isCrActive() || isDrActive() || isCsActive() || isCshActive(),
        mode: isDrActive() ? 'dialog' : isCrActive() ? 'chatroom' : isCshActive() ? 'search' : isCsActive() ? 'select' : null,
        dialogRect: isDrActive() ? getDialogRect() : null,
        keyboardLocked: isKeyboardLayoutLocked(),
    }),
});

/** 關掉所有直式模組（轉橫向、關設定、離開相關畫面時）。 */
function removeAll() {
    if (isCrActive()) crRemove();
    if (isDrActive()) drRemove();
    if (isCsActive()) csRemove();
    if (isCshActive()) cshRemove();
}

/** 每幀由 DrawProcess 呼叫：依目前場景決定要啟用/關閉哪個直式模組。 */
function checkScene() {
    if (!installed) return;
    const scr = typeof CurrentScreen !== 'undefined' ? CurrentScreen : '';
    const hasDialog = typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null;
    const cr = wantCr();
    const csh = wantCsh();

    // 聊天室 + 對話框：兩者互斥
    if (cr && scr === 'ChatRoom' && hasDialog) {
        if (isCrActive()) crRemove();
        if (!isDrActive()) drApply();
    } else if (cr && scr === 'ChatRoom' && !hasDialog) {
        if (isDrActive()) drRemove();
        if (!isCrActive()) crApply();
    } else {
        if (isCrActive()) crRemove();
        if (isDrActive()) drRemove();
    }

    // 房間清單：ChatSearch 與 ChatSelect 互斥
    if (csh && scr === 'ChatSearch') {
        if (isCsActive()) csRemove();
        if (!isCshActive()) cshApply();
    } else if (csh && scr === 'ChatSelect') {
        if (isCshActive()) cshRemove();
        if (!isCsActive()) csApply();
    } else {
        if (isCsActive()) csRemove();
        if (isCshActive()) cshRemove();
    }
}

function handleResize() {
    if (!installed) return;
    if (isCrActive()) { if (!wantCr()) crRemove(); else crMaintain(); }
    if (isDrActive()) { drRemove(); if (wantCr()) drApply(); }
    if (isCsActive()) { csRemove(); if (wantCsh()) csApply(); }
    if (isCshActive()) { if (!wantCsh()) cshRemove(); else renderCshList(false); }
}

let installed = false;

export function installVertical() {
    if (installed) return;
    installed = true;
    scope = createScope();

    // 註：新版 BC 已移除 ChatRoomTopMenuPosition（頂部選單改為 #chat-room-div 內的
    // flex 子元素、由 CSS 排版），不再有「單獨定位頂部選單」的函式可攔。重新套用直式
    // 版面的責任由下面的 ChatRoomResize hook 與 resize 監聽器承擔。
    hook('ChatRoomResize', 0, (args, next) => {
        if (isKeyboardLayoutLocked()) { crUpdateViewport(); return; }
        const r = next(args); crMaintain(); return r;
    });
    hook('ChatRoomLeave', 0, (args, next) => { crRemove(); return next(args); });

    hook('DialogLoad', 0, (args, next) => {
        const r = next(args);
        if (wantCr() && !isDrActive()) drApply();
        return r;
    });
    hook('DialogLeave', 0, (args, next) => {
        const r = next(args);
        if (isDrActive()) drRemove();
        return r;
    });

    hook('ChatSearchResultResponse', 0, (args, next) => { const r = next(args); cshMarkNeedSync(); return r; });
    hook('ChatSearchRun', 0, (args, next) => { const r = next(args); cshSyncIfNeeded(); return r; });
    hook('ChatSelectLoad', 0, (args, next) => {
        const r = next(args);
        if (isCsActive()) scope.frame(buildCsBg);
        return r;
    });
    hook('ChatSearchLoad', 0, (args, next) => {
        const r = next(args);
        // BC 載入後還會非同步補房間資料，等一下再刷才有東西
        if (isCshActive()) scope.timeout(() => { if (isCshActive()) renderCshList(); }, 600);
        return r;
    });

    hook('DrawProcess', 5, (args, next) => {
        const r = next(args);
        try {
            checkScene();
            if (isDrActive()) drMaintain();
        } catch (e) { console.warn(LOG, 'vertical checkScene:', e); }
        return r;
    });

    // Capture before ordinary resize listeners: keyboard animation must not trigger
    // the game's whole-canvas resize on every intermediate viewport size.
    scope.listen(window, 'resize', e => {
        if (!isKeyboardLayoutLocked()) return;
        e.stopImmediatePropagation();
        crUpdateViewport();
    }, true);
    scope.listen(window, 'resize', handleResize);
    scope.listen(window, 'orientationchange', () => scope.timeout(handleResize, 100));

    // 鍵盤改變 visual viewport 時只搬動原生輸入列，不重算人物區基準高度。
    scope.listen(window.visualViewport, 'resize', crUpdateViewport);
    scope.listen(window.visualViewport, 'scroll', crUpdateViewport);

    // 設定被關掉時立刻還原，不用等使用者轉螢幕
    scope.listen(window, SETTING_CHANGED_EVENT, (e) => {
        if (e.detail?.key === 'verticalChatRoom' || e.detail?.key === 'verticalChatSearch') {
            try { checkScene(); } catch { /* ignore */ }
        }
    });
}

/** 全部關閉並還原（供 console 或除錯用）。 */
export function uninstallVertical() {
    installed = false;
    scope?.dispose();
    scope = null;
    removeAll();
}
