import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { runtime } from './helpers/runtime.mjs';

const nativeSource = fs.readFileSync(new URL('./fixtures/r132-runtime.txt', import.meta.url), 'utf8');

async function wardrobeRuntime() {
    const screens = [], player = { MemberNumber: 1, IsPlayer: () => true };
    const wardrobeState = { selectedCharacter: null, excludeBodyparts: true };
    const rt = runtime({ globals: { Player: player, Wardrobe: wardrobeState, CurrentScreen: 'Appearance',
        CommonPromiseCatch: p => p, CommonGetScreen: () => ['Character', 'Appearance'],
        CommonSetScreen: (...args) => { screens.push(args); }, WardrobeSaveSelectedOutfit() {},
    } });
    vm.runInContext(nativeSource, rt.context);
    const settings = await rt.load('src/core/feature-settings.js');
    settings.setFeature('privateWardrobe', true); settings.setFeature('confirmWardrobeSave', true);
    const mod = await rt.load('src/features/wardrobe/index.js'); mod.installWardrobe();
    return { rt, player, wardrobeState, screens };
}

test('R132 wardrobe entry initializes actual native target and return screen', async () => {
    const { rt, player, wardrobeState, screens } = await wardrobeRuntime();
    for (const target of [player, { MemberNumber: 2, IsPlayer: () => false }]) {
        rt.hooks.get('CharacterAppearanceWardrobeLoad')([target], args => rt.context.CharacterAppearanceWardrobeLoad(...args));
        assert.equal(wardrobeState.selectedCharacter, target);
        assert.deepEqual(wardrobeState.returnScreen, ['Character', 'Appearance']);
    }
    assert.deepEqual(screens, [['Character', 'Wardrobe'], ['Character', 'Wardrobe']]);
});

test('R132 DOM controls, body options, previews and exit remain owned by BC', async () => {
    const { rt, player, wardrobeState } = await wardrobeRuntime();
    for (const name of ['AppearanceRun', 'AppearanceClick', 'WardrobeRun', 'WardrobeClick', 'WardrobeExit', 'WardrobeLoad']) {
        let calls = 0;
        assert.equal(rt.hooks.get(name)([], () => { calls++; return 'native'; }), 'native');
        assert.equal(calls, 1); assert.equal(rt.context.Player, player);
    }
    const preview = { MemberNumber: -1, IsPlayer: () => false };
    const options = { ExcludeBodyparts: true, BodyCharacter: player, ExpressionSource: player };
    const args = [preview, 25, false, options];
    rt.hooks.get('WardrobeFastLoad')(args, values => {
        assert.equal(values, args); assert.equal(values[3], options);
    });
    assert.equal(wardrobeState.excludeBodyparts, true);
    rt.document.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() { throw Error('native Escape intercepted'); } });
});

test('native save confirms once; direct overwrite still confirms, including after exceptions', async () => {
    const { rt, player } = await wardrobeRuntime();
    player.Wardrobe = [[{ Group: 'Pronouns' }]];
    let prompts = 0, writes = 0;
    rt.window.confirm = () => { prompts++; return false; };
    const save = () => rt.hooks.get('WardrobeFastSave')([player, 0], () => { writes++; });
    rt.hooks.get('WardrobeSaveSelectedOutfit')([], save);
    assert.equal(prompts, 0); assert.equal(writes, 1);
    save(); assert.equal(prompts, 1); assert.equal(writes, 1);
    assert.throws(() => rt.hooks.get('WardrobeSaveSelectedOutfit')([], () => { throw Error('save failure'); }));
    save(); assert.equal(prompts, 2); assert.equal(writes, 1);
});

