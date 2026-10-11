import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';
import { fakeClock } from './helpers/clock.mjs';

const load = async () => runtime().load('src/features/social/profile-share.js');

/** 一份合法的分享 payload；bytes 控制 characterBundle 的大小。 */
function payloadOf(memberNumber = 42, bytes = 0, extra = {}) {
    const bundle = JSON.stringify({ MemberNumber: memberNumber, Name: 'Test', Appearance: 'x'.repeat(bytes) });
    return { sharedAt: 1, from: { memberNumber: 7, name: 'Sender' },
        profile: { memberNumber, name: 'Test', lastNick: 'テスト 🐈', seen: 1000, characterBundle: bundle, ...extra } };
}
/** 以舊版公式（btoa(unescape(encodeURIComponent()))）切塊，代表尚未更新的 WPS / 舊 LCE 送出端。 */
function legacyMessages(payload, shareId, size = 800) {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const total = Math.ceil(encoded.length / size);
    return Array.from({ length: total }, (_, i) => `[PROFILESHARE] ${shareId} ${i + 1}/${total} ${encoded.slice(i * size, (i + 1) * size)}`);
}
const feed = (assembler, sender, messages) => messages.map(m => assembler.accept(sender, m));

test('encoding is byte-identical to the legacy WPS formula, including non-ASCII text', async () => {
    const { toBase64Utf8, fromBase64Utf8 } = await load();
    for (const text of ['', 'abc', '{"a":"測試 🐈‍⬛ ünï"}', 'x'.repeat(200_000)]) {
        assert.equal(toBase64Utf8(text), btoa(unescape(encodeURIComponent(text))));
        assert.equal(fromBase64Utf8(toBase64Utf8(text)), text);
    }
    assert.throws(() => fromBase64Utf8('not base64!'));
    assert.throws(() => fromBase64Utf8('AAAAA'), 'impossible base64 length');
});

test('chunk size follows the BC message limit and falls back to the legacy 800', async () => {
    const { chunkSizeFor } = await load();
    assert.equal(chunkSizeFor(2000), 1800);
    assert.equal(chunkSizeFor(1000), 800);
    assert.equal(chunkSizeFor(100), 400, 'never absurdly small');
    for (const bad of [undefined, null, NaN, 0, -5, 'x']) assert.equal(chunkSizeFor(bad), 800);
});

test('every message we send fits BC\'s per-message limit, and legacy and new senders both assemble', async () => {
    const { buildShareMessages, chunkSizeFor, createShareAssembler } = await load();
    const payload = payloadOf(42, 60_000);
    const built = buildShareMessages(payload, 'abc123', chunkSizeFor(2000));
    assert.ok(built.contents.length > 1);
    for (const c of built.contents) assert.ok(c.length <= 2000, `message length ${c.length}`);
    assert.ok(built.contents.length < legacyMessages(payload, 'abc123').length, 'fewer messages than the old 800-char chunks');
    for (const messages of [built.contents, legacyMessages(payload, 'old999')]) {
        const asm = createShareAssembler();
        const results = feed(asm, 7, messages);
        assert.ok(results.slice(0, -1).every(r => r.status === 'pending'));
        assert.equal(results.at(-1).status, 'complete');
        assert.equal(results.at(-1).payload.profile.memberNumber, 42);
        assert.equal(results.at(-1).payload.profile.lastNick, 'テスト 🐈');
        assert.equal(asm.size(), 0);
    }
});

test('chunks may arrive in any order and duplicates are ignored', async () => {
    const { createShareAssembler } = await load();
    const messages = legacyMessages(payloadOf(42, 5000), 'ord1');
    const asm = createShareAssembler();
    const shuffled = [...messages].reverse();
    const results = feed(asm, 7, [shuffled[0], shuffled[0], ...shuffled.slice(1)]);
    assert.equal(results.filter(r => r.status === 'complete').length, 1);
    assert.equal(results.at(-1).status, 'complete');
});

