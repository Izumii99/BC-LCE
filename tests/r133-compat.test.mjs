import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';

// R133 changed DrawGetImage: it now returns an ImageBitmap (which has no
// `.complete`) or `undefined` while the image is still loading. R132 returned an
// <img> whose `.complete` is false until loaded. The themed button must draw its
// icon on every "loaded" shape and silently skip every "not loaded" shape.
async function themedDraw(getImage) {
    const images = [];
    const rt = runtime({
        globals: {
            DrawRect() {}, DrawEmptyRect() {}, DrawTextFit() {},
            MouseHovering: () => false,
            DrawGetImage: getImage,
            RectMakeRect: (...frame) => frame,
            DrawingResizeMode: { ShowFullOriginalRatio: 1 },
            RectFitIntoRect: (source, target) => {
                const scale = Math.min(target[2] / source[2], target[3] / source[3]);
                const w = source[2] * scale, h = source[3] * scale;
                return [source, [target[0] + (target[2] - w) / 2, target[1] + (target[3] - h) / 2, w, h]];
            },
            DrawImageResize: (...args) => images.push(args),
        },
        mocks: { 'src/features/theme/theme-colors.js': {
            plainColors: { main: '#222222', accent: '#777777', text: '#eeeeee' },
            specialColors: {}, composeColors() {}, composeRootCss: () => '',
            getHexComputed: v => v, lighten: v => v, darken: v => v, isDark: () => true,
        } },
    });
    const settings = await rt.load('src/core/feature-settings.js');
    settings.initGlobalFeatures();
    const theme = await rt.load('src/features/theme/index.js');
    theme.installThemeEngine();
    settings.setFeature('themeEnabled', true);
    const draw = rt.hooks.get('DrawButton');
    const original = () => assert.fail('Active theme should draw the button');
    return { images, run: () => draw([100, 200, 65, 65, 'Menu', 'White', 'icon.png'], original) };
}

test('themed buttons draw icons when DrawGetImage returns an R133 ImageBitmap (no .complete)', async () => {
    const { images, run } = await themedDraw(() => ({ width: 100, height: 100 }));
    run();
    assert.deepEqual(images, [['icon.png', 102, 202, 61, 61]]);
});

test('themed buttons skip the icon without throwing while R133 DrawGetImage returns undefined', async () => {
    const { images, run } = await themedDraw(() => undefined);
    assert.doesNotThrow(run);
    assert.equal(images.length, 0);
});

test('themed buttons still skip a not-yet-loaded R132 <img>', async () => {
    const { images, run } = await themedDraw(() => ({ complete: false, width: 0, height: 0 }));
    assert.doesNotThrow(run);
    assert.equal(images.length, 0);
});

test('R133 moved expression and activity icons under Icons/ but they must stay uncolored', async () => {
    const policy = await runtime().load('src/features/theme/image-policy.js');
    for (const path of ['Icons/Expressions/Eyes/Default.png', './Icons/Activity/Kiss.png', 'Assets/Female3DCG/Activity/Kiss.png']) {
        assert.equal(policy.doColorizeImage(path), false, path);
        assert.equal(policy.doColorizeHTMLImage(path), false, path);
    }
    // plain UI icons keep being themed
    assert.equal(policy.doColorizeImage('Icons/Range/1.png'), true);
});
