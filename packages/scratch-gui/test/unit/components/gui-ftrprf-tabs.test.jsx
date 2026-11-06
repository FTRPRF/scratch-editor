/* eslint-disable react/display-name */
import React from 'react';
import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import VM from '@scratch/scratch-vm';
import {DEFAULT_MODE} from '../../../src/lib/settings/color-mode';
import {DEFAULT_THEME} from '../../../src/lib/settings/theme';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';

// The heavy children are irrelevant here: this suite is about what GUI renders
// around the built-in panels. Blocks records its props so passthrough can be asserted.
const mockBlocksProps = jest.fn();
jest.mock('../../../src/containers/blocks.jsx', () => props => {
    mockBlocksProps(props);
    return <div data-testid="blocks" />;
});
jest.mock('../../../src/containers/costume-tab.jsx', () => () => <div />);
jest.mock('../../../src/containers/sound-tab.jsx', () => () => <div />);
jest.mock('../../../src/containers/target-pane.jsx', () => () => <div />);
jest.mock('../../../src/containers/stage-wrapper.jsx', () => () => <div />);
jest.mock('../../../src/components/menu-bar/menu-bar.jsx', () => () => <div />);
jest.mock('../../../src/containers/watermark.jsx', () => () => <div />);
jest.mock('../../../src/containers/backpack.jsx', () => () => <div />);
jest.mock('../../../src/containers/cards.jsx', () => () => <div />);
jest.mock('../../../src/containers/alerts.jsx', () => () => <div />);
jest.mock('../../../src/containers/drag-layer.jsx', () => () => <div />);
jest.mock('../../../src/containers/webgl-modal.jsx', () => () => <div />);
jest.mock('../../../src/containers/tips-library.jsx', () => () => <div />);
jest.mock('../../../src/containers/connection-modal.jsx', () => () => <div />);
jest.mock('../../../src/containers/costume-library.jsx', () => () => <div />);
jest.mock('../../../src/containers/backdrop-library.jsx', () => () => <div />);

import GUIComponent from '../../../src/components/gui/gui.jsx';

global.matchMedia = global.matchMedia || (() => ({
    matches: true,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
}));

const store = configureStore()({
    scratchGui: {
        settings: {colorMode: DEFAULT_MODE, theme: DEFAULT_THEME},
        stageSize: {stageSize: 'large'},
        timeTravel: {year: 'NOW'}
    }
});

const TabHeader = ({label}) => <span data-testid="ftrprf-header">{label}</span>;
const TabContent = ({vm}) => <div data-testid="ftrprf-content">{vm ? 'has-vm' : 'no-vm'}</div>;

const renderGui = (props = {}) => renderWithIntl(
    <Provider store={store}>
        <GUIComponent
            activeTabIndex={0}
            colorMode={DEFAULT_MODE}
            theme={DEFAULT_THEME}
            vm={new VM()}
            {...props}
        />
    </Provider>
);

describe('GUI FTRPRF tabs extension point', () => {
    beforeEach(() => mockBlocksProps.mockClear());

    test('renders custom tab headers with headerProps', () => {
        const {getAllByTestId} = renderGui({
            tabs: [
                {header: TabHeader, headerProps: {label: 'Test'}, content: TabContent},
                {header: TabHeader, headerProps: {label: 'Other'}, content: TabContent}
            ]
        });
        expect(getAllByTestId('ftrprf-header').map(el => el.textContent)).toEqual(['Test', 'Other']);
    });

    test('renders tab content only when active', () => {
        const tabs = [{header: TabHeader, headerProps: {label: 'Test'}, content: TabContent}];
        const inactive = renderGui({tabs, activeTabIndex: 0});
        expect(inactive.queryByTestId('ftrprf-content')).toBeNull();
        inactive.unmount();

        // Custom tabs start after Code/Costumes/Sounds, so the first one is index 3.
        const active = renderGui({tabs, activeTabIndex: 3});
        expect(active.getByTestId('ftrprf-content').textContent).toBe('has-vm');
        expect(active.getByTestId('ftrprf-content').closest('.ftrprf-tab-panel')).not.toBeNull();
    });

    test('renders without tabs as upstream does', () => {
        const {queryByTestId} = renderGui();
        expect(queryByTestId('ftrprf-header')).toBeNull();
    });

    test('hideBlocksString, displayBlocksString and isInDeveloperMode reach Blocks', () => {
        renderGui({
            hideBlocksString: 'motion_movesteps',
            displayBlocksString: 'looks_say',
            isInDeveloperMode: true
        });
        expect(mockBlocksProps).toHaveBeenCalledWith(expect.objectContaining({
            hideBlocksString: 'motion_movesteps',
            displayBlocksString: 'looks_say',
            isInDeveloperMode: true
        }));
    });
});
