import {ScratchPaintReducer} from 'scratch-paint';
import LocalesReducer, {localesInitialState, initLocale, selectLocale} from './reducers/locales.js';
import GuiReducer, {buildInitialState, guiMiddleware, initEmbedded, initFullScreen, initPlayer} from './reducers/gui';
import {setFullScreen, setPlayer, setEmbedded} from './reducers/mode.js';
import {activateDeck} from './reducers/cards.js';
import {
    LoadingStates,
    onFetchedProjectData,
    onLoadedProject,
    defaultProjectId,
    manualUpdateProject,
    remixProject,
    requestNewProject,
    requestProjectUpload,
    setProjectId
} from './reducers/project-state.js';
import {
    openBackdropLibrary,
    openCostumeLibrary,
    openDebugModal,
    openExtensionLibrary,
    openLoadingProject,
    openTelemetryModal,
    openSoundLibrary,
    openSpriteLibrary,
    openSoundRecorder,
    openConnectionModal,
    openTipsLibrary,
    closeBackdropLibrary,
    closeCostumeLibrary,
    closeDebugModal,
    closeExtensionLibrary,
    closeLoadingProject,
    closeTelemetryModal,
    closeSpriteLibrary,
    closeSoundLibrary,
    closeSoundRecorder,
    closeTipsLibrary,
    closeConnectionModal
} from './reducers/modals.js';
import {setStageSize} from './reducers/stage-size';

// imports for scratch-judge
import AudioEngine from 'scratch-audio';
// @ts-ignore
import Renderer from '@scratch/scratch-render';
import getFonts from 'scratch-render-fonts';
import ScratchStorage from 'scratch-storage';
// @ts-ignore
import SVGRenderer from '@scratch/scratch-svg-renderer';
// @ts-ignore
import VM from '@scratch/scratch-vm';

// this seems super hacky. But the judge needs all elements of scratch
// on the global window object. Do not delete
// using indexer access to avoid ts errors
window.VirtualMachine = VM;
window.ScratchStorage = ScratchStorage;
window.ScratchSVGRenderer = SVGRenderer;
window.AudioEngine = AudioEngine;
window.ScratchRender = Renderer;
window.getFonts = getFonts;

export const guiReducers = {
    locales: LocalesReducer,
    scratchGui: GuiReducer,
    scratchPaint: ScratchPaintReducer
};

export {
    LoadingStates,
    onFetchedProjectData,
    onLoadedProject,
    defaultProjectId,
    manualUpdateProject,
    remixProject,
    requestNewProject,
    requestProjectUpload,
    setProjectId,
    setStageSize,

    openBackdropLibrary,
    openCostumeLibrary,
    openDebugModal,
    openExtensionLibrary,
    openLoadingProject,
    openTelemetryModal,
    openSoundLibrary,
    openSpriteLibrary,
    openSoundRecorder,
    openConnectionModal,
    openTipsLibrary,
    closeBackdropLibrary,
    closeCostumeLibrary,
    closeDebugModal,
    closeExtensionLibrary,
    closeLoadingProject,
    closeTelemetryModal,
    closeSpriteLibrary,
    closeSoundLibrary,
    closeSoundRecorder,
    closeTipsLibrary,
    closeConnectionModal,

    buildInitialState,
    guiMiddleware,
    initEmbedded,
    initPlayer,
    initFullScreen,
    initLocale,
    localesInitialState,
    setFullScreen,
    setPlayer,
    setEmbedded,
    activateDeck,
    selectLocale
};
