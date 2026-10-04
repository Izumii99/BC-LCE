import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runtime } from './helpers/runtime.mjs';
import { emoticonExpression, echoExpressionEvent, echoSound } from '../src/features/expressions/qol-rules.js';

const packet = (name, group = 'ItemMouth', sender = 2, target = 1) => ({
    Type: 'Activity', Content: `ChatOther-${group}-${name}`, Sender: sender,
    Dictionary: [{ TargetCharacter: target }],
});

test('textmoji handle mixed faces without matching URLs or ordinary words', () => {
    for (const text of ['>.<', ':3', '>w<', '=v=', 'xD', ';p']) assert.ok(Object.keys(emoticonExpression(text)).length);
    assert.deepEqual(emoticonExpression('https://example.com/#hello?x=0.0 ordinaryxD'), {});
    assert.equal(emoticonExpression(':3 >.<').Eyes, 'Daydream');
    assert.equal(emoticonExpression(';p').Eyes2, null);
});

test('Echo bridge recognizes canonical names, filters uninvolved players and non-mouth kisses', () => {
    assert.equal(echoExpressionEvent(packet('舔手'), 1), 'Lick');
    assert.equal(echoExpressionEvent(packet('抱入怀中', 'ItemTorso'), 1), 'Cuddle');
    assert.equal(echoExpressionEvent(packet('Luzi_DeepKiss'), 1), 'LongKiss');
    assert.equal(echoExpressionEvent(packet('Luzi_Kiss', 'ItemHead'), 1), null);
    assert.equal(echoExpressionEvent(packet('轻弹额头', 'ItemHead', 1, 2), 1), null);
    assert.equal(echoExpressionEvent(packet('舔手', 'ItemHands', 2, 3), 1), null);
    assert.equal(echoSound(packet('轻弹额头', 'ItemHead')), 'SpankSkin');
    assert.equal(echoSound(packet('Spank', 'ItemButt')), null, 'native activity stays native');
});

async function fixture() {
    const events = [], restored = [], cancelled = [], buttons = [];
    let tick, ready = true;
    const player = { Appearance: [{ Asset: { Name: 'Petsuit' } }], ActivePose: ['Kneel', 'BaseUpper'], _BlindLevel: 3 };
    const actions = [];
    const rt = runtime({ globals: {
        Player: player, CurrentScreen: 'ChatRoom', AudioActions: actions,
        MainCanvas: { globalAlpha: 0.4 }, DrawButton: (...args) => buttons.push(args), DrawImageResize() {}, MouseIn: () => false,
        DialogFacialExpressionsSelectedBlindnessLevel: 3,
        InventoryGet: () => ({ Property: { Expression: 'Closed' } }),
        PoseCanChangeUnaided: () => true,
        PoseFemale3DCG: [{ Name: 'Kneel', Category: 'BodyLower' }],
        setInterval: callback => { tick = callback; return 1; },
    }, mocks: {
        'src/features/expressions/index.js': {
            canUseExpressionEngine: () => ready,
            pushEvent: event => events.push(event),
            cancelExpressionEvent: type => cancelled.push(type),
            restoreQolPose: pose => restored.push([...pose]),
            restoreQolFace() {},
        },
    } });
    const settings = await rt.load('src/core/feature-settings.js');
    const module = await rt.load('src/features/chat-qol.js');
    module.installChatQol();
    return { rt, settings, module, player, actions, events, restored, cancelled, buttons,
        tick: () => tick(), setReady: value => { ready = value; } };
}

test('chat QoL leaves closed-eye settings and expression-dialog clicks to the game', async () => {
    const { rt, player } = await fixture();
    for (const name of ['ChatRoomUpdateDisplay', 'ChatRoomSync', 'ChatRoomDraw']) assert.equal(rt.hooks.has(name), false);
    rt.context.CurrentCharacter = player;
    rt.hooks.get('ChatRoomClick')([], () => {
        assert.equal(rt.context.DialogFacialExpressionsSelectedBlindnessLevel, 3);
        assert.equal(player._BlindLevel, 3);
        rt.context.DialogFacialExpressionsSelectedBlindnessLevel = 1;
        player._BlindLevel = 1;
    });
    assert.equal(rt.context.DialogFacialExpressionsSelectedBlindnessLevel, 1, 'native changes must not be rolled back');
    assert.equal(player._BlindLevel, 1);
});

