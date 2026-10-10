import { getFeature } from '../core/feature-settings.js';
import { SETTING_CHANGED_EVENT } from '../core/constants.js';
import { createSocketBinding } from '../core/lifecycle.js';
import { createHook } from '../core/hooks.js';
import modApi from '../modsdk.js';
import { SLOTS, ANIMAL_TYPES, fallbackCycles, clampCycles, clampDelay, sanitizeAnimalState, findSlotItem, applyAnimalState as applyState } from '../core/animal-actions.js';

const hook = createHook('animal-animations');

const HIDDEN_MSG_PREFIX = 'LCEAnimalAnim_';

const renderers = new Map(); // id+type -> { timer, char, slot, names, managedPropertyKeys, state1 }
let autoTriggerInterval = null;

function refreshCharacter(char) {
    if (typeof CharacterRefresh === 'function') CharacterRefresh(char, false, false);
}

function itemSignature(item) {
    if (!item) return '';
    try { return JSON.stringify([item.Asset.Name, item.Color, item.Property, item.Craft, item.Difficulty]); }
    catch { return ''; }
}

/**
 * 動畫結束後，如果本人部位的最終狀態與播放前不同，補送「一個」物件更新封包（同 BCAR 的
 * ChatRoomCharacterItemUpdate），讓伺服器與沒裝 LCE 的人看到的也是最終的 A。
 * 播放過程中的每個畫面不送封包（BCAR 每格都送，LCE 只送 1 個 Hidden 觸發封包）。
 * 起始狀態本來就是 A 時不會送，所以一般情況不增加封包。
 */
function syncToServer(char, slot, startSig) {
    if (char !== globalThis.Player) return;
    if (typeof globalThis.ChatRoomCharacterItemUpdate !== 'function' || !globalThis.ChatRoomData) return;
    if (itemSignature(findSlotItem(char, slot)) === startSig) return;
    try { globalThis.ChatRoomCharacterItemUpdate(char, slot); }
    catch (e) { console.warn('[LCE] animal sync failed', e); }
}

/**
 * 播放用 A → B → A → B …，共 cycles 個完整循環，最後停在 A（靜止姿勢），不還原播放前的物件：
 * 發送者與所有接收者都會停在同一個狀態，不會出現「對方看到 X、本人其實是 A」的落差。
 * 播放中若使用者手動換掉或脫下該部位，立即停止，不覆蓋他的變更。
 */
function startRender(char, type, state1, state2, delay, cycles) {
    const id = char.MemberNumber;
    if (!id) return;

    const slot = SLOTS[type];
    const key = id + type;
    const previous = renderers.get(key);
    if (previous) clearTimeout(previous.timer);

    const startItem = findSlotItem(char, slot);
    const names = new Set([state1.Name, state2.Name, ...(previous ? previous.names : []), ...(startItem ? [startItem.Asset.Name] : [])]);
    const managedPropertyKeys = new Set([
        ...(previous ? previous.managedPropertyKeys : []),
        ...Object.keys(startItem?.Property || {}),
        ...Object.keys(state1.Property || {}),
        ...Object.keys(state2.Property || {})
    ]);
    const startSig = previous ? previous.startSig : itemSignature(startItem);   // 重新觸發時仍以最初狀態為準
    const base = { char, slot, names, managedPropertyKeys, state1, startSig };

    const states = [state2, state1];   // 先 B 後 A：第一個畫面就會動，結束時剛好停在 A
    let i = 0;

    function finish() { renderers.delete(key); }

    function step() {
        try {
            // 角色已離開房間：物件已被丟棄，不需要任何處理
            if (char !== globalThis.Player && !(globalThis.ChatRoomCharacter ?? []).includes(char)) { finish(); return; }

            // 使用者手動換掉或脫下 → 停止，保留使用者的變更
            if (i > 0 || startItem) {
                const now = findSlotItem(char, slot);
                if (!now || !names.has(now.Asset.Name)) { finish(); return; }
            }

            if (globalThis.CurrentScreen !== 'ChatRoom') {
                // 中途離開畫面：定格在 A
                applyState(char, slot, state1, managedPropertyKeys);
                refreshCharacter(char);
                finish();
                syncToServer(char, slot, startSig);
                return;
            }
            if (i >= cycles * 2) { finish(); syncToServer(char, slot, startSig); return; }

            applyState(char, slot, states[i % 2], managedPropertyKeys);
            refreshCharacter(char);

            i++;
            renderers.set(key, { ...base, timer: setTimeout(step, delay) });
        } catch (e) {
            // 例外時一定要清掉登記，否則該角色之後的動畫會永遠被 renderers.has() 擋住
            console.warn('[LCE] animal animation failed', e);
            finish();
        }
    }

    step();
}

