/** Versionless, room-local identity advertisement. No commands or account settings. */
const members = new Set();
export function refreshLiteIdentity(characters, reset = false) {
    if (reset) members.clear();
    const present = new Set(characters.map(character => character.MemberNumber));
    for (const id of members) if (!present.has(id)) members.delete(id);
    for (const character of characters) {
        if (members.has(character.MemberNumber)) character.BCLite = true;
        else delete character.BCLite;
    }
}
export function forgetLiteIdentity(id) { members.delete(id); }
export function acceptLiteHello(data, characters) {
    if (data?.Type !== 'Hidden' || data.Content !== 'BCLiteHello' || !Number.isSafeInteger(data.Sender)) return false;
    if (!Array.isArray(data.Dictionary) || data.Dictionary.length !== 1 || data.Dictionary[0]?.client !== 'Lite') return false;
    const sender = characters.find(character => character.MemberNumber === data.Sender);
    if (!sender) return false;
    members.add(data.Sender);
    sender.BCLite = true;
    return true;
}