test('hostile indices are rejected instantly (the old code froze the page for ~27 s on "1000000000/1")', async () => {
    const { createShareAssembler } = await load();
    const asm = createShareAssembler();
    const bad = [
        '[PROFILESHARE] x 1000000000/1 a', '[PROFILESHARE] x 1/1000000000 a', '[PROFILESHARE] x 0/1 a', '[PROFILESHARE] x 2/1 a',
        '[PROFILESHARE] x 1/0 a', '[PROFILESHARE] x 1/401 a', '[PROFILESHARE] x -1/3 a', '[PROFILESHARE] x 1.5/3 a',
        '[PROFILESHARE] x NaN/NaN a', '[PROFILESHARE] x 1/3', '[PROFILESHARE]', '[PROFILESHARE] ', '[PROFILESHARE] x 1/3 not base64!',
        '[PROFILESHARE] ../../x 1/3 a', `[PROFILESHARE] ${'i'.repeat(41)} 1/3 a`, `[PROFILESHARE] x 1/3 ${'A'.repeat(2001)}`,
    ];
    const started = performance.now();
    for (const message of bad) assert.equal(asm.accept(7, message).status, 'rejected', message);
    assert.ok(performance.now() - started < 200, 'no slow path');
    assert.equal(asm.size(), 0, 'nothing is kept for rejected messages');
    assert.equal(asm.accept(7, 'hello').status, 'ignored', 'ordinary text is not ours');
    assert.equal(asm.accept(7, undefined).status, 'ignored');
});

test('senders must be real member numbers', async () => {
    const { createShareAssembler } = await load();
    const asm = createShareAssembler();
    for (const sender of [undefined, null, NaN, 0, -1, 1.5, '7', 2 ** 60]) assert.equal(asm.accept(sender, '[PROFILESHARE] x 1/3 AAAA').status, 'rejected');
});

test('assemblies are keyed by sender: nobody can inject chunks into someone else\'s share', async () => {
    const { createShareAssembler } = await load();
    const messages = legacyMessages(payloadOf(42, 5000), 'same');
    const asm = createShareAssembler();
    feed(asm, 7, messages.slice(0, -1));
    const forged = asm.accept(99, messages.at(-1));          // 另一個人補上最後一塊
    assert.equal(forged.status, 'pending', 'attacker only starts its own, incomplete share');
    assert.equal(asm.accept(7, messages.at(-1)).status, 'complete', 'the real sender still completes');
});

test('memory is bounded: per-sender, global and time limits', async () => {
    const { createShareAssembler, SHARE_LIMITS } = await load();
    let now = 0;
    const asm = createShareAssembler({ now: () => now });
    for (let i = 0; i < 1000; i++) asm.accept(7, `[PROFILESHARE] id${i} 1/2 AAAA`);
    assert.equal(asm.size(), SHARE_LIMITS.maxPerSender, 'one sender cannot hold more than its quota');
    for (let sender = 1; sender <= 200; sender++) for (let i = 0; i < 5; i++) asm.accept(sender, `[PROFILESHARE] id${i} 1/2 AAAA`);
    assert.ok(asm.size() <= SHARE_LIMITS.maxAssemblies, `global cap, got ${asm.size()}`);
    now += SHARE_LIMITS.ttlMs + 1;
    asm.accept(500, '[PROFILESHARE] fresh 1/2 AAAA');
    assert.equal(asm.size(), 1, 'stale assemblies expire');
});

test('there is no 180K total ceiling: BC limits each message, not the whole share', async () => {
    const { createShareAssembler, buildShareMessages, chunkSizeFor } = await load();
    // 以前把 180,000 當整份上限；那是單次傳輸的限制，分塊後每則各自計算。400 KB 的 bundle 應該能完整傳送。
    const payload = payloadOf(42, 400_000);
    const built = buildShareMessages(payload, 'huge', chunkSizeFor(2000));
    assert.equal(built.tooLarge, undefined);
    assert.ok(built.chars > 180_000, `scenario must exceed the old ceiling, got ${built.chars}`);
    for (const c of built.contents) assert.ok(c.length <= 2000);
    const asm = createShareAssembler();
    const results = feed(asm, 7, built.contents);
    assert.equal(results.at(-1).status, 'complete');
    assert.equal(results.at(-1).payload.profile.characterBundle, payload.profile.characterBundle);
});

test('receiver memory stays bounded by chunk count and chunk size; inconsistent totals drop the assembly', async () => {
    const { createShareAssembler, SHARE_LIMITS } = await load();
    assert.equal(SHARE_LIMITS.maxChars, SHARE_LIMITS.maxChunks * SHARE_LIMITS.maxChunkChars, 'derived, not an independent magic number');
    const asm = createShareAssembler();
    const big = 'A'.repeat(2000);
    // 400 塊 × 2000 字元（理論最大）一路維持 pending，沒有被中途拒絕
    for (let i = 1; i < SHARE_LIMITS.maxChunks; i++) assert.equal(asm.accept(7, `[PROFILESHARE] big ${i}/400 ${big}`).status, 'pending');
    // 同時組裝的份數與每位送出者的份數另有上限，所以總量有界：maxAssemblies × maxChars
    for (let sender = 1; sender <= 200; sender++) for (let i = 0; i < 5; i++) asm.accept(sender, `[PROFILESHARE] id${i} 1/2 AAAA`);
    assert.ok(asm.size() <= SHARE_LIMITS.maxAssemblies);
    const fresh = createShareAssembler();
    fresh.accept(7, '[PROFILESHARE] inc 1/3 AAAA');
    assert.equal(fresh.accept(7, '[PROFILESHARE] inc 2/4 AAAA').status, 'rejected');
    assert.equal(fresh.size(), 0, 'the inconsistent assembly is dropped');
});

