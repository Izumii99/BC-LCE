import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runtime } from './helpers/runtime.mjs';
import { emoticonExpression, emoticonDuration, echoExpressionEvent, echoSound } from '../src/features/expressions/qol-rules.js';

const packet = (name, group = 'ItemMouth', sender = 2, target = 1) => ({
    Type: 'Activity', Content: `ChatOther-${group}-${name}`, Sender: sender,
    Dictionary: [{ TargetCharacter: target }],
});

test('textmoji handle mixed faces without matching URLs or ordinary words', () => {
    for (const text of ['>.<', ':3', '>w<', '=v=', 'xD', ';p']) assert.ok(Object.keys(emoticonExpression(text)).length);
    assert.deepEqual(emoticonExpression('https://example.com/#hello?x=0.0 ordinaryxD'), {});
    assert.equal(emoticonExpression(':3 >.<').Eyes, 'Daydream');
    assert.equal(emoticonExpression(';p').Eyes2, null);
    assert.equal(emoticonExpression('0///0').Blush, 'Medium');
    assert.equal(emoticonExpression('>///<').Blush, 'Medium');
    assert.equal(emoticonExpression('<\\\\\\>').Blush, 'Medium');
    assert.equal(emoticonExpression('///////').Blush, 'Extreme');
    assert.equal(emoticonExpression('=w=/////').Emoticon, 'Hearts');
    assert.equal(emoticonExpression('=w=////').Emoticon, undefined);
    assert.equal(emoticonDuration('///'), 5000);
    assert.equal(emoticonDuration('>///<'), 5000);
    assert.equal(emoticonDuration('///////'), 7000);
    assert.equal(emoticonDuration('////////////////'), 16000);

    // Trailing marks and sweatdrops
    assert.equal(emoticonExpression('TwT;').Fluids, 'TearsHigh');
    assert.equal(emoticonExpression('TwT;').Eyes, 'Shy');
    assert.equal(emoticonExpression('^^;').Fluids, 'TearsLow');
    assert.equal(emoticonExpression('x_x;').Fluids, 'TearsLow');
    
    // >; is an angry face, the ; is not a sweatdrop
    assert.equal(emoticonExpression('>;').Fluids, undefined);
    assert.equal(emoticonExpression('>;').Eyes, 'Angry');
    
    // Slash stripping should not create faces from internal slashes
    assert.deepEqual(emoticonExpression('x//d'), {});
    assert.deepEqual(emoticonExpression('t//t'), {});
});

test('textmoji ignores ordinary punctuation but respects explicit expressive punctuation', () => {
    // Normal sentences should not trigger expressions (token-based triggers)
    assert.deepEqual(emoticonExpression('How are you?'), {});
    assert.deepEqual(emoticonExpression('hello!'), {});
    assert.deepEqual(emoticonExpression('Happy birthday!!!'), {});
    assert.deepEqual(emoticonExpression('C#'), {});
    assert.deepEqual(emoticonExpression('#general'), {});
    assert.deepEqual(emoticonExpression('wow!!'), {});
    assert.deepEqual(emoticonExpression('hello!! nice??'), {});
    assert.deepEqual(emoticonExpression('https://x.com'), {});

    // Explicit standalone triggers
    assert.equal(emoticonExpression('!!').Emoticon, 'Exclamation');
    assert.equal(emoticonExpression('!!').Eyebrows, 'Harsh');
    assert.equal(emoticonExpression('!!!').Eyebrows, 'Angry');
    assert.equal(emoticonExpression('??').Emoticon, 'Confusion');
    assert.equal(emoticonExpression('??').Eyebrows, 'OneRaised');
    assert.equal(emoticonExpression('?!').Eyebrows, 'Angry');
    assert.equal(emoticonExpression('?').Emoticon, 'Confusion', 'Single ? is now supported');

    // Composition with existing emoticons
    const w = emoticonExpression('>w<!!');
    assert.equal(w.Emoticon, 'Exclamation');
    assert.equal(w.Eyebrows, 'Harsh', 'Additive marks should add eyebrows if attached to textmoji');

    const shy = emoticonExpression('>///<!!');
    assert.equal(shy.Emoticon, 'Exclamation');
    assert.equal(shy.Eyebrows, 'Lowered', 'Existing eyebrows are not overwritten by additive punctuation');

    const sleep = emoticonExpression('zzz what??');
    assert.equal(sleep.Emoticon, 'Sleep');
    assert.equal(sleep.Eyebrows, undefined, 'Ordinary words like what?? do not trigger expressions in explicit mode');

    assert.equal(emoticonExpression('<3').Emoticon, 'Hearts');
    assert.equal(emoticonExpression('zzz~').Emoticon, 'Sleep');
    assert.equal(emoticonExpression('zzz...').Emoticon, 'Sleep');
});

