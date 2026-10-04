import { createHook } from '../core/hooks.js';
import { getFeature } from '../core/feature-settings.js';
import { T } from '../core/i18n.js';
import { canUseExpressionEngine, cancelExpressionEvent, pushEvent, restoreQolPose, restoreQolFace } from './expressions/index.js';
import { emoticonExpression, echoSound } from './expressions/qol-rules.js';

const hook = createHook('chat-qol');
let installed = false;
let animation = null;
let emoticonState;
const poses = ['OverTheHead', 'BackElbowTouch'];
const outgoingFaces = new WeakMap();

function canAnimate() {
    const player = globalThis.Player;
    return getFeature('petsuitAnimation') && canUseExpressionEngine() && globalThis.CurrentScreen === 'ChatRoom'
        && player?.Appearance?.some(i => /petsuit|pet suit/i.test(i.Asset.Name))
        && typeof PoseCanChangeUnaided === 'function' && poses.every(p => PoseCanChangeUnaided(player, p));
}

export function stopPetsuitAnimation(restore = true) {
    if (!animation) return;
    const previous = animation;
    animation = null;
    cancelExpressionEvent('LcePetsuit');
    if (restore && globalThis.Player === previous.player) restoreQolPose(previous.pose, previous.eyes);
}

export function togglePetsuitAnimation() {
    if (animation) { stopPetsuitAnimation(); return; }
    if (!canAnimate()) return;
    const delay = Math.max(250, Math.min(1000, Number(getFeature('petsuitAnimationDelay')) || 350));
    const cycles = Math.max(1, Math.min(20, Number(getFeature('petsuitAnimationCycles')) || 4));
    const duration = delay * cycles * 2;
    animation = { player: Player, pose: [...(Player.ActivePose || [])], until: Date.now() + duration,
        eyes: Object.fromEntries(['Eyes', 'Eyes2'].map(group => [group,
            Player.Appearance.find(i => i.Asset.Group?.Name === group)?.Property?.Expression ?? null])),
    };
    const lower = animation.pose.filter(name => globalThis.PoseFemale3DCG?.find(p => p.Name === name)?.Category === 'BodyLower');
    pushEvent({ Type: 'LcePetsuit', Duration: duration, Priority: 100,
        Expression: { Eyes: [{ Expression: 'Daydream', Duration: duration }] },
        Poses: Array.from({ length: cycles * 2 }, (_, i) => ({ Pose: [poses[i % 2], ...lower], Duration: delay })),
    });
}

function updateAnimationState() {
    if (emoticonState && (!getFeature('chatEmoticons') || !canUseExpressionEngine() || Date.now() >= emoticonState.until)) {
        cancelExpressionEvent('LceEmoticon');
        if (emoticonState.player === globalThis.Player) restoreQolFace(emoticonState.original, emoticonState.expected);
        emoticonState = null;
    }
    if (animation && (Date.now() >= animation.until || !canAnimate())) stopPetsuitAnimation();
}

export function petsuitButtonRect(position = getFeature('petsuitAnimationPosition')) {
    // FCM uses X=955 and 45px buttons within BC's 1000px room half.
    const right = position === 'tr' || position === 'br';
    const top = position === 'tl' || position === 'tr';
    return [right ? 955 : 0, top ? 200 : 800, 45, 45];
}

function showPetsuitButton() {
    return globalThis.CurrentScreen === 'ChatRoom' && !globalThis.CurrentCharacter
        && !globalThis.CommonPhotoMode && !(globalThis.ChatRoomHideIconState >= 2)
        && (!!animation || canAnimate());
}

