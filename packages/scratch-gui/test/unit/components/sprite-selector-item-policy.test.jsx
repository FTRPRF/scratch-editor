import React from 'react';
import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import VM from '@scratch/scratch-vm';
import {fireEvent, waitFor} from '@testing-library/react';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import SpriteSelectorItem from '../../../src/containers/sprite-selector-item.jsx';
import Selector from '../../../src/components/asset-panel/selector.jsx';

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
    },
    locales: {isRtl: false}
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

    test.each(['delete-costume', 'delete-sound'])(
        'asset list checks %s as its own action and hides delete when denied',
        async deleteAction => {
            const spriteActionPolicy = jest.fn(action => action === 'delete');
            const view = renderItem({deleteAction, id: 0, spriteActionPolicy});
            expect(spriteActionPolicy).toHaveBeenCalledWith(deleteAction, 0);
            expect(spriteActionPolicy).not.toHaveBeenCalledWith('delete', expect.anything());
            expect(view.container.querySelector('button[aria-label="Delete"]')).toBeNull();
            await openContextMenu(view);
            expect(view.queryByText(/delete/i)).toBeNull();
        }
    );

    test.each(['delete-costume', 'delete-sound'])('asset list shows delete when %s is allowed', async deleteAction => {
        const view = renderItem({deleteAction, id: 0, spriteActionPolicy: action => action === deleteAction});
        expect(view.container.querySelector('button[aria-label="Delete"]')).not.toBeNull();
        await openContextMenu(view);
        expect(view.queryByText(/delete/i)).not.toBeNull();
    });

    test('asset-panel selector forwards the policy and its delete action to every item', () => {
        const spriteActionPolicy = jest.fn(() => false);
        const view = renderWithIntl(
            <Provider store={store}>
                <Selector
                    buttons={[]}
                    deleteAction="delete-costume"
                    items={[{name: 'costume1', url: 'https://example.invalid/c1.svg'},
                        {name: 'costume2', url: 'https://example.invalid/c2.svg'}]}
                    selectedItemIndex={0}
                    spriteActionPolicy={spriteActionPolicy}
                    onDeleteClick={jest.fn()}
                    onItemClick={jest.fn()}
                />
            </Provider>
        );
        expect(spriteActionPolicy).toHaveBeenCalledWith('delete-costume', 0);
        expect(spriteActionPolicy).toHaveBeenCalledWith('delete-costume', 1);
        expect(view.container.querySelector('button[aria-label="Delete"]')).toBeNull();
    });
});
