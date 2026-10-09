import { createHook } from '../../core/hooks.js';
import { parseJSON } from '../../core/serialization.js';
// ════════════════════════════════════════════════════════════════════════════
// 衣櫃
//   extendedWardrobe    拓展衣櫃到 96 格（移植 WCE extendedWardrobe.ts）
//   privateWardrobe     用角色預覽取代衣櫃清單（移植 WCE privateWardrobe.js）
//   confirmWardrobeSave 覆蓋既有服裝前先確認
//
// 與 WCE 資料互通：額外的衣櫃格存在 Player.ExtensionSettings.FBCWardrobe
// （與 WCE 同一個鍵、同樣是 LZString UTF16），裝過 WCE 的帳號直接讀得到既有資料。
//
// 註：WCE 的 localWardrobe（+288 格，存 IndexedDB）不在規格內，未移植。
// ════════════════════════════════════════════════════════════════════════════

import { SETTING_CHANGED_EVENT, LOG } from '../../core/constants.js';
import { T } from '../../core/i18n.js';
import { openModalAsync } from '../../core/modal-service.js';
import { isWceFeatureEnabled, shouldLceHandle } from '../../core/wce-compat.js';

const DEFAULT_WARDROBE_SIZE = 24;
const EXPANDED_WARDROBE_SIZE = 96;
const WARDROBE_KEY = 'FBCWardrobe';      // 與 WCE 相同（勿改，否則資料不互通）

let extendedLoaded = false;

let nativeSaveConfirmationDepth = 0;



const hook = createHook('wardrobe');

const isWardrobe = (w) => Array.isArray(w) && w.every(o => o === null || Array.isArray(o));

/** 舊格式 Property.Type → TypeRecord（同 WCE，避免舊存檔載入後外觀跑掉）。 */
function sanitizeBundles(list) {
    if (!Array.isArray(list)) return list;
    return list.map(b => {
        if (typeof b?.Property?.Type === 'string' && !CommonIsObject(b.Property?.TypeRecord)) {
            const asset = AssetGet('Female3DCG', b.Group, b.Name);
            if (asset) b.Property.TypeRecord = ExtendedItemTypeToRecord(asset, b.Property.Type);
        }
        return b;
    });
}

// ───────────────────────── 拓展衣櫃 ─────────────────────────
/**
 * @param {boolean} init 是否為登入/啟動時自動套用（true），還是使用者在設定裡手動開啟（false）。
 *   只影響「找不到資料」時的提示文案（同 WCE）：登入時用較強的警告（可能是伺服器暫時讀不到，
 *   別急著建空衣櫃覆蓋雲端）；手動開啟時用較輕的提示（第一次啟用，想從別的裝置匯入就選取消）。
 */
export async function loadExtendedWardrobe(wardrobe, init = false) {
    if (!shouldLceHandle('extendedWardrobe')) return wardrobe;

    const wData = Player.ExtensionSettings?.[WARDROBE_KEY];
    WardrobeSize = EXPANDED_WARDROBE_SIZE;
    WardrobeFixLength();

    if (!wData) {
        // 沒有既有資料：可能是第一次啟用，也可能是伺服器暫時讀不到。
        // 直接建立空衣櫃會覆蓋掉雲端既有資料，所以先問過再說（同 WCE）。
        const [answ] = await openModalAsync({
            prompt: T(init ? 'wardrobe_new_prompt' : 'wardrobe_new_prompt_toggle'),
            buttons: { cancel: T('wardrobe_cancel'), submit: T('wardrobe_ok') },
        });
        if (answ === 'submit') extendedLoaded = true;
        return wardrobe;
    }

    try {
        const extra = parseJSON(LZString.decompressFromUTF16(wData));
        if (isWardrobe(extra)) {
            for (let i = DEFAULT_WARDROBE_SIZE; i < EXPANDED_WARDROBE_SIZE; i++) {
                const idx = i - DEFAULT_WARDROBE_SIZE;
                if (idx >= extra.length) break;
                wardrobe[i] = sanitizeBundles(extra[idx]);
            }
            extendedLoaded = true;
        }
    } catch (e) {
        console.error(LOG, '拓展衣櫃載入失敗（原始資料已保留，未覆寫）:', e, wData);
    }
    return wardrobe;
}


