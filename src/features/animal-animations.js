import { getFeature, setFeature } from '../core/feature-settings.js';

const SLOTS = {
    Ears: 'HairAccessory2',
    Tails: 'TailStraps',
    Wings: 'Wings'
};

export function saveAnimalPose(type, stateNum) {
    const player = globalThis.Player;
    if (!player) return false;
    
    const slot = SLOTS[type];
    const item = player.Appearance.find(i => i.Asset.Group.Name === slot);
    
    if (!item) {
        setFeature(`animal${type}State${stateNum}`, null);
        return true;
    }
    
    const state = {
        Name: item.Asset.Name,
        Color: item.Color,
        Property: item.Property ? structuredClone(item.Property) : undefined
    };
    
    setFeature(`animal${type}State${stateNum}`, state);
    return true;
}

export function clearAnimalAnim(type) {
    setFeature(`animal${type}State1`, null);
    setFeature(`animal${type}State2`, null);
    return true;
}

export function testAnimalAnim(type) {
    playAnimation(type);
    return true;
}

function playAnimation(type) {
    const player = globalThis.Player;
    if (!player || globalThis.CurrentScreen !== 'ChatRoom') return;
    
    const state1 = getFeature(`animal${type}State1`);
    const state2 = getFeature(`animal${type}State2`);
    if (!state1 || !state2) return;
    
    const slot = SLOTS[type];
    const currentItem = player.Appearance.find(i => i.Asset.Group.Name === slot);
    if (!currentItem || (currentItem.Asset.Name !== state1.Name && currentItem.Asset.Name !== state2.Name)) {
        return;
    }
    
    const cycles = getFeature(`animal${type}Cycles`) || 2;
    const delay = getFeature(`animal${type}Delay`) || 250;
    const states = [state2, state1];
    
    for (let i = 0; i < cycles * 2; i++) {
        setTimeout(() => {
            const state = states[i % 2];
            const item = globalThis.InventoryWear(player, state.Name, slot, state.Color, undefined, undefined, undefined, false);
            if (item && state.Property) {
                item.Property = structuredClone(state.Property);
            }
            globalThis.CharacterRefresh(player, false);
            if (typeof globalThis.ChatRoomCharacterItemUpdate === 'function') {
                globalThis.ChatRoomCharacterItemUpdate(player, slot);
            }
        }, i * delay);
    }
}

let lastTriggers = { Ears: Date.now(), Tails: Date.now(), Wings: Date.now() };

function checkTriggers() {
    if (globalThis.CurrentScreen !== 'ChatRoom') return;
    
    const now = Date.now();
    for (const type of ['Ears', 'Tails', 'Wings']) {
        if (!getFeature(`animal${type}`)) continue;
        
        const intervalMs = (getFeature(`animal${type}Interval`) || 30) * 1000;
        if (now - lastTriggers[type] > intervalMs) {
            // Randomize slightly so they don't all trigger at the exact same millisecond
            if (Math.random() < 0.2) { 
                lastTriggers[type] = now;
                playAnimation(type);
            }
        }
    }
}

let installed = false;
export function installAnimalAnimations() {
    if (installed) return;
    installed = true;
    
    setInterval(checkTriggers, 1000);
}
