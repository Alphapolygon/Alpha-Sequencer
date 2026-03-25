import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Juce from 'juce-framework-frontend';
import { PATTERN_LABELS } from '../utils/patternConstants.js';
import { noteNameToMidi } from '../utils/noteUtils.js';
import { createEmptyPattern, normalizeLoadedState } from '../utils/patternState.js';
import { REQUIRED_NATIVE_FUNCTIONS } from './juce/nativeFunctionNames.js';
import { SAVE_UI_DELAY_MS, selectUiMetadata } from './juce/uiMetadata.js';
import {
    applyEngineDiffToPatterns,
    clearTrackInData,
    resetAutomationLaneInData,
    setStepActiveInData,
    setStepParameterInData,
    setTrackLengthInData,
    setTrackMidiChannelInData,
    setTrackMidiKeyInData,
    setTrackRandomAmountInData,
    setTrackScaleInData,
    setTrackSequenceInData,
    setTrackStateInData,
    setTrackTimeDivisionInData,
    updatePatternCollection,
} from './juce/patternDataMutators.js';
import { toNativeParameterValue } from './juce/nativePayloads.js';

const createInitialPatterns = () => PATTERN_LABELS.map((label) => createEmptyPattern(`Pattern ${label}`));

export function useJuceBridge() {
    const [patterns, setPatterns] = useState(createInitialPatterns);
    const [activeIdx, setActiveIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [currentStep, setCurrentStep] = useState(-1);
    const [activeSection, setActiveSection] = useState(-1);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedTrack, setSelectedTrack] = useState(0);
    const [footerTab, setFooterTab] = useState('Velocity');
    const [themeIdx, setThemeIdx] = useState(0);
    const [uiScale, setUiScale] = useState(1);
    const [visibleTracks, setVisibleTracks] = useState(16);

    const [backendReady, setBackendReady] = useState(false);
    const [uiReady, setUiReady] = useState(false);
    const [backendStatus, setBackendStatus] = useState('Booting...');
    const [debugInfo, setDebugInfo] = useState('');

    const hasHydrated = useRef(false);
    const nativeFunctionsRef = useRef({});
    const saveUiTimeoutRef = useRef(null);
    const patternsRef = useRef(patterns);
    const activeIdxRef = useRef(activeIdx);

    useEffect(() => { patternsRef.current = patterns; }, [patterns]);
    useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

    const backendSupportsEvents = useCallback(() => (
        !!window.__JUCE__?.backend?.addEventListener && !!window.__JUCE__?.backend?.removeEventListener
    ), []);

    const resolveNativeFunctions = useCallback(() => {
        const nextFunctions = {};
        for (const name of REQUIRED_NATIVE_FUNCTIONS) {
            nextFunctions[name] = Juce.getNativeFunction(name);
        }
        nativeFunctionsRef.current = nextFunctions;
    }, []);

    const invokeNative = useCallback(async (name, args = []) => {
        const nativeFunction = nativeFunctionsRef.current[name];
        if (!nativeFunction) throw new Error(`Native function "${name}" is unavailable`);
        return nativeFunction(...args);
    }, []);

    const applyPatternDataPatch = useCallback((patternIndex, updater) => {
        setPatterns((previousPatterns) => updatePatternCollection(previousPatterns, patternIndex, updater));
    }, []);

    const patchActivePattern = useCallback((updater) => {
        applyPatternDataPatch(activeIdxRef.current, updater);
    }, [applyPatternDataPatch]);

    const callNativeIfReady = useCallback((name, args) => {
        if (!backendReady) return;
        invokeNative(name, args).catch(console.error);
    }, [backendReady, invokeNative]);

    const editStepActive = useCallback((patternIndex, trackIndex, stepIndex, isActive) => {
        applyPatternDataPatch(patternIndex, (data) => setStepActiveInData(data, trackIndex, stepIndex, isActive));
        callNativeIfReady('setStepActive', [patternIndex, trackIndex, stepIndex, isActive]);
    }, [applyPatternDataPatch, callNativeIfReady]);

    const editStepParameter = useCallback((patternIndex, trackIndex, stepIndex, paramName, value) => {
        applyPatternDataPatch(patternIndex, (data) => setStepParameterInData(data, trackIndex, stepIndex, paramName, value));
        callNativeIfReady('setStepParameter', [patternIndex, trackIndex, stepIndex, paramName, toNativeParameterValue(paramName, value)]);
    }, [applyPatternDataPatch, callNativeIfReady]);

    const editTrackState = useCallback((trackIndex, stateName, isEnabled) => {
        patchActivePattern((data) => setTrackStateInData(data, trackIndex, stateName, isEnabled));
        callNativeIfReady('setTrackState', [trackIndex, stateName, isEnabled]);
    }, [callNativeIfReady, patchActivePattern]);

    const editTrackMidiKey = useCallback((trackIndex, midiNoteName) => {
        patchActivePattern((data) => setTrackMidiKeyInData(data, trackIndex, midiNoteName));
        callNativeIfReady('setTrackMidiKey', [trackIndex, noteNameToMidi(midiNoteName)]);
    }, [callNativeIfReady, patchActivePattern]);

    const editTrackMidiChannel = useCallback((trackIndex, channel) => {
        patchActivePattern((data) => setTrackMidiChannelInData(data, trackIndex, channel));
        callNativeIfReady('setTrackMidiChannel', [trackIndex, channel]);
    }, [callNativeIfReady, patchActivePattern]);

    const editClearTrack = useCallback((patternIndex, trackIndex) => {
        applyPatternDataPatch(patternIndex, (data) => clearTrackInData(data, trackIndex));
        callNativeIfReady('clearTrack', [patternIndex, trackIndex]);
    }, [applyPatternDataPatch, callNativeIfReady]);

    const changeActivePattern = useCallback((index) => {
        setActiveIdx(index);
        callNativeIfReady('setActivePattern', [index]);
    }, [callNativeIfReady]);

    const changeSelectedTrack = useCallback((index) => {
        setSelectedTrack(index);
        callNativeIfReady('setSelectedTrack', [index]);
    }, [callNativeIfReady]);

    const changeCurrentPage = useCallback((index) => {
        setCurrentPage(index);
        callNativeIfReady('setCurrentPage', [index]);
    }, [callNativeIfReady]);

    const updateUiScale = useCallback((scale) => {
        setUiScale(scale);
        callNativeIfReady('setWindowScale', [scale]);
    }, [callNativeIfReady]);

    const setTrackLength = useCallback((trackIndex, length) => {
        patchActivePattern((data) => setTrackLengthInData(data, trackIndex, length));
        callNativeIfReady('setTrackLength', [trackIndex, length]);
    }, [callNativeIfReady, patchActivePattern]);

    const setTrackSequence = useCallback((trackIndex, sequence) => {
        patchActivePattern((data) => setTrackSequenceInData(data, trackIndex, sequence));
        callNativeIfReady('setTrackSequence', [trackIndex, sequence]);
    }, [callNativeIfReady, patchActivePattern]);

    const setTrackScale = useCallback((trackIndex, scale) => {
        patchActivePattern((data) => setTrackScaleInData(data, trackIndex, scale));
        callNativeIfReady('setTrackScale', [trackIndex, scale]);
    }, [callNativeIfReady, patchActivePattern]);

    const changeVisibleTracks = useCallback((count) => {
        setVisibleTracks(count);
        callNativeIfReady('setVisibleTracks', [count]);
    }, [callNativeIfReady]);

    const setTrackTimeDivision = useCallback((trackIndex, divisionIndex) => {
        patchActivePattern((data) => setTrackTimeDivisionInData(data, trackIndex, divisionIndex));
        callNativeIfReady('setTrackTimeDivision', [trackIndex, divisionIndex]);
    }, [callNativeIfReady, patchActivePattern]);

    const setTrackRandomAmount = useCallback((trackIndex, paramIndex, amount) => {
        patchActivePattern((data) => setTrackRandomAmountInData(data, trackIndex, paramIndex, amount));
        callNativeIfReady('setTrackRandomAmount', [trackIndex, paramIndex, amount]);
    }, [callNativeIfReady, patchActivePattern]);

    const resetAutomationLane = useCallback((trackIndex, paramName) => {
        patchActivePattern((data) => resetAutomationLaneInData(data, trackIndex, paramName));
        callNativeIfReady('resetAutomationLane', [trackIndex, paramName]);
    }, [callNativeIfReady, patchActivePattern]);

    const randomizeTrack = useCallback(async (trackIndex) => {
        if (!backendReady) return;
        await invokeNative('randomizeTrack', [trackIndex]);
        const savedState = await invokeNative('requestInitialState');
        const parsedState = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
        setPatterns(normalizeLoadedState(parsedState).patterns);
    }, [backendReady, invokeNative]);

    const randomizeParameter = useCallback(async (trackIndex, paramName) => {
        if (!backendReady) return;
        await invokeNative('randomizeParameter', [trackIndex, paramName]);
        const savedState = await invokeNative('requestInitialState');
        const parsedState = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
        setPatterns(normalizeLoadedState(parsedState).patterns);
    }, [backendReady, invokeNative]);

    const syncPatternToEngine = useCallback((_patternData, metadataPatch = {}) => {
        if (Object.prototype.hasOwnProperty.call(metadataPatch, 'activeIdx')) {
            changeActivePattern(metadataPatch.activeIdx);
        }

        if (Object.prototype.hasOwnProperty.call(metadataPatch, 'selectedTrack')) {
            changeSelectedTrack(metadataPatch.selectedTrack);
        }

        if (Object.prototype.hasOwnProperty.call(metadataPatch, 'currentPage')) {
            const page = metadataPatch.currentPage;
            setActiveSection(page);
            changeCurrentPage(page);
        }
    }, [changeActivePattern, changeCurrentPage, changeSelectedTrack]);

    const updateUiAndEngine = useCallback((patch) => {
        const patternIndex = activeIdxRef.current;
        const currentData = patternsRef.current[patternIndex]?.data;
        if (!currentData) return;

        applyPatternDataPatch(patternIndex, { ...currentData, ...patch });
        if (!backendReady) return;

        if (patch.activeSteps) {
            patch.activeSteps.forEach((trackSteps, trackIndex) => {
                trackSteps.forEach((value, stepIndex) => {
                    if (value !== currentData.activeSteps[trackIndex][stepIndex]) {
                        invokeNative('setStepActive', [patternIndex, trackIndex, stepIndex, value]).catch(console.error);
                    }
                });
            });
        }

        ['velocities', 'gates', 'probabilities', 'shifts', 'swings', 'repeats', 'pitches'].forEach((paramName) => {
            if (!patch[paramName]) return;
            patch[paramName].forEach((trackValues, trackIndex) => {
                trackValues.forEach((value, stepIndex) => {
                    if (value !== currentData[paramName][trackIndex][stepIndex]) {
                        invokeNative('setStepParameter', [patternIndex, trackIndex, stepIndex, paramName, toNativeParameterValue(paramName, value)]).catch(console.error);
                    }
                });
            });
        });

        if (patch.midiKeys) {
            patch.midiKeys.forEach((noteName, trackIndex) => {
                if (noteName !== currentData.midiKeys[trackIndex]) {
                    invokeNative('setTrackMidiKey', [trackIndex, noteNameToMidi(noteName)]).catch(console.error);
                }
            });
        }

        if (patch.trackStates) {
            patch.trackStates.forEach((nextState, trackIndex) => {
                const previousState = currentData.trackStates[trackIndex] || {};
                if (nextState.mute !== previousState.mute) invokeNative('setTrackState', [trackIndex, 'mute', !!nextState.mute]).catch(console.error);
                if (nextState.solo !== previousState.solo) invokeNative('setTrackState', [trackIndex, 'solo', !!nextState.solo]).catch(console.error);
                if (typeof nextState.midiChannel === 'number' && nextState.midiChannel !== previousState.midiChannel) {
                    invokeNative('setTrackMidiChannel', [trackIndex, nextState.midiChannel]).catch(console.error);
                }
            });
        }
    }, [applyPatternDataPatch, backendReady, invokeNative]);

    useEffect(() => {
        let cancelled = false;

        const initBackend = async () => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            try {
                let retries = 120;
                while (!window.__JUCE__?.backend && retries > 0) {
                    if (!cancelled) setBackendStatus('Waiting for JUCE backend...');
                    await wait(50);
                    retries -= 1;
                }

                if (window.__JUCE__?.initialisationPromise) {
                    await window.__JUCE__.initialisationPromise;
                }

                retries = 120;
                while (retries > 0) {
                    try {
                        resolveNativeFunctions();
                        if (!backendSupportsEvents()) {
                            throw new Error('JUCE backend event API is unavailable');
                        }

                        if (!cancelled) {
                            setBackendReady(true);
                            setBackendStatus('JUCE bridge ready. Starting hydration...');
                            setDebugInfo('Resolved native functions and event bridge');
                        }
                        return;
                    } catch (error) {
                        if (!cancelled) {
                            setBackendStatus('Waiting for JUCE native functions...');
                            setDebugInfo(error.message);
                        }
                        await wait(50);
                        retries -= 1;
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    setBackendStatus(`Init failed: ${error.message}`);
                    setDebugInfo(error.stack || String(error));
                }
            }
        };

        initBackend();
        return () => {
            cancelled = true;
        };
    }, [backendSupportsEvents, resolveNativeFunctions]);

    useEffect(() => {
        if (!backendReady || !backendSupportsEvents()) return undefined;

        const handlePlaybackState = (event) => {
            if (event?.bpm) setBpm(Math.round(event.bpm));
            setIsPlaying(!!event?.isPlaying);
            const nextStep = event?.isPlaying && event?.currentStep >= 0 ? event.currentStep : -1;
            setCurrentStep(nextStep);
            window.dispatchEvent(new CustomEvent('juce-playhead', { detail: nextStep }));
        };

        const listenerHandle = window.__JUCE__.backend.addEventListener('playbackState', handlePlaybackState);
        return () => window.__JUCE__.backend.removeEventListener(listenerHandle);
    }, [backendReady, backendSupportsEvents]);

    useEffect(() => {
        if (!backendReady || !backendSupportsEvents()) return undefined;

        const handleEngineDiff = (event) => {
            if (!hasHydrated.current) return;

            if (event?.type === 'selectedTrackChanged' && Number.isInteger(event.selectedTrack)) {
                setSelectedTrack(event.selectedTrack);
                return;
            }

            if (event?.type === 'currentPageChanged') {
                if (Number.isInteger(event.currentPage)) setCurrentPage(event.currentPage);
                if (Number.isInteger(event.activeSection)) setActiveSection(event.activeSection);
                return;
            }

            if (event?.type === 'activePatternChanged' && Number.isInteger(event.activeIdx)) {
                setActiveIdx(event.activeIdx);
                return;
            }

            setPatterns((previousPatterns) => applyEngineDiffToPatterns(previousPatterns, event));
        };

        const listenerHandle = window.__JUCE__.backend.addEventListener('engineDiff', handleEngineDiff);
        return () => window.__JUCE__.backend.removeEventListener(listenerHandle);
    }, [backendReady, backendSupportsEvents]);

    useEffect(() => {
        if (!backendReady || hasHydrated.current) return undefined;
        let cancelled = false;

        const hydrate = async () => {
            let normalizedState = normalizeLoadedState(null);

            try {
                setBackendStatus('Calling requestInitialState...');
                const savedState = await invokeNative('requestInitialState');
                if (cancelled) return;
                const parsedState = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
                normalizedState = normalizeLoadedState(parsedState);
            } catch (error) {
                console.error('requestInitialState failed', error);
            }

            if (cancelled) return;

            setPatterns(normalizedState.patterns);
            setActiveIdx(normalizedState.activeIdx);
            setThemeIdx(normalizedState.themeIdx);
            setSelectedTrack(normalizedState.selectedTrack);
            setCurrentPage(normalizedState.currentPage);
            setActiveSection(normalizedState.activeSection ?? -1);
            setFooterTab(normalizedState.footerTab);
            setUiScale(normalizedState.uiScale ?? 1);
            setVisibleTracks(normalizedState.visibleTracks ?? 16);

            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            if (cancelled) return;

            try {
                await invokeNative('uiReadyForEngineState');
            } catch (error) {
                console.error(error);
            }

            if (cancelled) return;
            hasHydrated.current = true;
            setUiReady(true);
            setBackendStatus('JUCE ready. UI hydrated.');
        };

        hydrate().catch(() => {
            if (!cancelled) {
                hasHydrated.current = true;
                setUiReady(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [backendReady, invokeNative]);

    const uiMetadata = useMemo(() => selectUiMetadata({
        activeIdx,
        themeIdx,
        selectedTrack,
        currentPage,
        activeSection,
        footerTab,
        uiScale,
        visibleTracks,
    }), [activeIdx, themeIdx, selectedTrack, currentPage, activeSection, footerTab, uiScale, visibleTracks]);

    useEffect(() => {
        if (!hasHydrated.current || !backendReady) return undefined;

        if (saveUiTimeoutRef.current) {
            window.clearTimeout(saveUiTimeoutRef.current);
        }

        saveUiTimeoutRef.current = window.setTimeout(() => {
            invokeNative('saveUiMetadata', [JSON.stringify(uiMetadata)]).catch(console.error);
        }, SAVE_UI_DELAY_MS);

        return () => {
            if (saveUiTimeoutRef.current) {
                window.clearTimeout(saveUiTimeoutRef.current);
            }
        };
    }, [backendReady, invokeNative, uiMetadata]);

    return {
        patterns,
        activeIdx,
        isPlaying,
        bpm,
        currentStep,
        activeSection,
        currentPage,
        selectedTrack,
        footerTab,
        themeIdx,
        uiScale,
        visibleTracks,

        setActiveIdx: changeActivePattern,
        setActiveSection,
        setCurrentPage: changeCurrentPage,
        setSelectedTrack: changeSelectedTrack,
        setFooterTab,
        setThemeIdx,
        updateUiScale,
        changeActivePattern,
        changeSelectedTrack,
        changeCurrentPage,
        changeVisibleTracks,

        updateUiAndEngine,
        syncPatternToEngine,
        editStepActive,
        editStepParameter,
        editTrackState,
        editTrackMidiKey,
        editTrackMidiChannel,
        editClearTrack,

        setTrackLength,
        setTrackSequence,
        setTrackScale,
        setTrackTimeDivision,
        randomizeTrack,
        randomizeParameter,
        setTrackRandomAmount,
        resetAutomationLane,

        backendReady,
        uiReady,
        backendStatus,
        debugInfo,
        hasHydrated,
    };
}
