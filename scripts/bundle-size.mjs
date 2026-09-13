import {readdirSync, readFileSync, appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
function measure(dir) {
    const files = readdirSync(dir).filter(name => name.endsWith('.js'));
    if (!files.length) throw Error(`No JS bundles in ${dir}`);
    return files.reduce((sum, name) => {
        const data = readFileSync(join(dir, name));
        sum.raw += data.length; sum.gzip += gzipSync(data).length;
        return sum;
    }, {raw: 0, gzip: 0});
}
const current = measure(process.argv[2] || 'dist/assets');
const base = process.argv[3] ? measure(process.argv[3]) : null;
const change = (now, before) => `${now - before >= 0 ? '+' : ''}${now - before} (${before ? ((now / before - 1) * 100).toFixed(2) : 'N/A'}%)`;
const report = ['### JavaScript bundle size (bytes)', '', '| Metric | Current | Base | Change |', '| --- | ---: | ---: | ---: |',
    ...['raw', 'gzip'].map(key => `| ${key} | ${current[key]} | ${base?.[key] ?? '—'} | ${base ? change(current[key], base[key]) : 'No PR base'} |`), ''].join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