test('a share needing more than 400 chunks is refused by the sender, with the limit for that chunk size', async () => {
    const { buildShareMessages, SHARE_LIMITS } = await load();
    const built = buildShareMessages(payloadOf(42, 700_000), 'big', 1800);   // base64 ≈ 933K > 400 × 1800
    assert.equal(built.tooLarge, true);
    assert.equal(built.limit, SHARE_LIMITS.maxChunks * 1800);
    assert.ok(built.chars > built.limit);
    assert.equal(buildShareMessages(payloadOf(42, 200_000), 'ok', 1800).tooLarge, undefined);
});

test('payload validation: wrong types, ids and mismatched or non-object bundles never reach the UI', async () => {
    const { normalizeSharedProfile } = await load();
    const ok = payloadOf(42);
    assert.ok(normalizeSharedProfile(ok, 5000));
    const bad = [
        null, {}, { profile: null }, { profile: 'x' },
        payloadOf(42, 0, { memberNumber: '42' }), payloadOf(42, 0, { memberNumber: 1.5 }), payloadOf(42, 0, { memberNumber: -1 }),
        payloadOf(42, 0, { name: 5 }), payloadOf(42, 0, { name: '' }), payloadOf(42, 0, { name: 'n'.repeat(101) }),
        payloadOf(42, 0, { seen: 'now' }), payloadOf(42, 0, { seen: NaN }), payloadOf(42, 0, { seen: -1 }),
        payloadOf(42, 0, { characterBundle: '' }), payloadOf(42, 0, { characterBundle: '{not json' }),
        payloadOf(42, 0, { characterBundle: '[]' }), payloadOf(42, 0, { characterBundle: '"str"' }),
        payloadOf(42, 0, { characterBundle: JSON.stringify({ MemberNumber: 43 }) }),
    ];
    for (const p of bad) assert.equal(normalizeSharedProfile(p, 5000), null, JSON.stringify(p)?.slice(0, 80));
    assert.equal(normalizeSharedProfile(payloadOf(42, 0, { lastNick: 5 }), 5000).profile.lastNick, undefined, 'optional field is dropped, not fatal');
});

test('a "seen" time in the future is clamped so it cannot block later real updates', async () => {
    const { normalizeSharedProfile } = await load();
    assert.equal(normalizeSharedProfile(payloadOf(42, 0, { seen: 9e15 }), 123456).profile.seen, 123456);
    assert.equal(normalizeSharedProfile(payloadOf(42, 0, { seen: 100 }), 123456).profile.seen, 100);
});

// ───────────────────────── 接上 past-profiles：配速、單一進行中、來源 ─────────────────────────
async function shareRuntime({ bundleBytes = 60_000, extra = {}, mocks = {} } = {}) {
    const clock = fakeClock();
    const sent = [], notices = [];
    const room = { in: true };
    const stored = { memberNumber: 42, name: 'Test', lastNick: 'Nick', seen: 1000,
        characterBundle: JSON.stringify({ MemberNumber: 42, Appearance: 'x'.repeat(bundleBytes) }) };
    const rt = runtime({
        globals: {
            ...clock.globals, CurrentScreen: 'ChatRoom', Player: { MemberNumber: 1 }, ServerChatMessageMaxLength: 2000,
            ServerSend: (kind, data) => sent.push({ kind, data, t: clock.globals.performance.now() }),
            ServerPlayerIsInChatRoom: () => room.in,
            ChatRoomCharacter: [{ MemberNumber: 7, Nickname: 'RealName' }],
            CharacterNickname: c => c.Nickname,
            testDb: { get: async () => stored },
            ...extra,
        },
        mocks: {
            'src/core/i18n.js': { T: k => ({ profiles_shared_from: '{from} shared a profile', profiles_shared_open: 'Open', profiles_seen: 'Seen' })[k] ?? k },
            idb: { openDB: async () => ({}) },
            'src/ui/chat/notification.js': { lceChatNotify: n => notices.push(typeof n === 'string' ? n : n.textContent) },
            ...mocks,
        },
        append: { 'src/features/social/past-profiles.js': 'db = testDb; export {shareProfile, handleShareMessage};' },
    });
    const mod = await rt.load('src/features/social/past-profiles.js');
    const tick = () => new Promise(resolve => setImmediate(resolve));
    return { ...mod, clock, sent, notices, room, rt, tick, stored };
}

