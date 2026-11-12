import React from 'react';
import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import VM from '@scratch/scratch-vm';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import SpriteList from '../../../src/components/sprite-selector/sprite-list.jsx';

// Necessary for the RadixUI context menu
global.MutationObserver = class {
    disconnect () { }
    observe () { }
};

const store = configureStore()({
    scratchGui: {
        config: {storage: {scratchStorage: {}}},
        assetDrag: {dragging: false},
        hoveredTarget: {receivedBlocks: false, sprite: null},
        vm: new VM()
    },
    locales: {isRtl: false}
});

const sprite = (id, order) => ({id, name: `Sprite-${id}`, order});

const renderList = (props = {}) => renderWithIntl(
    <Provider store={store}>
        <SpriteList
            editingTarget="a"
            hoveredTarget={{receivedBlocks: false, sprite: null}}
            items={[sprite('a', 0), sprite('b', 1), sprite('c', 2)]}
            selectedId="a"
            onSelectSprite={jest.fn()}
            {...props}
        />
    </Provider>
);

describe('sprite list show policy', () => {
    test('renders a tile for every sprite by default', () => {
        const view = renderList();
        expect(view.queryByText('Sprite-b')).not.toBeNull();
        expect(view.queryAllByText(/^Sprite-/).length).toBe(3);
    });

    test('renders no tile for a sprite the policy refuses to show', () => {
        const view = renderList({spriteActionPolicy: (action, id) => !(action === 'show' && id === 'b')});
        expect(view.queryAllByText(/^Sprite-/).length).toBe(2);
        expect(view.queryByText('Sprite-b')).toBeNull();
        expect(view.queryByText('Sprite-a')).not.toBeNull();
        expect(view.queryByText('Sprite-c')).not.toBeNull();
    });
});