test('equals-sign eye faces do not shadow each other', () => {
    for (const text of ['=_=', '=^=', '=-=']) {
        assert.deepEqual(emoticonExpression(text), { Eyes: 'Closed', Mouth: 'Frown' }, text);
    }
    for (const text of ['=.=', '=,=', '=~=']) {
        assert.deepEqual(emoticonExpression(text), { Eyes: 'Horny', Mouth: 'Frown' }, text);
    }
    assert.deepEqual(emoticonExpression('=3='), { Mouth: 'Pout' });
    // The dot in =.= must stay a literal dot, not a wildcard.
    for (const text of ['=x=', '=o=', '=a=']) assert.deepEqual(emoticonExpression(text), {}, text);
});

test('deadpan -_- face and punctuation precedence', () => {
    assert.deepEqual(emoticonExpression('-_-'), { Eyes: 'Dazed', Eyebrows: 'Harsh', Mouth: 'Frown' });
    const strong = emoticonExpression('-_-!!!');
    assert.equal(strong.Emoticon, 'Exclamation');
    assert.equal(strong.Eyebrows, 'Harsh', 'textmoji eyebrows are not replaced by !!!');

    // Eyebrow preservation does not depend on spacing or token order.
    for (const text of ['>///<!!', '>///< !!', '!! >///<']) {
        assert.equal(emoticonExpression(text).Eyebrows, 'Lowered', text);
        assert.equal(emoticonExpression(text).Emoticon, 'Exclamation', text);
    }
    assert.equal(emoticonExpression('>:< !!').Eyebrows, 'Angry');

    // Punctuation's Emoticon always beats a textmoji's own Emoticon, in either order.
    for (const text of ['<3 !!', '!! <3', '>/////< !!', 'T_T; !!']) {
        assert.equal(emoticonExpression(text).Emoticon, 'Exclamation', text);
    }
    assert.equal(emoticonExpression('T_T; !!').Fluids, 'TearsHigh', 'non-Emoticon parts of the textmoji are kept');

    // Mixed standalone punctuation is handled consistently with the attached form.
    for (const text of ['?!?', '!?!', '!!??']) {
        assert.equal(emoticonExpression(text).Emoticon, 'Confusion', text);
        assert.equal(emoticonExpression(text).Eyebrows, 'Angry', text);
    }
});

test('Echo bridge recognizes canonical names, filters uninvolved players and non-mouth kisses', () => {
    assert.equal(echoExpressionEvent(packet('舔手'), 1), 'Lick');
    assert.equal(echoExpressionEvent(packet('抱入怀中', 'ItemTorso'), 1), 'Cuddle');
    assert.equal(echoExpressionEvent(packet('Luzi_DeepKiss'), 1), 'LongKiss');
    assert.equal(echoExpressionEvent(packet('Luzi_Kiss', 'ItemHead'), 1), null);
    assert.equal(echoExpressionEvent(packet('轻弹额头', 'ItemHead', 1, 2), 1), null);
    assert.equal(echoExpressionEvent(packet('舔手', 'ItemHands', 2, 3), 1), null);
    assert.equal(echoSound(packet('轻弹额头', 'ItemHead')), 'SpankSkin');
    assert.equal(echoSound(packet('Spank', 'ItemButt')), 'SpankSkin', 'fallback sound generated for all activities');
});

test('Echo bridge custom sound regex matching', () => {
    // Should match Luzi_* exact identifiers
    assert.equal(echoSound(packet('Luzi_Slap')), 'SpankSkin');
    assert.equal(echoSound(packet('Luzi_Hit')), 'SmackCrop');
    assert.equal(echoSound(packet('Luzi_Whip')), 'WhipCrack');
    assert.equal(echoSound(packet('Luzi_Pinch')), 'LeatherStretchingShort');
    assert.equal(echoSound(packet('Luzi_Bap')), 'SpankSkin');
    assert.equal(echoSound(packet('Luzi_Flick')), 'SpankSkin');

    // Negatives
    assert.equal(echoSound(packet('baptizes you')), null);
    assert.equal(echoSound(packet('flicker the lights')), null);
    assert.equal(echoSound(packet('whipped cream')), null);
    assert.equal(echoSound(packet('hit the snooze button')), 'SmackCrop');
    assert.equal(echoSound(packet('is hitting the gym')), 'SmackCrop');

    // Dictionary text should not contaminate matching
    assert.equal(echoSound({
        Type: 'Activity', Content: 'ChatOther-ItemTorso-Luzi_Hug', Sender: 2,
        Dictionary: [{ TargetCharacter: 1 }, { Tag: 'SourceCharacter', Text: 'Slap' }]
    }), null);
});

