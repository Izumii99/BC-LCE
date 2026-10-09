export const SLOTS = {
    Ears: 'HairAccessory2',
    Tails: 'TailStraps',
    Wings: 'Wings'
};

export function saveAnimalPose(type, stateNum, draft) {
    const player = globalThis.Player;
    if (!player) return false;
    
    const slot = SLOTS[type];
    const item = player.Appearance.find(i => i.Asset.Group.Name === slot);
    
    if (!item) {
        return false;
    }
    
    const state = {
        Name: item.Asset.Name,
        Color: Array.isArray(item.Color) ? structuredClone(item.Color) : item.Color,
        Property: item.Property ? structuredClone(item.Property) : undefined,
        Craft: item.Craft ? structuredClone(item.Craft) : undefined,
        Difficulty: item.Difficulty
    };
    for (const key of Object.keys(item)) {
        if (['Asset', 'Model', 'ModelLoad', 'Name', 'Color', 'Property', 'Craft', 'Difficulty'].includes(key)) continue;
        if (typeof item[key] !== 'function') {
            state[key] = structuredClone(item[key]);
        }
    }
    
    draft[`animal${type}State${stateNum}`] = state;
    return true;
}

export function clearAnimalAnim(type, draft) {
    draft[`animal${type}State1`] = null;
    draft[`animal${type}State2`] = null;
    return true;
}
