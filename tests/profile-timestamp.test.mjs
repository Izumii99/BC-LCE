import test from 'node:test';
import assert from 'node:assert/strict';
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
