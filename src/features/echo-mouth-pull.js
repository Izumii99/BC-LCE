import { createHook } from '../core/hooks.js';
import { getFeature } from '../core/feature-settings.js';
import modApi from '../modsdk.js';
import '../core/i18n-engine.js';
import { getPlayer, getRoomCharacters } from '../game/bc-state.js';

const hook = createHook('echo-mouth-pull');
const NAME = '拉到身边';
const PAIRS = { CollarLeash: '拉紧的牵绳', ChainLeash: '拉紧的链子' };
const isPull = name => name === NAME || name === `Luzi_${NAME}`;
let installed = false;

// Echo owns the activity, remote execution and paired-item data. Only relax
// UseHands, never its leash, asset, room or custom function prerequisites.
function mouthAvailable(acting, acted) {
    if (!getFeature('echoMouthPull') || acting !== getPlayer() || !acted
        || acting === acted || acting.IsMouthBlocked()
        || (acting.CanInteract() && !acting.Effect?.includes('MergedFingers'))) return false;
    const pair = PAIRS[InventoryGet(acted, 'ItemNeckRestraints')?.Asset?.Name];
    if (!pair || !AssetGet(acting.AssetFamily, 'ItemMisc', pair)) return false;
    const misc = InventoryGet(acting, 'ItemMisc');
    // Mouth pulling requires an empty MISC slot. Echo fills it with the pair.
    if (misc) return false;
    if (acting.Appearance.some(item => item.Asset.Name === pair
        && item.Asset.Group.Name !== 'ItemMisc')) return false;
    return !InventoryGroupIsBlocked(acting, 'ItemMisc');
}

export function installEchoMouthPull() {
    if (installed) return;
    installed = true;
    const l10n = window.Liko.__Sys_L10N__;
    l10n.register('LCE', {
        echoMouthPull: {
            EN: '{0} takes the leash in their mouth and pulls {1} to their side.',
            TW: '{0} 用嘴咬住牽繩，將 {1} 拉到身邊。',
            CN: '{0} 用嘴咬住牵绳，将 {1} 拉到身边。',
            DE: '{0} nimmt die Leine in den Mund und zieht {1} an die eigene Seite.',
            FR: '{0} prend la laisse dans sa bouche et attire {1} à ses côtés.',
            RU: '{0} берёт поводок в рот и притягивает {1} к себе.',
            UA: '{0} бере повідець до рота й підтягує {1} до себе.',
        },
    });
    l10n.install(modApi);

    hook('ActivityCheckPrerequisites', 100, (args, next) => {
        const [activity, acting, acted] = args;
        if (!isPull(activity?.Name) || !activity.Prerequisite?.includes('Luzi_TargetLeashedOrCanBeLeashed')
            || !mouthAvailable(acting, acted)) return next(args);
        // A shallow copy keeps Echo's shared activity definition untouched.
        return next([{ ...activity, Prerequisite: activity.Prerequisite.filter(pre => pre !== 'UseHands') }, ...args.slice(1)]);
    });

    hook('ServerSend', 0, (args, next) => {
        const [kind, data] = args;
        const dict = data?.Dictionary;
        if (kind !== 'ChatRoomChat' || data?.Type !== 'Activity' || !Array.isArray(dict)
            || !dict.some(d => isPull(d.ActivityName) || (d.Tag === 'ActivityName'
                && (isPull(d.Text) || d.Text === `Activity${NAME}` || d.Text === `ActivityLuzi_${NAME}`)))) return next(args);
        const targetId = dict.find(d => d.Tag === 'TargetCharacter')?.MemberNumber
            ?? dict.find(d => Number.isInteger(d.TargetCharacter))?.TargetCharacter;
        const target = getRoomCharacters().find(c => c.MemberNumber === targetId);
        if (!mouthAvailable(getPlayer(), target)) return next(args);
        // Preserve the original Echo packet: recipients need Echo, not LCE.
        const result = next(args);
        l10n.send('LCE', 'echoMouthPull', CharacterNickname(Player), CharacterNickname(target));
        return result;
    });
}
