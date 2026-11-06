import React from 'react';
import {render, act} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

const mockWorkspace = {};
const mockScratchBlocks = {};

jest.mock('../../../src/lib/blocks', () => () => mockScratchBlocks);
// The error boundary / connect wrappers are not under test; use the raw class.
jest.mock('../../../src/lib/error-boundary-hoc.jsx', () => () => Component => Component);

import Blocks from '../../../src/containers/blocks.jsx';

const TOOLBOX = [
    '<xml>',
    '<category name="Motion" id="motion"><block type="motion_movesteps"></block></category>',
    '<category name="Looks" id="looks"><block type="looks_say"></block></category>',
    '<category name="My Blocks" id="myBlocks" custom="PROCEDURE"></category>',
    '</xml>'
].join('');

const makeVm = (overrides = {}) => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    blockListener: jest.fn(),
    flyoutBlockListener: jest.fn(),
    monitorBlockListener: jest.fn(),
    clearFlyoutBlocks: jest.fn(),
    refreshWorkspace: jest.fn(),
    getLocale: () => 'en',
    setLocale: jest.fn(() => Promise.resolve()),
    editingTarget: null,
    runtime: {},
    ...overrides
});

const makeStore = (toolboxXML = TOOLBOX) => configureStore()({
    locales: {isRtl: false, locale: 'en', messages: {}},
    scratchGui: {
        modals: {},
        mode: {isFullScreen: false},
        toolbox: {toolboxXML},
        customProcedures: {active: false},
        workspaceMetrics: {targets: {}},
        settings: {theme: 'default'},
        timeTravel: {year: 'NOW'},
        assetDrag: {dragging: false}
    }
});

const resetMocks = () => {
    const flyoutWorkspace = {registerButtonCallback: jest.fn(), addChangeListener: jest.fn()};
    const flyout = {getWorkspace: () => flyoutWorkspace, setRecyclingEnabled: jest.fn()};
    Object.keys(mockWorkspace).forEach(k => delete mockWorkspace[k]);
    Object.assign(mockWorkspace, {
        setDeveloperMode: jest.fn(),
        setHideAndDisplayStrings: jest.fn(),
        getFlyout: jest.fn(() => flyout),
        setToolboxRefreshEnabled: jest.fn(),
        addChangeListener: jest.fn(),
        translate: jest.fn(),
        zoom: jest.fn(),
        setVisible: jest.fn(),
        dispose: jest.fn(),
        updateToolbox: jest.fn(),
        toolbox_: {
            getSelectedCategoryId: () => 'motion',
            getCategoryScrollOffset: () => 0,
            getCategoryPositionById: () => 0,
            getCategoryLengthById: () => 10,
            setFlyoutScrollPos: jest.fn()
        }
    });
    Object.keys(mockScratchBlocks).forEach(k => delete mockScratchBlocks[k]);
    Object.assign(mockScratchBlocks, {
        inject: jest.fn(() => mockWorkspace),
        hideChaff: jest.fn(),
        FieldColourSlider: {},
        Procedures: {},
        ScratchMsgs: {setLocale: jest.fn()},
        Workspace: {prototype: {}}
    });
};

const renderBlocks = (props = {}, store = makeStore(), vmOverrides = {}) => {
    const vm = makeVm(vmOverrides);
    const ui = (extra, nextStore = store) => (
        <Provider store={nextStore}>
            <Blocks
                vm={vm}
                stageSize="large"
                {...props}
                {...extra}
            />
        </Provider>
    );
    const result = render(ui());
    return {...result, vm, rerenderWith: (extra, nextStore) => result.rerender(ui(extra, nextStore))};
};

const flushToolboxUpdate = () => act(() => {
    jest.runAllTimers();
});

