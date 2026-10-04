import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';

test('mouth pulling relaxes only hands, retains Echo conditions and MISC pairing', async () => {
    let blocked = false, occupied = false;
    const player = { MemberNumber: 1, AssetFamily: 'Female3DCG', Appearance: [],
        CanInteract: () => false, IsMouthBlocked: () => blocked };
    const target = { MemberNumber: 2 };
    const messages = [];
    const rt = runtime({ globals: {
        Player: player, ChatRoomCharacter: [player, target],
        InventoryGet: (c, g) => c === target ? { Asset: { Name: 'CollarLeash' } }
            : occupied && g === 'ItemMisc' ? { Asset: { Name: occupied === 'pair' ? '拉紧的牵绳' : 'Other' } } : null,
        AssetGet: () => ({}), InventoryGroupIsBlocked: () => false,
        CharacterNickname: c => String(c.MemberNumber),
    }, mocks: { 'src/core/i18n-engine.js': {} } });
    let translations;
    rt.window.Liko = { __Sys_L10N__: { register: (_, table) => { translations = table; }, install() {}, send: (...args) => messages.push(args) } };
    const settings = await rt.load('src/core/feature-settings.js');
    assert.equal(settings.getFeature('echoMouthPull'), true, 'enabled by default');
    settings.setFeature('echoMouthPull', true);
    const feature = await rt.load('src/features/echo-mouth-pull.js');
    feature.installEchoMouthPull();
    assert.deepEqual(Object.keys(translations.echoMouthPull).sort(), ['CN', 'DE', 'EN', 'FR', 'RU', 'TW', 'UA']);
    const custom = () => false;
    const activity = { Name: '拉到身边', Prerequisite: ['UseHands', 'Luzi_TargetLeashedOrCanBeLeashed', custom] };
    const args = [activity, player, target, {}];
    const check = rt.hooks.get('ActivityCheckPrerequisites');
    check(args, ([copy]) => {
        assert.notEqual(copy, activity);
        assert.deepEqual([...copy.Prerequisite], ['Luzi_TargetLeashedOrCanBeLeashed', custom]);
    });
    assert.equal(activity.Prerequisite[0], 'UseHands');
    assert.equal(check(args, ([copy]) => copy.Prerequisite.every(pre => typeof pre !== 'function' || pre())), false,
        'a failing Echo custom prerequisite must still reject the activity');
    const unrelated = { Name: 'Other', Prerequisite: activity.Prerequisite };
    check([unrelated, player, target, {}], ([copy]) => assert.equal(copy, unrelated));
    player.Appearance.push({ Asset: { Name: '拉紧的牵绳', Group: { Name: 'ItemHandheld' } } });
    check(args, ([copy]) => assert.equal(copy, activity, 'do not reuse a handheld pair for mouth pulling'));
    player.Appearance.length = 0;
    occupied = 'pair';
    check(args, ([copy]) => assert.equal(copy, activity, 'even a matching pair occupies MISC'));
    occupied = false;
    for (const condition of ['mouth', 'misc', 'off']) {
        blocked = condition === 'mouth'; occupied = condition === 'misc';
        settings.setFeature('echoMouthPull', condition !== 'off');
        check(args, ([copy]) => assert.equal(copy, activity));
    }
    blocked = false; occupied = false; settings.setFeature('echoMouthPull', true);
    const packet = { Type: 'Activity', Dictionary: [
        { ActivityName: '拉到身边' }, { Tag: 'TargetCharacter', MemberNumber: 2 },
    ] };
    rt.hooks.get('ServerSend')(['ChatRoomChat', packet], ([, sent]) => assert.equal(sent, packet));
    assert.deepEqual(messages, [['LCE', 'echoMouthPull', '1', '2']]);
});

test('mouth action uses English fallback on the wire and localizes in all seven languages', async () => {
    const sent = [];
    const rt = runtime({ globals: { ServerSend: (...args) => sent.push(args) } });
    rt.window.Liko = { __Sys_Flags__: {} };
    const feature = await rt.load('src/features/echo-mouth-pull.js');
    feature.installEchoMouthPull();
    const l10n = rt.window.Liko.__Sys_L10N__;
    l10n.send('LCE', 'echoMouthPull', 'Alice', 'Bob');
    assert.equal(sent.length, 1);
    const data = sent[0][1];
    assert.equal(data.Type, 'Action');
    assert.match(data.Dictionary[0].Text, /^Alice takes the leash/);
    const unique = new Set();
    for (const lang of ['TW', 'CN', 'EN', 'DE', 'FR', 'RU', 'UA']) {
        rt.storage.set('BondageClubLanguage', lang);
        const copy = structuredClone(data);
        assert.equal(l10n.localize(copy), true);
        assert.ok(copy.Dictionary[0].Text.includes('Alice') && copy.Dictionary[0].Text.includes('Bob'));
        assert.ok(!/\{\d\}/.test(copy.Dictionary[0].Text));
        unique.add(copy.Dictionary[0].Text);
    }
    assert.equal(unique.size, 7);
});
