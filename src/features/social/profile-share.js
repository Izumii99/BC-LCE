// ════════════════════════════════════════════════════════════════════════════
// 個資分享（WPS）的編碼、分塊與「安全的接收組裝」。不碰 DOM、不碰 BC 全域，純邏輯，方便單元測試。
//
// 線路格式與 Liko-WPS 外掛互通，**不可更動**：
//   Hidden 聊天訊息 Content = `[PROFILESHARE] <shareId> <i>/<n> <chunk>`（i 從 1 起算）
//   所有 chunk 依序串接 = base64( UTF-8( JSON.stringify(payload) ) )
//   payload = { sharedAt, from: { memberNumber, name }, profile: { memberNumber, name, lastNick, seen, characterBundle } }
// 每塊的大小只有「送出端」決定，接收端靠 i/n 重組，所以調整送出端的塊大小不影響互通。
//
// 接收端的訊息來自房間裡的任何人，一律視為不可信：
//   • 嚴格解析，i / n 必須是範圍內的整數（舊版曾因 `1000000000/1` 讓 filter 跑約 27 秒而卡死頁面）
//   • 組裝以「送出者 + shareId」為鍵，別人無法往你的分享裡插分塊
//   • 同時組裝數、每位送出者的組裝數、總字元數、存活時間都有上限，記憶體有界
//   • 組完的 payload 再逐欄驗證型別與範圍，才交給 UI
// ════════════════════════════════════════════════════════════════════════════

export const PROFILE_SHARE_PREFIX = '[PROFILESHARE]';

// 真正的限制是「單則訊息 2000 字元」（BC 的 ServerChatMessageMaxLength）與「分塊數」。
// 先前的 180,000 字元是 BC 單次傳輸資料的上限，分塊後每一則訊息各自計算，不適用於整份分享，
// 所以這裡不再有獨立的總字元上限；maxChars 只是由分塊數與單塊上限推出來的接收端記憶體防線。
const MAX_CHUNKS = 400;
const MAX_CHUNK_CHARS = 2000;
export const SHARE_LIMITS = Object.freeze({
    maxChunks: MAX_CHUNKS,                       // 單一分享的最多分塊數
    maxChunkChars: MAX_CHUNK_CHARS,              // 單塊內容上限（BC 的 ServerChatMessageMaxLength）
    maxChars: MAX_CHUNKS * MAX_CHUNK_CHARS,      // 推導值：單一分享在接收端最多佔用的字元數（800,000）
    ttlMs: 60_000,           // 組裝中的分享逾時
    maxAssemblies: 8,        // 同時組裝的分享總數
    maxPerSender: 2,         // 每位送出者同時組裝的分享數
});

const LEGACY_CHUNK = 800;    // 舊版固定塊大小；BC 常數讀不到時退回
const MAX_CHUNK = 1800;      // 即使 BC 允許更多也不超過
const MIN_CHUNK = 400;
const RESERVED = 200;        // 前綴、shareId、i/n（合計約 40 字元）與安全餘裕；塊越大，同一份分享要送的則數越少、等得越短

// 單塊：<prefix> <shareId> <i>/<n> <base64>。base64 沒有空白，所以用嚴格樣式一次解析。
const CHUNK_RE = /^\[PROFILESHARE\] ([A-Za-z0-9_-]{1,40}) (\d{1,4})\/(\d{1,4}) ([A-Za-z0-9+/=]*)$/;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

// ───────────────────────── 編碼 ─────────────────────────
/** UTF-8 → base64。與舊版 btoa(unescape(encodeURIComponent(s))) 的輸出逐位元相同，但不用已棄用的 escape/unescape。 */
export function toBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

/** base64 → UTF-8。輸入不是合法 base64 或 UTF-8 時丟例外。 */
export function fromBase64Utf8(b64) {
    if (!BASE64_RE.test(b64) || b64.length % 4 === 1) throw new Error('invalid base64');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** 依 BC 單則訊息上限決定每塊大小（讀不到就沿用舊值 800）。 */
export function chunkSizeFor(maxMessageChars) {
    if (!Number.isFinite(maxMessageChars) || maxMessageChars <= 0) return LEGACY_CHUNK;
    return Math.max(MIN_CHUNK, Math.min(MAX_CHUNK, Math.floor(maxMessageChars) - RESERVED));
}

/**
 * 把 payload 編成要送出的訊息內容陣列。
 * 分塊數超過上限時回傳 { tooLarge: true, chars, limit }（limit 為這個塊大小下可送的最大字元數），
 * 呼叫端應提示使用者而不是送出。
 */
export function buildShareMessages(payload, shareId, chunkSize = LEGACY_CHUNK) {
    const encoded = toBase64Utf8(JSON.stringify(payload));
    const total = Math.ceil(encoded.length / chunkSize);
    if (total > SHARE_LIMITS.maxChunks) return { tooLarge: true, chars: encoded.length, limit: SHARE_LIMITS.maxChunks * chunkSize };
    const contents = [];
    for (let i = 0; i < total; i++) {
        contents.push(`${PROFILE_SHARE_PREFIX} ${shareId} ${i + 1}/${total} ${encoded.slice(i * chunkSize, (i + 1) * chunkSize)}`);
    }
    return { contents, chars: encoded.length };
}

// ───────────────────────── payload 驗證 ─────────────────────────
const isInt = v => Number.isSafeInteger(v) && v > 0;
const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);

