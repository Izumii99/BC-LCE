import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';

test('模組群組（Luzi）鏡射：不被引擎改回、不代送封包、刷新重入不洩漏佇列', async () => {
    let tick, now = 0;
    const sent = [];
    const groups = ['Eyes', 'Eyes2', 'Mouth', '右眼_Luzi', '左眼_Luzi'];
    const player = { MemberNumber: 1, IsPlayer: () => true,
        Appearance: [...groups, 'Emoticon'].map(Name => ({
            Asset: { Group: { Name, AllowExpression: ['Daydream', 'Smirk'] } }, Property: { Expression: null } })),
        AppearanceLayers: [], ActivePose: ['BaseUpper', 'BaseLower'],
        ArousalSettings: { Progress: 0 }, OnlineSharedSettings: { ItemsAffectExpressions: true } };
    const face = n => player.Appearance.find(a => a.Asset.Group.Name === n).Property;
    let rt, change;
    // 模擬「服装拓展」：Eyes 變動時鏡射到 Luzi；每次刷新也重呼叫（模擬重入來源）
    const mirror = (C, g, e) => {
        if (g === 'Eyes') for (const l of ['右眼_Luzi', '左眼_Luzi']) { face(l).Expression = e; }
    };
    rt = runtime({ globals: {
        Player: player, CurrentScreen: 'ChatRoom', CurrentTime: 0,
        Date: class extends Date { static now() { return now; } },
        addEventListener() {}, setInterval: cb => { tick = cb; return 1; },
        PoseFemale3DCG: [{ Name: 'BaseUpper', Category: 'BodyUpper' }, { Name: 'BaseLower', Category: 'BodyLower' }],
        DialogSelfMenuSelected: '', ServerSend: (...a) => sent.push(a), ServerAppearanceBundle: x => x,
        CharacterSetFacialExpression: mirror,
        CharacterRefresh() { for (const l of ['右眼_Luzi', '左眼_Luzi']) change([player, l, null], () => {}); },
    } });
    const settings = await rt.load('src/core/feature-settings.js');
    settings.setFeature('animationEngine', true);
    settings.setFeature('activityExpressions', true);
    settings.setFeature('autoArousalExpression', false);
    const ex = await rt.load('src/features/expressions/index.js');
    ex.installExpressions();
    change = rt.hooks.get('CharacterSetFacialExpression');
    tick();
    ex.pushEvent({ Type: 'Activity', Duration: 5000, Expression: { Eyes: [{ Expression: 'Daydream' }] } });
    sent.length = 0;
    for (now = 250; now < 4500; now += 250) tick();
    assert.equal(face('Eyes').Expression, 'Daydream');
    assert.equal(face('右眼_Luzi').Expression, 'Daydream', '鏡射值不可被引擎改回');
    assert.equal(sent.filter(([, d]) => /Luzi/.test(d.Group)).length, 0, '引擎不代送模組群組');
    assert.ok(ex.getExpressionQueue().length < 6, `佇列不可洩漏，目前 ${ex.getExpressionQueue().length}`);
    assert.equal(sent.filter(([, d]) => d.Group === 'Eyes').length >= 1, true);
    for (now = 4500; now <= 6000; now += 250) tick();
    assert.equal(face('Eyes').Expression, null, '時間到恢復');
});
