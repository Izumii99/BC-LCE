import assert from 'node:assert/strict';
import { runtime } from './runtime.mjs';

export async function themedButtonRuntime(getImage) {
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
    return { images, settings, draw, original };
}