test('sharing is paced through the shared send budget instead of flooding the queue', async () => {
    const { shareProfile, clock, sent, tick } = await shareRuntime();
    const done = shareProfile(42);
    await tick();
    for (let i = 0; i < 2000 && sent.length === 0 || (i < 2000 && sent.length < 30); i++) { clock.advance(50); await tick(); }
    clock.advance(30000); await tick();
    assert.equal(await done, true);
    assert.ok(sent.length >= 30, `expected a multi-chunk share, got ${sent.length}`);
    for (const s of sent) { assert.equal(s.kind, 'ChatRoomChat'); assert.equal(s.data.Type, 'Hidden'); assert.ok(s.data.Content.length <= 2000); }
    for (let i = 1; i < sent.length; i++) assert.ok(sent[i].t - sent[i - 1].t >= 100, `gap ${i}`);
    for (const s of sent) assert.ok(sent.filter(v => v.t >= s.t && v.t < s.t + 1200).length <= 12, 'within the window budget (limit 14 - reserveHigh 2)');
});

test('what we send can be received and opened on the other side, naming the real sender', async () => {
    const { shareProfile, handleShareMessage, clock, sent, notices, tick } = await shareRuntime({ bundleBytes: 8000 });
    const done = shareProfile(42);
    await tick();
    for (let i = 0; i < 400; i++) { clock.advance(50); await tick(); }
    assert.equal(await done, true);
    notices.length = 0;
    for (const s of sent) assert.equal(handleShareMessage({ Type: 'Hidden', Sender: 7, Content: s.data.Content }), true);
    assert.equal(notices.length, 1);
    assert.match(notices[0], /RealName/, 'name comes from the server-attached sender, not the payload');
    assert.match(notices[0], /\(42\)/);
});

test('a second share while one is in flight is refused, not queued', async () => {
    const { shareProfile, clock, sent, notices, tick } = await shareRuntime();
    const first = shareProfile(42);
    await tick();
    assert.equal(await shareProfile(42), false);
    assert.ok(notices.some(n => /profiles_share_busy/.test(n)));
    clock.advance(60000); await tick();
    assert.equal(await first, true);
    const count = sent.length;
    const again = shareProfile(42);
    await tick(); clock.advance(60000); await tick();
    assert.equal(await again, true, 'allowed again once the first finished');
    assert.equal(sent.length, count * 2);
});

test('an oversized profile is reported and nothing is sent', async () => {
    const { shareProfile, sent, notices } = await shareRuntime({ bundleBytes: 800_000 });
    assert.equal(await shareProfile(42), false);
    assert.equal(sent.length, 0);
    assert.ok(notices.some(n => /profiles_share_too_large/.test(n)));
});

test('leaving the room mid-share stops sending and frees the slot', async () => {
    const { shareProfile, clock, sent, room, tick } = await shareRuntime();
    const done = shareProfile(42);
    await tick();
    for (let i = 0; i < 20; i++) { clock.advance(60); await tick(); }
    const before = sent.length;
    assert.ok(before > 0);
    room.in = false;
    clock.advance(5000); await tick();
    assert.equal(await done, false);
    assert.equal(sent.length, before, 'no more chunks after leaving');
    room.in = true;
    const next = shareProfile(42);
    await tick(); clock.advance(60000); await tick();
    assert.equal(await next, true, 'the slot was released');
});

test('hostile share messages are swallowed instantly and show nothing', async () => {
    const { handleShareMessage, notices } = await shareRuntime();
    const started = performance.now();
    for (const Content of ['[PROFILESHARE] x 1000000000/1 a', '[PROFILESHARE]', '[PROFILESHARE] x 1/1 !!!', `[PROFILESHARE] y 1/1 ${'A'.repeat(100)}`]) {
        assert.equal(handleShareMessage({ Type: 'Hidden', Sender: 7, Content }), true, 'still swallowed so it never reaches the chat log');
    }
    assert.equal(handleShareMessage({ Type: 'Hidden', Sender: 7, Content: 'BCEMsg' }), false, 'other hidden messages are left alone');
    assert.ok(performance.now() - started < 200);
    assert.deepEqual(notices, []);
});

