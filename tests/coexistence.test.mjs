import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {fakeClock} from './helpers/clock.mjs';

test('LCE owns badge rendering with either WCE registration order', async () => {
    for (const wceFirst of [true, false]) {
        const draws = [];
        const rt = runtime({globals: {DrawTextFit: (...args) => draws.push(args), ChatRoomHideIconState: 0}});
        const {default: sdk} = await rt.load('src/modsdk.js');
        const wce = () => sdk.hookFunction('ChatRoomDrawCharacterStatusIcons', 0, (args, next) => {
            const result = next(args);
            if (args[0].FBC) draws.push(['WCE duplicate']);
            return result;
        });
        if (wceFirst) wce();
        (await rt.load('src/features/social/badges.js')).installBadges();
        if (!wceFirst) wce();
        const c = {FBC: '6.0', LCE: '1.0', FBCNoteExists: true};
        rt.hooks.get('ChatRoomDrawCharacterStatusIcons')([c, 0, 0, 1], () => {});
        assert.equal(draws.length, 2); assert.equal(draws[0][4], 'Purple');
        assert.equal(c.FBC, '6.0');
    }
});

test('fake clock executes, repeats and cancels work deterministically', () => {
    const clock = fakeClock(), calls = [];
    const id = clock.globals.setInterval(() => calls.push(clock.globals.Date.now()), 10);
    clock.advance(25); clock.globals.clearInterval(id); clock.advance(100);
    assert.deepEqual(calls, [10, 20]);
});