describe('Blocks container (FTRPRF additions)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        resetMocks();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test('applies developer mode and strings after inject', () => {
        renderBlocks({isInDeveloperMode: true, hideBlocksString: 'Hide', displayBlocksString: 'Show'});
        expect(mockScratchBlocks.inject).toHaveBeenCalledTimes(1);
        expect(mockWorkspace.setDeveloperMode).toHaveBeenCalledWith(true);
        expect(mockWorkspace.setHideAndDisplayStrings).toHaveBeenCalledWith('Hide', 'Show');
    });

    test('defaults isInDeveloperMode to false', () => {
        renderBlocks();
        expect(mockWorkspace.setDeveloperMode).toHaveBeenCalledWith(false);
    });

    test('re-applies setHideAndDisplayStrings when the strings props change', () => {
        const {rerenderWith} = renderBlocks({hideBlocksString: 'Hide', displayBlocksString: 'Show'});
        mockWorkspace.setHideAndDisplayStrings.mockClear();
        rerenderWith({hideBlocksString: 'Verberg', displayBlocksString: 'Toon'});
        expect(mockWorkspace.setHideAndDisplayStrings).toHaveBeenCalledTimes(1);
        expect(mockWorkspace.setHideAndDisplayStrings).toHaveBeenCalledWith('Verberg', 'Toon');
    });

    test('re-applies setDeveloperMode when isInDeveloperMode changes', () => {
        const {rerenderWith} = renderBlocks({isInDeveloperMode: false});
        mockWorkspace.setDeveloperMode.mockClear();
        rerenderWith({isInDeveloperMode: true});
        expect(mockWorkspace.setDeveloperMode).toHaveBeenCalledTimes(1);
        expect(mockWorkspace.setDeveloperMode).toHaveBeenCalledWith(true);
    });

    test('does not re-apply settings when unrelated props change', () => {
        const {rerenderWith} = renderBlocks({
            isInDeveloperMode: false,
            hideBlocksString: 'a',
            displayBlocksString: 'b'
        });
        mockWorkspace.setDeveloperMode.mockClear();
        mockWorkspace.setHideAndDisplayStrings.mockClear();
        rerenderWith({stageSize: 'small'});
        expect(mockWorkspace.setDeveloperMode).not.toHaveBeenCalled();
        expect(mockWorkspace.setHideAndDisplayStrings).not.toHaveBeenCalled();
    });

    test('filters the toolbox when the workspace reports useful blocks', () => {
        renderBlocks();
        flushToolboxUpdate();
        mockWorkspace.updateToolbox.mockClear();

        act(() => {
            mockScratchBlocks.Workspace.prototype.externalFilterToolboxCallback(['motion_movesteps']);
        });
        flushToolboxUpdate();

        expect(mockWorkspace.updateToolbox).toHaveBeenCalledTimes(1);
        const xml = mockWorkspace.updateToolbox.mock.calls[0][0];
        expect(xml).toContain('motion_movesteps');
        expect(xml).not.toContain('looks_say');
        expect(xml).toContain('myBlocks');
    });

    test('does not filter in developer mode', () => {
        renderBlocks({isInDeveloperMode: true});
        flushToolboxUpdate();
        mockWorkspace.updateToolbox.mockClear();

        act(() => {
            mockScratchBlocks.Workspace.prototype.externalFilterToolboxCallback(['motion_movesteps']);
        });
        flushToolboxUpdate();

        expect(mockWorkspace.updateToolbox).toHaveBeenCalledWith(TOOLBOX);
    });

    // Old fork parity: the filtered XML lived in redux, so an empty list (Blockly undo/redo
    // re-creating the hidden define block) left the toolbox filtered until the toolbox XML was
    // regenerated. Unfiltering happens only on regeneration, not on the [] callback itself.
    test('preserves old-fork behaviour: undo ([]) keeps the filtered toolbox until the next regeneration', () => {
        const {rerenderWith} = renderBlocks();
        flushToolboxUpdate();

        act(() => {
            mockScratchBlocks.Workspace.prototype.externalFilterToolboxCallback(['motion_movesteps']);
        });
        flushToolboxUpdate();
        const filtered = mockWorkspace.updateToolbox.mock.calls.slice(-1)[0][0];
        expect(filtered).not.toContain('looks_say');

        mockWorkspace.updateToolbox.mockClear();
        act(() => {
            mockScratchBlocks.Workspace.prototype.externalFilterToolboxCallback([]);
        });
        flushToolboxUpdate();
        expect(mockWorkspace.updateToolbox).toHaveBeenCalledTimes(1);
        expect(mockWorkspace.updateToolbox).toHaveBeenLastCalledWith(filtered);

        // Regeneration: the toolboxXML prop changes (mapStateToProps reads the store).
        mockWorkspace.updateToolbox.mockClear();
        const regenerated = TOOLBOX.replace('</xml>', '<sep></sep></xml>');
        rerenderWith({}, makeStore(regenerated));
        flushToolboxUpdate();
        expect(mockWorkspace.updateToolbox).toHaveBeenLastCalledWith(regenerated);
    });

    test('locale change skips the flyout work when the flyout is gone', async () => {
        let resolveLocale;
        const {vm} = renderBlocks({}, makeStore(), {
            setLocale: jest.fn(() => new Promise(resolve => {
                resolveLocale = resolve;
            }))
        });
        vm.refreshWorkspace.mockClear();
        mockWorkspace.getFlyout.mockReturnValue(null);
        await act(async () => {
            resolveLocale();
            await Promise.resolve();
        });
        expect(vm.refreshWorkspace).not.toHaveBeenCalled();
    });
});
