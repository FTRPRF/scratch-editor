import {visibleSprites, vmSpriteIndex} from '../../../src/lib/ftrprf-sprite-visibility';

const items = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
const hideB = (action, id) => !(action === 'show' && id === 'b');
const allowAll = () => true;

describe('ftrprf sprite visibility', () => {
    test('visibleSprites leaves out sprites the policy refuses to show', () => {
        expect(visibleSprites(items, hideB).map(item => item.id)).toEqual(['a', 'c']);
    });

    test('visibleSprites asks the show action with the sprite id', () => {
        const policy = jest.fn(() => true);
        visibleSprites(items, policy);
        expect(policy).toHaveBeenCalledWith('show', 'b');
    });

    test('vmSpriteIndex maps a visible position to its VM position past a hidden sprite', () => {
        expect(vmSpriteIndex(items, hideB, 0)).toBe(0);
        expect(vmSpriteIndex(items, hideB, 1)).toBe(2);
    });

    test('vmSpriteIndex is the identity with the default policy', () => {
        expect([0, 1, 2].map(i => vmSpriteIndex(items, allowAll, i))).toEqual([0, 1, 2]);
    });
});
