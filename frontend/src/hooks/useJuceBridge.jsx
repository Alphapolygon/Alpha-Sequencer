import { useState, useEffect, useCallback, useRef } from 'react';
import * as Juce from 'juce-framework-frontend';
import { normalizeLoadedState, createEmptyPattern, noteNameToMidi, midiToNoteName } from '../utils/helpers';
import { PATTERN_LABELS } from '../utils/constants';

const REQUIRED_NATIVE_FUNCTIONS = [
    'saveUiMetadata',
    'requestInitialState',
    'uiReadyForEngineState',
    'setStepActive',
    'setStepParameter',
    'setTrackState',
    'setTrackMidiKey',
    'setTrackMidiChannel',
    'clearTrack',
    'setActivePattern',
    'setSelectedTrack',
    'setCurrentPage',
    'setWindowScale',
    'setTrackLength',
    'randomizeTrack',
    'randomizeParameter',
    'setTrackScale',
    'setTrackSequence',
    'setTrackRandomAmount', 
    'resetAutomationLane',
    'setTrackTimeDivision', 
    'setVisibleTracks'      
];

const SAVE_UI_DELAY_MS = 300;

export function useJuceBridge() {
    const [patterns, setPatterns] = useState(PATTERN_LABELS.map(label => createEmptyPattern(`Pattern ${label}`)));
    const [activeIdx, setActiveIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [currentStep, setCurrentStep] = useState(-1);
    const [activeSection, setActiveSection] = useState(-1);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedTrack, setSelectedTrack] = useState(0);
    const [footerTab, setFooterTab] = useState('Velocity');
    const [themeIdx, setThemeIdx] = useState(0);
    const [uiScale, setUiScale] = useState(1.0);
    const [visibleTracks, setVisibleTracks] = useState(16);

    const [backendReady, setBackendReady] = useState(false);
    const [uiReady, setUiReady] = useState(false);
    const [backendStatus, setBackendStatus] = useState('Booting...');
    const [debugInfo, setDebugInfo] = useState('');

    const hasHydrated = useRef(false);
    const nativeFnsRef = useRef({});
    const saveUiTimeout = useRef(null);
    const patternsRef = useRef(patterns);
    const activeIdxRef = useRef(activeIdx);

    useEffect(() => { patternsRef.current = patterns; }, [patterns]);
    useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

    const backendSupportsEvents = useCallback(() => {
        return !!window.__JUCE__?.backend?.addEventListener && !!window.__JUCE__?.backend?.removeEventListener;
    }, []);

    const invokeNativeWithTimeout = useCallback(async (name, args = []) => {
        const fn = nativeFnsRef.current[name];
        if (!fn) throw new Error(`Native function "${name}" is unavailable`);
        return fn(...args);
    }, []);

    const applyPatternDataPatch = useCallback((patternIndex, updater) => {
        setPatterns(prev => {
            if (patternIndex < 0 || patternIndex >= prev.length) return prev;
            const currentPattern = prev[patternIndex];
            if (!currentPattern) return prev;

            const nextData = typeof updater === 'function' ? updater(currentPattern.data) : updater;
            if (!nextData) return prev;

            const next = [...prev];
            next[patternIndex] = { ...currentPattern, data: nextData };
            return next;
        });
    }, []);

    const resolveNativeFunctions = useCallback(() => {
        const resolved = {};
        for (const name of REQUIRED_NATIVE_FUNCTIONS) {
            resolved[name] = Juce.getNativeFunction(name);
        }
        nativeFnsRef.current = resolved;
    }, []);

    const editStepActive = useCallback((pIdx, tIdx, sIdx, isActive) => {
        applyPatternDataPatch(pIdx, (data) => {
            const nextActiveSteps = data.activeSteps.map((row, rowIdx) => rowIdx === tIdx ? [...row] : row);
            nextActiveSteps[tIdx][sIdx] = isActive;
            return { ...data, activeSteps: nextActiveSteps };
        });
        if (backendReady) invokeNativeWithTimeout('setStepActive', [pIdx, tIdx, sIdx, isActive]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const editStepParameter = useCallback((pIdx, tIdx, sIdx, paramName, value) => {
        applyPatternDataPatch(pIdx, (data) => {
            const nextMatrix = data[paramName].map((row, rowIdx) => rowIdx === tIdx ? [...row] : row);
            nextMatrix[tIdx][sIdx] = value;
            return { ...data, [paramName]: nextMatrix };
        });
        const nativeValue = (paramName === 'repeats' || paramName === 'pitches') ? value : value / 100.0;
        if (backendReady) invokeNativeWithTimeout('setStepParameter', [pIdx, tIdx, sIdx, paramName, nativeValue]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const editTrackState = useCallback((tIdx, stateName, isEnabled) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextTrackStates = data.trackStates.map((state, index) => index === tIdx ? { ...state, [stateName]: isEnabled } : state);
            return { ...data, trackStates: nextTrackStates };
        });
        if (backendReady) invokeNativeWithTimeout('setTrackState', [tIdx, stateName, isEnabled]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const editTrackMidiKey = useCallback((tIdx, midiNoteName) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextMidiKeys = [...data.midiKeys];
            nextMidiKeys[tIdx] = midiNoteName;
            return { ...data, midiKeys: nextMidiKeys };
        });
        if (backendReady) invokeNativeWithTimeout('setTrackMidiKey', [tIdx, noteNameToMidi(midiNoteName)]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const editTrackMidiChannel = useCallback((tIdx, channel) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextTrackStates = data.trackStates.map((state, index) => index === tIdx ? { ...state, midiChannel: channel } : state);
            return { ...data, trackStates: nextTrackStates };
        });
        if (backendReady) invokeNativeWithTimeout('setTrackMidiChannel', [tIdx, channel]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const editClearTrack = useCallback((pIdx, tIdx) => {
        applyPatternDataPatch(pIdx, (data) => {
            const nextActiveSteps = data.activeSteps.map((row, rowIdx) => rowIdx === tIdx ? Array(32).fill(false) : row);
            return { ...data, activeSteps: nextActiveSteps };
        });
        if (backendReady) invokeNativeWithTimeout('clearTrack', [pIdx, tIdx]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const changeActivePattern = useCallback((idx) => {
        setActiveIdx(idx);
        if (backendReady) invokeNativeWithTimeout('setActivePattern', [idx]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

    const changeSelectedTrack = useCallback((idx) => {
        setSelectedTrack(idx);
        if (backendReady) invokeNativeWithTimeout('setSelectedTrack', [idx]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

    const changeCurrentPage = useCallback((idx) => {
        setCurrentPage(idx);
        if (backendReady) invokeNativeWithTimeout('setCurrentPage', [idx]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

    const updateUiScale = useCallback((scale) => {
        setUiScale(scale);
        if (backendReady) invokeNativeWithTimeout('setWindowScale', [scale]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

    // Polymeter Link
    const setTrackLength = useCallback((tIdx, len) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextTrackStates = data.trackStates.map((state, index) => index === tIdx ? { ...state, length: len } : state);
            return { ...data, trackStates: nextTrackStates };
        });
        if (backendReady) invokeNativeWithTimeout('setTrackLength', [tIdx, len]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    // Sequence Melodic Links
    const setTrackSequence = useCallback((tIdx, seq) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextTrackStates = data.trackStates.map((state, index) => index === tIdx ? { ...state, sequence: seq } : state);
            return { ...data, trackStates: nextTrackStates };
        });
        if (backendReady) invokeNativeWithTimeout('setTrackSequence', [tIdx, seq]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const setTrackScale = useCallback((tIdx, scale) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextTrackStates = data.trackStates.map((state, index) => index === tIdx ? { ...state, scale: scale } : state);
            return { ...data, trackStates: nextTrackStates };
        });
        if (backendReady) invokeNativeWithTimeout('setTrackScale', [tIdx, scale]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

     const changeVisibleTracks = useCallback((num) => {
        setVisibleTracks(num);
        if (backendReady) invokeNativeWithTimeout('setVisibleTracks', [num]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

   
    const setTrackTimeDivision = useCallback((tIdx, divIdx) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextTrackStates = data.trackStates.map((state, index) => 
                index === tIdx ? { ...state, timeDivision: divIdx } : state
            );
            return { ...data, trackStates: nextTrackStates };
        });
        if (backendReady) invokeNativeWithTimeout('setTrackTimeDivision', [tIdx, divIdx]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    // Randomization Links (Forces state sync to UI instantly)
    const randomizeTrack = useCallback(async (tIdx) => {
        if (!backendReady) return;
        await invokeNativeWithTimeout('randomizeTrack', [tIdx]);
        const savedState = await invokeNativeWithTimeout('requestInitialState');
        const parsedState = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
        setPatterns(normalizeLoadedState(parsedState).patterns);
    }, [backendReady, invokeNativeWithTimeout]);

    const randomizeParameter = useCallback(async (tIdx, paramName) => {
        if (!backendReady) return;
        await invokeNativeWithTimeout('randomizeParameter', [tIdx, paramName]);
        const savedState = await invokeNativeWithTimeout('requestInitialState');
        const parsedState = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
        setPatterns(normalizeLoadedState(parsedState).patterns);
    }, [backendReady, invokeNativeWithTimeout]);

    const setTrackRandomAmount = useCallback((tIdx, paramIdx, amount) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextRandomAmounts = data.randomAmounts.map((arr, index) => index === tIdx ? [...arr] : arr);
            nextRandomAmounts[tIdx][paramIdx] = amount;
            return { ...data, randomAmounts: nextRandomAmounts };
        });
        if (backendReady) invokeNativeWithTimeout('setTrackRandomAmount', [tIdx, paramIdx, amount]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const resetAutomationLane = useCallback((tIdx, paramName) => {
        applyPatternDataPatch(activeIdxRef.current, (data) => {
            const nextMatrix = data[paramName].map((row, rowIdx) => rowIdx === tIdx ? [...row] : row);
            for (let s = 0; s < 32; s++) {
                if (paramName === 'velocities') nextMatrix[tIdx][s] = 100;
                else if (paramName === 'gates') nextMatrix[tIdx][s] = 75;
                else if (paramName === 'probabilities') nextMatrix[tIdx][s] = 100;
                else if (paramName === 'shifts') nextMatrix[tIdx][s] = 50;
                else if (paramName === 'swings') nextMatrix[tIdx][s] = 0;
                else if (paramName === 'pitches') nextMatrix[tIdx][s] = 0;
            }
            
            const paramIdx = paramName === 'gates' ? 1 : paramName === 'probabilities' ? 2 : paramName === 'shifts' ? 3 : paramName === 'swings' ? 4 : paramName === 'pitches' ? 5 : 0;
            const nextRandomAmounts = data.randomAmounts.map((arr, index) => index === tIdx ? [...arr] : arr);
            nextRandomAmounts[tIdx][paramIdx] = 0;

            return { ...data, [paramName]: nextMatrix, randomAmounts: nextRandomAmounts };
        });
        if (backendReady) invokeNativeWithTimeout('resetAutomationLane', [tIdx, paramName]).catch(console.error);
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const syncPatternToEngine = useCallback((_patternData, metadataPatch = {}) => {
        if (Object.prototype.hasOwnProperty.call(metadataPatch, 'activeIdx')) changeActivePattern(metadataPatch.activeIdx);
        if (Object.prototype.hasOwnProperty.call(metadataPatch, 'selectedTrack')) changeSelectedTrack(metadataPatch.selectedTrack);
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
            for (let t = 0; t < patch.activeSteps.length; t++) {
                for (let s = 0; s < patch.activeSteps[t].length; s++) {
                    if (patch.activeSteps[t][s] !== currentData.activeSteps[t][s]) {
                        invokeNativeWithTimeout('setStepActive', [patternIndex, t, s, patch.activeSteps[t][s]]).catch(console.error);
                    }
                }
            }
        }

        for (const paramName of ['velocities', 'gates', 'probabilities', 'shifts', 'swings', 'repeats', 'pitches']) {
            if (!patch[paramName]) continue;
            for (let t = 0; t < patch[paramName].length; t++) {
                for (let s = 0; s < patch[paramName][t].length; s++) {
                    if (patch[paramName][t][s] !== currentData[paramName][t][s]) {
                       const nativeValue = (paramName === 'repeats' || paramName === 'pitches') ? patch[paramName][t][s] : patch[paramName][t][s] / 100.0;
                        invokeNativeWithTimeout('setStepParameter', [patternIndex, t, s, paramName, nativeValue]).catch(console.error);
                    }
                }
            }
        }

        if (patch.midiKeys) {
            for (let t = 0; t < patch.midiKeys.length; t++) {
                if (patch.midiKeys[t] !== currentData.midiKeys[t]) {
                    invokeNativeWithTimeout('setTrackMidiKey', [t, noteNameToMidi(patch.midiKeys[t])]).catch(console.error);
                }
            }
        }

        if (patch.trackStates) {
            for (let t = 0; t < patch.trackStates.length; t++) {
                const prevState = currentData.trackStates[t] || {};
                const nextState = patch.trackStates[t] || {};

                if (nextState.mute !== prevState.mute) invokeNativeWithTimeout('setTrackState', [t, 'mute', !!nextState.mute]).catch(console.error);
                if (nextState.solo !== prevState.solo) invokeNativeWithTimeout('setTrackState', [t, 'solo', !!nextState.solo]).catch(console.error);
                if (typeof nextState.midiChannel === 'number' && nextState.midiChannel !== prevState.midiChannel) invokeNativeWithTimeout('setTrackMidiChannel', [t, nextState.midiChannel]).catch(console.error);
            }
        }
    }, [applyPatternDataPatch, backendReady, invokeNativeWithTimeout]);

    const applyEngineDiff = useCallback((diff) => {
        if (!diff || typeof diff.type !== 'string') return;

        switch (diff.type) {
            case 'selectedTrackChanged':
                if (Number.isInteger(diff.selectedTrack)) setSelectedTrack(diff.selectedTrack);
                return;
            case 'currentPageChanged':
                if (Number.isInteger(diff.currentPage)) setCurrentPage(diff.currentPage);
                if (Number.isInteger(diff.activeSection)) setActiveSection(diff.activeSection);
                return;
            case 'activePatternChanged':
                if (Number.isInteger(diff.activeIdx)) setActiveIdx(diff.activeIdx);
                return;
            case 'stepActiveChanged':
                if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.stepIndex)) {
                    applyPatternDataPatch(diff.patternIndex, (data) => {
                        const nextActiveSteps = data.activeSteps.map((row, rowIdx) => rowIdx === diff.trackIndex ? [...row] : row);
                        nextActiveSteps[diff.trackIndex][diff.stepIndex] = !!diff.isActive;
                        return { ...data, activeSteps: nextActiveSteps };
                    });
                }
                return;
            case 'stepParameterChanged':
                if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.stepIndex) && typeof diff.paramName === 'string') {
                    applyPatternDataPatch(diff.patternIndex, (data) => {
                        const currentMatrix = data[diff.paramName];
                        if (!currentMatrix) return data;
                        const nextMatrix = currentMatrix.map((row, rowIdx) => rowIdx === diff.trackIndex ? [...row] : row);
                        nextMatrix[diff.trackIndex][diff.stepIndex] = diff.value;
                        return { ...data, [diff.paramName]: nextMatrix };
                    });
                }
                return;
            case 'trackStateChanged':
                if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && typeof diff.stateName === 'string') {
                    applyPatternDataPatch(diff.patternIndex, (data) => {
                        const nextTrackStates = data.trackStates.map((state, index) => index === diff.trackIndex ? { ...state, [diff.stateName]: !!diff.isEnabled } : state);
                        return { ...data, trackStates: nextTrackStates };
                    });
                }
                return;
            case 'trackMidiKeyChanged':
                if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.midiNote)) {
                    applyPatternDataPatch(diff.patternIndex, (data) => {
                        const nextMidiKeys = [...data.midiKeys];
                        nextMidiKeys[diff.trackIndex] = midiToNoteName(diff.midiNote);
                        return { ...data, midiKeys: nextMidiKeys };
                    });
                }
                return;
            case 'trackMidiChannelChanged':
                if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.midiChannel)) {
                    applyPatternDataPatch(diff.patternIndex, (data) => {
                        const nextTrackStates = data.trackStates.map((state, index) => index === diff.trackIndex ? { ...state, midiChannel: diff.midiChannel } : state);
                        return { ...data, trackStates: nextTrackStates };
                    });
                }
                return;
            case 'pageCleared':
                if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.pageIndex)) {
                    const startStep = diff.pageIndex * 8;
                    applyPatternDataPatch(diff.patternIndex, (data) => {
                        const nextActiveSteps = data.activeSteps.map((row, rowIdx) => rowIdx === diff.trackIndex ? [...row] : row);
                        for (let step = startStep; step < startStep + 8; step++) nextActiveSteps[diff.trackIndex][step] = false;
                        return { ...data, activeSteps: nextActiveSteps };
                    });
                }
                return;
            case 'trackCleared':
                if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex)) {
                    applyPatternDataPatch(diff.patternIndex, (data) => {
                        const nextActiveSteps = data.activeSteps.map((row, rowIdx) => rowIdx === diff.trackIndex ? Array(32).fill(false) : row);
                        return { ...data, activeSteps: nextActiveSteps };
                    });
                }
                return;
            case 'trackLengthChanged':
                if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.length)) {
                    applyPatternDataPatch(diff.patternIndex, (data) => {
                        const nextTrackStates = data.trackStates.map((state, index) => index === diff.trackIndex ? { ...state, length: diff.length } : state);
                        return { ...data, trackStates: nextTrackStates };
                    });
                }
                return;
            default:
                return;
        }
    }, [applyPatternDataPatch]);

    useEffect(() => {
        let cancelled = false;

        const initBackend = async () => {
            const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            try {
                let retries = 120;
                while (!window.__JUCE__?.backend && retries > 0) {
                    if (!cancelled) setBackendStatus('Waiting for JUCE backend...');
                    await wait(50);
                    retries--;
                }
                if (window.__JUCE__?.initialisationPromise) await window.__JUCE__.initialisationPromise;
                retries = 120;
                while (retries > 0) {
                    try {
                        resolveNativeFunctions();
                        if (!backendSupportsEvents()) throw new Error('JUCE backend event API is unavailable');
                        if (!cancelled) {
                            setBackendReady(true);
                            setBackendStatus('JUCE bridge ready. Starting hydration...');
                            setDebugInfo('Resolved native functions and event bridge');
                        }
                        return;
                    } catch (err) {
                        if (!cancelled) {
                            setBackendStatus('Waiting for JUCE native functions...');
                            setDebugInfo(err.message);
                        }
                        await wait(50);
                        retries--;
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setBackendStatus(`Init failed: ${err.message}`);
                    setDebugInfo(err.stack || String(err));
                }
            }
        };

        initBackend();
        return () => { cancelled = true; };
    }, [backendSupportsEvents, resolveNativeFunctions]);

    useEffect(() => {
        if (!backendReady || !backendSupportsEvents()) return undefined;
        const handlePlaybackState = (event) => {
            if (event?.bpm) setBpm(Math.round(event.bpm));
            setIsPlaying(!!event?.isPlaying);
            const step = (event?.isPlaying && event?.currentStep >= 0) ? event.currentStep : -1;
            setCurrentStep(step);
            window.dispatchEvent(new CustomEvent('juce-playhead', { detail: step }));
        };
        const listenerHandle = window.__JUCE__.backend.addEventListener('playbackState', handlePlaybackState);
        return () => window.__JUCE__.backend.removeEventListener(listenerHandle);
    }, [backendReady, backendSupportsEvents]);

    useEffect(() => {
        if (!backendReady || !backendSupportsEvents()) return undefined;
        const handleEngineDiff = (event) => {
            if (!hasHydrated.current) return;
            applyEngineDiff(event);
        };
        const listenerHandle = window.__JUCE__.backend.addEventListener('engineDiff', handleEngineDiff);
        return () => window.__JUCE__.backend.removeEventListener(listenerHandle);
    }, [applyEngineDiff, backendReady, backendSupportsEvents]);

    useEffect(() => {
        if (!backendReady || hasHydrated.current) return;
        let cancelled = false;

        const hydrate = async () => {
            let normalized = normalizeLoadedState(null);
            try {
                setBackendStatus('Calling requestInitialState...');
                const savedState = await invokeNativeWithTimeout('requestInitialState');
                if (cancelled) return;
                const parsedState = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
                normalized = normalizeLoadedState(parsedState);
            } catch (err) {
                console.error('requestInitialState failed or timed out', err);
            }
            if (cancelled) return;

            setPatterns(normalized.patterns);
            setActiveIdx(normalized.activeIdx);
            setThemeIdx(normalized.themeIdx);
            setSelectedTrack(normalized.selectedTrack);
            setCurrentPage(normalized.currentPage);
            setActiveSection(normalized.activeSection ?? -1);
            setFooterTab(normalized.footerTab);
            setUiScale(normalized.uiScale ?? 1.0);
            setVisibleTracks(normalized.visibleTracks ?? 16);

            await new Promise(resolve => window.requestAnimationFrame(() => resolve()));
            if (cancelled) return;

            try { await invokeNativeWithTimeout('uiReadyForEngineState'); } catch (err) { console.error(err); }

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

        return () => { cancelled = true; };
    }, [backendReady, invokeNativeWithTimeout]);

    useEffect(() => {
        if (!hasHydrated.current || !backendReady) return;
        if (saveUiTimeout.current) window.clearTimeout(saveUiTimeout.current);

        saveUiTimeout.current = window.setTimeout(() => {
            invokeNativeWithTimeout('saveUiMetadata', [JSON.stringify({
                activeIdx,
                themeIdx,
                selectedTrack,
                currentPage,
                activeSection,
                footerTab,
                uiScale,
                visibleTracks,
            })]).catch(console.error);
        }, SAVE_UI_DELAY_MS);

        return () => { if (saveUiTimeout.current) window.clearTimeout(saveUiTimeout.current); };
    }, [activeIdx, themeIdx, selectedTrack, currentPage, activeSection, footerTab, uiScale, backendReady, invokeNativeWithTimeout]);

    return {
        patterns, activeIdx, isPlaying, bpm, currentStep, activeSection,
        currentPage, selectedTrack, footerTab, themeIdx, uiScale, visibleTracks,

        setActiveIdx: changeActivePattern,
        setActiveSection,
        setCurrentPage: changeCurrentPage,
        setSelectedTrack: changeSelectedTrack,
        setFooterTab, setThemeIdx, updateUiScale,
        changeActivePattern, changeSelectedTrack, changeCurrentPage,
        changeVisibleTracks,

        updateUiAndEngine, syncPatternToEngine,
        editStepActive, editStepParameter, editTrackState, editTrackMidiKey,
        editTrackMidiChannel, editClearTrack,
        
        setTrackLength, setTrackSequence, setTrackScale,
        setTrackTimeDivision,
        randomizeTrack, randomizeParameter,
        setTrackRandomAmount, resetAutomationLane,

        backendReady, uiReady, backendStatus, debugInfo, hasHydrated,
    };
}