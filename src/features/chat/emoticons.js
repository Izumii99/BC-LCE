import { createHook } from '../../core/hooks.js';
import { getFeature } from '../../core/feature-settings.js';

const hook = createHook('Emoticons', () => getFeature('textEmoticons'));

function SetSafeExpression(group, expression, timer = 4) {
    if (typeof CharacterSetFacialExpression === 'function') {
        CharacterSetFacialExpression(Player, group, expression, timer);
    }
}

export function installEmoticons() {
    hook('ChatRoomSendChat', 101, (args, next) => {
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
                SetSafeExpression("Eyes", "Closed");
            } else if (msg.match(/(^|[\s*~([])(qwq)(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Happy");
                SetSafeExpression("Eyes", "Sad");
            } else if (msg.match(/(^|[\s*~([])([xX:;][pP])(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Ahegao");
                SetSafeExpression("Eyes", "Closed");
            } else if (msg.match(/\^~?\^|TwT/i) || msg.match(/(^|[\s*~([])([xX:;=]\))(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Smile");
                if (msg.match(/TwT/i)) SetSafeExpression("Eyes", "Closed");
            } else if (msg.match(/(^|[\s*~([])(=v=|>v>|<v<|>w<)(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Smirk");
                if (msg.match(/>w</i)) SetSafeExpression("Eyes", "Closed");
            } else if (msg.match(/@~?@|TxT/i) || msg.match(/>[.,~_3]>|<[.,~_3]</)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Sad");
                if (msg.match(/@~?@/i)) SetSafeExpression("Eyes", "Dizzy");
                else if (msg.match(/TxT/i)) SetSafeExpression("Eyes", "Closed");
            } else if (msg.match(/=\/{2,5}=|>\/{2,5}</) || msg.match(/=3=|>3<|>3>|<3</)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Pout");
                SetSafeExpression("Eyes", "Closed");
            } else if (msg.match(/(^|[\s*~([])(o\.o|o_o|oxo)(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "HalfOpen");
                SetSafeExpression("Eyes", "None");
            } else if (msg.match(/(^|[\s*~([])(:3|;3|:>)(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Smile");
            } else if (msg.match(/(^|[\s*~([])(xD|XD)(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Happy");
                SetSafeExpression("Eyes", "Closed");
            } else if (msg.match(/(^|[\s*~([])(:\(|=~=)(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Sad");
            } else if (msg.match(/(^|[\s*~([])(TT|T_T|T-T)(?=$|[\s.,?!~*)\]])/i)) {
                hasEmoticon = true;
                SetSafeExpression("Mouth", "Sad");
                SetSafeExpression("Eyes", "Closed");
            }

            if (msg.match(/(>|<)\/{2,5}(>|<)/)) {
                SetSafeExpression("Eyebrows", "Lowered");
            } else if (msg.match(/(^|[\s*~([])(>[:;xX=]|[:;xX=]<|>:<|>;<|>x<)(?=$|[\s.,?!~*)\]])/i)) {
                SetSafeExpression("Eyebrows", "Angry");
            } else if (msg.match(/(^|[\s*~([])(><|>.<|>_<|T_T|TT|T-T|>w<)(?=$|[\s.,?!~*)\]])/i)) {
                SetSafeExpression("Eyebrows", "Sad");
                if (msg.match(/(><|>.<|>_<|>w<)/i)) SetSafeExpression("Eyes", "Closed");
            } else if (msg.match(/>[.,~_3]>|<[.,~_3]</)) {
                SetSafeExpression("Eyebrows", "Harsh");
            } else if (msg.match(/(^|[\s*~([])(o\.o|o_o|oxo)(?=$|[\s.,?!~*)\]])/i)) {
                SetSafeExpression("Eyebrows", "Raised");
            }
            
            if (msg.match(/(^|[\s*~([])(qwq)(?=$|[\s.,?!~*)\]])/i)) {
                SetSafeExpression("Fluids", "TearsMedium");
            }

            if (msg.match(/(TwT|T_T|T-T|TvT|x_x|x-x|TT);/i)) {
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
