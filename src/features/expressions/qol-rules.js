import { faces, knownEchoNames, mappings, targetOnly } from './qol-data.js';

// Chat-QoL feature ideas: Izumii99/BC-Desktop, Scripts/chat-qol.js.
// Rules are kept separate from execution so LCE owns timing and cancellation.
export function emoticonExpression(text) {
    const result = {};
    // Whole tokens only: URLs, commands and substrings of ordinary words do
    // not accidentally trigger a face. Later tokens win for the same group.
    for (const token of String(text).split(/\s+/)) {
        if (/https?:\/\//i.test(token)) continue;
        const bare = token.replace(/(?:~+|\/{2,5})$/g, '').replace(/\/{2,5}/g, '');
        const match = faces.find(([pattern]) => pattern.test(token) || pattern.test(bare));
        if (match) {
            Object.assign(result, match[1]);
            const slashMatch = token.match(/(\/{2,5})/);
            if (slashMatch) {
                const count = slashMatch[1].length;
                const levels = { 2: 'Low', 3: 'Medium', 4: 'High', 5: 'VeryHigh' };
                result.Blush = levels[count] || 'VeryHigh';
            }
        }

        // Floating Marks from chat-qol
        if (/[?!#]$/.test(token)) {
            if (token.endsWith('?')) result.Emoticon = 'Confusion';
            else if (token.endsWith('!')) result.Emoticon = 'Exclamation';
            else if (token.endsWith('#')) result.Emoticon = 'Annoyed';
        }

        // Sweatdrop
        if (/;\s*$/.test(token) || /[=><\^~-];/.test(token) || /(TwT|T_T|T-T|TvT|x_x|x-x);/i.test(token)) {
            result.Emoticon = 'Tear';
        }
    }
    return result;
}

export function echoActivity(data) {
    if (data?.Type !== 'Activity' && data?.Type !== 'Emote' && data?.Type !== 'Action') return null;
    const dict = Array.isArray(data.Dictionary) ? data.Dictionary : [];
    const content = typeof data.Content === 'string' ? data.Content : '';
    const nameEntry = dict.find(d => typeof d.ActivityName === 'string');
    const labelEntry = dict.find(d => d.Tag === 'ActivityName' && typeof d.Text === 'string');
    let name = nameEntry?.ActivityName || labelEntry?.Text?.replace(/^Activity/, '')
        || content.replace(/^Chat(?:Other|Self)-[^-]+-/, '');
    // Custom Echo actions carry their wording in the translated label or in
    // Dictionary text entries; read all of it like chat-qol's WCE bridge did.
    const texts = dict.map(d => d.Text).filter(t => typeof t === 'string');
    if (typeof ActivityDictionaryText === 'function' && content) texts.push(ActivityDictionaryText(content));
    const known = knownEchoNames.has(name);
    name = [name, ...texts].filter(Boolean).join(' ');
    const custom = data.Type === 'Emote' || (data.Type === 'Action' && /\s/.test(content)) || known
        || /Luzi_/i.test(content) || dict.some(d => /Luzi_/i.test(d.Tag || ''))
        || /Luzi_/i.test(nameEntry?.ActivityName || labelEntry?.Text || '');
    return { name, group: /^Chat(?:Other|Self)-([^-]+)-/.exec(content)?.[1], custom };
}

export function echoExpressionEvent(data, memberNumber) {
    const activity = echoActivity(data);
    if (!activity) return null;
    const event = mappings.find(([, pattern]) => pattern.test(activity.name))?.[0];
    if (!event) return null;
    if (['LongKiss', 'KissOnLips'].includes(event) && activity.group !== 'ItemMouth') return null;
    const target = data.Dictionary?.some(d => d.TargetCharacter === memberNumber
        || (d.Tag === 'TargetCharacter' && d.MemberNumber === memberNumber));
    if (!target && (targetOnly.has(event) || data.Sender !== memberNumber)) return null;
    return event;
}

export function echoSound(data) {
    const activity = echoActivity(data);
    if (!activity || !activity.custom) return null;
    if (/Whip|鞭打/i.test(activity.name)) return 'WhipCrack';
    if (/拍打|打屁股|轻拍|轻弹|扇耳光|Spank|Slap|Flick|Bap/i.test(activity.name)) return 'SpankSkin';
    if (/Pinch|掐|拧/i.test(activity.name)) return 'LeatherStretchingShort';
    if (/(?<![a-z])hit(?:s|ting)?(?![a-z])|打/i.test(activity.name)) return 'SmackCrop';
    return null;
}
