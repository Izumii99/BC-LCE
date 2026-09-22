import { createHook } from '../../core/hooks.js';
import { getFeature } from '../../core/feature-settings.js';

const hook = createHook('PullToSide', () => getFeature('pullToSide'));

const TARGET = "PullToSide";

// We use a global flag to temporarily bypass checks when PullToSide is active
window._pullToSideActive = false;

export function installPullToSide() {
    hook('ActivityCheckPrerequisite', 0, (args, next) => {
        const prereq = args[0];
        const acting = args[1];
        if (window._pullToSideActive) {
            if (prereq === "UseHands") {
                return !acting.IsMouthBlocked() || next(args);
            }
        }
        return next(args);
    });

    hook('ActivityCheckPrerequisites', 0, (args, next) => {
        const activity = args[0];
        const acting = args[1];
        
        if (activity.Name === TARGET || activity.Name.includes("PullToSide")) {
            if (acting && acting.IsPlayer() && acting.CanInteract() && !acting.Effect.includes("MergedFingers")) {
                window._pullToSideActive = true;
                setTimeout(() => { window._pullToSideActive = false; }, 0);
                return true; 
            }
            
            if (acting && acting.IsPlayer() && !acting.CanInteract() && !acting.IsMouthBlocked()) {
                window._pullToSideActive = true;
                try {
                    if (!activity.Prerequisite) return true;
                    return activity.Prerequisite.every((pre) => {
                        if (typeof pre === "function") return true;
                        return typeof window.ActivityCheckPrerequisite === 'function' ? window.ActivityCheckPrerequisite(pre, acting, args[2], args[3]) : true;
                    });
                } finally {
                    window._pullToSideActive = false;
                }
            }
        }
        return next(args);
    });

    hook('ServerSend', 0, (args, next) => {
        const Message = args[0];
        const Data = args[1];
        
        if (Message === "ChatRoomChat" && Data && Data.Type === "Activity" && Data.Dictionary) {
            const isPullToSide = Data.Dictionary.some(d => 
                d.ActivityName === TARGET || 
                (d.Tag === "ActivityName" && typeof d.Text === "string" && (d.Text === "Activity" + TARGET || d.Text === TARGET || d.Text.includes(TARGET)))
            );

            if (isPullToSide && typeof Player !== "undefined" && !Player.CanInteract() && !Player.IsMouthBlocked()) {
                let targetName = "them";
                if (typeof CurrentCharacter !== "undefined" && CurrentCharacter) {
                    targetName = CurrentCharacter.Name;
                }
                
                // Append custom flavor text indicating they used their mouth
                Data.Dictionary.push({ Tag: "FocusAssetGroup", Text: " (using mouth)" });
            }
        }
        return next(args);
    });

    if (typeof window.ChatRoomCanBeLeashed === 'function') {
        hook('ChatRoomCanBeLeashed', 0, (args, next) => {
            if (window._pullToSideActive) return true;
            return next(args);
        });
    }
}
