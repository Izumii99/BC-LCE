import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';

test('room rebuild pacing retains dirty state, serves queued characters and bypasses initial/editor work', async () => {
    let now = 0, enabled = true, builds = 0;
    const a = {Canvas: {}, CanvasBlink: {}, MustDraw: true};
    const b = {Canvas: {}, CanvasBlink: {}, MustDraw: true};
    const rt = runtime({globals: {CurrentScreen: 'ChatRoom', CurrentCharacter: null,
        Player: {}, ChatRoomCharacter: [a, b], performance: {now: () => now}},
    mocks: {'src/core/feature-settings.js': {getFeature: () => enabled}}});
    const mod = await rt.load('src/features/performance/character-load.js');
    mod.installCharacterLoadPerformance();
    const load = c => rt.hooks.get('CharacterLoadCanvas')([c], () => { builds++; c.MustDraw = false; });
    const draw = c => rt.hooks.get('DrawCharacter')([c], () => { load(c); c.MustDraw = false; });
    draw(a); draw(b);
    assert.equal(builds, 1); assert.equal(b.MustDraw, true);
    now = 60; draw(a); draw(b);
    assert.equal(builds, 2); assert.equal(a.MustDraw, true); assert.equal(b.MustDraw, false);
    // Synchronous work outside DrawCharacter is never deferred.
    load(a); assert.equal(builds, 3);
    delete b.Canvas; draw(b); assert.equal(builds, 4);
    enabled = false; draw(a); assert.equal(builds, 5);
});
