import { getFeature } from '../core/feature-settings.js';
import { SETTING_CHANGED_EVENT } from '../core/constants.js';
import { createSocketBinding } from '../core/lifecycle.js';
import { createHook } from '../core/hooks.js';
import modApi from '../modsdk.js';
import { SLOTS } from '../core/animal-actions.js';

const hook = createHook('animal-animations');

const HIDDEN_MSG_PREFIX = 'LCEAnimalAnim_';

const renderers = new Map(); // id -> { timer, originalState }
let autoTriggerInterval = null;

function refreshCharacter(char) {
    if (typeof CharacterRefresh === 'function') CharacterRefresh(char, false, false);
}

function applyState(char, slot, state, managedRootKeys, managedPropertyKeys) {
    let item = char.Appearance.find(i => i.Asset.Group.Name === slot);
    if (!item || item.Asset.Name !== state.Name) {
        item = globalThis.InventoryWear(char, state.Name, slot, state.Color, undefined, undefined, undefined, false);
        if (!item) return;
    } else {
        item.Color = Array.isArray(state.Color) ? structuredClone(state.Color) : state.Color;
    }
    
    if (managedRootKeys) {
        for (const key of managedRootKeys) {
            if (['Name', 'Color', 'Asset'].includes(key)) continue;
            if (!(key in state)) delete item[key];
        }
    }
    
    if (managedPropertyKeys && item.Property) {
        for (const key of managedPropertyKeys) {
            if (!state.Property || !(key in state.Property)) delete item.Property[key];
        }
    }
    
    for (const key of Object.keys(state)) {
        if (['Name', 'Color'].includes(key)) continue;
        if (key === 'Property' && item.Property) {
            item.Property = Object.assign(item.Property, structuredClone(state[key]));
        } else {
            item[key] = structuredClone(state[key]);
        }
    }
}

// Perform local animation only
function startRender(char, type, state1, state2, delay, cycles) {
    const id = char.MemberNumber;
    if (!id) return;
    
    const slot = SLOTS[type];
    
    let originalState;
    if (renderers.has(id + type)) {
        const r = renderers.get(id + type);
        clearTimeout(r.timer);
        originalState = r.originalState;
    } else {
        const currentItem = char.Appearance.find(item => item.Asset.Group.Name === slot);
        if (!currentItem) return;
        originalState = { Name: currentItem.Asset.Name, Color: Array.isArray(currentItem.Color) ? structuredClone(currentItem.Color) : currentItem.Color };
        for (const key of Object.keys(currentItem)) {
            if (['Asset', 'Model', 'ModelLoad', 'Name', 'Color'].includes(key) || typeof currentItem[key] === 'function') continue;
            originalState[key] = structuredClone(currentItem[key]);
        }
    }
    
    const managedRootKeys = new Set([...Object.keys(originalState), ...Object.keys(state1), ...Object.keys(state2)]);
    const managedPropertyKeys = new Set([
        ...Object.keys(originalState.Property || {}),
        ...Object.keys(state1.Property || {}),
        ...Object.keys(state2.Property || {})
    ]);
    
    const states = [state2, state1];
    let i = 0;
    
    function step() {
        if (globalThis.CurrentScreen !== 'ChatRoom') {
            const r = renderers.get(id + type);
            if (r) {
                applyState(char, slot, originalState, managedRootKeys, managedPropertyKeys);
                refreshCharacter(char);
                renderers.delete(id + type);
            }
            return;
        }

        const currentItemNow = char.Appearance.find(item => item.Asset.Group.Name === slot);
        
        // Stop if the character took off the item or swapped to something unexpected
        if (!currentItemNow || (currentItemNow.Asset.Name !== state1.Name && currentItemNow.Asset.Name !== state2.Name && currentItemNow.Asset.Name !== originalState.Name)) {
            renderers.delete(id + type);
            return;
        }

        if (i >= cycles * 2) {
            applyState(char, slot, originalState, managedRootKeys, managedPropertyKeys);
            refreshCharacter(char);
            renderers.delete(id + type);
            return;
        }
        
        const state = states[i % 2];
        applyState(char, slot, state, managedRootKeys, managedPropertyKeys);
        
        refreshCharacter(char);
        
        i++;
        renderers.set(id + type, { 
            timer: setTimeout(step, delay), 
            originalState, char, slot, managedRootKeys, managedPropertyKeys 
        });
    }
    
    step();
}