test('actual native DOM save cancel does not save or rename; acceptance asks only once', async () => {
    const { rt, player, wardrobeState } = await wardrobeRuntime();
    wardrobeState.selectedCharacter = player; player.Wardrobe = [[{ Group: 'Pronouns' }]];
    let answer = false, prompts = 0, writes = 0, renames = 0;
    rt.window.confirm = () => { throw Error('unexpected second confirmation'); };
    Object.assign(rt.context, { WardrobeSelection: 0,
        WardrobeSetActionPreview() {}, WardrobeGetSidePreviewCharacter: () => null,
        TextGet: x => x, confirm: () => { prompts++; return answer; },
        WardrobeFastSave: (...args) => rt.hooks.get('WardrobeFastSave')(args, () => { writes++; }),
        WardrobeRenameSelectedOutfit: () => { renames++; return true; },
        WardrobePushAll() {}, WardrobeUpdateElements() {},
    });
    const call = () => rt.hooks.get('WardrobeSaveSelectedOutfit')([], () => rt.context.WardrobeSaveSelectedOutfit());
    call(); assert.equal(prompts, 1); assert.equal(writes, 0); assert.equal(renames, 0);
    answer = true; call(); assert.equal(prompts, 2); assert.equal(writes, 1); assert.equal(renames, 1);
    assert.equal(wardrobeState.previewLocked, false);
});

test('extended wardrobe keeps extra slots separate and native first 24 intact', async () => {
    const { rt, player } = await wardrobeRuntime();
    player.ExtensionSettings = {};
    player.Wardrobe = Array.from({ length: 96 }, (_, i) => [{ Group: 'Cloth', Name: String(i) }]);
    Object.assign(rt.context, { WardrobeSize: 24, WardrobeFixLength() {},
        LZString: { compressToUTF16: s => s, decompressFromUTF16: s => s },
        CommonIsObject: x => !!x && typeof x === 'object', ServerPlayerExtensionSettingsSync() {},
    });
    player.ExtensionSettings.FBCWardrobe = JSON.stringify(player.Wardrobe.slice(24));
    const settings = await rt.load('src/core/feature-settings.js'); settings.setFeature('extendedWardrobe', true);
    const mod = await rt.load('src/features/wardrobe/index.js'); await mod.loadExtendedWardrobe(player.Wardrobe);
    rt.hooks.get('CharacterCompressWardrobe')([player.Wardrobe], ([first]) => {
        assert.equal(first.length, 24); assert.equal(first[23][0].Name, '23');
    });
    assert.equal(JSON.parse(player.ExtensionSettings.FBCWardrobe).length, 72);
    assert.equal(player.Wardrobe[95][0].Name, '95');
});

test('WCE expression reset fix and native Beta3 struggle tolerate an absent queue', async () => {
    const player = { MemberNumber: 1, ExpressionQueue: [{ Time: 5000 }], OnlineSharedSettings: { ItemsAffectExpressions: true } };
    const rt = runtime({ globals: { Player: player, CurrentScreen: 'Login', StruggleProgressStruggleCount: 1,
        StruggleProgressCurrentMinigame: 'Strength', CharacterSetFacialExpression() {}, addEventListener() {},
    }, append: { 'src/features/expressions/index.js': 'export const testReset = () => resetExpressionQueue([MANUAL_EVT]);' } });
    vm.runInContext(nativeSource, rt.context);
    const mod = await rt.load('src/features/expressions/index.js'); mod.installExpressions();
    mod.testReset(); assert.ok(Array.isArray(player.ExpressionQueue)); assert.equal(player.ExpressionQueue.length, 0);
    delete player.ExpressionQueue;
    const call = () => rt.hooks.get('StruggleMinigameHandleExpression')([false], args => rt.context.StruggleMinigameHandleExpression(...args));
    call(); assert.ok(Array.isArray(player.ExpressionQueue));
    const events = [{ Time: 5000 }]; player.ExpressionQueue = events;
    call(); assert.equal(player.ExpressionQueue, events); assert.equal(events[0].Time, 4000);
});

test('AppearanceRun theme patch targets match and remain syntactically valid on native R132', () => {
    const source = fs.readFileSync('src/features/theme/index.js', 'utf8');
    const patches = new Map();
    vm.runInNewContext(source.slice(source.indexOf('function installPatches()')) + '\ninstallPatches();', {
        patched: false, console, patch: (name, rules) => patches.set(name, rules),
    });
    const native = vm.createContext({}); vm.runInContext(nativeSource, native);
    let body = native.AppearanceRun.toString();
    for (const [target, replacement] of Object.entries(patches.get('AppearanceRun'))) {
        assert.ok(body.includes(target), target); body = body.replaceAll(target, replacement);
    }
    assert.doesNotThrow(() => new vm.Script('(' + body + ')'));
});
