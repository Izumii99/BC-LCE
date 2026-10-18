import test from 'node:test';
import assert from 'node:assert/strict';
import { themedButtonRuntime } from './helpers/themed-button.mjs';

test('themed buttons keep icons at their original inset while fitting oversized images', async () => {
    const { images, settings, draw, original } = await themedButtonRuntime(() => ({ complete: true, width: 100, height: 100 }));
    // BCX-style wide menu, square toolbar, and tall button: neither axis may move.
    for (const [w, h] of [[400, 90], [65, 65], [65, 100]]) {
        draw([100, 200, w, h, 'Menu', 'White', 'icon.png'], original);
        const size = Math.min(w, h) - 4;
        assert.deepEqual(images.pop(), ['icon.png', 102, 202, size, size]);
    }
    draw([100, 200, 400, 90, 'Menu', 'White', ''], original);
    assert.equal(images.length, 0);
    settings.setFeature('themeEnabled', false);
    const args = [100, 200, 400, 90, 'Menu', 'White', 'icon.png'];
    let forwarded;
    draw(args, values => { forwarded = values; });
    assert.equal(forwarded, args);
    assert.equal(images.length, 0);
});
