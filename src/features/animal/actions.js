export const SLOTS = {
    Ears: 'HairAccessory2',
    Tails: 'TailStraps',
    Wings: 'Wings'
};
/** 部位清單的單一來源（設定頁分頁順序、定時觸發、預覽都用它）。 */
export const ANIMAL_TYPES = Object.freeze(Object.keys(SLOTS));
/** 次數設定壞掉時的退路：翅膀拍一輪較久，預設 3，其餘 9（與 schema 預設一致）。 */
export const fallbackCycles = type => (type === 'Wings' ? 3 : 9);

// ───────────────────────── 共用限制（發送端、隨機化後、接收端共用同一組） ─────────────────────────
export const MAX_CYCLES = 20;   // 一個循環 = A → B → A
export const MIN_DELAY = 100;
export const MAX_DELAY = 2000;

/** 夾限循環次數；非有限數字時用 fallback。 */
export function clampCycles(value, fallback = 1) {
    const n = Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(1, Math.min(MAX_CYCLES, n));
}

/** 夾限延遲；非有限數字時用 fallback。 */
export function clampDelay(value, fallback = 250) {
    const n = Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.max(MIN_DELAY, Math.min(MAX_DELAY, n));
}

// ───────────────────────── 狀態白名單與驗證 ─────────────────────────
// 動畫狀態只允許這些根層欄位（Name / Color 另外處理）。發送端存檔、本地播放與
// 接收端驗證都用同一份清單，避免「本地看起來正常、別人看到的不完整」。
// Rotate / Resize / Layer 為外觀擴充欄位；若發現其他欄位名稱，加進這裡即可。
export const ANIMAL_STATE_KEYS = Object.freeze([
    'Property', 'Craft', 'Difficulty', 'Extended',
    'Rotate', 'Resize', 'Layer'
]);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 6;
const MAX_NODES = 300;
const MAX_ARRAY = 100;
const MAX_STRING = 1000;
const MAX_KEY_JSON = 2000;     // 單一欄位序列化後的上限
const MAX_STATE_JSON = 6000;   // 整個狀態序列化後的上限
const INVALID = Symbol('invalid');

function isPlainObject(v) {
    if (!v || typeof v !== 'object') return false;
    // 不直接比 Object.prototype：跨 realm（iframe / VM）的純物件會誤判
    const proto = Object.getPrototypeOf(v);
    return proto === null || Object.getPrototypeOf(proto) === null;
}

/**
 * 重新建構一份只含純資料的複本。
 * 檢查的是「自身擁有」的危險鍵（Object.keys 會列出從 JSON 來的自有 __proto__），
 * 不用 `in`（原型鏈上本來就有 constructor / __proto__，會把一般物件全擋掉）。
 * 遇到函式、Symbol、非純物件、過深／過大的結構時回傳 INVALID。
 */
function cleanValue(v, depth, budget) {
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : INVALID;
    if (typeof v === 'string') return v.length <= MAX_STRING ? v : INVALID;
    if (depth >= MAX_DEPTH || ++budget.nodes > MAX_NODES) return INVALID;

    if (Array.isArray(v)) {
        if (v.length > MAX_ARRAY) return INVALID;
        const out = [];
        for (const item of v) {
            const c = item === undefined ? null : cleanValue(item, depth + 1, budget);
            if (c === INVALID) return INVALID;
            out.push(c);
        }
        return out;
    }
    if (isPlainObject(v)) {
        const out = {};
        for (const key of Object.keys(v)) {
            if (FORBIDDEN_KEYS.has(key)) return INVALID;
            if (v[key] === undefined) continue;
            const c = cleanValue(v[key], depth + 1, budget);
            if (c === INVALID) return INVALID;
            out[key] = c;
        }
        return out;
    }
    return INVALID;
}

function cleanTopLevel(key, value) {
    const cleaned = cleanValue(value, 0, { nodes: 0 });
    if (cleaned === INVALID) return INVALID;
    if ((key === 'Property' || key === 'Craft') && !isPlainObject(cleaned)) return INVALID;
    if (key === 'Difficulty' && typeof cleaned !== 'number') return INVALID;
    if (JSON.stringify(cleaned).length > MAX_KEY_JSON) return INVALID;
    return cleaned;
}

/**
 * 把任意來源（設定檔、遠端封包、目前穿著的物件）整理成安全的動畫狀態。
 * 無法使用時回傳 null；個別欄位不合法時只丟棄該欄位。
 */