function drawPetsuitButton() {
    if (!showPetsuitButton()) return;
    const canvas = globalThis.MainCanvas;
    const ctx = canvas?.getContext?.('2d') ?? canvas;
    if (!ctx || typeof DrawButton !== 'function') return;
    const [x, y, w, h] = petsuitButtonRect();
    const alpha = ctx.globalAlpha;
    try {
        ctx.globalAlpha = 0.75;
        DrawButton(x, y, w, h, '', animation ? 'Pink' : 'Gray', '', T(animation ? 'qol_stopAnimation' : 'qol_startAnimation'));
        if (typeof DrawImageResize === 'function') DrawImageResize('Icons/Poses/OverTheHead.png', x + 4, y + 4, w - 8, h - 8);
    } finally { ctx.globalAlpha = alpha; }
}

export function installChatQol() {
    if (installed) return;
    installed = true;
    // Retain the typed text locally even when a gag transforms the packet.
    // Nothing extra is added to the network message or anti-garble protocol.
    hook('ChatRoomGenerateChatRoomChatMessage', 200, (args, next) => {
        const packet = next(args);
        if (getFeature('chatEmoticons') && packet && typeof packet === 'object') {
            outgoingFaces.set(packet, emoticonExpression(args[1]));
        }
        return packet;
    });
    // Run on the final outgoing packet: typing commands or cancelled sends
    // must not change the face. Emotes and whispers may contain textmoji too.
    hook('ServerSend', 5, (args, next) => {
        const [kind, data] = args;
        if (kind === 'ChatRoomChat' && ['Chat', 'Whisper', 'Emote'].includes(data?.Type)
            && getFeature('chatEmoticons') && canUseExpressionEngine()) {
            const original = data.Dictionary?.find(d => typeof d.Original === 'string')?.Original;
            const face = outgoingFaces.get(data) ?? emoticonExpression(original ?? data.Content);
            outgoingFaces.delete(data);
            if (Object.keys(face).length) {
                if ('Eyes' in face && !('Eyes2' in face)) face.Eyes2 = face.Eyes;
                if (!emoticonState || emoticonState.player !== Player || Date.now() >= emoticonState.until) {
                    emoticonState = { player: Player, original: {}, expected: {} };
                }
                for (const [group, value] of Object.entries(face)) {
                    if (!(group in emoticonState.original)) emoticonState.original[group] =
                        Player.Appearance.find(i => i.Asset.Group?.Name === group)?.Property?.Expression ?? null;
                    emoticonState.expected[group] = value;
                }
                emoticonState.until = Date.now() + 5000;
                cancelExpressionEvent('LceEmoticon');
                pushEvent({ Type: 'LceEmoticon', Duration: 5000, Priority: 100, SingleEye: 'Eyes2' in face,
                    Expression: Object.fromEntries(Object.entries(face).map(([group, expression]) =>
                        [group, [{ Expression: expression, Duration: 5000 }]])),
                });
            }
        }
        return next(args);
    });

    // A temporary last-resort AudioActions entry leaves native and other
    // plugins' sounds first. BC still applies its mute/volume/involvement rules.
    hook('AudioPlaySoundForChatMessage', 0, (args, next) => {
        const sound = getFeature('richerActivitySounds') && echoSound(args[0]);
        const actions = globalThis.AudioActions;
        if (!sound || !Array.isArray(actions)) return next(args);
        const fallback = { IsAction: data => data === args[0], GetSoundEffect: () => sound };
        actions.push(fallback);
        try { return next(args); }
        finally { const index = actions.indexOf(fallback); if (index >= 0) actions.splice(index, 1); }
    });

    // Manual pose changes cancel our sequence before the engine records them.
    for (const fn of ['CharacterSetActivePose', 'PoseSetActive']) hook(fn, 50, (args, next) => {
        if (args[0] === globalThis.Player) stopPetsuitAnimation(false);
        return next(args);
    });
    hook('ChatRoomLeave', 50, (args, next) => { stopPetsuitAnimation(); return next(args); });
    hook('DrawProcess', 10, (args, next) => { const result = next(args); drawPetsuitButton(); return result; });
    hook('ChatRoomClick', 20, (args, next) => {
        if (showPetsuitButton() && MouseIn(...petsuitButtonRect())) { togglePetsuitAnimation(); return; }
        return next(args);
    });
    setInterval(updateAnimationState, 250);
}
