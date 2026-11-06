import assertFtrprfBlocks from '../../../src/lib/ftrprf/assert-ftrprf-blocks';

describe('assertFtrprfBlocks', () => {
    test('throws for stock blocks', () => {
        const stock = {Workspace: {prototype: {}}};
        expect(() => assertFtrprfBlocks(stock)).toThrow(
            '@ftrprf/scratch-blocks expected but stock scratch-blocks is loaded'
        );
    });

    test('passes for ftrprf blocks', () => {
        const ftrprf = {Workspace: {prototype: {setDeveloperMode: () => {}}}};
        expect(() => assertFtrprfBlocks(ftrprf)).not.toThrow();
    });
});