test('Animal animation triggers', async () => {
    const rt = runtime({ globals: { window: { location: { href: 'http://localhost' } } } });
    const { getAnimTypeFromMsg } = await rt.load('src/features/animal-animations.js');

    // Exact forms should trigger
    assert.equal(getAnimTypeFromMsg('*wag*'), 'Tails');
    assert.equal(getAnimTypeFromMsg('*wags*'), 'Tails');
    assert.equal(getAnimTypeFromMsg('*flap*'), 'Wings');
    assert.equal(getAnimTypeFromMsg('*flaps*'), 'Wings');
    assert.equal(getAnimTypeFromMsg('*wiggle*'), 'Ears');
    assert.equal(getAnimTypeFromMsg('*twitch*'), 'Ears');

    // Sentences containing the word should not trigger
    assert.equal(getAnimTypeFromMsg('*please wag*'), null);
    assert.equal(getAnimTypeFromMsg("*doesn't wag*"), null);
    assert.equal(getAnimTypeFromMsg('*he wags his tail*'), null);

    // Non-emotes should not trigger
    assert.equal(getAnimTypeFromMsg('wag'), null);
    assert.equal(getAnimTypeFromMsg('wags'), null);
});

async function fixture({ responsive = false } = {}) {
    const events = [], restored = [], cancelled = [], buttons = [], settled = [], timers = [];
    let tick, ready = true, responsiveConsumer;
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
        setTimeout: (fn, ms) => timers.push({ fn, ms }) && timers.length,
        // Timer ids are 1-based indexes into `timers`; clearTimeout marks the entry so tests can assert real cancellation.
        clearTimeout: id => { if (timers[id - 1]) timers[id - 1].cancelled = true; },
        ...(responsive ? { Liko: { Responsive_Liko: { apiVersion: 1, registerConsumer: (_name, cb) => { responsiveConsumer = cb; } } } } : {}),
    }, mocks: {
        'src/features/expressions/index.js': {
            canUseExpressionEngine: () => ready,
            pushEvent: event => events.push(event),
            cancelExpressionEvent: type => cancelled.push(type),
            restoreQolPose: pose => restored.push([...pose]),
            readFace: group => player.Appearance.find(i => i.Asset.Group?.Name === group)?.Property?.Expression ?? null,
            settleFace: groups => settled.push([...groups]),
        },
    } });
    const settings = await rt.load('src/core/feature-settings.js');
    const module = await rt.load('src/features/chat-qol.js');
    module.installChatQol();
    return { rt, settings, module, player, actions, events, restored, cancelled, buttons, settled, timers,
        tick: () => tick(), setReady: value => { ready = value; },
        setResponsive: desired => responsiveConsumer(desired) };
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
    const { rt, settings, events, timers } = await fixture();
    settings.setFeature('chatEmoticons', true);
    const message = { Type: 'Chat', Content: 'mmm', Dictionary: [] };
    rt.hooks.get('ChatRoomGenerateChatRoomChatMessage')(['Chat', '>.<'], () => message);
    assert.equal(events.length, 0, 'preparing a cancelled message does not animate');
    rt.hooks.get('ServerSend')(['ChatRoomChat', message], () => {});
    timers.at(-1).fn(); // advance the delay timer
    assert.equal(events[0].Expression.Eyes[0].Expression, 'Daydream');
    assert.equal(events[0].Duration, 5000);
    assert.equal(message.Dictionary.length, 0);

    const blushMessage = { Type: 'Chat', Content: 'ignored', Dictionary: [{ Original: '>//////<' }] };
    rt.hooks.get('ServerSend')(['ChatRoomChat', blushMessage], () => {});
    timers.at(-1).fn(); // advance the delay timer
    assert.equal(events[1].Duration, 6000);
    assert.equal(events[1].Expression.Blush[0].Expression, 'Extreme');
    assert.equal(events[1].Expression.Blush[0].Duration, 6000);

    const emoteMessage = { Type: 'Emote', Content: 'ignored', Dictionary: [{ Original: '>.<' }] };
    rt.hooks.get('ServerSend')(['ChatRoomChat', emoteMessage], () => {});
    assert.equal(timers.at(-1).ms, 0, 'Emote has no speech delay');
    
    const whisperMessage = { Type: 'Whisper', Content: 'ignored', Dictionary: [{ Original: '>.<' }] };
    rt.hooks.get('ServerSend')(['ChatRoomChat', whisperMessage], () => {});
    assert.equal(timers.at(-1).ms, 0, 'Whisper has no speech delay');
});

