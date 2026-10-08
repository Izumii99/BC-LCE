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
        Color: item.Color, // Can be array or string
        Property: item.Property && typeof item.Property === 'object' && item.Property.Type ? { Type: item.Property.Type } : undefined
    };
    
    draft[`animal${type}State${stateNum}`] = state;
    return true;
}

export function clearAnimalAnim(type, draft) {
    draft[`animal${type}State1`] = null;
    draft[`animal${type}State2`] = null;
    return true;
}