// Send the one-packet network trigger
function triggerAnimation(type, { auto = false } = {}) {
    const player = globalThis.Player;
    if (!player) return;

    // 設定檔內容也走同一套驗證，本地播放與送出的封包一致
    const state1 = sanitizeAnimalState(getFeature(`animal${type}State1`));
    const state2 = sanitizeAnimalState(getFeature(`animal${type}State2`));
    if (!state1 || !state2) return;

    const slot = SLOTS[type];
    const currentItem = findSlotItem(player, slot);

    // 自動觸發：使用者脫掉的部位不要被動畫穿回去
    if (auto && !currentItem) return;

    let cycles = clampCycles(getFeature(`animal${type}Cycles`), fallbackCycles(type));
    let delay = clampDelay(getFeature(`animal${type}Delay`) || 250);

    // Randomize cycles (+/- 1) and delay (+/- 20ms) for a more natural, less rigid feel.
    // 隨機化後再夾限一次，上限與接收端相同。
    const cyclesVary = 1;
    cycles = clampCycles(cycles - cyclesVary + Math.floor(Math.random() * (cyclesVary * 2 + 1)));

    const delayVary = 20;
    delay = clampDelay(delay - delayVary + Math.floor(Math.random() * (delayVary * 2 + 1)));

    // Animate locally for ourselves
    startRender(player, type, state1, state2, delay, cycles);

    if (globalThis.CurrentScreen !== 'ChatRoom') return;

    // Broadcast hidden message
    if (typeof ServerSend === 'function') {
        ServerSend('ChatRoomChat', {
            Type: 'Hidden',
            Content: HIDDEN_MSG_PREFIX + type,
            Dictionary: [{ type, state1, state2, delay, cycles }]
        });
    }
}

// Chat intercept for *wag*, *flap*, *wiggle*
export function getAnimTypeFromMsg(msg) {
    if (!msg || typeof msg !== 'string') return null;
    if (!msg.startsWith('*') || !msg.endsWith('*')) return null;
    const content = msg.slice(1, -1).toLowerCase().trim();
    if (/^(?:wag|wags)$/.test(content)) return 'Tails';
    if (/^(?:flap|flaps)$/.test(content)) return 'Wings';
    if (/^(?:wiggle|wiggles|twitch|twitches)$/.test(content)) return 'Ears';
    return null;
}

let lastTriggers = { Ears: Date.now(), Tails: Date.now(), Wings: Date.now() };

function checkTriggers() {
    if (globalThis.CurrentScreen !== 'ChatRoom') return;
    
    const now = Date.now();
    for (const type of ANIMAL_TYPES) {
        if (!getFeature(`animal${type}`)) continue;
        
        const intervalMs = (getFeature(`animal${type}Interval`) || 30) * 1000;
        if (now - lastTriggers[type] > intervalMs) {
            // 20% chance per second after interval elapses (~+5s on average)
            if (Math.random() < 0.2) { 
                lastTriggers[type] = now;
                triggerAnimation(type, { auto: true });
            }
        }
    }
}

