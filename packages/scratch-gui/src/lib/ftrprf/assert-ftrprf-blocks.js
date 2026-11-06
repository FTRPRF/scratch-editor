/**
 * Guard against the stock `scratch-blocks` being bundled by mistake.
 * FTRPRF ships a fork (@ftrprf/scratch-blocks, aliased as `scratch-blocks`)
 * that adds `Workspace.prototype.setDeveloperMode`; stock blocks lacks it.
 * @param {object} ScratchBlocks - the loaded scratch-blocks module
 * @throws {Error} when the stock scratch-blocks is loaded
 */
const assertFtrprfBlocks = ScratchBlocks => {
    const workspace = ScratchBlocks && ScratchBlocks.Workspace;
    if (!workspace || !workspace.prototype ||
        typeof workspace.prototype.setDeveloperMode !== 'function') {
        throw new Error('@ftrprf/scratch-blocks expected but stock scratch-blocks is loaded');
    }
};

export {assertFtrprfBlocks};
export default assertFtrprfBlocks;