test('sound fallback preserves native priority and cleans up on disable and exceptions', async () => {
    const { rt, settings, actions } = await fixture();
    settings.setFeature('richerActivitySounds', true);
    const data = packet('轻弹额头');
    const audio = rt.hooks.get('AudioPlaySoundForChatMessage');
    const native = { IsAction: () => true, GetSoundEffect: () => 'native' };
    actions.push(native);
    audio([data], () => assert.equal(actions.find(a => a.IsAction(data)).GetSoundEffect(), 'native'));
    actions.length = 0;
    audio([data], () => assert.equal(actions.find(a => a.IsAction(data)).GetSoundEffect(), 'SpankSkin'));
    assert.equal(actions.length, 0);
    assert.throws(() => audio([data], () => { throw Error('sound'); }));
    assert.equal(actions.length, 0);
    settings.setFeature('richerActivitySounds', false);
    audio([data], () => assert.equal(actions.length, 0));
});

test('outgoing emoticons use pre-garble text without adding original to network payload', async () => {
    const { rt, settings, events } = await fixture();
    settings.setFeature('chatEmoticons', true);
    const message = { Type: 'Chat', Content: 'mmm', Dictionary: [] };
    rt.hooks.get('ChatRoomGenerateChatRoomChatMessage')(['Chat', '>.<'], () => message);
    assert.equal(events.length, 0, 'preparing a cancelled message does not animate');
    rt.hooks.get('ServerSend')(['ChatRoomChat', message], () => {});
    assert.equal(events[0].Expression.Eyes[0].Expression, 'Daydream');
    assert.equal(message.Dictionary.length, 0);
});

test('Petsuit cycles have two poses, stop restores pose, manual changes cancel without overwriting', async () => {
    const { rt, settings, module, player, events, restored, tick, buttons } = await fixture();
    settings.setFeature('petsuitAnimation', true);
    module.togglePetsuitAnimation();
    assert.equal(events[0].Poses.length, 8);
    assert.equal(events[0].Duration, 2800);
    assert.equal(events[0].Poses[0].Pose[1], 'Kneel');
    tick();
    rt.hooks.get('DrawProcess')([], () => {});
    assert.equal(buttons.at(-1)[7], 'qol_stopAnimation');
    assert.equal(buttons.at(-1)[5], 'Pink');
    assert.equal(rt.context.MainCanvas.globalAlpha, 0.4);
    module.togglePetsuitAnimation();
    assert.deepEqual(restored, [['Kneel', 'BaseUpper']]);
    module.togglePetsuitAnimation();
    rt.hooks.get('PoseSetActive')([player, 'NewPose'], () => {});
    assert.equal(restored.length, 1, 'manual pose wins');
    module.togglePetsuitAnimation();
    settings.setFeature('petsuitAnimation', false);
    tick();
    assert.equal(restored.length, 2);
    buttons.length = 0;
    rt.hooks.get('DrawProcess')([], () => {});
    assert.equal(buttons.length, 0);
});

test('pet suit button uses FCM coordinates in all four corners and matching click targets', async () => {
    const { rt, settings, module, buttons, events } = await fixture();
    settings.setFeature('petsuitAnimation', true);
    const expected = { tl: [0, 200, 45, 45], bl: [0, 800, 45, 45], tr: [955, 200, 45, 45], br: [955, 800, 45, 45] };
    for (const [position, rect] of Object.entries(expected)) {
        settings.setFeature('petsuitAnimationPosition', position);
        assert.deepEqual([...module.petsuitButtonRect()], rect);
        rt.hooks.get('DrawProcess')([], () => {});
        assert.deepEqual(buttons.at(-1).slice(0, 4), rect);
        assert.ok(rect[1] + rect[3] < 1000);
    }
    rt.context.MouseIn = (...rect) => JSON.stringify(rect) === JSON.stringify(expected.br);
    rt.hooks.get('ChatRoomClick')([], () => assert.fail('button should consume its click'));
    assert.equal(events.length, 1);
    rt.context.CurrentCharacter = {};
    let passed = false;
    rt.hooks.get('ChatRoomClick')([], () => { passed = true; });
    assert.equal(passed, true, 'no button over a character dialog');
});

