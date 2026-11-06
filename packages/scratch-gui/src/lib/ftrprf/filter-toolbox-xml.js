/**
 * Category that is always kept: it holds the custom procedure ("My Blocks") flyout.
 */
const ALWAYS_KEPT_CATEGORY_ID = 'myBlocks';

/**
 * Remove every category that contains no useful block (except myBlocks).
 * @param {Document} xmlDoc - parsed toolbox
 * @param {Set<string>} useful - useful block types
 */
const removeUselessCategories = (xmlDoc, useful) => {
    const usefulCategoryIds = new Set([ALWAYS_KEPT_CATEGORY_ID]);
    for (const block of Array.from(xmlDoc.getElementsByTagName('block'))) {
        if (useful.has(block.getAttribute('type')) && block.parentElement) {
            usefulCategoryIds.add(block.parentElement.getAttribute('id'));
        }
    }
    for (const category of Array.from(xmlDoc.getElementsByTagName('category'))) {
        if (!usefulCategoryIds.has(category.getAttribute('id'))) {
            category.parentNode.removeChild(category);
        }
    }
};

/**
 * Remove every block whose type is not useful.
 * @param {Document} xmlDoc - parsed toolbox
 * @param {Set<string>} useful - useful block types
 */
const removeUselessBlocks = (xmlDoc, useful) => {
    for (const block of Array.from(xmlDoc.getElementsByTagName('block'))) {
        if (!useful.has(block.getAttribute('type'))) {
            block.parentNode.removeChild(block);
        }
    }
};

/**
 * Removing categories and blocks leaves separators next to each other (or at the start of a
 * category). Collapse those, as the old FTRPRF fork did.
 * @param {Document} xmlDoc - parsed toolbox
 */
const removeDuplicateSeparators = xmlDoc => {
    let removeNextSeparator = true;
    const toDelete = [];
    for (const child of Array.from(xmlDoc.documentElement.children)) {
        if (child.tagName === 'category') {
            removeNextSeparator = true;
            for (const grandChild of Array.from(child.children)) {
                if (grandChild.tagName === 'block') {
                    removeNextSeparator = false;
                } else if (grandChild.tagName === 'sep') {
                    if (removeNextSeparator) toDelete.push(grandChild);
                    removeNextSeparator = true;
                }
            }
            removeNextSeparator = false;
        } else if (child.tagName === 'sep') {
            if (removeNextSeparator) toDelete.push(child);
            removeNextSeparator = true;
        }
    }
    for (const separator of toDelete) {
        separator.parentNode.removeChild(separator);
    }
};

/**
 * Filter a toolbox XML string down to the blocks an exercise considers useful.
 * An empty list means "no restriction" and returns the input unchanged.
 * @param {string} toolboxXml - toolbox XML
 * @param {Array<string>} usefulBlocks - block types (opcodes) to keep
 * @returns {string} the filtered toolbox XML
 */
const filterToolboxXml = (toolboxXml, usefulBlocks) => {
    if (!Array.isArray(usefulBlocks) || usefulBlocks.length === 0) return toolboxXml;

    const xmlDoc = new DOMParser().parseFromString(toolboxXml, 'text/xml');
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) return toolboxXml;

    const useful = new Set(usefulBlocks);
    removeUselessCategories(xmlDoc, useful);
    removeUselessBlocks(xmlDoc, useful);
    removeDuplicateSeparators(xmlDoc);

    return new XMLSerializer().serializeToString(xmlDoc);
};

export {filterToolboxXml};
export default filterToolboxXml;
