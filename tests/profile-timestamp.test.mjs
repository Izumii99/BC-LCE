import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';

test('profile timestamps are left aligned and restore canvas alignment even after an error', async () => {
    const canvas = {textAlign: 'center'};
    let fail = false;
    const rt = runtime({globals: {MainCanvas: canvas, DrawText() {
        assert.equal(canvas.textAlign, 'left');
        if (fail) throw Error('draw failed');
    }}, mocks: {idb: {openDB: async () => ({})},
        'src/ui/chat/notification.js': {lceChatNotify() {}}},
    append: {'src/features/social/past-profiles.js': 'export {drawTimestamp};'}});
    const {drawTimestamp} = await rt.load('src/features/social/past-profiles.js');
    drawTimestamp('Saved', 100, 105, 'Black', 'Gray');
    assert.equal(canvas.textAlign, 'center');
    canvas.textAlign = 'right'; fail = true;
    assert.throws(() => drawTimestamp('Saved', 100, 105, 'Black', 'Gray'));
    assert.equal(canvas.textAlign, 'right');
});

// 這個時間是「本機紀錄這筆個資的時間」（最後見面），不是對方的最後登入／上線時間（我們無從得知）。
const LANGS = ['CN', 'DE', 'EN', 'FR', 'RU', 'TW', 'UA'];
const tr = lang => JSON.parse(readFileSync(new URL(`../Translation/${lang}.json`, import.meta.url), 'utf8'));

test('profile time labels exist in all 7 languages and mean "met", never online/login', () => {
    const wrong = /在線|在线|上線|上线|登入|登录|online|login|log in|en ligne|angemeldet|в сети|онлайн|вход|в мережі/i;
    const labels = new Set();
    for (const lang of LANGS) {
        const t = tr(lang);
        for (const key of ['profiles_last_seen', 'profiles_seen']) {
            assert.equal(typeof t[key], 'string', `${lang} ${key} missing`);
            assert.ok(t[key].trim(), `${lang} ${key} empty`);
            assert.ok(!wrong.test(t[key]), `${lang} ${key} implies online/login: ${t[key]}`);
        }
        labels.add(t.profiles_last_seen);
    }
    assert.equal(labels.size, LANGS.length, 'each language has its own translated text');
    assert.equal(tr('TW').profiles_last_seen, '最後見面：');
    assert.equal(tr('CN').profiles_last_seen, '最后见面：');
    assert.equal(tr('EN').profiles_last_seen, 'Last met:');
});
