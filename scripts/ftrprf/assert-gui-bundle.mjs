#!/usr/bin/env node
// Build-time guard for the FTRPRF scratch-gui package.
//
// Usage: node scripts/ftrprf/assert-gui-bundle.mjs <distDir>
//
// Exits 1 unless the built dist contains the expected files AND the main
// bundle contains code that only @ftrprf/scratch-blocks has. The stock
// scratch-blocks has no `setHideAndDisplayStrings`, so its presence proves
// the fork was bundled rather than the upstream package.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Entries ending in `/` must be non-empty directories; the rest must be files.
// Filled in from the unmodified v12.7.1 build (see the TR-4805 task-3 notes).
export const REQUIRED_DIST = [
    'scratch-gui.js',
    'scratch-gui-standalone.js',
    'extension-worker.js',
    'libraries/backdrops.json',
    'libraries/costumes.json',
    'libraries/sounds.json',
    'libraries/sprites.json',
    'types/index.d.ts',
    'static/',
    'static/assets/',
    'static/blocks-media/',
    'chunks/'
];

export const BUNDLE_MARKER = 'setHideAndDisplayStrings';

// The SVG sanitizer must run with DOMPurify's svgFilters profile, or every
// <fe*> primitive is stripped from costumes on load (TR-4805). The sanitizer is
// bundled from the workspace svg-renderer source, so a bundle without this means
// the npm @scratch/scratch-svg-renderer (or a stale build) was bundled instead.
// Matches both minified (`svgFilters:!0`) and unminified (`svgFilters: true`) output.
export const SVG_FILTERS_MARKER = /USE_PROFILES:\s*\{\s*svg:\s*(?:!0|true),\s*svgFilters:\s*(?:!0|true)\s*\}/;

export const checkDist = distDir => {
    const problems = [];

    for (const entry of REQUIRED_DIST) {
        const target = path.join(distDir, entry);
        const wantDir = entry.endsWith('/');
        let stat = null;
        try {
            stat = fs.statSync(target);
        } catch {
            // missing; reported below
        }
        if (!stat) {
            problems.push(`missing: ${entry}`);
        } else if (wantDir && (!stat.isDirectory() || fs.readdirSync(target).length === 0)) {
            problems.push(`not a non-empty directory: ${entry}`);
        } else if (!wantDir && !stat.isFile()) {
            problems.push(`not a file: ${entry}`);
        }
    }

    const bundle = path.join(distDir, 'scratch-gui.js');
    if (fs.existsSync(bundle)) {
        const source = fs.readFileSync(bundle, 'utf8');
        if (!source.includes(BUNDLE_MARKER)) {
            problems.push(
                `scratch-gui.js does not contain "${BUNDLE_MARKER}": ` +
                'the stock scratch-blocks was bundled instead of @ftrprf/scratch-blocks'
            );
        }
        if (!SVG_FILTERS_MARKER.test(source)) {
            problems.push(
                'scratch-gui.js does not sanitize SVG with the svgFilters profile: ' +
                'the FTRPRF scratch-svg-renderer was not bundled, so costume filter effects would be stripped'
            );
        }
    }

    return problems;
};

const main = () => {
    const distDir = process.argv[2];
    if (!distDir) {
        console.error('usage: assert-gui-bundle.mjs <distDir>');
        process.exit(2);
    }
    const problems = checkDist(distDir);
    if (problems.length > 0) {
        for (const problem of problems) console.error(`FAIL ${problem}`);
        process.exit(1);
    }
    console.log(`OK ${distDir}: ${REQUIRED_DIST.length} required entries present, bundle contains ${BUNDLE_MARKER} and the svgFilters sanitizer`);
};

// Only run when executed directly, so the checks stay importable.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
