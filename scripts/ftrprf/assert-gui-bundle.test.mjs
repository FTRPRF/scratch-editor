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

const run = parts => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assert-gui-bundle-'));
    const file = path.join(dir, 'scratch-gui.js');
    fs.writeFileSync(file, Object.values(parts).join('\n'));
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
