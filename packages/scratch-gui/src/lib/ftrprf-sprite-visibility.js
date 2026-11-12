// FTRPRF (TR-4761): the host app can hide sprites from the sprite list through
// the spriteActionPolicy prop ('show'). The sortable list then only holds the
// visible tiles, so its drag positions must be mapped back to VM positions.

/**
 * The sprites the policy allows to show, in their original order.
 * @param {Array<{id: string}>} items all sprites, in VM order without the stage
 * @param {function(string, string): boolean} policy the sprite action policy
 * @returns {Array<{id: string}>} the visible sprites
 */
const visibleSprites = (items, policy) =>
    items.filter(item => policy('show', item.id) !== false);

/**
 * The position in `items` of the visibleIndex-th visible sprite.
 * @param {Array<{id: string}>} items all sprites, in VM order without the stage
 * @param {function(string, string): boolean} policy the sprite action policy
 * @param {number} visibleIndex a position in the visible list
 * @returns {number} the position in `items`
 */
const vmSpriteIndex = (items, policy, visibleIndex) => {
    const visible = visibleSprites(items, policy);
    if (visibleIndex < 0 || visibleIndex >= visible.length) return visibleIndex;
    return items.indexOf(visible[visibleIndex]);
};

export {visibleSprites, vmSpriteIndex};
