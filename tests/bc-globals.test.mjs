import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 規則見 src/game/bc-state.js：讀 BC 全域一律用裸識別字（或 bc-state 的 helper），
// 不用 globalThis.X / window.X —— BC 的全域若是 let / const 宣告，globalThis.X 會讀到 undefined。
// 允許的例外：非 BC 本體的全域（其他插件注入的 API）與「只寫入」的畫面狀態變數。
const ALLOWED = new Set([
    'Liko', 'FUSAM', 'FBC_VERSION',                    // 其他插件／LCE 自己掛在 window 上的 API
    'MouseX', 'MouseY', 'GameAnimationFrameId',       // 只寫入，不讀取
    'Element', 'Node', 'URL', 'Blob', 'CSS', 'Image', 'Option', 'MouseEvent', 'KeyboardEvent', 'CustomEvent',
    'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'DOMParser', 'XMLSerializer',
]);

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : full.endsWith('.js') && entry.name !== 'modsdk.js' ? [full] : [];
    });
}

test('BC globals are read as bare identifiers, never through globalThis./window.', () => {
    const offenders = [];
    for (const file of walk('src')) {
        const code = fs.readFileSync(file, 'utf8').split('\n');
        code.forEach((line, i) => {
            if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
            for (const match of line.matchAll(/\b(?:globalThis|window)\.([A-Z][A-Za-z0-9_]*)\b/g)) {
                if (!ALLOWED.has(match[1]) && !/^HTML/.test(match[1])) offenders.push(`${file}:${i + 1} ${match[0]}`);
            }
        });
    }
    assert.deepEqual(offenders, [], 'use bare identifiers or src/game/bc-state.js helpers');
});
