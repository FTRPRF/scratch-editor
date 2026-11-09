/* eslint-disable react/display-name */
import React from 'react';
import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import {render} from '@testing-library/react';
import {IntlProvider} from 'react-intl';
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
        config: {},
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

// Shows the label it renders with and the one it mounted with: a header that
// React reused for another tab (an index key) shows two different labels.
const StatefulHeader = ({label}) => {
    const [mountedAs] = React.useState(label);
    return <span data-testid="ftrprf-header">{`${label}:${mountedAs}`}</span>;
};

// One VM for every render, so a rerender changes only the tabs.
const sharedVm = new VM();
const guiWithTabs = (tabs, props = {}) => (
    <IntlProvider locale="en">
        <Provider store={store}>
            <GUIComponent
                activeTabIndex={0}
                colorMode={DEFAULT_MODE}
                theme={DEFAULT_THEME}
                vm={sharedVm}
                tabs={tabs}
                {...props}
            />
        </Provider>
    </IntlProvider>
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

    test('keeps each tab\'s state with that tab when an earlier tab goes away', () => {
        // The @ftrprf/scratch wrapper passes no id, but sets a translationKey on every header.
        const tab = translationKey => ({
            header: StatefulHeader,
            headerProps: {label: translationKey, translationKey},
            content: TabContent
        });
        const {getAllByTestId, rerender} = render(guiWithTabs([tab('test'), tab('translate')]));
        rerender(guiWithTabs([tab('translate')]));
        expect(getAllByTestId('ftrprf-header').map(el => el.textContent)).toEqual(['translate:translate']);
    });

    test('keys a tab by its id when it has one', () => {
        const tab = id => ({id, header: StatefulHeader, headerProps: {label: id}, content: TabContent});
        const {getAllByTestId, rerender} = render(guiWithTabs([tab('a'), tab('b')]));
        rerender(guiWithTabs([tab('b')]));
        expect(getAllByTestId('ftrprf-header').map(el => el.textContent)).toEqual(['b:b']);
    });

    describe('keeps the selected custom tab when the tab list changes', () => {
        const contents = {};
        const contentFor = id => {
            contents[id] = contents[id] || (() => <div data-testid="ftrprf-content">{id}</div>);
            return contents[id];
        };
        const tab = id => ({id, header: TabHeader, headerProps: {label: id}, content: contentFor(id)});

        test('an earlier tab goes away: re-selects the same tab at its new index', () => {
            const onActivateTab = jest.fn();
            // 'b' is selected at index 4 (custom tabs start at 3).
            const {rerender} = render(guiWithTabs([tab('a'), tab('b')], {activeTabIndex: 4, onActivateTab}));
            expect(onActivateTab).not.toHaveBeenCalled();
            rerender(guiWithTabs([tab('b')], {activeTabIndex: 4, onActivateTab}));
            expect(onActivateTab).toHaveBeenCalledTimes(1);
            expect(onActivateTab).toHaveBeenCalledWith(3);
        });

        test('the selected tab goes away: falls back to the Code tab', () => {
            const onActivateTab = jest.fn();
            const {rerender} = render(guiWithTabs([tab('a'), tab('b')], {activeTabIndex: 4, onActivateTab}));
            rerender(guiWithTabs([tab('a')], {activeTabIndex: 4, onActivateTab}));
            expect(onActivateTab).toHaveBeenCalledTimes(1);
            expect(onActivateTab).toHaveBeenCalledWith(0);
        });

        test('a tab is inserted before it: re-selects the same tab at its new index', () => {
            const onActivateTab = jest.fn();
            const {rerender, getByTestId} = render(guiWithTabs([tab('b')], {activeTabIndex: 3, onActivateTab}));
            rerender(guiWithTabs([tab('a'), tab('b')], {activeTabIndex: 3, onActivateTab}));
            expect(onActivateTab).toHaveBeenCalledTimes(1);
            expect(onActivateTab).toHaveBeenCalledWith(4);
            // Once the store follows, 'b' is the selected tab again.
            rerender(guiWithTabs([tab('a'), tab('b')], {activeTabIndex: 4, onActivateTab}));
            expect(onActivateTab).toHaveBeenCalledTimes(1);
            expect(getByTestId('ftrprf-content').textContent).toBe('b');
        });

        test('a built-in tab is selected: leaves the selection alone', () => {
            const onActivateTab = jest.fn();
            const {rerender} = render(guiWithTabs([tab('a'), tab('b')], {activeTabIndex: 1, onActivateTab}));
            rerender(guiWithTabs([tab('b')], {activeTabIndex: 1, onActivateTab}));
            expect(onActivateTab).not.toHaveBeenCalled();
        });
    });

    test('renders without tabs as upstream does', () => {
        const {queryByTestId} = renderGui();
        expect(queryByTestId('ftrprf-header')).toBeNull();
    });
});
