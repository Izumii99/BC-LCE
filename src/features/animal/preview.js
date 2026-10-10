// ════════════════════════════════════════════════════════════════════════════
// 動物頁擺動預覽
// 參考 Responsive 的 animation-preview：用「獨立的預覽角色」播放，不動本人、不送封包。
// 與 Responsive 不同的是 A/B 姿勢來源是 LCE 設定（animal{Ears,Tails,Wings}State1/2 與
// Cycles / Delay），播放順序與正式動畫一致：B → A → B → A …，共 cycles 個循環，停在 A。
// 以經過時間決定畫面（而非 setTimeout），由設定頁每幀呼叫 draw() 驅動。
// ════════════════════════════════════════════════════════════════════════════

import { getFeature } from '../../core/feature-settings.js';
import { SLOTS, fallbackCycles, clampCycles, clampDelay, sanitizeAnimalState, findSlotItem, safeClone, applyAnimalState, collectManagedKeys, poseAt } from './actions.js';

const PREVIEW_NAME = 'LCE_AnimalPreview';

// 設定頁每幀都會問「能不能測試」：姿勢驗證（深度檢查 + JSON 長度）只在設定物件換了才重算。
const stateCache = new Map();   // type -> { raw1, raw2, state1, state2 }

function savedStates(type) {
    const raw1 = getFeature(`animal${type}State1`), raw2 = getFeature(`animal${type}State2`);
    const hit = stateCache.get(type);
    if (hit && hit.raw1 === raw1 && hit.raw2 === raw2) return hit;
    const entry = { raw1, raw2, state1: sanitizeAnimalState(raw1), state2: sanitizeAnimalState(raw2) };
    stateCache.set(type, entry);
    return entry;
}

/**
 * 指定部位（Ears / Tails / Wings）的播放設定；A、B 姿勢沒有都存好時回傳 null。
 * 預覽等同「主動觸發」（*wag* 等），不要求本人有穿；只有定時自動觸發才需要配戴（見 index.js）。
 * 一次只測一個部位（設定頁目前停留的分頁），避免多個部位同時動而混淆。
 */
export function getTrack(type) {
    const { state1, state2 } = savedStates(type);
    if (!state1 || !state2) return null;
    return {
        type, slot: SLOTS[type], state1, state2,
        cycles: clampCycles(getFeature(`animal${type}Cycles`), fallbackCycles(type)),
        delay: clampDelay(getFeature(`animal${type}Delay`) || 250),
    };
}

/** 預覽用的本人副本：只複製外觀與姿勢，物件資料深複製，之後的改動不會回寫到 Player。 */
function copyAppearance(player) {
    return player.Appearance.map(item => {
        const copy = { ...item, Color: safeClone(item.Color) ?? 'Default' };
        if (item.Property !== undefined) copy.Property = safeClone(item.Property) ?? {};
        if (item.Craft) copy.Craft = safeClone(item.Craft);
        return copy;
    });
}

export function createAnimalPreview(now = () => performance.now()) {
    let character = null;
    let run = null;   // { start, track: {...getTrack(), managed, frame} }

    const refresh = () => CharacterRefresh(character, false, false);

    return {
        /** 依本人目前外觀重建預覽角色（進入頁面、從衣櫃返回、按測試時呼叫）。 */
        rebuild() {
            const player = globalThis.Player;
            run = null;
            if (!player?.Appearance || typeof CharacterLoadSimple !== 'function') { character = null; return false; }
            character = CharacterLoadSimple(PREVIEW_NAME);
            character.Name = player.Name;
            character.AssetFamily = player.AssetFamily;
            character.Appearance = copyAppearance(player);
            character.ActivePose = safeClone(player.ActivePose ?? []) ?? [];
            refresh();
            return true;
        },

        hasAnimation: (type) => !!character && getTrack(type) !== null,
        isPlaying: () => run !== null,

        /** 從頭播放指定部位；該部位沒有存好 A、B 兩個姿勢時回傳 false。 */
        play(type) {
            const track = character && getTrack(type);
            if (!track) return false;
            const startItem = findSlotItem(character, track.slot);
            const managed = collectManagedKeys(new Set(), startItem, track.state1, track.state2);
            run = { start: now(), track: { ...track, managed, frame: -1 } };
            this.update();
            return true;
        },

        stop() { run = null; },

        /** 依經過時間推進動畫：只在畫面（B/A）改變時才套用並重繪；播完停在 A 並結束。 */
        update() {
            if (!character || !run) return;
            const t = run.track;
            const total = t.cycles * 2;
            const frame = Math.min(total, Math.floor((now() - run.start) / t.delay));
            if (frame !== t.frame) {
                t.frame = frame;
                applyAnimalState(character, t.slot, poseAt(frame, total, t.state1, t.state2), t.managed);
                refresh();
            }
            if (frame >= total) run = null;
        },

        /** 畫在畫布上（x, y 為角色框左上角；DrawCharacter 自己處理 MustDraw 與暫存）。 */
        draw(x, y, zoom) {
            if (!character) return;
            this.update();
            DrawCharacter(character, x, y, zoom, false);
        },

        clear() { run = null; character = null; },
    };
}
