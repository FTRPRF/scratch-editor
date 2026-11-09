import React from 'react';
import ShallowRenderer from 'react-test-renderer/shallow';
import VMScratchBlocks from '../../../src/lib/blocks';
import ConnectedGUIComponent from '../../../src/components/gui/gui.jsx';
import BlocksContainer, {Blocks} from '../../../src/containers/blocks.jsx';

jest.mock('../../../src/lib/blocks', () => jest.fn());

// The paint editor is a workspace package that is not built in the unit-test environment.
jest.mock('@scratch/scratch-paint', () => ({__esModule: true, default: () => null}));

jest.mock('../../../src/generated/microbit-hex-url.cjs', () => 'microbit.hex');

// Only the Blocks element is inspected; the intl hook needs no provider this way.
jest.mock('react-intl', () => ({
    ...jest.requireActual('react-intl'),
    useIntl: () => ({formatMessage: message => message.defaultMessage})
}));

const findElements = (node, type, found = []) => {
    if (!node || typeof node !== 'object') return found;
    if (Array.isArray(node)) {
        node.forEach(child => findElements(child, type, found));
        return found;
    }
    if (node.type === type) found.push(node);
    if (node.props) findElements(node.props.children, type, found);
    return found;
};

// The un-connected function component, so no redux store is needed.
const GUIComponent = ConnectedGUIComponent.WrappedComponent;

