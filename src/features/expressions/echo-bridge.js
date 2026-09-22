import { getFeature } from '../../core/feature-settings.js';
import { ActivityTriggers } from './data.js';

export function installEchoBridge() {
    if (!getFeature('echoBridge')) return;

    const mappings = [
        { Event: "Lick", Keywords: "舔|Lick|吸吮|Suck|含住|舔弄|舔舐|舔舔|用嘴脱掉" },
        { Event: "LongKiss", Keywords: "深吻|Deep Kiss|DeepKiss" },
        { Event: "KissOnLips", Keywords: "接吻|Kiss" },
        { Event: "LipBite", Keywords: "咬|Bite" },
        { Event: "DroolSides", Keywords: "流口水|Drool" },
        { Event: "OpenMouth", Keywords: "张开嘴|Open Mouth|OpenMouth" },
        { Event: "CloseMouth", Keywords: "闭上嘴|Close Mouth|CloseMouth|吞咽口水|Swallow" },
        { Event: "Spank", Keywords: "拍打|打屁股|Spank|Flick|Bap|Flicks|Baps" },
        { Event: "Cuddle", Keywords: "拥抱|贴贴|抱|Cuddle|Hug" },
        { Event: "Pinch", Keywords: "掐|拧|掐住|拧住|Pinch" },
        { Event: "Hit", Keywords: "Hit" },
        { Event: "ShockLight", Keywords: "吓|Shock|Startle" },
        { Event: "Smile", Keywords: "微笑|Smile" },
        { Event: "Giggle", Keywords: "轻笑|Giggle" },
        { Event: "Laugh", Keywords: "大笑|Laugh|笑" },
        { Event: "Blush", Keywords: "脸红|害羞|Blush|Shy" },
        { Event: "Sad", Keywords: "委屈|伤心|Sad|Cry" },
        { Event: "Angry", Keywords: "生气|愤怒|Angry|Mad" },
    ];

    const aggressiveEvents = ["Spank", "Hit", "Pinch", "ShockLight", "DroolSides", "LipBite"];

    for (const m of mappings) {
        const processedKeywords = m.Keywords.split('|').map(k => {
            if (/^[a-z\s]+$/i.test(k)) {
                return `(?<=^|[^a-z])(?:${k})(?:s|es|ed|ing)?(?=$|[^a-z])`;
            }
            return k;
        }).join('|');

        const tagRegex = new RegExp(`^Chat(Other|Self)-.*-.*(${processedKeywords}).*$`, "i");
        const textRegex = new RegExp(`(${processedKeywords})`, "i");
        
        const matchers = [
            {
                Tester: {
                    test(c) {
                        if (tagRegex.test(c)) return true;
                        if (c && c.includes("Luzi_") && typeof ActivityDictionaryText === "function") {
                            const t = ActivityDictionaryText(c);
                            return t && textRegex.test(t);
                        }
                        return false;
                    },
                },
                Criteria: { TargetIsPlayer: true },
            }
        ];

        if (!aggressiveEvents.includes(m.Event)) {
            matchers.unshift({
                Tester: {
                    test(c) {
                        if (tagRegex.test(c)) return true;
                        if (c && c.includes("Luzi_") && typeof ActivityDictionaryText === "function") {
                            const t = ActivityDictionaryText(c);
                            return t && textRegex.test(t);
                        }
                        return false;
                    },
                },
                Criteria: { SenderIsPlayer: true },
            });
        }

        ActivityTriggers.push({
            Event: m.Event,
            Type: "Activity",
            Matchers: matchers,
        });
    }
}
