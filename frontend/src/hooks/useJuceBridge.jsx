import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeLoadedState } from '../utils/helpers';
import { PATTERN_LABELS } from '../utils/constants';
import { createEmptyPattern } from '../utils/helpers';

export function useJuceBridge() {
    const [patterns, setPatterns] = useState(PATTERN_LABELS.map(l => createEmptyPattern(`Pattern ${l}`)));
    const [activeIdx, setActiveIdx] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [activeSection, setActiveSection] = useState(-1);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedTrack, setSelectedTrack] = useState(0);
    const [footerTab, setFooterTab] = useState('Velocity');
    const [themeIdx, setThemeIdx] = useState(0);

    const [backendReady, setBackendReady] = useState(false);
    const hasHydrated = useRef(false);

    const buildUiSnapshot = useCallback((patternState = patterns, overrides = {}) => ({
        patterns: patternState,
        activeIdx: overrides.activeIdx ?? activeIdx,
        themeIdx: overrides.themeIdx ?? themeIdx,
        selectedTrack: overrides.selectedTrack ?? selectedTrack,
        currentPage: overrides.currentPage ?? currentPage,
        footerTab: overrides.footerTab ?? footerTab
    }), [patterns, activeIdx, themeIdx, selectedTrack, currentPage, footerTab]);

    const saveUiSnapshot = useCallback((snapshot) => {
        if (backendReady && window.__JUCE__?.backend?.saveFullUiState) {
            window.__JUCE__.backend.saveFullUiState(snapshot);
        }
    }, [backendReady]);

    const syncPatternToEngine = useCallback((patternData, overrides = {}) => {
        if (backendReady && window.__JUCE__?.backend?.updateCPlusPlusState) {
            window.__JUCE__.backend.updateCPlusPlusState({
                ...patternData,
                activePatternIndex: overrides.activeIdx ?? activeIdx,
                selectedTrack: overrides.selectedTrack ?? selectedTrack,
                currentPage: overrides.currentPage ?? currentPage
            });
        }
    }, [backendReady, activeIdx, selectedTrack, currentPage]);

    // 1. HANDSHAKE
    useEffect(() => {
        if (window.__JUCE__?.backend) { setBackendReady(true); return; }
        const interval = setInterval(() => {
            if (window.__JUCE__?.backend) { setBackendReady(true); clearInterval(interval); }
        }, 50);
        return () => clearInterval(interval);
    }, []);

    // 2. PLAYBACK STATE
    useEffect(() => {
        if (!backendReady) return;
        const handlePlaybackState = (event) => {
            if (event.bpm) setBpm(Math.round(event.bpm));
            setIsPlaying(event.isPlaying);
            setCurrentStep((event.isPlaying && event.currentStep >= 0) ? event.currentStep : 0);
        };
        window.__JUCE__.backend.addEventListener("playbackState", handlePlaybackState);
        return () => window.__JUCE__.backend.removeEventListener("playbackState", handlePlaybackState);
    }, [backendReady]);

    // 3. ENGINE STATE
    useEffect(() => {
        if (!backendReady) return;
        const handleEngineState = (event) => {
            if (!hasHydrated.current || !event?.patternData) return;
            const enginePatternIndex = Number.isInteger(event.activePatternIndex) ? event.activePatternIndex : activeIdx;
            
            setPatterns(prev => {
                const next = [...prev];
                if (!next[enginePatternIndex]) return prev;
                next[enginePatternIndex] = { ...next[enginePatternIndex], data: event.patternData };
                return next;
            });

            if (Number.isInteger(event.currentInstrument)) setSelectedTrack(event.currentInstrument);
            if (Number.isInteger(event.currentPage)) {
                setCurrentPage(event.currentPage);
                setActiveSection(event.currentPage);
            }
        };
        window.__JUCE__.backend.addEventListener("engineState", handleEngineState);
        return () => window.__JUCE__.backend.removeEventListener("engineState", handleEngineState);
    }, [backendReady, activeIdx]);

    // 4. HYDRATION
    useEffect(() => {
        if (!backendReady) return;
        if (window.__JUCE__.backend.requestInitialState) {
            window.__JUCE__.backend.requestInitialState()
                .then(savedState => {
                    let parsedState = savedState;
                    if (typeof savedState === 'string') { try { parsedState = JSON.parse(savedState); } catch(e) {} }
                    const normalized = normalizeLoadedState(parsedState);
                    setPatterns(normalized.patterns);
                    setActiveIdx(normalized.activeIdx);
                    setThemeIdx(normalized.themeIdx);
                    setSelectedTrack(normalized.selectedTrack);
                    setCurrentPage(normalized.currentPage);
                    setActiveSection(normalized.currentPage);
                    setFooterTab(normalized.footerTab);
                    
                    const loadedPattern = normalized.patterns[normalized.activeIdx]?.data || normalized.patterns[0]?.data;
                    if (loadedPattern) {
                        syncPatternToEngine(loadedPattern, {
                            activeIdx: normalized.activeIdx,
                            selectedTrack: normalized.selectedTrack,
                            currentPage: normalized.currentPage
                        });
                    }
                })
                .catch(err => console.error('requestInitialState failed', err))
                .finally(() => hasHydrated.current = true);
        } else { hasHydrated.current = true; }
    }, [backendReady, syncPatternToEngine]);

    // 5. HARD DRIVE SAVER
    useEffect(() => {
        if (!hasHydrated.current || !backendReady) return;
        saveUiSnapshot(buildUiSnapshot());
    }, [patterns, activeIdx, themeIdx, selectedTrack, currentPage, footerTab, backendReady, buildUiSnapshot, saveUiSnapshot]);

    // 6. UI UPDATE EMITTER
    const updateUiAndEngine = useCallback((newData) => {
        const currentPattern = patterns[activeIdx];
        if (!currentPattern) return;
        const updatedData = { ...currentPattern.data, ...newData };

        setPatterns(prev => {
            const next = [...prev];
            next[activeIdx] = { ...next[activeIdx], data: updatedData };
            return next;
        });
        syncPatternToEngine(updatedData);
    }, [activeIdx, patterns, syncPatternToEngine]);

    return {
        patterns, activeIdx, currentStep, isPlaying, bpm, activeSection, currentPage,
        selectedTrack, footerTab, themeIdx, 
        setActiveIdx, setActiveSection, setCurrentPage, setSelectedTrack, setFooterTab, setThemeIdx,
        updateUiAndEngine, syncPatternToEngine, backendReady, hasHydrated
    };
}