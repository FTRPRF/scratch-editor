# Draft upstream PR (scratchfoundation/scratch-editor) - not opened

## Title

fix(svg-renderer): keep SVG filter primitives when sanitizing costumes

## Problem

`sanitizeSvgText` runs DOMPurify with `USE_PROFILES: {svg: true}` only. That profile does not include the `<fe*>` filter primitives (`feGaussianBlur`, `feFlood`, `feOffset`, `feMerge`, ...), so they are all stripped and an empty `<filter>` is left behind. Costumes that use SVG filters for a glow or drop shadow lose the effect, and an element drawn through an empty filter is not rendered at all. Because costumes are re-serialized on save, the loss is persisted.

## Fix

Enable DOMPurify's `svgFilters` profile alongside `svg`. It only adds tags; its attributes are the svg and xml sets already admitted. The existing hooks continue to strip every non-internal `href`/`xlink:href` and every external CSS `url()`. `feImage` is the only primitive that can load a resource, so it is added to `FORBID_TAGS` so that its safety does not depend on the href hook alone.

## Test

`packages/scratch-svg-renderer/test/sanitize-svg-filters.js`:

- a filter-bearing SVG keeps its `fe*` primitives, their attributes, and the internal `filter="url(#id)"` reference;
- `<script>`, `on*` handlers, `javascript:` URLs, external filter/CSS URLs, `<a>` and `feImage` (including `data:` and `#fragment` forms) are still removed.