// ───────────────────────── 優先級：分享高於動畫，也不被表情的持續補送卡住 ─────────────────────────
async function budgetFixture(bc) {
    const clock = fakeClock();
    const rt = runtime({ globals: clock.globals });
    const { createSendBudget } = await rt.load('src/core/send-budget.js');
    const state = bc ? { times: [], queueLength: 0, ...bc } : null;
    const budget = createSendBudget({ now: () => clock.globals.performance.now(), readBc: () => state });
    return { clock, budget, bc: state };
}
const HIGH = { priority: 'high' };

test('priority: high ignores "someone else just called ServerSend", low still yields', async () => {
    const { clock, budget } = await budgetFixture();
    budget.noteServerSend();
    assert.equal(budget.requestSlot(), false, 'animation yields to a fresh external send');
    assert.equal(budget.requestSlot(HIGH), true, 'a share does not');
    budget.markSubmitted();
    assert.equal(budget.requestSlot(HIGH), false, 'but its own minGap still applies');
    clock.advance(100);
    assert.equal(budget.requestSlot(HIGH), true);
});

test('priority: high keeps a smaller reserve than low, and still honors the BC queue', async () => {
    const { clock, budget, bc } = await budgetFixture({});
    clock.advance(1000);
    bc.times = Array.from({ length: 10 }, (_, i) => 900 + i);   // 視窗內已 10 則
    assert.equal(budget.requestSlot(), false, 'low: 14 - 4 = 10 already used');
    assert.equal(budget.requestSlot(HIGH), true, 'high: 14 - 2 = 12, two more fit');
    bc.times = Array.from({ length: 12 }, (_, i) => 900 + i);
    assert.equal(budget.requestSlot(HIGH), false, 'never uses the last 2 slots, they stay for chat');
    bc.times = []; bc.queueLength = 3;
    assert.equal(budget.requestSlot(HIGH), false, 'FIFO queue not empty: wait so chat is at most one chunk behind');
    assert.equal(budget.nextAllowedAt(HIGH), 1050);
});

test('priority: with continuous expression traffic a share finishes far sooner than at animation priority', async () => {
    // 表情引擎：每 250ms 呼叫一次 ServerSend（約 4 發/秒，保守估計），BC 實際發送紀錄同步更新。
    async function secondsToSend(chunks, opts) {
        const { clock, budget, bc } = await budgetFixture({});
        let sent = 0, nextExpr = 0;
        for (let t = 0; t < 600_000 && sent < chunks; t += 10) {
            clock.advance(10);
            const now = clock.globals.performance.now();
            if (now >= nextExpr) { budget.noteServerSend(); bc.times.push(now); nextExpr += 250; }
            bc.times = bc.times.filter(x => now - x < 1200);
            if (budget.requestSlot(opts)) { budget.withOwnSend(() => bc.times.push(now)); budget.markSubmitted(); sent++; }
        }
        assert.equal(sent, chunks);
        return clock.globals.performance.now() / 1000;
    }
    const low = await secondsToSend(120, undefined), high = await secondsToSend(120, HIGH);
    // 實測（假時鐘）：low ≈ 26.9 s，high ≈ 19.4 s。差距有限，因為瓶頸是 BC 同一個 14 則/1.2 秒的視窗，
    // 表情佔掉其中約 4.8 則；優先級只能多拿到 reserve 的差額，再快就得減少表情補送或減少分塊數。
    assert.ok(high < low * 0.8, `high ${high}s should beat low ${low}s`);
    assert.ok(high <= 22, `120 chunks (~216 KB) under steady expression traffic, got ${high}s`);
});

test('the sender asks the budget for high priority on every slot check and wait estimate', async () => {
    const seen = [];
    const spy = {
        config: { minGap: 100 },
        requestSlot: opts => { seen.push(['slot', opts?.priority]); return seen.length % 3 !== 0; },   // 每三次拒絕一次，才會走到等待估算
        nextAllowedAt: opts => { seen.push(['next', opts?.priority]); return 0; },
        markSubmitted() {}, withOwnSend: fn => fn(),
    };
    const { shareProfile, clock, sent, tick } = await shareRuntime({ mocks: { 'src/core/send-budget.js': { sendBudget: spy } } });
    const done = shareProfile(42);
    for (let i = 0; i < 400; i++) { await tick(); clock.advance(100); }
    assert.equal(await done, true);
    assert.ok(sent.length > 1 && seen.length >= sent.length);
    assert.ok(seen.every(([, priority]) => priority === 'high'), JSON.stringify(seen.filter(([, p]) => p !== 'high').slice(0, 3)));
});
