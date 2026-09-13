import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('bundle report compares raw/gzip and ignores sourcemaps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lce-size-'));
    try {
        writeFileSync(join(dir, 'app.js'), 'hello');
        writeFileSync(join(dir, 'app.js.map'), 'ignored');
        const env = {...process.env}; delete env.GITHUB_STEP_SUMMARY;
        const report = execFileSync(process.execPath, ['scripts/bundle-size.mjs', dir, dir], {encoding: 'utf8', env});
        assert.match(report, /\| raw \| 5 \| 5 \| \+0 \(0.00%\)/);
        assert.match(report, /\| gzip \|/);
    } finally { rmSync(dir, {recursive: true}); }
});
