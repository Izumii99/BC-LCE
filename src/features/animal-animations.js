import { getFeature, setFeature } from '../core/feature-settings.js';
import { createSocketBinding } from '../core/lifecycle.js';
import { createHook } from '../core/hooks.js';
import modApi from '../modsdk.js';

const hook = createHook('animal-animations');

const SLOTS = {
    Ears: 'HairAccessory2',
    Tails: 'TailStraps',
    Wings: 'Wings'
};

const HIDDEN_MSG_PREFIX = 'LCEAnimalAnim_';

const renderers = new Map(); // id -> { timer }

export function saveAnimalPose(type, stateNum, draft) {
    const player = globalThis.Player;
    if (!player) return false;
    
    const slot = SLOTS[type];
    const item = player.Appearance.find(i => i.Asset.Group.Name === slot);
    
    if (!item) {
        draft[`animal${type}State${stateNum}`] = null;
        return true;
    }
    
    const state = {
        Name: item.Asset.Name,
        Color: item.Color,
        Property: item.Property ? structuredClone(item.Property) : undefined
    };
    
    console.log(`[LCE Debug] saveAnimalPose type=${type}, stateNum=${stateNum}`, state);
    draft[`animal${type}State${stateNum}`] = state;
    return true;
}

export function clearAnimalAnim(type, draft) {
    draft[`animal${type}State1`] = null;
    draft[`animal${type}State2`] = null;
    return true;
}

export function testAnimalAnim(type) {
    triggerAnimation(type, true); // true = force local only, no server send
    return true;
}

function refreshCharacter(char) {
    if (typeof CharacterRefresh === 'function') CharacterRefresh(char, false, false);
}

// Perform local animation only
function startRender(char, type, state1, state2, delay, cycles) {
    const id = char.MemberNumber;
    if (!id) return;
    
    const slot = SLOTS[type];
    
    if (renderers.has(id + type)) {
        clearTimeout(renderers.get(id + type).timer);
        renderers.delete(id + type);
    }
    
    const states = [state2, state1];
    let i = 0;
    
    function step() {
        if (i >= cycles * 2) {
            refreshCharacter(char);
            renderers.delete(id + type);
            return;
        }
        
        const state = states[i % 2];
        const currentItem = char.Appearance.find(item => item.Asset.Group.Name === slot);
        
        // Stop if the character took off the item
        if (!currentItem || (currentItem.Asset.Name !== state1.Name && currentItem.Asset.Name !== state2.Name)) {
            refreshCharacter(char);
            renderers.delete(id + type);
            return;
        }
        
        const item = globalThis.InventoryWear(char, state.Name, slot, state.Color, undefined, undefined, undefined, false);
        if (item && state.Property) {
            item.Property = structuredClone(state.Property);
        }
        
        refreshCharacter(char);
        
        i++;
        renderers.set(id + type, { timer: setTimeout(step, delay) });
    }
    
    step();
}

// Send the one-packet network trigger
function triggerAnimation(type, localOnly = false) {
    const player = globalThis.Player;
    if (!player) return;
    
    const state1 = getFeature(`animal${type}State1`);
    const state2 = getFeature(`animal${type}State2`);
    console.log(`[LCE Debug] triggerAnimation type=${type}, localOnly=${localOnly}, state1=${!!state1}, state2=${!!state2}`);
    if (!state1 || !state2) {
        console.log(`[LCE Debug] Missing states! state1:`, state1, `state2:`, state2);
        return;
    }
    
    const slot = SLOTS[type];
    const currentItem = player.Appearance.find(i => i.Asset.Group.Name === slot);
    if (!currentItem) {
        console.log(`[LCE Debug] No item found on player for slot ${slot}`);
        return;
    }
    
    if (currentItem.Asset.Name !== state1.Name && currentItem.Asset.Name !== state2.Name) {
        console.log(`[LCE Debug] Item name mismatch. Current: ${currentItem.Asset.Name}, State1: ${state1.Name}, State2: ${state2.Name}`);
        return;
    }
    
    const cycles = Math.max(1, Math.min(10, getFeature(`animal${type}Cycles`) || 2));
    const delay = Math.max(100, Math.min(2000, getFeature(`animal${type}Delay`) || 250));
    
    console.log(`[LCE Debug] Starting render. Cycles: ${cycles}, Delay: ${delay}`);
    // Animate locally for ourselves
    startRender(player, type, state1, state2, delay, cycles);
    
    if (localOnly) return;
    if (globalThis.CurrentScreen !== 'ChatRoom') {
        console.log(`[LCE Debug] Not in ChatRoom, skipping broadcast.`);
        return;
    }
    
    console.log(`[LCE Debug] Broadcasting hidden packet.`);
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
function getAnimTypeFromMsg(msg) {
    if (!msg || typeof msg !== 'string') return null;
    const lower = msg.toLowerCase().trim();
    if (lower === '*wag*') return 'Tails';
    if (lower === '*flap*') return 'Wings';
    if (lower === '*wiggle*') return 'Ears';
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
    
    const char = (globalThis.ChatRoomCharacter ?? []).find(c => c.MemberNumber === id);
    if (!char) return;
    
    startRender(char, dict.type, dict.state1, dict.state2, dict.delay || 250, dict.cycles || 2);
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
        if (kind === 'ChatRoomChat' && ['Chat', 'Whisper', 'Emote'].includes(data?.Type)) {
            const type = getAnimTypeFromMsg(data.Content);
            if (type && getFeature(`animal${type}`)) {
                triggerAnimation(type);
                lastTriggers[type] = Date.now(); // reset auto interval
            }
        }
        return next(args);
    });

    setInterval(checkTriggers, 1000);
}
