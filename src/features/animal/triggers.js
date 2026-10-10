// 耳朵／尾巴／翅膀的文字觸發詞（聊天室輸入 *關鍵字* 並送出）。
// 七種語言的詞全部啟用，與介面語言無關：房間裡的人可能用不同語言聊天，
// 所以任何一種語言的詞都能觸發。新增或修改詞請同步更新 docs/animal-trigger-words.md。
//
// 比對前兩邊（輸入與這張表）都會先正規化：轉小寫、去掉重音符號（é→e、ö→o、ё→е）、
// 連續空白合併成一個，因此使用者不必輸入重音符號。

export const ANIMAL_TRIGGER_WORDS = {
    Ears: {
        EN: ['wiggle', 'wiggles', 'twitch', 'twitches', 'wiggle ears', 'wiggles ears', 'twitch ears', 'twitches ears'],
        TW: ['搖耳朵', '晃耳朵', '抖耳朵', '動耳朵', '搖動耳朵', '擺動耳朵'],
        CN: ['摇耳朵', '晃耳朵', '抖耳朵', '动耳朵', '摇动耳朵', '摆动耳朵'],
        RU: ['шевелит ушами', 'шевелит ушками', 'дергает ушами', 'дергает ушками', 'шевелить ушами'],
        FR: ['remue les oreilles', 'bouge les oreilles', 'agite les oreilles', 'frétille des oreilles'],
        UA: ['ворушить вухами', 'ворушить вушками', 'сіпає вухами', 'сіпає вушками'],
        DE: ['wackelt mit den ohren', 'zuckt mit den ohren', 'bewegt die ohren'],
    },
    Tails: {
        EN: ['wag', 'wags', 'wag tail', 'wags tail'],
        TW: ['搖尾巴', '擺尾巴', '甩尾巴', '搖擺尾巴', '搖動尾巴'],
        CN: ['摇尾巴', '摆尾巴', '甩尾巴', '摇摆尾巴', '摇动尾巴'],
        RU: ['виляет хвостом', 'машет хвостом', 'помахивает хвостом', 'вилять хвостом'],
        FR: ['remue la queue', 'agite la queue', 'bouge la queue', 'frétille de la queue'],
        UA: ['виляє хвостом', 'махає хвостом', 'помахує хвостом'],
        DE: ['wedelt mit dem schwanz', 'wackelt mit dem schwanz', 'bewegt den schwanz', 'wedelt mit dem schweif'],
    },
    Wings: {
        EN: ['flap', 'flaps', 'flap wings', 'flaps wings'],
        TW: ['拍翅膀', '搧翅膀', '揮翅膀', '振翅', '拍動翅膀'],
        CN: ['拍翅膀', '扇翅膀', '挥翅膀', '振翅', '拍动翅膀'],
        RU: ['машет крыльями', 'хлопает крыльями', 'взмахивает крыльями', 'трепещет крыльями'],
        FR: ['bat des ailes', 'bat les ailes', 'agite les ailes', 'remue les ailes'],
        UA: ['махає крилами', 'змахує крилами', 'тріпоче крилами'],
        DE: ['flattert mit den flügeln', 'schlägt mit den flügeln', 'wackelt mit den flügeln', 'bewegt die flügel'],
    },
};

export const ANIMAL_TRIGGER_LANGS = ['EN', 'TW', 'CN', 'RU', 'FR', 'UA', 'DE'];

/** 轉小寫、去重音、合併空白（含全形空白）。輸入與詞表共用同一套。 */
export function normalizeTrigger(text) {
    return String(text)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[\s\u3000]+/g, ' ')
        .trim();
}

// 正規化後的詞 → 部位。同一個詞不能同時屬於兩個部位。
const TRIGGER_MAP = new Map();
for (const [type, langs] of Object.entries(ANIMAL_TRIGGER_WORDS)) {
    for (const words of Object.values(langs)) {
        for (const word of words) {
            const key = normalizeTrigger(word);
            const existing = TRIGGER_MAP.get(key);
            if (existing && existing !== type) throw new Error(`[LCE] animal trigger "${word}" is used by both ${existing} and ${type}`);
            TRIGGER_MAP.set(key, type);
        }
    }
}

const STAR = /^[*＊]$/;   // 中日韓輸入法常打出全形星號

/** 整句訊息必須是 *關鍵字*（半形或全形星號）；回傳 'Ears' | 'Tails' | 'Wings' | null。 */
export function getAnimTypeFromMsg(msg) {
    if (typeof msg !== 'string') return null;
    const text = msg.trim();
    if (text.length < 3 || !STAR.test(text[0]) || !STAR.test(text[text.length - 1])) return null;
    return TRIGGER_MAP.get(normalizeTrigger(text.slice(1, -1))) ?? null;
}
