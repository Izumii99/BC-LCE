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
        originalState = {
            Name: currentItem.Asset.Name,
            Color: Array.isArray(currentItem.Color) ? structuredClone(currentItem.Color) : currentItem.Color,
            Property: currentItem.Property ? structuredClone(currentItem.Property) : undefined,
            Craft: currentItem.Craft ? structuredClone(currentItem.Craft) : undefined,
            Difficulty: currentItem.Difficulty
        };
    }
    
    const states = [state2, state1];
    let i = 0;
    
    function step() {
        const currentItemNow = char.Appearance.find(item => item.Asset.Group.Name === slot);
        
        // Stop if the character took off the item or swapped to something unexpected
        if (!currentItemNow || (currentItemNow.Asset.Name !== state1.Name && currentItemNow.Asset.Name !== state2.Name && currentItemNow.Asset.Name !== originalState.Name)) {
            renderers.delete(id + type);
            return;
        }

        if (i >= cycles) {
            const item = globalThis.InventoryWear(char, originalState.Name, slot, originalState.Color, undefined, undefined, undefined, false);
            if (item) {
                if (originalState.Property) item.Property = structuredClone(originalState.Property);
                if (originalState.Craft) item.Craft = structuredClone(originalState.Craft);
                if (originalState.Difficulty !== undefined) item.Difficulty = originalState.Difficulty;
            }
            refreshCharacter(char);
            renderers.delete(id + type);
            return;
        }
        
        const state = states[i % 2];
        const item = globalThis.InventoryWear(char, state.Name, slot, state.Color, undefined, undefined, undefined, false);
        if (item && state.Property) {
            item.Property = structuredClone(state.Property);
        }
        
        refreshCharacter(char);
        
        i++;
        renderers.set(id + type, { timer: setTimeout(step, delay), originalState });
    }
    
    step();
}

// Send the one-packet network trigger
function triggerAnimation(type, localOnly = false) {
    const player = globalThis.Player;
    if (!player) return;
    
    const state1 = getFeature(`animal${type}State1`);
    const state2 = getFeature(`animal${type}State2`);
    if (!state1 || !state2) return;
    
    const slot = SLOTS[type];
    const currentItem = player.Appearance.find(i => i.Asset.Group.Name === slot);
    if (!currentItem) return;
    
    if (currentItem.Asset.Name !== state1.Name && currentItem.Asset.Name !== state2.Name) return;
    
    let cycles = Math.max(1, Math.min(40, getFeature(`animal${type}Cycles`) || 18));
    let delay = Math.max(10, Math.min(2000, getFeature(`animal${type}Delay`) || 250));
    
    // Randomize cycles and delay (+/- 33%) for a more natural, less rigid feel
    const cyclesVary = Math.round(cycles * 0.33);
    cycles = Math.max(1, cycles - cyclesVary + Math.floor(Math.random() * (cyclesVary * 2 + 1)));
    
    const delayVary = Math.round(delay * 0.33);
    delay = Math.max(10, delay - delayVary + Math.floor(Math.random() * (delayVary * 2 + 1)));
    
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
    
    const char = (globalThis.ChatRoomCharacter ?? []).find(c => c.MemberNumber === id);
    if (!char) return;
    
    const delay = Number.isFinite(dict.delay) ? Math.max(10, Math.min(2000, dict.delay)) : 250;
    const cycles = Number.isFinite(dict.cycles) ? Math.max(1, Math.min(40, dict.cycles)) : 2;
    
    const buildState = s => {
        if (!s || typeof s !== 'object' || typeof s.Name !== 'string') return null;
        let color = s.Color;
        if (!['string', 'undefined'].includes(typeof color) && !Array.isArray(color)) color = 'Default';
        if (Array.isArray(color)) color = color.filter(c => typeof c === 'string');
        return {
            Name: s.Name,
            Color: color,
            Property: s.Property && typeof s.Property === 'object' && typeof s.Property.Type === 'string' && s.Property.Type.length < 50 ? { Type: s.Property.Type } : undefined
        };
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

    // Intercept manual chat triggers
    hook('ServerSend', 10, (args, next) => {
        const [kind, data] = args;
        if (kind === 'ChatRoomChat' && ['Chat', 'Emote', 'Action'].includes(data?.Type)) {
            const type = getAnimTypeFromMsg(data.Content);
            if (type && getFeature(`animal${type}`)) {
                triggerAnimation(type);
                lastTriggers[type] = Date.now(); // reset auto interval
            }
        }
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
