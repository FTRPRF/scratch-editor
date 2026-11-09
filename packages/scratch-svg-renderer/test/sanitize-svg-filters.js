const test = require('tap').test;

const sanitizeSvg = require('../src/sanitize-svg');

// FTRPRF: costumes drawn with SVG filters (glow, drop shadow) must keep their
// filter primitives. Without them an empty <filter> is left behind, and an
// element drawn through an empty filter is not rendered at all.
const FILTER_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">',
    '<defs>',
    '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">',
    '<feFlood flood-color="#ff0" flood-opacity="0.8" result="flood"/>',
    '<feComposite in="flood" in2="SourceAlpha" operator="in" result="mask"/>',
    '<feGaussianBlur in="mask" stdDeviation="3" result="blur"/>',
    '<feOffset in="blur" dx="1" dy="2" result="offset"/>',
    '<feMerge><feMergeNode in="offset"/><feMergeNode in="SourceGraphic"/></feMerge>',
    '</filter>',
    '</defs>',
    '<circle cx="20" cy="20" r="10" fill="red" filter="url(#glow)"/>',
    '</svg>'
].join('');

const KEPT_PRIMITIVES = ['feFlood', 'feComposite', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode'];

test('svg filter primitives survive sanitizing', t => {
    const out = sanitizeSvg.sanitizeSvgText(FILTER_SVG);
    for (const primitive of KEPT_PRIMITIVES) {
        t.match(out, new RegExp(`<${primitive}[\\s>/]`), `${primitive} is kept`);
    }
    t.match(out, /<feMergeNode in="offset"/, 'feMergeNode keeps its input');
    t.match(out, /stdDeviation="3"/, 'feGaussianBlur keeps stdDeviation');
    t.match(out, /operator="in"/, 'feComposite keeps operator');
    t.match(out, /filter="url\(#glow\)"/, 'the internal filter reference is kept');
    t.end();
});

test('sanitizing still removes active content around filters', t => {
    const malicious = [
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">',
        '<script>alert(2)</script>',
        '<defs>',
        '<filter id="f" onload="alert(3)">',
        '<feGaussianBlur stdDeviation="2" onbegin="alert(4)"/>',
        '<feImage href="https://example.com/track.png"/>',
        '<feImage xlink:href="https://example.com/track-xlink.png"/>',
        '<feImage href="data:image/png;base64,iVBORw0KGgo="/>',
        '<feImage href="#internal"/>',
        '<feTile in="SourceGraphic" style="background:url(https://example.com/css.png)"/>',
        '</filter>',
        '<filter id="g"><feFlood flood-color="red"/></filter>',
        '</defs>',
        '<rect width="10" height="10" filter="url(https://example.com/remote.svg#f)"/>',
        '<image href="javascript:alert(5)"/>',
        '<image xlink:href="javascript:alert(6)"/>',
        '<a href="javascript:alert(7)"><rect width="1" height="1"/></a>',
        '</svg>'
    ].join('');
    const out = sanitizeSvg.sanitizeSvgText(malicious);

    t.notMatch(out, /<script/i, 'script element removed');
    t.notMatch(out, /alert/, 'no script payload remains anywhere');
    t.notMatch(out, /\son[a-z]+=/i, 'event handler attributes removed');
    t.notMatch(out, /javascript:/i, 'script-scheme URLs removed');
    t.notMatch(out, /example\.com/, 'no external URL remains (href, xlink:href, CSS url(), filter url())');
    t.notMatch(out, /<feImage/i, 'feImage is forbidden outright, data: and #fragment forms included');
    t.notMatch(out, /<a[\s>]/, 'anchor removed');
    t.match(out, /<feGaussianBlur stdDeviation="2"/, 'the harmless primitive itself is kept');
    t.match(out, /<feFlood flood-color="red"/, 'an untouched filter is kept');
    t.end();
});
