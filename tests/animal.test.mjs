import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';

function makeItem(name, extra = {}) {
    return { Asset: { Name: name, Group: { Name: 'HairAccessory2' } }, Color: 'Default', ...extra };
}

async function animalRuntime({ player: playerOverride, sent, updates } = {}) {
    const timers = [];
    const refreshes = [];
    const remote = { MemberNumber: 7, Appearance: [makeItem('Orig', { Property: { Keep: 1 } })] };
    const player = playerOverride ?? { MemberNumber: 1, Appearance: [] };
    const rt = runtime({ append: { 'src/features/animal-animations.js': 'export { triggerAnimation };' }, globals: {
        Player: player, CurrentScreen: 'ChatRoom', ServerSend: (...a) => sent?.push(a), ChatRoomData: {}, ChatRoomCharacterItemUpdate: (c, g) => updates?.push([c.MemberNumber, g]), ChatRoomCharacter: [player, remote],
        setTimeout: fn => timers.push(fn),
        AssetGet: (_g, _slot, name) => (['A', 'B', 'Orig'].includes(name) ? { Name: name } : null),
        CharacterRefresh: c => refreshes.push(c.MemberNumber),
        InventoryWear: (char, name, slot, color) => {
            const item = makeItem(name, { Color: color });
            char.Appearance = char.Appearance.filter(i => i.Asset.Group.Name !== slot).concat(item);
            return item;
        },
    } });
    const settings = await rt.load('src/core/feature-settings.js');
    settings.setFeature('animalEars', true);
    rt.settings = settings;
    const mod = await rt.load('src/features/animal-animations.js');
    const run = () => { while (timers.length) timers.shift()(); };
    return { rt, mod, remote, player, timers, refreshes, run };
}

const packet = (state1, state2, extra = {}) => ({
    Type: 'Hidden', Sender: 7, Content: 'LCEAnimalAnim_Ears',
    Dictionary: [{ type: 'Ears', state1, state2, delay: 200, cycles: 2, ...extra }],
});

test('remote animation keeps ordinary object properties and appearance extension fields', async () => {
    const { mod, remote, timers, run } = await animalRuntime();
    mod.onAnimalMessage(packet(
        { Name: 'A', Color: ['#fff'], Property: { Type: 'x', Nested: { a: [1, 2] } }, Rotate: 15, Layer: { Top: 1 }, Bogus: 1 },
        { Name: 'B', Property: { Type: 'y' }, Craft: { Name: 'n' }, Difficulty: 2 }));
    // 第一個畫面是 state2（B）、第二個才是 state1（A）
    assert.equal(remote.Appearance[0].Asset.Name, 'B');
    assert.deepEqual(remote.Appearance[0].Craft, { Name: 'n' });
    assert.equal(remote.Appearance[0].Difficulty, 2);
    timers.shift()();
    const item = remote.Appearance[0];
    assert.equal(item.Asset.Name, 'A');
    assert.deepEqual(item.Property.Nested, { a: [1, 2] });
    assert.equal(item.Rotate, 15);
    assert.deepEqual(item.Layer, { Top: 1 });
    assert.equal('Bogus' in item, false, 'keys outside the whitelist are dropped');
    run();   // finish remaining cycles
    assert.equal(remote.Appearance[0].Asset.Name, 'A', 'playback ends on A (resting pose), not on the previous item');
    assert.equal(remote.Appearance[0].Rotate, 15);
    assert.equal('Keep' in remote.Appearance[0].Property, false, 'leftover properties of the previous item are cleaned');
});

test('own dangerous keys are rejected recursively without rejecting normal objects', async () => {
    const { rt } = await animalRuntime();
    const { sanitizeAnimalState } = await rt.load('src/core/animal-actions.js');
    const evil = JSON.parse('{"Name":"A","Property":{"x":{"__proto__":{"polluted":1}}}}');
    assert.equal('Property' in sanitizeAnimalState(evil), false);
    const evilTop = JSON.parse('{"Name":"A","Property":{"constructor":{"a":1}}}');
    assert.equal('Property' in sanitizeAnimalState(evilTop), false);
    assert.equal(JSON.stringify(sanitizeAnimalState({ Name: 'A', Property: { ok: { deep: true } } }).Property), '{"ok":{"deep":true}}');
    assert.equal('Property' in sanitizeAnimalState({ Name: 'A', Property: () => 1 }), false);
    assert.equal('Property' in sanitizeAnimalState({ Name: 'A', Property: { big: 'x'.repeat(1001) } }), false);
    assert.equal(({}).polluted, undefined);
});

test('cycles are capped at 20 in settings, sender clamp and receiver', async () => {
    const { rt, mod, remote, timers, refreshes, run } = await animalRuntime();
    const schema = await rt.load('src/core/settings-schema.js');
    const actions = await rt.load('src/core/animal-actions.js');
    for (const t of ['Ears', 'Tails', 'Wings']) assert.equal(schema.DEFAULT_FEATURE_SETTINGS[`animal${t}Cycles`].max, 20);
    assert.equal(actions.clampCycles(40), 20);
    assert.equal(actions.clampCycles(21 + 1), 20);
    assert.equal(actions.clampDelay(5), 100);
    mod.onAnimalMessage(packet({ Name: 'A' }, { Name: 'B' }, { cycles: 40 }));
    run();
    // 20 cycles = 40 frames, ending on A
    assert.equal(refreshes.filter(id => id === 7).length, 40);
    assert.equal(remote.Appearance[0].Asset.Name, 'A');
    assert.equal(timers.length, 0);
});

