import { useState, useEffect, useCallback, useRef } from 'react';
import * as Juce from 'juce-framework-frontend';
import { normalizeLoadedState, createEmptyPattern, noteNameToMidi } from '../utils/helpers';
import { PATTERN_LABELS } from '../utils/constants';

const REQUIRED_NATIVE_FUNCTIONS = [
    'updateCPlusPlusState', 'saveUiMetadata', 'requestInitialState',
    'uiReadyForEngineState', 'setWindowScale', 'setStepActive',
    'setStepParameter', 'setTrackState', 'setTrackMidiKey', 'setTrackMidiChannel', 'clearTrack'
];

const wait = (ms) => new Promise(resolve => window.setTimeout(resolve, ms));

export function useJuceBridge() {
    const [patterns, setPatterns] = useState(PATTERN_LABELS.map(l => createEmptyPattern(`Pattern ${l}`)));
    const [activeIdx, setActiveIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [activeSection, setActiveSection] = useState(-1);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedTrack, setSelectedTrack] = useState(0);
    const [footerTab, setFooterTab] = useState('Velocity');
    const [themeIdx, setThemeIdx] = useState(0);
    const [uiScale, setUiScale] = useState(1.0);

    const [backendReady, setBackendReady] = useState(false);
    const [uiReady, setUiReady] = useState(false);
    const [backendStatus, setBackendStatus] = useState('Initializing JUCE bridge...');
    const [debugInfo, setDebugInfo] = useState('Waiting for window.__JUCE__...');

    const hasHydrated = useRef(false);
    const saveUiTimeout = useRef(null);
    const nativeFnsRef = useRef({});

    const backendSupportsEvents = useCallback(() => {
        return !!window.__JUCE__?.backend && typeof window.__JUCE__.backend.addEventListener === 'function';
    }, []);

    const resolveNativeFunctions = useCallback(() => {
        const resolved = {};
        for (const name of REQUIRED_NATIVE_FUNCTIONS) {
            const fn = Juce.getNativeFunction(name);
            if (typeof fn !== 'function') throw new Error(`Missing ${name}`);
            resolved[name] = fn;
        }
        nativeFnsRef.current = resolved;
        return resolved;
    }, []);

    const invokeNativeWithTimeout = useCallback(async (name, args = [], timeoutMs = 500) => {
        const fn = nativeFnsRef.current[name];
        if (!fn) throw new Error(`${name} not ready`);
        const invocation = Promise.resolve().then(() => fn(...args));
        if (timeoutMs <= 0) return await invocation;

        let timeoutId = 0;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error(`${name} timed out`)), timeoutMs);
        });

        try {
            return await Promise.race([invocation, timeoutPromise]);
        } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
        }
    }, []);

    const editStepActive = useCallback((pIdx, tIdx, sIdx, isActive) => {
        setPatterns(prev => {
            const next = [...prev];
            const current = next[pIdx];
            const nextActive = current.data.activeSteps.map(row => [...row]);
            nextActive[tIdx] = [...nextActive[tIdx]];
            nextActive[tIdx][sIdx] = isActive;
            next[pIdx] = { ...current, data: { ...current.data, activeSteps: nextActive } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('setStepActive', [pIdx, tIdx, sIdx, isActive]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

    const editStepParameter = useCallback((pIdx, tIdx, sIdx, paramName, value) => {
        setPatterns(prev => {
            const next = [...prev];
            const current = next[pIdx];
            const nextParam = current.data[paramName].map(row => [...row]);
            nextParam[tIdx] = [...nextParam[tIdx]];
            nextParam[tIdx][sIdx] = value;
            next[pIdx] = { ...current, data: { ...current.data, [paramName]: nextParam } };
            return next;
        });
        let cValue = paramName === 'repeats' ? value : value / 100.0;
        if (backendReady) invokeNativeWithTimeout('setStepParameter', [pIdx, tIdx, sIdx, paramName, cValue]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

    const editTrackState = useCallback((tIdx, stateName, isEnabled) => {
        setPatterns(prev => {
            const next = [...prev];
            const current = next[activeIdx];
            const nextStates = current.data.trackStates.map((s, i) => i === tIdx ? { ...s, [stateName]: isEnabled } : s);
            next[activeIdx] = { ...current, data: { ...current.data, trackStates: nextStates } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('setTrackState', [tIdx, stateName, isEnabled]).catch(console.error);
    }, [activeIdx, backendReady, invokeNativeWithTimeout]);

    const editTrackMidiKey = useCallback((tIdx, midiNoteName) => {
        setPatterns(prev => {
            const next = [...prev];
            const current = next[activeIdx];
            const nextKeys = [...current.data.midiKeys];
            nextKeys[tIdx] = midiNoteName;
            next[activeIdx] = { ...current, data: { ...current.data, midiKeys: nextKeys } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('setTrackMidiKey', [tIdx, noteNameToMidi(midiNoteName)]).catch(console.error);
    }, [activeIdx, backendReady, invokeNativeWithTimeout]);

    // NEW: Function to edit the MIDI Channel of a track
    const editTrackMidiChannel = useCallback((tIdx, channel) => {
        setPatterns(prev => {
            const next = [...prev];
            const current = next[activeIdx];
            const nextStates = current.data.trackStates.map((s, i) => i === tIdx ? { ...s, midiChannel: channel } : s);
            next[activeIdx] = { ...current, data: { ...current.data, trackStates: nextStates } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('setTrackMidiChannel', [tIdx, channel]).catch(console.error);
    }, [activeIdx, backendReady, invokeNativeWithTimeout]);

    const editClearTrack = useCallback((pIdx, tIdx) => {
         setPatterns(prev => {
            const next = [...prev];
            const current = next[pIdx];
            const nextActive = current.data.activeSteps.map(row => [...row]);
            nextActive[tIdx] = Array(32).fill(false);
            next[pIdx] = { ...current, data: { ...current.data, activeSteps: nextActive } };
            return next;
        });
        if (backendReady) invokeNativeWithTimeout('clearTrack', [pIdx, tIdx]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

    const syncPatternToEngine = useCallback((patternData, overrides = {}) => {
        if (!backendReady) return;
        const payload = JSON.stringify({
            ...patternData,
            activeIdx: overrides.activeIdx ?? activeIdx, 
            activePatternIndex: overrides.activeIdx ?? activeIdx,
            selectedTrack: overrides.selectedTrack ?? selectedTrack,
            currentPage: overrides.currentPage ?? currentPage
        });
        invokeNativeWithTimeout('updateCPlusPlusState', [payload], 1200).catch(console.error);
    }, [backendReady, activeIdx, selectedTrack, currentPage, invokeNativeWithTimeout]);

    const updateUiScale = useCallback((newScale) => {
        setUiScale(newScale);
        if (backendReady) invokeNativeWithTimeout('setWindowScale', [newScale]).catch(console.error);
    }, [backendReady, invokeNativeWithTimeout]);

    useEffect(() => {
        let cancelled = false;
        const initBackend = async () => {
            let retries = 120;
            while (!window.__JUCE__?.backend && retries > 0) { await wait(50); retries--; }
            if (window.__JUCE__?.initialisationPromise) await window.__JUCE__.initialisationPromise;
            
            retries = 120;
            while (retries > 0) {
                try {
                    resolveNativeFunctions();
                    if (backendSupportsEvents() && !cancelled) { setBackendReady(true); return; }
                } catch (err) { await wait(50); retries--; }
            }
        };
        initBackend();
        return () => { cancelled = true; };
    }, [backendSupportsEvents, resolveNativeFunctions]);

    useEffect(() => {
        if (!backendReady || !backendSupportsEvents()) return;
        const hPlayback = (e) => {
            if (e?.bpm) setBpm(Math.round(e.bpm));
            setIsPlaying(!!e?.isPlaying);
            
            // We now send the absolute timeline tick over so JS can wrap it per-track
            window.dispatchEvent(new CustomEvent('juce-playhead', { detail: (e?.isPlaying && e?.currentStep >= 0) ? e.currentStep : -1 }));
        };
        const hEngine = (e) => {
            if (!hasHydrated.current) return;
            if (e?.patterns) {
                setPatterns(e.patterns);
                if (Number.isInteger(e.activeIdx)) setActiveIdx(e.activeIdx);
                if (Number.isInteger(e.selectedTrack)) setSelectedTrack(e.selectedTrack);
                if (Number.isInteger(e.currentPage)) { setCurrentPage(e.currentPage); setActiveSection(e.currentPage); }
                if (Number.isInteger(e.themeIdx)) setThemeIdx(e.themeIdx);
                if (e.footerTab) setFooterTab(e.footerTab);
                if (Number.isFinite(e.uiScale)) setUiScale(e.uiScale);
            } else if (e?.patternData) {
                const pIdx = Number.isInteger(e.activePatternIndex) ? e.activePatternIndex : activeIdx;
                setPatterns(prev => {
                    const next = [...prev];
                    if (!next[pIdx]) return prev;
                    next[pIdx] = { ...next[pIdx], data: e.patternData };
                    return next;
                });
            }
        };
        const l1 = window.__JUCE__.backend.addEventListener('playbackState', hPlayback);
        const l2 = window.__JUCE__.backend.addEventListener('engineState', hEngine);
        return () => { window.__JUCE__.backend.removeEventListener(l1); window.__JUCE__.backend.removeEventListener(l2); };
    }, [backendReady, backendSupportsEvents, activeIdx]);

    useEffect(() => {
        if (!backendReady || hasHydrated.current) return;
        let cancelled = false;
        const hydrate = async () => {
            let normalized = normalizeLoadedState(null);
            try {
                const savedState = await invokeNativeWithTimeout('requestInitialState', [], 3000);
                if (cancelled) return;
                normalized = normalizeLoadedState(typeof savedState === 'string' ? JSON.parse(savedState) : savedState);
            } catch (err) {}
            
            if (cancelled) return;
            setPatterns(normalized.patterns);
            setActiveIdx(normalized.activeIdx);
            setThemeIdx(normalized.themeIdx);
            setSelectedTrack(normalized.selectedTrack);
            setCurrentPage(normalized.currentPage);
            setActiveSection(normalized.currentPage);
            setFooterTab(normalized.footerTab);
            setUiScale(normalized.uiScale || 1.0);
            
            await wait(16);
            if (!cancelled) {
                invokeNativeWithTimeout('uiReadyForEngineState', [], 1500).catch(()=>{});
                hasHydrated.current = true;
                setUiReady(true);
            }
        };
        hydrate();
        return () => { cancelled = true; };
    }, [backendReady, invokeNativeWithTimeout]);

    useEffect(() => {
        if (!hasHydrated.current || !backendReady) return;
        if (saveUiTimeout.current) window.clearTimeout(saveUiTimeout.current);
        saveUiTimeout.current = window.setTimeout(() => {
            invokeNativeWithTimeout('saveUiMetadata', [JSON.stringify({
                activeIdx, themeIdx, selectedTrack, currentPage, footerTab, uiScale
            })], 500).catch(()=>{});
        }, 300);
    }, [activeIdx, themeIdx, uiScale, selectedTrack, currentPage, footerTab, backendReady, invokeNativeWithTimeout]);

    return {
        patterns, activeIdx, isPlaying, bpm, activeSection, currentPage,
        selectedTrack, footerTab, themeIdx, uiScale, setActiveIdx, setActiveSection,
        setCurrentPage, setSelectedTrack, setFooterTab, setThemeIdx, updateUiScale,
        syncPatternToEngine, editStepActive, editStepParameter, editTrackState, editTrackMidiKey, editTrackMidiChannel, editClearTrack,
        backendReady, uiReady, backendStatus, debugInfo, hasHydrated,
    };
}