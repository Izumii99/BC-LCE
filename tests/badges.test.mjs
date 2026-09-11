import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';

test('badges use install/note colors, ignore BIO and suppress duplicate WCE drawing', async () => {
    const draws = [];
    const rt = runtime({globals: {ChatRoomHideIconState: 0, FBC_VERSION: '6.0',
        DrawTextFit: (...args) => draws.push(args)}});
    (await rt.load('src/features/social/badges.js')).installBadges();
    const draw = rt.hooks.get('ChatRoomDrawCharacterStatusIcons');
    for (const mods of [{LCE: '1.0'}, {FBC: '6.0'}, {LCE: '1.0', FBC: '6.0'}]) {
        for (const note of [false, true]) {
            const c = {...mods, FBCNoteExists: note, Description: 'Not a private note'};
            draws.length = 0;
            draw([c, 0, 0, 1], () => { assert.equal(c.FBC, undefined); });
            assert.equal(c.FBC, mods.FBC);
            assert.equal(draws.length, 2);
            const both = !!(mods.LCE && mods.FBC);
            assert.equal(draws[0][4], both ? (note ? 'Purple' : 'Red') : (note ? 'Blue' : 'White'));
            assert.equal(draws[1][4], 'White');
        }
    }
    const c = {FBC: '6.0'};
    assert.throws(() => draw([c, 0, 0, 1], () => { throw Error('draw failed'); }));
    assert.equal(c.FBC, '6.0');
    rt.context.ChatRoomHideIconState = 1;
    draws.length = 0;
    draw([c, 0, 0, 1], () => {});
    assert.equal(draws.length, 0);
});