test('a user swap is never overwritten by restoring the old snapshot', async () => {
    const { mod, remote, timers, run } = await animalRuntime();
    mod.onAnimalMessage(packet({ Name: 'A' }, { Name: 'B' }, { cycles: 5 }));
    timers.shift()();
    remote.Appearance = [makeItem('UserPick')];       // user swapped the item
    globalThis.CurrentScreen = 'x';
    run();
    assert.equal(remote.Appearance[0].Asset.Name, 'UserPick');
});

test('leaving the screen freezes on A when the animation still owns the slot', async () => {
    const { rt, mod, remote, timers, run } = await animalRuntime();
    mod.onAnimalMessage(packet({ Name: 'A' }, { Name: 'B' }, { cycles: 5 }));
    rt.context.CurrentScreen = 'Online';
    run();
    assert.equal(remote.Appearance[0].Asset.Name, 'A');
});

test('uncloneable third-party fields do not break saving a pose', async () => {
    const { rt, player } = await animalRuntime();
    const { saveAnimalPose } = await rt.load('src/core/animal-actions.js');
    player.Appearance = [makeItem('A', { Property: { a: 1 }, Rotate: 3 })];
    player.Appearance[0].Layer = { fn() {} };         // structuredClone throws on functions
    const draft = {};
    assert.equal(saveAnimalPose('Ears', 1, draft), true);
    assert.equal(draft.animalEarsState1.Rotate, 3);
    assert.equal('Layer' in draft.animalEarsState1, false);
});

test('animal settings use three top tabs with one column each', async () => {
    const rt = runtime({ mocks: {
        'src/settings/pickers.js': { langFlag() {}, openLanguageDropdown() {}, openFontPicker() {}, promptInput() {}, openColorPicker() {} },
        'src/settings/storage-manager.js': { openStorageManager() {}, closeStorageManager() {}, isStorageManagerOpen: () => false, positionStorageManager() {} },
        'src/settings/trusted-domain-manager.js': { openTrustedDomainManager() {}, closeTrustedDomainManager() {}, isTrustedDomainManagerOpen: () => false, positionTrustedDomainManager() {} },
    }, append: { 'src/settings/settings-page.js': `
        export function testAnimal(section) { currentCategory = 'animal'; currentSection = section; return { sections: computeSections('animal').length, rows: settingLayouts(), labels: SECTION_LABELS.animal }; }
    ` } });
    const view = await rt.load('src/settings/settings-page.js');
    for (const [i, type] of ['Ears', 'Tails', 'Wings'].entries()) {
        const { sections, rows, labels } = view.testAnimal(i);
        assert.equal(sections, 3);
        assert.equal(rows.length, 7);
        assert.ok(rows.every(r => r.entry[0].startsWith(`animal${type}`)));
        assert.equal(new Set(rows.map(r => r.x)).size, 1);
        assert.equal(labels.length, 3);
    }
});

test('playback ignores whatever is currently equipped', async () => {
    const { mod, remote, timers, run } = await animalRuntime();
    remote.Appearance = [makeItem('Other')];
    mod.onAnimalMessage(packet({ Name: 'A' }, { Name: 'B' }, { cycles: 2 }));
    assert.equal(remote.Appearance[0].Asset.Name, 'B');
    run();
    assert.equal(remote.Appearance[0].Asset.Name, 'A');
    assert.equal(timers.length, 0);
});

test('automatic triggers do not put back an item the user took off', async () => {
    const sent = [];
    const player = { MemberNumber: 1, Appearance: [] };
    const { rt, mod } = await animalRuntime({ player, sent });
    rt.settings.updateSettings({ animalEarsState1: { Name: 'A' }, animalEarsState2: { Name: 'B' } });
    mod.triggerAnimation('Ears', { auto: true });
    assert.equal(sent.length, 0);
    assert.equal(player.Appearance.length, 0);
});


test('own animation sends one item update at the end only when the final state differs from the start', async () => {
    const sent = [], updates = [];
    const player = { MemberNumber: 1, Appearance: [makeItem('Other')] };
    const { rt, mod, run } = await animalRuntime({ player, sent, updates });
    rt.settings.updateSettings({ animalEarsState1: { Name: 'A' }, animalEarsState2: { Name: 'B' } });
    mod.triggerAnimation('Ears');
    assert.equal(sent.length, 1, 'one Hidden trigger packet');
    assert.equal(updates.length, 0, 'no per-frame update packets');
    run();
    assert.equal(player.Appearance[0].Asset.Name, 'A');
    assert.deepEqual(updates, [[1, 'HairAccessory2']], 'exactly one update at the end');

    // starting already on A: nothing to sync
    updates.length = 0;
    mod.triggerAnimation('Ears');
    run();
    assert.equal(player.Appearance[0].Asset.Name, 'A');
    assert.equal(updates.length, 0);
});

test('remote characters never send updates', async () => {
    const updates = [];
    const { mod, remote, run } = await animalRuntime({ updates });
    remote.Appearance = [makeItem('Other')];
    mod.onAnimalMessage(packet({ Name: 'A' }, { Name: 'B' }, { cycles: 1 }));
    run();
    assert.equal(updates.length, 0);
});

test('manual trigger (*wag* etc.) plays without equipment; random trigger needs equipment', async () => {
    const sent = [], updates = [];
    const player = { MemberNumber: 1, Appearance: [] };
    const { rt, mod, run } = await animalRuntime({ player, sent, updates });
    rt.settings.updateSettings({ animalEarsState1: { Name: 'A' }, animalEarsState2: { Name: 'B' } });
    mod.triggerAnimation('Ears', { auto: true });
    assert.equal(sent.length, 0);
    assert.equal(player.Appearance.length, 0);
    mod.triggerAnimation('Ears');
    assert.equal(sent.length, 1);
    assert.equal(player.Appearance[0].Asset.Name, 'B');
    run();
    assert.equal(player.Appearance[0].Asset.Name, 'A');
    assert.equal(updates.length, 1);
});