/**
 * 逐欄驗證組好的 payload，回傳可安全交給 UI 與資料庫的物件；任何必要欄位不合格就回傳 null。
 * seen 不得晚於現在：否則一份「未來時間」的個資會讓之後所有真正的更新都被 saveIfNewer 擋掉。
 */
export function normalizeSharedProfile(raw, now = Date.now()) {
    const p = raw?.profile;
    if (!p || typeof p !== 'object') return null;
    if (!isInt(p.memberNumber)) return null;
    const name = str(p.name, 100);
    if (name === undefined || !name) return null;
    if (typeof p.characterBundle !== 'string' || !p.characterBundle || p.characterBundle.length > SHARE_LIMITS.maxChars) return null;
    if (!Number.isFinite(p.seen) || p.seen < 0) return null;

    // 內容必須是物件，且成員編號與外層一致（我們自己存檔時 memberNumber 就是 bundle.MemberNumber）
    let bundle;
    try { bundle = JSON.parse(p.characterBundle); } catch { return null; }
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle) || bundle.MemberNumber !== p.memberNumber) return null;

    return {
        profile: {
            memberNumber: p.memberNumber,
            name,
            lastNick: str(p.lastNick, 100),
            seen: Math.min(p.seen, now),
            characterBundle: p.characterBundle,
        },
        fromName: str(raw?.from?.name, 40) ?? '',
    };
}

// ───────────────────────── 接收組裝器 ─────────────────────────
/**
 * @returns {{accept(sender: number, content: string): {status: 'ignored'|'rejected'|'pending'|'complete', payload?: object}, size(): number}}
 * ignored：不是分享訊息；rejected：是分享訊息但不合格（呼叫端一樣要吞掉，別讓它進聊天室）。
 */
export function createShareAssembler({ now = () => Date.now(), limits = SHARE_LIMITS } = {}) {
    const assemblies = new Map();   // `${sender}:${shareId}` -> { sender, total, chunks, received, chars, createdAt }

    const purge = t => { for (const [key, a] of assemblies) if (t - a.createdAt > limits.ttlMs) assemblies.delete(key); };
    const oldest = pred => {
        let pick = null;
        for (const [key, a] of assemblies) if (pred(a) && (!pick || a.createdAt < pick.a.createdAt)) pick = { key, a };
        return pick?.key;
    };

    return {
        size: () => assemblies.size,
        accept(sender, content) {
            if (typeof content !== 'string' || !content.startsWith(PROFILE_SHARE_PREFIX)) return { status: 'ignored' };
            if (!Number.isSafeInteger(sender) || sender <= 0) return { status: 'rejected' };
            if (content.length > limits.maxChunkChars + 80) return { status: 'rejected' };
            const m = CHUNK_RE.exec(content);
            if (!m) return { status: 'rejected' };
            const [, shareId, idxText, totalText, chunk] = m;
            const idx = Number(idxText), total = Number(totalText);
            if (total < 1 || total > limits.maxChunks || idx < 1 || idx > total) return { status: 'rejected' };
            if (chunk.length > limits.maxChunkChars) return { status: 'rejected' };

            const t = now();
            purge(t);
            const key = `${sender}:${shareId}`;
            let entry = assemblies.get(key);
            if (!entry) {
                // 容量：每位送出者的上限先擋（只淘汰他自己最舊的），再擋全體上限
                let mine = 0;
                for (const a of assemblies.values()) if (a.sender === sender) mine++;
                if (mine >= limits.maxPerSender) assemblies.delete(oldest(a => a.sender === sender));
                if (assemblies.size >= limits.maxAssemblies) assemblies.delete(oldest(() => true));
                entry = { sender, total, chunks: new Array(total), received: 0, chars: 0, createdAt: t };
                assemblies.set(key, entry);
            }
            if (entry.total !== total) { assemblies.delete(key); return { status: 'rejected' }; }   // 同一份分享的 n 不一致

            if (entry.chunks[idx - 1] === undefined) {
                entry.chunks[idx - 1] = chunk;   // 重複的分塊以第一次為準
                entry.received++;
                entry.chars += chunk.length;
                if (entry.chars > limits.maxChars) { assemblies.delete(key); return { status: 'rejected' }; }
            }
            if (entry.received < entry.total) return { status: 'pending' };

            assemblies.delete(key);
            try {
                const raw = JSON.parse(fromBase64Utf8(entry.chunks.join('')));
                const payload = normalizeSharedProfile(raw, t);
                return payload ? { status: 'complete', payload } : { status: 'rejected' };
            } catch { return { status: 'rejected' }; }
        },
    };
}
