import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';

for (const loadOrder of ['before', 'after', 'already-active']) {
    test(`HSC owns its face until release; HSC load order: ${loadOrder}`, async () => {
        let tick, now = 0, active = loadOrder === 'already-active';
        const sent = [];
        const groups = ['Eyes', 'Eyes2', 'Mouth', '右眼_Luzi'];
        const player = { MemberNumber: 1, IsPlayer: () => true,
            Appearance: [...groups, 'Emoticon'].map(Name => ({
                Asset: { Group: { Name, AllowExpression: ['Happy', 'Closed', 'Hearts'] } },
                Property: { Expression: null },
            })),
            AppearanceLayers: [], ActivePose: ['BaseUpper', 'BaseLower'],
            ArousalSettings: { Progress: 0 }, OnlineSharedSettings: { ItemsAffectExpressions: true },
        };
        const api = { apiVersion: 1, getState: () => ({ active, groups: [...groups] }) };
        const liko = { HSC: loadOrder !== 'after' ? { expressions: api } : undefined };
        if (active) for (const item of player.Appearance) {
            if (groups.includes(item.Asset.Group.Name)) item.Property.Expression = 'Hearts';
        }
        const rt = runtime({ globals: {
            Player: player, Liko: liko, CurrentScreen: 'ChatRoom', CurrentTime: 0,
            Date: class extends Date { static now() { return now; } },
            addEventListener() {}, setInterval: cb => { tick = cb; return 1; },
            PoseFemale3DCG: [{ Name: 'BaseUpper', Category: 'BodyUpper' }, { Name: 'BaseLower', Category: 'BodyLower' }],
            DialogSelfMenuSelected: '', CharacterRefresh() {}, ServerSend: (...args) => sent.push(args),
            ServerAppearanceBundle: x => x, CharacterSetFacialExpression() {},
        } });
        const settings = await rt.load('src/core/feature-settings.js');
        settings.setFeature('animationEngine', true);
        settings.setFeature('activityExpressions', true);
        settings.setFeature('autoArousalExpression', false);
        const ex = await rt.load('src/features/expressions/index.js');
        ex.installExpressions();
        const change = rt.hooks.get('CharacterSetFacialExpression');
        const face = name => player.Appearance.find(item => item.Asset.Group.Name === name).Property;
        if (active) {
            tick();
            assert.equal(face('Eyes').Expression, 'Hearts');
            for (const name of groups) face(name).Expression = 'Happy';
            active = false;
            tick();
            assert.equal(face('Eyes').Expression, 'Happy', 'adopt HSC restoration, not the hypnotized startup face');
        }
        change([player, 'Eyes', 'Happy'], () => assert.fail('unexpected native fallback'));
        // A pre-existing timed effect must expire in real time, not restart after HSC.
        ex.pushEvent({ Type: 'Activity', Duration: 2000, Expression: { Eyes: [{ Expression: 'Closed' }] } });
        tick();
        assert.equal(face('Eyes').Expression, 'Closed');
        liko.HSC = { expressions: api };
        active = true;
        for (const name of groups) face(name).Expression = 'Hearts';
        sent.length = 0;
        for (now = 250; now <= 9000; now += 250) tick();
        for (const name of groups) assert.equal(face(name).Expression, 'Hearts');
        assert.equal(sent.filter(([, data]) => groups.includes(data.Group)).length, 0);
        // At second 9: neither LCE activities nor native/manual/timer entry points
        // may overwrite hypnosis or leave a deferred face to replay at second 10.
        now = 9000;
        ex.pushEvent({ Type: 'Activity', Duration: 5000, Expression: { Eyes: [{ Expression: 'Closed' }] } });
        change([player, 'Eyes', 'Closed'], () => assert.fail('must not overwrite HSC via native fallback'));
        player.ExpressionQueue = [{ Group: 'Eyes', Expression: 'Closed', Time: 0 }];
        rt.hooks.get('TimerInventoryRemove')([], () => {});
        settings.setFeature('autoArousalExpression', true);
        player.ArousalSettings.Progress = 90;
        tick();
        for (const name of groups) assert.equal(face(name).Expression, 'Hearts');
        assert.ok(!ex.getExpressionQueue().some(event => event.At === 9000 && event.Expression?.Eyes));
        // Other facial groups are not globally disabled.
        change([player, 'Emoticon', 'Happy'], () => assert.fail('unexpected fallback'));
        assert.equal(face('Emoticon').Expression, 'Happy');
        settings.setFeature('autoArousalExpression', false);
        now = 10000;
        // HSC restores its snapshot synchronously, then releases ownership.
        for (const name of groups) face(name).Expression = null;
        face('Eyes').Expression = face('Eyes2').Expression = 'Closed';
        active = false;
        tick();
        assert.equal(face('Eyes').Expression, 'Happy', 'expired pre-HSC event is not resurrected');
        assert.equal(face('Eyes2').Expression, 'Happy');
        now = 15000; tick();
        assert.equal(face('Eyes').Expression, 'Happy', 'no delayed second-9 expression');
        ex.pushEvent({ Type: 'Activity', Duration: 3000, Expression: { Eyes: [{ Expression: 'Closed' }] } });
        tick();
        assert.equal(face('Eyes').Expression, 'Closed', 'new activities resume after release');
        assert.equal(rt.warnings.length, 0);
    });
}

test('HSC adapter tolerates absence, old APIs, removal and invalid snapshots', async () => {
    const liko = {};
    const rt = runtime({ globals: { Liko: liko } });
    const { hscExpressionGroups } = await rt.load('src/core/hsc-compat.js');
    assert.equal(hscExpressionGroups().size, 0);
    for (const expressions of [undefined, { apiVersion: 0 },
        { apiVersion: 1, getState() { throw Error('unavailable'); } },
        { apiVersion: 1, getState: () => ({ active: true, groups: null }) }]) {
        liko.HSC = { expressions };
        assert.equal(hscExpressionGroups().size, 0);
    }
    liko.HSC = { expressions: { apiVersion: 1, getState: () => ({ active: true, groups: ['Eyes', 1] }) } };
    assert.deepEqual([...hscExpressionGroups()], ['Eyes']);
    delete liko.HSC;
    assert.equal(hscExpressionGroups().size, 0);
});
