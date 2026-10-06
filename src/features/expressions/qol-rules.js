import { faces, knownEchoNames, mappings, targetOnly } from './qol-data.js';

const DEFAULT_EMOTICON_DURATION = 5000;
const SLASH_DURATION_STEP = 1000;
const MAX_SLASH_EMOTICON_DURATION = 30000;

// Chat-QoL feature ideas: Izumii99/BC-Desktop, Scripts/chat-qol.js.
// Rules are kept separate from execution so LCE owns timing and cancellation.
export function emoticonExpression(text) {
    const result = {};
    // Whole tokens only: URLs, commands and substrings of ordinary words do
    // not accidentally trigger a face. Later tokens win for the same group.
    for (const token of String(text).split(/\s+/)) {
        if (/https?:\/\//i.test(token)) continue;
        const match = faces.find(([pattern]) => pattern.test(token));
        if (match) Object.assign(result, match[1]);
    }
    return result;
}

// Slash/backslash blushes historically used the number of slashes as their
// hold time. Keep that behavior, while accepting longer runs instead of
// silently losing the blush when someone types more than five slashes.
export function emoticonDuration(text, group = null) {
    if (group === 'Blush') {
        let duration = 0;
        for (const token of String(text).split(/\s+/)) {
            if (/https?:\/\//i.test(token)) continue;
            const match = faces.find(([pattern]) => pattern.test(token));
            if (!match || !('Blush' in match[1])) continue;
            const slashRun = token.match(/[\\/]+/);
            if (slashRun) duration = Math.max(duration, slashRun[0].length * SLASH_DURATION_STEP);
        }
        return Math.min(duration || DEFAULT_EMOTICON_DURATION, MAX_SLASH_EMOTICON_DURATION);
    }
    return DEFAULT_EMOTICON_DURATION;
}

export function echoActivity(data) {
    if (data?.Type !== 'Activity') return null;
    const dict = Array.isArray(data.Dictionary) ? data.Dictionary : [];
    const content = typeof data.Content === 'string' ? data.Content : '';
    const nameEntry = dict.find(d => typeof d.ActivityName === 'string');
    const labelEntry = dict.find(d => d.Tag === 'ActivityName' && typeof d.Text === 'string');
    const name = nameEntry?.ActivityName || labelEntry?.Text?.replace(/^Activity/, '')
        || content.replace(/^Chat(?:Other|Self)-[^-]+-/, '');
    const custom = knownEchoNames.has(name) || /Luzi_/i.test(content) || dict.some(d => /Luzi_/i.test(d.Tag || ''))
        || /Luzi_/i.test(nameEntry?.ActivityName || labelEntry?.Text || '');
    if (!custom) return null;
    return { name, group: /^Chat(?:Other|Self)-([^-]+)-/.exec(content)?.[1] };
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
    if (!activity) return null;
    if (/Whip|鞭打/i.test(activity.name)) return 'WhipCrack';
    if (/拍打|打屁股|轻拍|轻弹|扇耳光|Spank|Slap|Flick|Bap/i.test(activity.name)) return 'SpankSkin';
    if (/Pinch|掐|拧/i.test(activity.name)) return 'LeatherStretchingShort';
    if (/(?:^|_)Hit(?:$|_)/i.test(activity.name)) return 'SmackCrop';
    return null;
}