export function onAnimalMessage(data) {
    if (data?.Type !== 'Hidden' || !data.Content?.startsWith(HIDDEN_MSG_PREFIX)) return;
    
    const id = data.Sender;
    if (!Number.isSafeInteger(id) || id === globalThis.Player?.MemberNumber) return;


    const dict = Array.isArray(data.Dictionary) ? data.Dictionary[0] : data.Dictionary;
    if (!dict || !dict.type || !dict.state1 || !dict.state2) return;
    if (!Object.keys(SLOTS).includes(dict.type)) return;
    
    if (renderers.has(id + dict.type)) return;
    if (renderers.size > 20) return;
    if (!getFeature(`animal${dict.type}`)) return;
    
    const char = (globalThis.ChatRoomCharacter ?? []).find(c => c.MemberNumber === id);
    if (!char) return;
    
    const delay = clampDelay(dict.delay, 250);
    const cycles = clampCycles(dict.cycles, 2);

    // 資產必須存在於該部位；其餘欄位由共用的 sanitizeAnimalState 驗證（白名單、型別、深度、大小）
    const buildState = s => {
        const state = sanitizeAnimalState(s);
        if (!state) return null;
        if (!globalThis.AssetGet('Female3DCG', SLOTS[dict.type], state.Name)) return null;
        return state;
    };

    const state1 = buildState(dict.state1);
    const state2 = buildState(dict.state2);

    if (!state1 || !state2) return;

    startRender(char, dict.type, state1, state2, delay, cycles);
}

let installed = false;
export function installAnimalAnimations() {
    if (installed) return;
    installed = true;
    
    // Receive network anims
    const binding = createSocketBinding({ ChatRoomMessage: onAnimalMessage });
    const bind = () => binding.bind(typeof ServerSocket === 'undefined' ? null : ServerSocket);
    (function wait(n = 240) {
        if (typeof ServerSocket === 'undefined' || !ServerSocket) {
            if (n > 0) setTimeout(() => wait(n - 1), 500);
            return;
        }
        bind();
        try { modApi.hookFunction('ServerInit', 10, (args, next) => { const r = next(args); bind(); return r; }); }
        catch { /* ignore */ }
    })();

    hook('ChatRoomLeave', 10, (args, next) => {
        for (const r of renderers.values()) {
            clearTimeout(r.timer);
            // 定格在 A；使用者已手動換掉或脫下的部位不動
            try {
                const item = findSlotItem(r.char, r.slot);
                if (item && r.names.has(item.Asset.Name)) {
                    applyState(r.char, r.slot, r.state1, r.managedPropertyKeys);
                    syncToServer(r.char, r.slot, r.startSig);
                }
            } catch (e) { console.warn('[LCE] animal finalize failed', e); }
        }
        renderers.clear();
        return next(args);
    });

    // *wag* / *flap* / *wiggle* 聊天觸發：照常送出訊息，送出後播放
    hook('ChatRoomSendChat', 5, (args, next) => {
        let type = null;
        try {
            type = getAnimTypeFromMsg(typeof ElementValue === 'function' ? ElementValue('InputChat') : '');
            if (type && !getFeature(`animal${type}`)) type = null;
        } catch { type = null; }
        const result = next(args);
        if (type) { try { triggerAnimation(type); } catch (e) { console.warn('[LCE] animal trigger failed', e); } }
        return result;
    });

    if (!autoTriggerInterval) {
        autoTriggerInterval = setInterval(checkTriggers, 1000);
    }
    
    window.addEventListener(SETTING_CHANGED_EVENT, () => {
        const anyEnabled = ANIMAL_TYPES.some(t => getFeature(`animal${t}`));
        if (!anyEnabled && autoTriggerInterval) {
            clearInterval(autoTriggerInterval);
            autoTriggerInterval = null;
        } else if (anyEnabled && !autoTriggerInterval) {
            autoTriggerInterval = setInterval(checkTriggers, 1000);
        }
    });
}
