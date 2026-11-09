import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assert-gui-bundle.mjs');

const PARTS = {
    svgFilters: 'x({USE_PROFILES:{svg:!0,svgFilters:!0}});',
    onBeforeBlocksInject: 'a.onBeforeBlocksInject;',
    onBlocksReady: 'a.onBlocksReady;',
    onWorkspaceLoaded: 'a.onWorkspaceLoaded;',
    filterToolboxXml: 'a.filterToolboxXml;'
};

const VLQ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const vlq = n => {
    let v = n < 0 ? ((-n) << 1) | 1 : n << 1;
    let out = '';
    do {
        let digit = v & 31;
        v >>>= 5;
        if (v) digit |= 32;
        out += VLQ[digit];
    } while (v);
    return out;
};
// `lines` lines of `perLine` 4-field segments, hopping across `sources` sources.
const mappingsFor = (lines, perLine, sources) => {
    const rows = [];
    let src = 0;
    for (let l = 0; l < lines; l++) {
        const segs = [];
        for (let i = 0; i < perLine; i++) {
            const next = (src + 1) % sources;
            segs.push(vlq(i ? 2 : 0) + vlq(next - src) + vlq(1) + vlq(1));
            src = next;
        }
        rows.push(segs.join(','));
    }
    return rows.join(';');
};
const realMap = () => JSON.stringify({version: 3, sources: [], mappings: mappingsFor(2000, 100, 1000)});
const stubMap = () => JSON.stringify({
    version: 3,
    sources: Array.from({length: 1988}, (_, i) => `src/${i}.js`),
    sourcesContent: Array.from({length: 1988}, () => 'x'.repeat(10000)),
    mappings: 'AAAA'
});

const run = (parts, map = realMap()) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assert-gui-bundle-'));
    const file = path.join(dir, 'scratch-gui.js');
    fs.writeFileSync(file, Object.values(parts).join('\n'));
    if (map !== null) fs.writeFileSync(`${file}.map`, map);
    try {
        return spawnSync(process.execPath, [script, file], {encoding: 'utf8'});
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
};

test('passes when every marker is present', () => {
    assert.equal(run(PARTS).status, 0);
});

test('accepts the unminified svgFilters form', () => {
    const parts = {...PARTS, svgFilters: 'USE_PROFILES: { svg: true, svgFilters: true }'};
    assert.equal(run(parts).status, 0);
});

test('accepts svgFilters in reversed order and alongside other keys', () => {
    for (const svgFilters of [
        'x({USE_PROFILES:{svgFilters:!0,svg:!0}});',
        'x({USE_PROFILES:{svg:!0,html:!0,svgFilters:!0,mathMl:!0}});'
    ]) {
        assert.equal(run({...PARTS, svgFilters}).status, 0, svgFilters);
    }
});

test('rejects svgFilters that is not enabled', () => {
    const result = run({...PARTS, svgFilters: 'x({USE_PROFILES:{svg:!0,svgFilters:!1}});'});
    assert.equal(result.status, 1);
});

for (const marker of Object.keys(PARTS)) {
    test(`fails naming ${marker} when it is missing`, () => {
        const {[marker]: _omitted, ...rest} = PARTS;
        const result = run(rest);
        assert.equal(result.status, 1);
        assert.match(result.stderr, new RegExp(`missing marker: ${marker}`));
    });
}

test('fails on a missing file and on no argument', () => {
    assert.equal(spawnSync(process.execPath, [script, '/nonexistent/scratch-gui.js']).status, 1);
    assert.equal(spawnSync(process.execPath, [script]).status, 1);
});

test('passes on a real source map and reports its counts', () => {
    const result = run(PARTS);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /200000 mapping segments across 1000 sources/);
});

test('fails on a stub map that is large only because of sourcesContent', () => {
    const map = stubMap();
    assert.ok(map.length > 10 * 1024 * 1024);
    const result = run(PARTS, map);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /looks like a stub: 1 mapping segments/);
});

test('fails on a map with many segments but few sources', () => {
    const result = run(PARTS, JSON.stringify({mappings: mappingsFor(2000, 100, 3)}));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /across 3 sources/);
});

test('fails on a missing, non-JSON or mapping-less map', () => {
    assert.match(run(PARTS, null).stderr, /cannot read source map/);
    assert.match(run(PARTS, 'nope').stderr, /not valid JSON/);
    assert.match(run(PARTS, '{}').stderr, /no mappings string/);
    assert.equal(run(PARTS, '{}').status, 1);
});