test('all new settings and buttons have all seven LCE translations', () => {
    const keys = ['echoMouthPull', 'chatEmoticons', 'richerActivitySounds',
        'petsuitAnimation', 'petsuitAnimationCycles', 'petsuitAnimationDelay', 'petsuitAnimationPosition'];
    for (const lang of ['TW', 'CN', 'EN', 'DE', 'FR', 'RU', 'UA']) {
        const table = JSON.parse(fs.readFileSync(`Translation/${lang}.json`, 'utf8'));
        for (const key of keys) for (const prefix of ['s_', 'sd_']) assert.ok(table[prefix + key], `${lang}: ${prefix}${key}`);
        assert.ok(table.qol_startAnimation && table.qol_stopAnimation);
        assert.ok(table.settings_reset_immersion);
        for (const position of ['tl', 'bl', 'tr', 'br']) assert.ok(table[`so_fp_${position}`]);
        for (const removed of ['smartClosedEyes', 'echoActivityExpressions']) {
            assert.equal(table[`s_${removed}`], undefined);
            assert.equal(table[`sd_${removed}`], undefined);
        }
        for (const section of ['expressions', 'chat', 'other']) assert.ok(table[`settings_tab_immersion_${section}`]);
    }
});

test('real expression engine expires textmoji and restores temporary pose without activity expressions', async () => {
    let tick, now = 0;
    const player = { MemberNumber: 1, IsPlayer: () => true,
        Appearance: ['Eyes', 'Eyes2', 'Mouth'].map(Name => ({
            Asset: { Group: { Name, AllowExpression: ['Happy', 'Daydream', 'Smirk'] } }, Property: {},
        })), AppearanceLayers: [], ActivePose: ['BaseUpper', 'BaseLower'], ArousalSettings: { Progress: 0 },
    };
    const rt = runtime({ append: { 'src/features/expressions/index.js': 'export { handleChatMessage as testMessage };' }, globals: { Player: player, CurrentScreen: 'ChatRoom',
        Date: class extends Date { static now() { return now; } },
        addEventListener() {}, removeEventListener() {}, setInterval: cb => { tick = cb; return 1; },
        PoseFemale3DCG: ['BaseUpper', 'BaseLower', 'OverTheHead', 'BackElbowTouch'].map(Name =>
            ({ Name, Category: Name === 'BaseLower' ? 'BodyLower' : 'BodyUpper' })),
        DialogSelfMenuSelected: '', CharacterRefresh() {}, ServerSend() {},
        ServerAppearanceBundle: x => x, CharacterSetFacialExpression() {},
    } });
    const settings = await rt.load('src/core/feature-settings.js');
    settings.setFeature('animationEngine', true);
    settings.setFeature('autoArousalExpression', false);
    settings.setFeature('activityExpressions', false);
    settings.setFeature('chatEmoticons', true);
    settings.setFeature('petsuitAnimation', true);
    const ex = await rt.load('src/features/expressions/index.js');
    ex.installExpressions();
    rt.hooks.get('CharacterSetFacialExpression')([player, 'Eyes', 'Happy'], () => {});
    ex.pushEvent({ Type: 'LceEmoticon', Duration: 5000, Expression: { Eyes: [{ Expression: 'Daydream' }] } });
    tick();
    assert.equal(player.Appearance[0].Property.Expression, 'Daydream');
    now = 5001; tick();
    assert.equal(player.Appearance[0].Property.Expression, 'Happy');
    ex.pushEvent({ Type: 'LcePetsuit', Duration: 1000, Poses: [{ Pose: ['OverTheHead', 'BaseLower'], Duration: 1000 }] });
    tick();
    assert.ok(player.ActivePose.includes('OverTheHead'));
    ex.cancelExpressionEvent('LcePetsuit');
    ex.restoreQolPose(['BackElbowTouch', 'BaseLower']);
    tick();
    assert.ok(player.ActivePose.includes('BackElbowTouch'));
    settings.setFeature('activityExpressions', true);
    ex.testMessage(packet('舔手'));
    assert.ok(ex.getExpressionQueue().some(event => event.Type === 'LceEchoActivity'), 'Echo is included in the existing activity switch');
    settings.setFeature('activityExpressions', false);
    tick();
    assert.ok(!ex.getExpressionQueue().some(event => event.Type === 'LceEchoActivity'));
    assert.equal(rt.warnings.length, 0);
});
