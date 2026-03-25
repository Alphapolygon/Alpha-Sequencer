import { useEffect, useRef, useState } from 'react';
import { PATTERN_LABELS } from '../../utils/patternConstants.js';
import { createEmptyPattern } from '../../utils/patternState.js';

export const createInitialPatterns = () => (
    PATTERN_LABELS.map((label) => createEmptyPattern(`Pattern ${label}`))
);

export function useBridgeState() {
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

    useEffect(() => {
        patternsRef.current = patterns;
    }, [patterns]);

    useEffect(() => {
        activeIdxRef.current = activeIdx;
    }, [activeIdx]);

    return {
        patterns,
        setPatterns,
        activeIdx,
        setActiveIdx,
        isPlaying,
        setIsPlaying,
        bpm,
        setBpm,
        currentStep,
        setCurrentStep,
        activeSection,
        setActiveSection,
        currentPage,
        setCurrentPage,
        selectedTrack,
        setSelectedTrack,
        footerTab,
        setFooterTab,
        themeIdx,
        setThemeIdx,
        uiScale,
        setUiScale,
        visibleTracks,
        setVisibleTracks,
        backendReady,
        setBackendReady,
        uiReady,
        setUiReady,
        backendStatus,
        setBackendStatus,
        debugInfo,
        setDebugInfo,
        hasHydrated,
        nativeFunctionsRef,
        saveUiTimeoutRef,
        patternsRef,
        activeIdxRef,
    };
}
