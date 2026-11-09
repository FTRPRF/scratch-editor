#!/usr/bin/env node
// Cheap tripwire for the FTRPRF scratch-gui bundle.
//
// Usage: node scripts/ftrprf/assert-gui-bundle.mjs <dist/scratch-gui.js>
//
// Exits 1 unless the built bundle contains every FTRPRF marker: the DOMPurify
// svgFilters profile and the four hook names. The behavioural hook-order tests
// are the authoritative gate; this only catches a bundle built from the wrong
// source (for example the unpatched upstream packages).
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

// The SVG sanitizer must run with DOMPurify's svgFilters profile, or every
// <fe*> primitive is stripped from costumes on load. Matches a USE_PROFILES
// object that sets svgFilters truthy, in any key order and with any other keys,
// in both minified (`svgFilters:!0`) and unminified (`svgFilters: true`) output.
const SVG_FILTERS = /USE_PROFILES:\s*\{[^{}]*\bsvgFilters:\s*(?:!0|true)\b/;

export const MARKERS = [
    {name: 'svgFilters', test: bundle => SVG_FILTERS.test(bundle)},
    ...['onBeforeBlocksInject', 'onBlocksReady', 'onWorkspaceLoaded', 'filterToolboxXml']
        .map(name => ({name, test: bundle => bundle.includes(name)}))
];

/**
 * @param {string} bundle - the contents of dist/scratch-gui.js
 * @returns {string[]} the names of the markers the bundle lacks
 */
export const missingMarkers = bundle => MARKERS.filter(m => !m.test(bundle)).map(m => m.name);

const main = () => {
    const file = process.argv[2];
    if (!file) {
        console.error('usage: assert-gui-bundle.mjs <dist/scratch-gui.js>');
        return 1;
    }
    let bundle;
    try {
        bundle = fs.readFileSync(file, 'utf8');
    } catch (e) {
        console.error(`cannot read ${file}: ${e.message}`);
        return 1;
    }
    const missing = missingMarkers(bundle);
    if (missing.length) {
        for (const name of missing) console.error(`bundle ${file} is missing marker: ${name}`);
        return 1;
    }
    console.log(`${file}: all ${MARKERS.length} FTRPRF markers present`);
    return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = main();
}
