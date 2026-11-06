import React from 'react';
import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import VM from '@scratch/scratch-vm';
import {fireEvent, waitFor} from '@testing-library/react';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import SpriteSelectorItem from '../../../src/containers/sprite-selector-item.jsx';

// Necessary for the RadixUI context menu
global.MutationObserver = class {
    disconnect () { }
    observe () { }
};
document.body.insertAdjacentElement = jest.fn();
global.DOMRect = {
    fromRect: ({x = 0, y = 0, width = 0, height = 0} = {}) =>
        ({x, y, width, height, top: y, left: x, right: x + width, bottom: y + height})
};

const store = configureStore()({
    scratchGui: {
        config: {storage: {scratchStorage: {}}},
        assetDrag: {dragging: false},
        hoveredTarget: {receivedBlocks: false, sprite: null},
        vm: new VM()
    }
});

const renderItem = (props = {}) => renderWithIntl(
    <Provider store={store}>
        <SpriteSelectorItem
            costumeURL="https://example.invalid/sprite.svg"
            id="sprite-1"
            name="Sprite1"
            selected
            onClick={jest.fn()}
            onDeleteButtonClick={jest.fn()}
            onDuplicateButtonClick={jest.fn()}
            {...props}
        />
    </Provider>
);

const openContextMenu = async ({container, findByText, queryByText}) => {
    fireEvent.contextMenu(container.querySelector('[class*="spriteSelectorItem"]') || container.firstChild);
    await waitFor(() => expect(queryByText('duplicate') || queryByText('Duplicate')).not.toBeNull());
    return findByText;
};

describe('sprite action policy', () => {
    test('default policy shows delete', async () => {
        const view = renderItem();
        expect(view.container.querySelector('button[aria-label="Delete"]')).not.toBeNull();
        await openContextMenu(view);
        expect(view.queryByText(/delete/i)).not.toBeNull();
    });

    test('policy false hides delete button and delete menu item', async () => {
        const spriteActionPolicy = jest.fn(() => false);
        const view = renderItem({spriteActionPolicy});
        expect(spriteActionPolicy).toHaveBeenCalledWith('delete', 'sprite-1');
        expect(view.container.querySelector('button[aria-label="Delete"]')).toBeNull();
        await openContextMenu(view);
        expect(view.queryByText(/delete/i)).toBeNull();
    });
});