test('emoticon duration comes from the typed text even when Dictionary.Original is missing', async () => {
    const { rt, settings, events, timers } = await fixture();
    settings.setFeature('chatEmoticons', true);
    // A gag rewrote Content and no Original was recorded: the slash run only exists in the typed text.
    const message = { Type: 'Chat', Content: 'mmm', Dictionary: [] };
    rt.hooks.get('ChatRoomGenerateChatRoomChatMessage')(['Chat', '>//////<'], () => message);
    rt.hooks.get('ServerSend')(['ChatRoomChat', message], () => {});
    timers.at(-1).fn();
    assert.equal(events[0].Expression.Blush[0].Expression, 'Extreme');
    assert.equal(events[0].Duration, 6000, 'duration must follow the same text as the face, not the default 5000');
    assert.equal(events[0].Expression.Blush[0].Duration, 6000);
});

test('face delay matches CharTalk eligibility (feature, Responsive ownership, simple chat, packet type)', async () => {
    const { rt, settings, timers, setResponsive } = await fixture({ responsive: true });
    const speech = await rt.load('src/features/expressions/char-talk.js');
    settings.setFeature('chatEmoticons', true);
    const send = (type, typed) => {
        const message = { Type: type, Content: typed, Dictionary: [] };
        rt.hooks.get('ChatRoomGenerateChatRoomChatMessage')([type, typed], () => message);
        const before = timers.length;
        rt.hooks.get('ServerSend')(['ChatRoomChat', message], () => {});
        assert.equal(timers.length, before + 1, `a face timer is scheduled for ${type} "${typed}"`);
        return timers.at(-1).ms;
    };

    settings.setFeature('autoMouthOnTalk', false);
    assert.equal(send('Chat', 'hello >.<'), 0, 'autoMouthOnTalk off: CharTalk will not animate, so no delay');

    settings.setFeature('autoMouthOnTalk', true);
    assert.equal(send('Chat', 'hello >.<'), speech.getSpeechDuration('hello >.<'));
    assert.ok(send('Chat', 'hello >.<') > 0);
    assert.equal(send('Chat', '(haha >.< )'), 0, 'OOC chat is skipped by CharTalk');
    assert.equal(send('Chat', '*waves >.< '), 0, 'action-style chat is skipped by CharTalk');
    assert.equal(send('Emote', 'hello >.<'), 0);
    assert.equal(send('Whisper', 'hello >.<'), 0);

    setResponsive({ mouth: true, expressions: false });
    assert.equal(send('Chat', 'hello >.<'), 0, 'Responsive owns the mouth: CharTalk is disabled');
    setResponsive({ mouth: false, expressions: false });
    assert.equal(send('Chat', 'hello >.<'), speech.getSpeechDuration('hello >.<'));

    rt.context.ChatRoomTargetMemberNumber = 5;
    assert.equal(send('Chat', 'hello >.<'), 0, 'targeted (whisper-mode) chat is skipped by CharTalk');
});

