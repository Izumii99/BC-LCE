import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './helpers/runtime.mjs';

function canvas() {
    const result = { width: 500, height: 1000, halves: [] };
    result.getContext = () => ({
        clearRect() { result.halves = []; },
        drawImage(source, ...rect) {
            if (rect.length === 2) result.halves = [...source.halves];
            else result.halves[rect[4] / 250] = source.halves[rect[0] / 250];
        },
    });
    return result;
}

test('alternating arms compose both normal and blink canvases and restore draw state', async () => {
    const rt = runtime({ globals: {
        CharacterAppearanceSortLayers: c => [c.DrawPoseMapping.BodyUpper],
        CharacterAppearanceBuildMasks: c => [c.DrawPoseMapping.BodyUpper],
    } });
    rt.document.createElement = canvas;
    const { drawAlternatingPetsuit } = await rt.load('src/features/petsuit-render.js');
    const c = { DrawPoseMapping: { BodyUpper: 'BackElbowTouch', BodyLower: 'Kneel' },
        AppearanceLayers: [], AppearanceMasks: [], Canvas: canvas(), CanvasBlink: canvas() };
    const original = { ...c };
    const draw = () => {
        assert.equal(c.DrawPoseMapping.BodyLower, 'Kneel');
        const pose = c.DrawPoseMapping.BodyUpper;
        c.Canvas.halves = [pose, pose];
        c.CanvasBlink.halves = [pose + '-blink', pose + '-blink'];
    };
    for (const left of [true, false]) {
        drawAlternatingPetsuit(c, left, draw);
        const expected = left ? ['OverTheHead', 'BackElbowTouch'] : ['BackElbowTouch', 'OverTheHead'];
        assert.deepEqual(c.Canvas.halves, expected);
        assert.deepEqual(c.CanvasBlink.halves, expected.map(p => p + '-blink'));
        for (const key of ['DrawPoseMapping', 'AppearanceLayers', 'AppearanceMasks']) assert.equal(c[key], original[key]);
    }
    assert.throws(() => drawAlternatingPetsuit(c, true, () => { throw Error('render failed'); }));
    assert.equal(c.DrawPoseMapping, original.DrawPoseMapping);
    assert.equal(c.AppearanceLayers, original.AppearanceLayers);
    draw();
    assert.deepEqual(c.Canvas.halves, ['BackElbowTouch', 'BackElbowTouch']);
});
