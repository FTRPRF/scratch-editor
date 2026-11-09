#!/usr/bin/env node
// Cheap tripwire for the FTRPRF scratch-gui bundle.
//
// Usage: node scripts/ftrprf/assert-gui-bundle.mjs <dist/scratch-gui.js> [<map>]
//
// Exits 1 unless the built bundle contains every FTRPRF marker: the DOMPurify
// svgFilters profile and the four hook names. The behavioural hook-order tests
// are the authoritative gate; this only catches a bundle built from the wrong
// source (for example the unpatched upstream packages).
//
// It also checks the source map next to the bundle (`<bundle>.map`, or the
// optional second argument) has real mappings. File size proves nothing: a
// `cheap-module-source-map` map lists every source and embeds sourcesContent
// (tens of MB) yet carries one mapping segment, so Sentry cannot resolve frames.
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

// A real full map has millions of segments over thousands of sources; a stub or
// line-only map has a handful. These floors sit far below real and far above stub.
export const MIN_SEGMENTS = 100000;
export const MIN_USED_SOURCES = 500;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_VALUE = Object.fromEntries([...B64].map((c, i) => [c, i]));

/**
 * Walks a source map's `mappings` string without building the full table.
 * @param {string} mappings - the VLQ `mappings` field
 * @returns {{segments: number, usedSources: number}} the segment count and the
 *   number of distinct source indexes referenced by 4+ field segments
 */
export const countMappings = mappings => {
    const used = new Set();
    let segments = 0;
    let source = 0;
    let fields = [];
    let value = 0;
    let shift = 0;
    const endSegment = () => {
        if (fields.length) {
            segments++;
            if (fields.length >= 4) {
                source += fields[1];
                used.add(source);
            }
            fields = [];
        }
    };
    for (const ch of mappings) {
        if (ch === ';' || ch === ',') {
            endSegment();
            continue;
        }
        const digit = B64_VALUE[ch];
        if (digit === undefined) throw new Error(`invalid VLQ character ${JSON.stringify(ch)} in mappings`);
        value += (digit & 31) * (2 ** shift);
        if (digit & 32) {
            shift += 5;
        } else {
            fields.push(value % 2 ? -(value - 1) / 2 : value / 2);
            value = 0;
            shift = 0;
        }
    }
    endSegment();
    return {segments, usedSources: used.size};
};

/**
 * @param {string} mapText - the contents of the .map file
 * @returns {{problem: string|null, segments?: number, usedSources?: number}} problem is null when the map is real
 */
export const checkSourceMap = mapText => {
    let map;
    try {
        map = JSON.parse(mapText);
    } catch (e) {
        return {problem: `not valid JSON: ${e.message}`};
    }
    if (typeof map.mappings !== 'string') return {problem: 'has no mappings string'};
    let counts;
    try {
        counts = countMappings(map.mappings);
    } catch (e) {
        return {problem: e.message};
    }
    if (counts.segments < MIN_SEGMENTS || counts.usedSources < MIN_USED_SOURCES) {
        return {
            ...counts,
            problem: `looks like a stub: ${counts.segments} mapping segments (need ${MIN_SEGMENTS}+) ` +
                `across ${counts.usedSources} sources (need ${MIN_USED_SOURCES}+)`
        };
    }
    return {...counts, problem: null};
};

const main = () => {
    const file = process.argv[2];
    if (!file) {
        console.error('usage: assert-gui-bundle.mjs <dist/scratch-gui.js> [<map>]');
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

    const mapFile = process.argv[3] || `${file}.map`;
    let mapText;
    try {
        mapText = fs.readFileSync(mapFile, 'utf8');
    } catch (e) {
        console.error(`cannot read source map ${mapFile}: ${e.message}`);
        return 1;
    }
    const result = checkSourceMap(mapText);
    if (result.problem) {
        console.error(`source map ${mapFile} ${result.problem}`);
        return 1;
    }
    console.log(`${mapFile}: ${result.segments} mapping segments across ${result.usedSources} sources`);
    return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = main();
}
