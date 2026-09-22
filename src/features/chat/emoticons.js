import { createHook } from '../../core/hooks.js';
import { getFeature } from '../../core/feature-settings.js';

const hook = createHook('Emoticons', () => getFeature('textEmoticons'));

function SetSafeExpression(group, expression, timer = 3500) {
    if (typeof CharacterSetFacialExpression === 'function') {
        CharacterSetFacialExpression(Player, group, expression, timer);
    }
}

export function installEmoticons() {
    hook('ChatRoomSendChat', 10, (args, next) => {
        const msg = (document.getElementById("InputChat")?.value || "").trim();
        if (msg.startsWith("/") || msg.startsWith("*")) {
            return next(args);
        }
        
        try {
            let hasEmoticon = false;
            let blushType = "Low";

            if (msg.match(/(>|<)\/{2,5}(>|<)/)) {
                hasEmoticon = true;
                blushType = "High";
                SetSafeExpression("Mouth", "Pout");
            } else if (msg.match(/(^|[\s*~])(qwq)(?=$|[\s.,?!~*])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Happy");
            } else if (msg.match(/(^|[\s*~])([x:;][pP])(?=$|[\s.,?!~*])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Ahegao");
            } else if (msg.match(/\^~?\^|TwT/i) || msg.match(/(^|[\s*~])([x:;=]\))(?=$|[\s.,?!~*])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Smile");
            } else if (msg.match(/(^|[\s*~])(=v=|>v>|<v<)(?=$|[\s.,?!~*])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Smirk");
            } else if (msg.match(/@~?@|TxT/i) || msg.match(/>[.,~_3]>|<[.,~_3]</)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Sad");
            } else if (msg.match(/=\/{2,5}=|>\/{2,5}</) || msg.match(/=3=|>3<|>3>|<3</)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Pout");
            } else if (msg.match(/(^|[\s*~])(o\.o|o_o|oxo)(?=$|[\s.,?!~*])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "HalfOpen");
            }

            if (msg.match(/(>|<)\/{2,5}(>|<)/)) {
                SetSafeExpression("Eyebrows", "Lowered");
            } else if (msg.match(/(^|[\s*~])(>[:;xX=]|[:;xX=]<)(?=$|[\s.,?!~*])/)) {
                SetSafeExpression("Eyebrows", "Angry");
            } else if (msg.match(/(^|[\s*~])(><|T_T)(?=$|[\s.,?!~*])/)) {
                SetSafeExpression("Eyebrows", "Sad");
            } else if (msg.match(/>[.,~_3]>|<[.,~_3]</)) {
                SetSafeExpression("Eyebrows", "Harsh");
            } else if (msg.match(/(^|[\s*~])(o\.o|o_o|oxo)(?=$|[\s.,?!~*])/i)) {
                SetSafeExpression("Eyebrows", "Raised");
            }
            
            if (msg.match(/(^|[\s*~])(qwq)(?=$|[\s.,?!~*])/i)) {
                SetSafeExpression("Fluids", "TearsMedium");
            }

            if (msg.match(/(TwT|T_T|T-T|TvT|x_x|x-x);/i)) {
                SetSafeExpression("Emoticon", "Tear");
            }

            if (hasEmoticon) {
                if (msg.includes("?")) {
                    SetSafeExpression("Emoticon", "Confusion");
                } else if (msg.includes("!")) {
                    SetSafeExpression("Emoticon", "Exclamation");
                } else if (msg.includes("#")) {
                    SetSafeExpression("Emoticon", "Annoyed");
                }

                const slashCount = (msg.match(/\//g) || []).length;
                if (slashCount > 2 && slashCount < 5) blushType = "High";
                else if (slashCount >= 5) blushType = "VeryHigh";

                SetSafeExpression("Blush", blushType);
            }
            
            let afkMatch = msg.match(/(^|\s)\(?(afk|brb)\)?~?(\s|$)/i);
            if (afkMatch) {
                let type = afkMatch[2].toLowerCase();
                type = type.charAt(0).toUpperCase() + type.slice(1);
                SetSafeExpression("Emoticon", type, null);
            }
        } catch (e) {
            console.warn("🐈‍⬛ [LCE] Emoticons error:", e);
        }
        
        return next(args);
    });
}