test('mouth delay timer is really cancelled on room leave, Responsive takeover and feature disable', async () => {
    const { rt, settings, events, timers, tick, setReady, setResponsive } = await fixture({ responsive: true });
    settings.setFeature('chatEmoticons', true);
    const send = () => {
        const message = { Type: 'Chat', Content: 'hello', Dictionary: [{ Original: '>.<' }] };
        rt.hooks.get('ServerSend')(['ChatRoomChat', message], () => {});
        return timers.at(-1);
    };

    let timer = send();
    assert.equal(timer.cancelled, undefined);
    rt.hooks.get('ChatRoomLeave')([], () => {});
    assert.equal(timer.cancelled, true, 'ChatRoomLeave cancels the pending timer');

    timer = send();
    setResponsive({ mouth: false, expressions: true });
    assert.equal(timer.cancelled, true, 'Responsive takeover cancels the pending timer');
    setResponsive({ mouth: false, expressions: false });

    timer = send();
    settings.setFeature('chatEmoticons', false);
    tick();
    assert.equal(timer.cancelled, true, 'disabling the feature cancels the pending timer');
    settings.setFeature('chatEmoticons', true);

    timer = send();
    setReady(false);
    tick();
    assert.equal(timer.cancelled, true, 'expression engine going away cancels the pending timer');
    setReady(true);

    // A newer message replaces the pending one instead of stacking timers.
    const first = send();
    const second = send();
    assert.equal(first.cancelled, true);
    assert.equal(second.cancelled, undefined);

    // Defence in depth: a stale callback still must not animate outside the chat room.
    rt.context.CurrentScreen = 'Main';
    second.fn();
    assert.equal(events.length, 0);
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

test('all three pet suits require both native arm poses before animating', async () => {
    const { rt, settings, module, player, events } = await fixture();
    settings.setFeature('petsuitAnimation', true);
    for (const name of ['StrappedPetsuitArms', 'PawPaddedPetsuitArms', '宠物服上']) {
        player.Appearance[0].Asset.Name = name;
        const before = events.length;
        module.togglePetsuitAnimation();
        assert.equal(events.length, before + 1, name);
        module.stopPetsuitAnimation();
        rt.context.PoseCanChangeUnaided = (_, pose) => pose !== 'OverTheHead';
        module.togglePetsuitAnimation();
        assert.equal(events.length, before + 1, 'blocked arms must stay blocked');
        rt.context.PoseCanChangeUnaided = () => true;
    }
});

test('emoticonDuration and emoticonExpression share one slash-run rule', () => {
    // A stray single slash is neither a blush nor a longer hold time.
    for (const text of ['xD/foo', 'xD/', '>/<', 'a//b']) {
        assert.equal(emoticonDuration(text), 5000, text);
    }
    assert.deepEqual(emoticonExpression('xD/foo'), {});
    assert.equal(emoticonExpression('xD//').Blush, 'Low');
    assert.equal(emoticonDuration('>//////////<'), 10000);
    assert.equal(emoticonExpression('>//////////<').Blush, 'Extreme');
});

test('getSpeechDuration reuses the CharTalk animation builder', async () => {
    const { rt } = await fixture();
    const speech = await rt.load('src/features/expressions/char-talk.js');
    const total = list => list.reduce((sum, [, ms]) => sum + ms, 0);
    for (const text of ['hello world', '你好嗎', 'a'.repeat(300), '...']) {
        assert.equal(speech.getSpeechDuration(text), total(speech.buildSpeechAnimation(text)), text);
    }
    assert.equal(speech.getSpeechDuration('hello'), 600, 'Latin: "hel" (e) 300 + "lo" (o) 300');
    assert.equal(speech.getSpeechDuration('你好嗎'), 1000, 'CJK: one frame per character, alternating Open/HalfOpen');
    assert.equal(speech.buildSpeechAnimation('a'.repeat(300)).length, 30, 'frame cap');
    assert.equal(speech.getSpeechDuration('a'.repeat(300)), 30 * 400);
    assert.equal(speech.getSpeechDuration(''), 0);
    assert.equal(speech.getSpeechDuration(undefined), 0);
    assert.equal(speech.getSpeechDuration(42), 0);
});

test('isSimpleChat matches what CharTalk animates', async () => {
    const { rt } = await fixture();
    const { isSimpleChat } = await rt.load('src/features/expressions/char-talk.js');
    for (const ok of ['hello', 'hello >.<', '你好']) assert.equal(isSimpleChat(ok), true, ok);
    for (const no of ['', '   ', '(haha >.<)', '/me waves', '*waves', '!cmd', '.x', '@x', 'http://x']) assert.equal(isSimpleChat(no), false, no);
    assert.equal(isSimpleChat(undefined), false);
});

test('all new settings and buttons have all seven LCE translations', () => {
    const keys = ['echoMouthPull', 'chatEmoticons', 'richerActivitySounds',
        'petsuitAnimation', 'petsuitAnimationCycles', 'petsuitAnimationDelay', 'petsuitAnimationPosition', 'petsuitAlternate'];
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

test('Petsuit sends one Hidden message, throttles network poses, and remote clients render locally', async () => {
    const sent = [], refreshed = [];
    const { rt, settings, module, player, events } = await fixture();
    Object.assign(rt.context, { ServerSend: (...a) => sent.push(a), CharacterRefresh: (...a) => refreshed.push(a), ChatRoomCharacter: [] });
    player.MemberNumber = 1;
    settings.setFeature('petsuitAnimation', true);
    settings.setFeature('petsuitAnimationDelay', 100);
    settings.setFeature('petsuitAnimationCycles', 4);
    module.togglePetsuitAnimation();
    const hidden = sent.filter(([k, d]) => k === 'ChatRoomChat' && d.Type === 'Hidden');
    assert.equal(hidden.length, 1);
    assert.equal(JSON.stringify(hidden[0][1].Dictionary[0].message), JSON.stringify({ type: 'Start', delay: 100, cycles: 4, alternate: true }));
    assert.equal(events[0].Duration, 800);
    assert.ok(events[0].Poses.every(p => p.Duration >= 350), 'network pose steps are throttled');

    const other = { MemberNumber: 2, Appearance: [{ Asset: { Name: 'Petsuit' } }] };
    rt.context.ChatRoomCharacter.push(other);
    const msg = (message, Sender = 2) => ({ Type: 'Hidden', Content: 'LCEPetsuit', Sender, Dictionary: [{ message }] });
    module.onPetsuitMessage(msg({ type: 'Start', delay: 5, cycles: 999, alternate: true }));
    assert.ok(refreshed.some(([c]) => c === other), 'receiver redraws locally');
    module.onPetsuitMessage(msg({ type: 'Start', delay: 100, cycles: 2, alternate: true }, 3));
    module.onPetsuitMessage(msg({ type: 'Stop' }));
    assert.equal(refreshed.filter(([c]) => c === other).length, 2);
});

test('receiver follows the sender alternate flag, regardless of its own settings', async () => {
    const refreshed = [];
    const { rt, settings, module } = await fixture();
    Object.assign(rt.context, { CharacterRefresh: (...a) => refreshed.push(a), ChatRoomCharacter: [] });
    rt.context.ChatRoomCharacter.push({ MemberNumber: 2, Appearance: [{ Asset: { Name: 'Petsuit' } }] });
    const msg = alternate => ({ Type: 'Hidden', Content: 'LCEPetsuit', Sender: 2,
        Dictionary: [{ message: { type: 'Start', delay: 100, cycles: 2, alternate } }] });
    settings.setFeature('petsuitAnimation', false);
    settings.setFeature('petsuitAlternate', false);
    module.onPetsuitMessage(msg(true));
    assert.equal(refreshed.length, 1, 'sender enabled -> alternating even if receiver has everything off');
    settings.setFeature('petsuitAlternate', true);
    module.onPetsuitMessage(msg(false));
    assert.equal(refreshed.length, 2, 'sender disabled -> render cleared, ordinary swing');
});

test('temporary faces share one expression cache: first original wins, cleared at the last release, final values synced once', async () => {
    const { rt, settings, module, player, settled, timers } = await fixture();
    const cache = await rt.load('src/features/expressions/face-cache.js');
    player.Appearance.push(...['Eyes', 'Eyes2'].map(Name => ({ Asset: { Name, Group: { Name } }, Property: { Expression: 'Closed' } })));
    settings.setFeature('petsuitAnimation', true);
    settings.setFeature('chatEmoticons', true);
    assert.equal(cache.FaceCache.isEmpty(), true);
    module.togglePetsuitAnimation();
    assert.equal(cache.FaceCache.get().original.Eyes, 'Closed');
    player.Appearance.forEach(i => { if (i.Property) i.Property.Expression = 'Daydream'; });   // engine applied the temporary face
    const message = { Type: 'Chat', Content: 'x', Dictionary: [] };
    rt.hooks.get('ChatRoomGenerateChatRoomChatMessage')(['Chat', '>.<'], () => message);
    rt.hooks.get('ServerSend')(['ChatRoomChat', message], () => {});
    timers.at(-1).fn(); // trigger delay timer
    assert.equal(cache.FaceCache.get().original.Eyes, 'Closed', 'already cached: not overwritten by the temporary face');
    module.togglePetsuitAnimation();   // stop: the emoticon still holds the face
    assert.equal(cache.FaceCache.isEmpty(), false);
    assert.equal(settled.length, 0);
    timers.filter(t => t.ms === 5000).at(-1).fn();   // emoticon ends = last release
    assert.equal(cache.FaceCache.isEmpty(), true);
    const settle = timers.at(-1);
    assert.equal(settle.ms, 300, 'final sync waits one engine tick');
    rt.context.CurrentScreen = 'ChatRoom';
    settle.fn();
    assert.equal(settled.length, 1);
    assert.ok(['Eyes', 'Eyes2'].every(g => settled[0].includes(g)));
});