export function sanitizeAnimalState(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.Name !== 'string') return null;
    if (!raw.Name || raw.Name.length > 100) return null;

    let color = raw.Color;
    if (Array.isArray(color)) {
        color = color.length <= 50 ? color.filter(c => typeof c === 'string' && c.length <= 64) : 'Default';
    } else if (typeof color === 'string') {
        if (color.length > 64) color = 'Default';
    } else if (color !== undefined) {
        color = 'Default';
    }

    const state = { Name: raw.Name, Color: color };
    for (const key of ANIMAL_STATE_KEYS) {
        if (!Object.hasOwn(raw, key) || raw[key] === undefined) continue;
        const cleaned = cleanTopLevel(key, raw[key]);
        if (cleaned !== INVALID) state[key] = cleaned;
    }
    return JSON.stringify(state).length <= MAX_STATE_JSON ? state : null;
}

/** structuredClone 遇到不可複製的第三方欄位會拋例外；這裡回傳 undefined 讓呼叫端略過該欄位。 */
export function safeClone(value) {
    try { return structuredClone(value); }
    catch { return undefined; }
}

export function saveAnimalPose(type, stateNum, draft) {
    const player = globalThis.Player;
    if (!player) return false;

    const slot = SLOTS[type];
    const item = player.Appearance.find(i => i.Asset.Group.Name === slot);
    if (!item) return false;

    const candidate = { Name: item.Asset.Name, Color: safeClone(item.Color) ?? 'Default' };
    for (const key of ANIMAL_STATE_KEYS) {
        if (!Object.hasOwn(item, key) || typeof item[key] === 'function') continue;
        const copy = safeClone(item[key]);
        if (copy !== undefined) candidate[key] = copy;
    }

    const state = sanitizeAnimalState(candidate);
    if (!state) return false;

    draft[`animal${type}State${stateNum}`] = state;
    return true;
}

export function clearAnimalAnim(type, draft) {
    draft[`animal${type}State1`] = null;
    draft[`animal${type}State2`] = null;
    return true;
}

// ───────────────────────── 套用姿勢（正式播放與設定頁預覽共用） ─────────────────────────
export const findSlotItem = (char, slot) => char.Appearance.find(item => item.Asset.Group.Name === slot);

/**
 * 物件的比較簽章：名稱、顏色加上所有白名單欄位。
 * 直接用 ANIMAL_STATE_KEYS 組出來，之後新增白名單欄位時簽章會自動跟上，不會漏比。
 */
export function animalItemSignature(item) {
    if (!item) return '';
    try { return JSON.stringify([item.Asset.Name, item.Color, ...ANIMAL_STATE_KEYS.map(key => item[key])]); }
    catch { return ''; }
}

/** 把「這次播放會動到的 Property 欄位」併入 keys（播放前的物件、A、B 的欄位都算）。 */
export function collectManagedKeys(keys, startItem, ...states) {
    for (const source of [startItem, ...states]) {
        for (const key of Object.keys(source?.Property || {})) keys.add(key);
    }
    return keys;
}

/** 第 frame 格要顯示的姿勢：先 B 後 A，播完（frame >= total）停在 A。正式播放與預覽共用。 */
export const poseAt = (frame, total, state1, state2) => (frame >= total || frame % 2 ? state1 : state2);

/**
 * 把部位直接改成指定狀態（A 或 B）。播放時不管目前穿的是什麼，一律照穿。
 * 只動白名單欄位與 Property 內的欄位。
 */
export function applyAnimalState(char, slot, state, managedPropertyKeys) {
    let item = findSlotItem(char, slot);
    if (!item || item.Asset.Name !== state.Name) {
        item = InventoryWear(char, state.Name, slot, state.Color, undefined, undefined, undefined, false);
        if (!item) return;
    } else {
        item.Color = Array.isArray(state.Color) ? [...state.Color] : state.Color;
    }

    for (const key of ANIMAL_STATE_KEYS) {
        if (key === 'Property' || key in state) continue;
        delete item[key];
    }

    if (item.Property) {
        for (const key of managedPropertyKeys) {
            if (FORBIDDEN_KEYS.has(key)) continue;
            if (!state.Property || !(key in state.Property)) delete item.Property[key];
        }
    }

    for (const key of ANIMAL_STATE_KEYS) {
        if (!(key in state)) continue;
        const copy = safeClone(state[key]);
        if (copy === undefined) continue;
        if (key === 'Property') {
            if (!item.Property) item.Property = {};
            for (const k of Object.keys(copy)) if (!FORBIDDEN_KEYS.has(k)) item.Property[k] = copy[k];
        } else {
            item[key] = copy;
        }
    }
}