// Send the one-packet network trigger
function triggerAnimation(type, localOnly = false) {
    const player = globalThis.Player;
    if (!player) return;
    
    const state1 = getFeature(`animal${type}State1`);
    const state2 = getFeature(`animal${type}State2`);
    if (!state1 || typeof state1 !== 'object' || typeof state1.Name !== 'string' || !state2 || typeof state2 !== 'object' || typeof state2.Name !== 'string') return;
    
    const slot = SLOTS[type];
    const currentItem = player.Appearance.find(i => i.Asset.Group.Name === slot);
    if (!currentItem) return;
    
    if (currentItem.Asset.Name !== state1.Name && currentItem.Asset.Name !== state2.Name) return;
    
    const cycleFeature = getFeature(`animal${type}Cycles`);
    let cycles = Math.max(1, Math.min(40, (cycleFeature != null ? cycleFeature : (type === 'Wings' ? 3 : 9))));
    let delay = Math.max(100, Math.min(2000, getFeature(`animal${type}Delay`) || 250));
    
    // Randomize cycles (+/- 1) and delay (+/- 20ms) for a more natural, less rigid feel
    const cyclesVary = 1;
    cycles = Math.max(1, Math.min(40, cycles - cyclesVary + Math.floor(Math.random() * (cyclesVary * 2 + 1))));
    
    const delayVary = 20;
    delay = Math.max(100, Math.min(2000, delay - delayVary + Math.floor(Math.random() * (delayVary * 2 + 1))));
    
    // Animate locally for ourselves
    startRender(player, type, state1, state2, delay, cycles);
    
    if (localOnly) return;
    if (globalThis.CurrentScreen !== 'ChatRoom') return;
    
    // Broadcast hidden message
    if (typeof ServerSend === 'function') {
        ServerSend('ChatRoomChat', { 
            Type: 'Hidden', 
            Content: HIDDEN_MSG_PREFIX + type, 
            Dictionary: [{ 
                type: type,
                state1: state1,
                state2: state2,
                delay: delay,
                cycles: cycles
            }] 
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
    for (const type of ['Ears', 'Tails', 'Wings']) {
        if (!getFeature(`animal${type}`)) continue;
        
        const intervalMs = (getFeature(`animal${type}Interval`) || 30) * 1000;
        if (now - lastTriggers[type] > intervalMs) {
            // 20% chance per second after interval elapses (~+5s on average)
            if (Math.random() < 0.2) { 
                lastTriggers[type] = now;
                triggerAnimation(type);
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
    
    const delay = Number.isFinite(dict.delay) ? Math.max(100, Math.min(2000, dict.delay)) : 250;
    const cycles = Number.isFinite(dict.cycles) ? Math.max(1, Math.min(40, dict.cycles)) : 2;
    
    const buildState = s => {
        if (!s || typeof s !== 'object' || typeof s.Name !== 'string') return null;
        if (!globalThis.AssetGet('Female3DCG', SLOTS[dict.type], s.Name)) return null;
        let color = s.Color;
        if (!['string', 'undefined'].includes(typeof color) && !Array.isArray(color)) color = 'Default';
        if (Array.isArray(color)) color = color.filter(c => typeof c === 'string');
        const state = { Name: s.Name, Color: color };
        
        const ALLOWED_KEYS = ['Property', 'Craft', 'Difficulty', 'Extended'];
        for (const key of Object.keys(s)) {
            if (!ALLOWED_KEYS.includes(key)) continue;
            try {
                const val = structuredClone(s[key]);
                // Reject malicious keys just in case structuredClone let them through if they were somehow simple objects
                if (val && typeof val === 'object' && ('__proto__' in val || 'constructor' in val)) continue;
                // Rough size limit
                if (JSON.stringify(val).length > 2000) continue;
                state[key] = val;
            } catch { /* ignore clone errors */ }
        }
        return state;
    };

    const state1 = buildState(dict.state1);
    const state2 = buildState(dict.state2);
    
    if (!state1?.Name || !state2?.Name) return;

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
        for (const [key, r] of renderers.entries()) {
            clearTimeout(r.timer);
            if (r.char && r.slot && r.originalState) {
                applyState(r.char, r.slot, r.originalState, r.managedRootKeys, r.managedPropertyKeys);
            }
        }
        renderers.clear();
        return next(args);
    });

    if (!autoTriggerInterval) {
        autoTriggerInterval = setInterval(checkTriggers, 1000);
    }
    
    window.addEventListener(SETTING_CHANGED_EVENT, () => {
        const anyEnabled = ['Ears', 'Tails', 'Wings'].some(t => getFeature(`animal${t}`));
        if (!anyEnabled && autoTriggerInterval) {
            clearInterval(autoTriggerInterval);
            autoTriggerInterval = null;
        } else if (anyEnabled && !autoTriggerInterval) {
            autoTriggerInterval = setInterval(checkTriggers, 1000);
        }
    });
}
