import { useState, useEffect, useCallback, useRef } from 'react';
import * as Juce from 'juce-framework-frontend';
import { normalizeLoadedState, createEmptyPattern, noteNameToMidi } from '../utils/helpers';
import { PATTERN_LABELS } from '../utils/constants';

const REQUIRED_NATIVE_FUNCTIONS = [
    'saveUiMetadata', 'requestInitialState', 'uiReadyForEngineState', 
    'setStepActive', 'setStepParameter', 'setTrackState', 'setTrackMidiKey', 'setTrackMidiChannel', 'clearTrack',
    'setActivePattern', 'setSelectedTrack', 'setCurrentPage'
];

export function useJuceBridge() {
    const [patterns, setPatterns] = useState(PATTERN_LABELS.map(l => createEmptyPattern(`Pattern ${l}`)));
    const [activeIdx, setActiveIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [currentStep, setCurrentStep] = useState(-1); // FIX: React Playhead State
    const [activeSection, setActiveSection] = useState(-1);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedTrack, setSelectedTrack] = useState(0);
    const [footerTab, setFooterTab] = useState('Velocity');
    const [themeIdx, setThemeIdx] = useState(0);

    const [backendReady, setBackendReady] = useState(false);
    const [uiReady, setUiReady] = useState(false);
    const [backendStatus, setBackendStatus] = useState('Booting...');
    const [debugInfo, setDebugInfo] = useState('');

    const hasHydrated = useRef(false);
    const saveUiTimeout = useRef(null);
    const nativeFnsRef = useRef({});

    const invokeNativeWithTimeout = useCallback(async (name, args = [], timeoutMs = 500) => {
        const fn = nativeFnsRef.current[name];
        if (!fn) return;
        Promise.resolve().then(() => fn(...args)).catch(console.error);
    }, []);

    // --- Granular Pattern Mutators ---
    const editStepActive = useCallback((pIdx, tIdx, sIdx, isActive) => {
        setPatterns(prev => {
            const next = [...prev];
            const nextActive = next[pIdx].data.activeSteps.map(row => [...row]);
            nextActive[tIdx][sIdx] = isActive;
            next[pIdx] = { ...next[pIdx], data: { ...next[pIdx].data, activeSteps: nextActive } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('setStepActive', [pIdx, tIdx, sIdx, isActive]);
    }, [backendReady, invokeNativeWithTimeout]);

    const editStepParameter = useCallback((pIdx, tIdx, sIdx, paramName, value) => {
        setPatterns(prev => {
            const next = [...prev];
            const nextParam = next[pIdx].data[paramName].map(row => [...row]);
            nextParam[tIdx][sIdx] = value;
            next[pIdx] = { ...next[pIdx], data: { ...next[pIdx].data, [paramName]: nextParam } };
            return next;
        });
        let cValue = paramName === 'repeats' ? value : value / 100.0;
        if (backendReady) invokeNativeWithTimeout('setStepParameter', [pIdx, tIdx, sIdx, paramName, cValue]);
    }, [backendReady, invokeNativeWithTimeout]);

    const editTrackState = useCallback((tIdx, stateName, isEnabled) => {
        setPatterns(prev => {
            const next = [...prev];
            const nextStates = next[activeIdx].data.trackStates.map((s, i) => i === tIdx ? { ...s, [stateName]: isEnabled } : s);
            next[activeIdx] = { ...next[activeIdx], data: { ...next[activeIdx].data, trackStates: nextStates } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('setTrackState', [tIdx, stateName, isEnabled]);
    }, [activeIdx, backendReady, invokeNativeWithTimeout]);

    const editTrackMidiKey = useCallback((tIdx, midiNoteName) => {
        setPatterns(prev => {
            const next = [...prev];
            const nextKeys = [...next[activeIdx].data.midiKeys];
            nextKeys[tIdx] = midiNoteName;
            next[activeIdx] = { ...next[activeIdx], data: { ...next[activeIdx].data, midiKeys: nextKeys } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('setTrackMidiKey', [tIdx, noteNameToMidi(midiNoteName)]);
    }, [activeIdx, backendReady, invokeNativeWithTimeout]);

    const editTrackMidiChannel = useCallback((tIdx, channel) => {
        setPatterns(prev => {
            const next = [...prev];
            const nextStates = next[activeIdx].data.trackStates.map((s, i) => i === tIdx ? { ...s, midiChannel: channel } : s);
            next[activeIdx] = { ...next[activeIdx], data: { ...next[activeIdx].data, trackStates: nextStates } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('setTrackMidiChannel', [tIdx, channel]);
    }, [activeIdx, backendReady, invokeNativeWithTimeout]);

    const editClearTrack = useCallback((pIdx, tIdx) => {
         setPatterns(prev => {
            const next = [...prev];
            const nextActive = next[pIdx].data.activeSteps.map(row => [...row]);
            nextActive[tIdx] = Array(32).fill(false);
            next[pIdx] = { ...next[pIdx], data: { ...next[pIdx].data, activeSteps: nextActive } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('clearTrack', [pIdx, tIdx]);
    }, [backendReady, invokeNativeWithTimeout]);

    // --- Granular Metadata UI Events ---
    const changeActivePattern = useCallback((idx) => {
        setActiveIdx(idx);
        if (backendReady) invokeNativeWithTimeout('setActivePattern', [idx]);
    }, [backendReady, invokeNativeWithTimeout]);

    const changeSelectedTrack = useCallback((idx) => {
        setSelectedTrack(idx);
        if (backendReady) invokeNativeWithTimeout('setSelectedTrack', [idx]);
    }, [backendReady, invokeNativeWithTimeout]);

    const changeCurrentPage = useCallback((idx) => {
        setCurrentPage(idx);
        if (backendReady) invokeNativeWithTimeout('setCurrentPage', [idx]);
    }, [backendReady, invokeNativeWithTimeout]);


    useEffect(() => {
        let cancelled = false;
        const initBackend = async () => {
            let retries = 120;
            while (!window.__JUCE__?.backend && retries > 0) { await new Promise(r => setTimeout(r, 50)); retries--; }
            if (window.__JUCE__?.initialisationPromise) await window.__JUCE__.initialisationPromise;
            
            try {
                for (const name of REQUIRED_NATIVE_FUNCTIONS) nativeFnsRef.current[name] = Juce.getNativeFunction(name);
                if (!cancelled) setBackendReady(true);
            } catch (err) {}
        };
        initBackend();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!backendReady) return;
        const hPlayback = (e) => {
            if (e?.bpm) setBpm(Math.round(e.bpm));
            setIsPlaying(!!e?.isPlaying);
            setCurrentStep((e?.isPlaying && e?.currentStep >= 0) ? e.currentStep : -1);
        };
        const l1 = window.__JUCE__.backend.addEventListener('playbackState', hPlayback);
        return () => { window.__JUCE__.backend.removeEventListener(l1); };
    }, [backendReady]);

    useEffect(() => {
        if (!backendReady || hasHydrated.current) return;
        let cancelled = false;
        const hydrate = async () => {
            let normalized = normalizeLoadedState(null);
            try {
                const savedState = await new Promise(r => {
                    nativeFnsRef.current.requestInitialState().then(r);
                    setTimeout(() => r(null), 2000);
                });
                if (cancelled) return;
                normalized = normalizeLoadedState(typeof savedState === 'string' ? JSON.parse(savedState) : savedState);
            } catch (err) {}
            
            if (cancelled) return;
            setPatterns(normalized.patterns);
            setActiveIdx(normalized.activeIdx);
            setThemeIdx(normalized.themeIdx);
            setSelectedTrack(normalized.selectedTrack);
            setCurrentPage(normalized.currentPage);
            setActiveSection(normalized.activeSection ?? -1);
            setFooterTab(normalized.footerTab);
            
            if (!cancelled) {
                nativeFnsRef.current.uiReadyForEngineState();
                hasHydrated.current = true;
                setUiReady(true);
            }
        };
        hydrate();
        return () => { cancelled = true; };
    }, [backendReady]);

    useEffect(() => {
        if (!hasHydrated.current || !backendReady) return;
        if (saveUiTimeout.current) window.clearTimeout(saveUiTimeout.current);
        saveUiTimeout.current = window.setTimeout(() => {
            invokeNativeWithTimeout('saveUiMetadata', [JSON.stringify({
                activeIdx, themeIdx, selectedTrack, currentPage, activeSection, footerTab
            })]);
        }, 300);
    }, [activeIdx, themeIdx, selectedTrack, currentPage, activeSection, footerTab, backendReady, invokeNativeWithTimeout]);

    return {
        patterns, activeIdx, isPlaying, bpm, currentStep, activeSection, currentPage,
        selectedTrack, footerTab, themeIdx, setActiveSection, setFooterTab, setThemeIdx,
        changeActivePattern, changeSelectedTrack, changeCurrentPage,
        editStepActive, editStepParameter, editTrackState, editTrackMidiKey, editTrackMidiChannel, editClearTrack,
        backendReady, uiReady, backendStatus, debugInfo, hasHydrated,
    };
}