describe('Blocks FTRPRF install hooks', () => {
    let calls;
    let scratchBlocks;
    let workspace;
    let flyoutWorkspace;
    let toolbox;
    let vm;

    const record = (name, fn) => jest.fn((...args) => {
        calls.push(name);
        return fn ? fn(...args) : null;
    });

    const makeInstance = props => {
        calls = [];
        flyoutWorkspace = {
            registerButtonCallback: jest.fn(),
            scale: 1,
            getMetrics: () => ({viewTop: 0})
        };
        toolbox = {
            selectItemByPosition: jest.fn(),
            getSelectedItem: () => ({getName: () => 'motion'}),
            runAfterRerender: jest.fn(),
            forceRerender: jest.fn()
        };
        workspace = {
            registerToolboxCategoryCallback: record('category'),
            addChangeListener: jest.fn(),
            removeChangeListener: jest.fn(),
            getFlyout: () => ({
                getWorkspace: () => flyoutWorkspace,
                getCategoryScrollPosition: () => 0
            }),
            getToolbox: () => toolbox,
            updateToolbox: record('updateToolbox'),
            clearUndo: record('clearUndo'),
            dispose: record('workspace.dispose')
        };
        scratchBlocks = {
            dialog: {setPrompt: jest.fn()},
            StatusIndicatorLabel: {},
            FieldColourSlider: {},
            ScratchProcedures: {},
            ScratchVariables: {},
            ScratchMsgs: {setLocale: jest.fn()},
            Theme: function Theme () {},
            Events: {disable: jest.fn(), enable: jest.fn()},
            utils: {xml: {textToDom: jest.fn()}},
            WidgetDiv: {hide: jest.fn()},
            getFocusManager: () => ({focusNode: jest.fn()}),
            inject: record('inject', () => workspace),
            clearWorkspaceAndLoadFromXml: record('load')
        };
        VMScratchBlocks.mockReturnValue(scratchBlocks);
        vm = {
            editingTarget: {id: 'target'},
            clearFlyoutBlocks: jest.fn()
        };
        const instance = {
            props: {
                ...Blocks.defaultProps,
                vm,
                isVisible: false,
                toolboxXML: '<xml>raw</xml>',
                colorMode: 'default',
                locale: 'en',
                workspaceMetrics: {targets: {}},
                updateToolboxState: jest.fn(),
                ...props
            },
            handlePromptStart: jest.fn(),
            handleConnectionModalStart: jest.fn(),
            handleOpenSoundRecorder: jest.fn(),
            requestToolboxUpdate: jest.fn(),
            onWorkspaceMetricsChange: jest.fn(),
            getToolboxXML: jest.fn().mockReturnValue(null),
            toolboxUpdateChangeListener: jest.fn(),
            blocks: {},
            attachVM: record('attachVM'),
            detachVM: record('detachVM'),
            setLocale: jest.fn()
        };
        return instance;
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('mount order is onBeforeBlocksInject → inject → category callbacks → onBlocksReady → attachVM', () => {
        const instance = makeInstance({
            onBeforeBlocksInject: record('onBeforeBlocksInject'),
            onBlocksReady: record('onBlocksReady')
        });
        jest.spyOn(window, 'addEventListener').mockImplementation(() => {});

        Blocks.prototype.componentDidMount.call(instance);

        const order = [];
        calls.forEach(name => {
            if (order[order.length - 1] !== name) order.push(name);
        });
        expect(order).toEqual([
            'onBeforeBlocksInject', 'inject', 'category', 'onBlocksReady', 'attachVM'
        ]);
        expect(instance.props.onBeforeBlocksInject).toHaveBeenCalledWith({ScratchBlocks: scratchBlocks});
        expect(instance.props.onBlocksReady).toHaveBeenCalledWith({
            ScratchBlocks: scratchBlocks, workspace, vm
        });
        // Button callbacks are registered before the hook runs too.
        expect(flyoutWorkspace.registerButtonCallback).toHaveBeenCalledTimes(3);
    });

    test('onWorkspaceLoaded runs after clearWorkspaceAndLoadFromXml and clearUndo', () => {
        const instance = makeInstance({onWorkspaceLoaded: record('onWorkspaceLoaded')});
        instance.workspace = workspace;
        instance.ScratchBlocks = scratchBlocks;
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

        Blocks.prototype.onWorkspaceUpdate.call(instance, {xml: '<xml/>'});

        expect(calls).toEqual(['load', 'clearUndo', 'onWorkspaceLoaded']);
        expect(instance.props.onWorkspaceLoaded).toHaveBeenCalledWith({
            ScratchBlocks: scratchBlocks, workspace, vm, target: vm.editingTarget
        });
    });

    test('onWorkspaceLoaded still runs when the workspace load throws', () => {
        const instance = makeInstance({onWorkspaceLoaded: record('onWorkspaceLoaded')});
        instance.workspace = workspace;
        instance.ScratchBlocks = scratchBlocks;
        scratchBlocks.clearWorkspaceAndLoadFromXml.mockImplementation(() => {
            throw new Error('boom');
        });
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

        Blocks.prototype.onWorkspaceUpdate.call(instance, {xml: '<xml/>'});

        expect(calls).toEqual(['clearUndo', 'onWorkspaceLoaded']);
    });

    test('the onBlocksReady disposer runs on unmount before workspace.dispose', () => {
        const disposer = record('disposer');
        const instance = makeInstance({onBlocksReady: () => disposer});
        jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
        Blocks.prototype.componentDidMount.call(instance);
        calls.length = 0;
        instance.workspace = workspace;
        instance.ScratchBlocks = scratchBlocks;

        Blocks.prototype.componentWillUnmount.call(instance);

        expect(calls).toEqual(['disposer', 'detachVM', 'workspace.dispose']);
    });

    test('unmount works when onBlocksReady returns nothing', () => {
        const instance = makeInstance();
        jest.spyOn(window, 'addEventListener').mockImplementation(() => {});
        Blocks.prototype.componentDidMount.call(instance);
        instance.workspace = workspace;
        instance.ScratchBlocks = scratchBlocks;

        expect(() => Blocks.prototype.componentWillUnmount.call(instance)).not.toThrow();
    });

    test('filterToolboxXml is applied at inject and in updateToolbox', () => {
        const filterToolboxXml = jest.fn(xml => `<filtered>${xml}</filtered>`);
        const instance = makeInstance({filterToolboxXml});
        jest.spyOn(window, 'addEventListener').mockImplementation(() => {});

        Blocks.prototype.componentDidMount.call(instance);
        expect(scratchBlocks.inject.mock.calls[0][1].toolbox).toBe('<filtered><xml>raw</xml></filtered>');

        instance.workspace = workspace;
        instance.toolboxUpdateQueue = [];
        Blocks.prototype.updateToolbox.call(instance);
        expect(workspace.updateToolbox).toHaveBeenCalledWith('<filtered><xml>raw</xml></filtered>');
    });

    test('the hooks default to no-ops that leave the toolbox untouched', () => {
        const instance = makeInstance();
        jest.spyOn(window, 'addEventListener').mockImplementation(() => {});

        Blocks.prototype.componentDidMount.call(instance);

        expect(scratchBlocks.inject.mock.calls[0][1].toolbox).toBe('<xml>raw</xml>');
    });

    test('GUI passes all four props to Blocks', () => {
        const hooks = {
            onBeforeBlocksInject: jest.fn(),
            onBlocksReady: jest.fn(),
            onWorkspaceLoaded: jest.fn(),
            filterToolboxXml: jest.fn()
        };
        const renderer = new ShallowRenderer();
        renderer.render(
            <GUIComponent
                colorMode="default"
                setTheme={jest.fn()}
                vm={{}}
                {...hooks}
            />
        );
        // The page layout is a MediaQuery render-prop; resolve it for the full-size layout.
        const layout = renderer.getRenderOutput().props.children(true);
        const [blocks] = findElements(layout, BlocksContainer);
        expect(blocks).toBeDefined();
        Object.keys(hooks).forEach(name => {
            expect(blocks.props[name]).toBe(hooks[name]);
        });
    });
});
