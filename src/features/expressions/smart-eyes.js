import { createHook } from '../../core/hooks.js';
import { getFeature } from '../../core/feature-settings.js';

const hook = createHook('SmartClosedEyes', () => getFeature('smartClosedEyes'));

const sceWrapper = (args, next) => {
    let shouldBypass = false;
    
    if (typeof Player !== 'undefined' && typeof Player.GetBlindLevel === 'function') {
        const hasBlindItem = Player.Effect && (
            Player.Effect.includes("BlindHeavy") || 
            Player.Effect.includes("BlindNormal") || 
            Player.Effect.includes("BlindLight")
        );
        
        if (!hasBlindItem && Player.GetBlindLevel() > 0) {
            shouldBypass = true;
        }
    }
    
    let origGetBlindLevel = null;
    if (shouldBypass) {
        origGetBlindLevel = Player.GetBlindLevel;
        Player.GetBlindLevel = function () { return 0; };
    }
    
    try {
        return next(args);
    } finally {
        if (shouldBypass && origGetBlindLevel) {
            Player.GetBlindLevel = origGetBlindLevel;
        }
    }
};

export function installSmartEyes() {
    hook('ChatRoomUpdateDisplay', 0, sceWrapper);
    hook('ChatRoomClick', 0, sceWrapper);
    
    if (typeof window.ChatRoomSync === 'function') {
        hook('ChatRoomSync', 0, sceWrapper);
    }
}
