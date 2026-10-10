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
    const mod = await rt.load('src/features/wardrobe/index.js'); mod.installWardrobe();
    return { rt, player, wardrobeState, screens };
}



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