let installed = false;

export function installWardrobe() {
    if (installed) return;
    installed = true;

    // ── 拓展衣櫃：存檔時把 24 格之後的內容抽出來另存 ──
    hook('CharacterCompressWardrobe', 100, (args, next) => {
        let [wardrobe] = args;
        try {
            if (isWardrobe(wardrobe)) {
                const extra = wardrobe.slice(DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE);
                if (extra.length > 0 && extendedLoaded) {
                    Player.ExtensionSettings[WARDROBE_KEY] = LZString.compressToUTF16(JSON.stringify(extra));
                    wardrobe = wardrobe.slice(0, DEFAULT_WARDROBE_SIZE);   // 前 24 格才走 BC 原本的存檔
                    ServerPlayerExtensionSettingsSync(WARDROBE_KEY);
                }
            }
        } catch (e) { console.warn(LOG, '拓展衣櫃存檔失敗:', e); }
        return next([wardrobe]);
    });



    // The DOM save action already confirms. Keep protection for direct callers
    // without asking twice or letting our cancellation fall through to rename.
    if (typeof WardrobeSaveSelectedOutfit === 'function') {
        hook('WardrobeSaveSelectedOutfit', 20, (args, next) => {
            nativeSaveConfirmationDepth++;
            try { return next(args); }
            finally { nativeSaveConfirmationDepth--; }
        });
    }

    // ── 覆蓋確認 ──
    hook('WardrobeFastSave', 20, (args, next) => {
        const [C] = args;
        // 該格已有內容（以 Pronouns 判斷存過檔）才問，空格不會被打擾
        if (!nativeSaveConfirmationDepth && shouldLceHandle('confirmWardrobeSave') && Player.Wardrobe?.length > args[1]
            && Player.Wardrobe[args[1]]?.some(a => a.Group === 'Pronouns')) {
            if (!window.confirm(T('wardrobe_override_confirm'))) return null;
        }
        return next(args);
    });



    // 拓展衣櫃：啟動時套用一次，並在設定被切換時即時套用。
    // （不能只在 install 時判斷一次 —— 這個設定預設是關的，那樣使用者打開後永遠不會生效）
    (function wait(n = 240) {
        if (!Player?.Wardrobe) {
            if (n <= 0) return;
            setTimeout(() => wait(n - 1), 500);
            return;
        }
        applyExtendedWardrobe(true);   // 登入/啟動時自動套用 → init=true
    })();

    window.addEventListener(SETTING_CHANGED_EVENT, (e) => {
        if (e.detail?.key === 'extendedWardrobe') applyExtendedWardrobe(false);   // 使用者手動切換 → init=false
    });
}

/**
 * 依目前設定套用/還原拓展衣櫃格數。可重複呼叫。
 * @param {boolean} init 見 loadExtendedWardrobe：只影響「找不到資料」時的提示文案。
 */
function applyExtendedWardrobe(init = false) {
    try {
        if (!Player?.Wardrobe) return;
        if (shouldLceHandle('extendedWardrobe')) {
            // 只把額外格載入記憶體（顯示/使用），**不要**回頭呼叫 CharacterCompressWardrobe：
            // 那等於每次登入就把剛載入的衣櫃原封再存一次，會把 sanitizeBundles 補上的 TypeRecord
            // （比舊的 Property.Type 字串肥很多）永久寫回 FBCWardrobe，讓精簡的舊存檔一次膨脹好幾倍
            // （50K→200K 的元凶），還有「伺服器暫時讀不到時反手覆蓋雲端」的資料遺失風險。
            // 存檔交給使用者實際變更衣櫃時 BC 觸發的 CharacterCompressWardrobe 即可（同 WCE：載入只載入）。
            loadExtendedWardrobe(Player.Wardrobe, init)
                .catch(e => console.warn(LOG, '拓展衣櫃初始化失敗:', e));
        } else if (!isWceFeatureEnabled('extendedWardrobe')) {
            // 關閉 → 還原成 BC 預設的 24 格
            WardrobeSize = DEFAULT_WARDROBE_SIZE;
            WardrobeFixLength();
            CharacterAppearanceWardrobeOffset = 0;
            extendedLoaded = false;
        }
    } catch (e) { console.warn(LOG, '套用拓展衣櫃失敗:', e); }
}
