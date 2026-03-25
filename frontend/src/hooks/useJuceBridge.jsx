import { useMemo } from 'react';
import { useBackendBootstrap } from './juceBridge/useBackendBootstrap.js';
import { useBridgeState } from './juceBridge/useBridgeState.js';
import { useEngineDiffSubscription } from './juceBridge/useEngineDiffSubscription.js';
import { useEngineHydration } from './juceBridge/useEngineHydration.js';
import { createNativeInvoker } from './juceBridge/nativeBridge.js';
import { usePatternCommands } from './juceBridge/usePatternCommands.js';
import { usePlaybackSubscription } from './juceBridge/usePlaybackSubscription.js';
import { useUiMetadataPersistence } from './juceBridge/useUiMetadataPersistence.js';

export function useJuceBridge() {
    const bridgeState = useBridgeState();

    const invokeNative = useMemo(() => (
        createNativeInvoker(bridgeState.nativeFunctionsRef)
    ), [bridgeState.nativeFunctionsRef]);

    useBackendBootstrap({
        nativeFunctionsRef: bridgeState.nativeFunctionsRef,
        setBackendReady: bridgeState.setBackendReady,
        setBackendStatus: bridgeState.setBackendStatus,
        setDebugInfo: bridgeState.setDebugInfo,
    });

    usePlaybackSubscription({
        backendReady: bridgeState.backendReady,
        setBpm: bridgeState.setBpm,
        setIsPlaying: bridgeState.setIsPlaying,
        setCurrentStep: bridgeState.setCurrentStep,
    });

    useEngineDiffSubscription({
        backendReady: bridgeState.backendReady,
        hasHydrated: bridgeState.hasHydrated,
        setActiveIdx: bridgeState.setActiveIdx,
        setSelectedTrack: bridgeState.setSelectedTrack,
        setCurrentPage: bridgeState.setCurrentPage,
        setActiveSection: bridgeState.setActiveSection,
        setPatterns: bridgeState.setPatterns,
    });

    useEngineHydration({
        backendReady: bridgeState.backendReady,
        invokeNative,
        hasHydrated: bridgeState.hasHydrated,
        setBackendStatus: bridgeState.setBackendStatus,
        setPatterns: bridgeState.setPatterns,
        setActiveIdx: bridgeState.setActiveIdx,
        setThemeIdx: bridgeState.setThemeIdx,
        setSelectedTrack: bridgeState.setSelectedTrack,
        setCurrentPage: bridgeState.setCurrentPage,
        setActiveSection: bridgeState.setActiveSection,
        setFooterTab: bridgeState.setFooterTab,
        setUiScale: bridgeState.setUiScale,
        setVisibleTracks: bridgeState.setVisibleTracks,
        setUiReady: bridgeState.setUiReady,
    });

    useUiMetadataPersistence({
        backendReady: bridgeState.backendReady,
        hasHydrated: bridgeState.hasHydrated,
        saveUiTimeoutRef: bridgeState.saveUiTimeoutRef,
        invokeNative,
        activeIdx: bridgeState.activeIdx,
        themeIdx: bridgeState.themeIdx,
        selectedTrack: bridgeState.selectedTrack,
        currentPage: bridgeState.currentPage,
        activeSection: bridgeState.activeSection,
        footerTab: bridgeState.footerTab,
        uiScale: bridgeState.uiScale,
        visibleTracks: bridgeState.visibleTracks,
    });

    const commands = usePatternCommands({
        backendReady: bridgeState.backendReady,
        invokeNative,
        patternsRef: bridgeState.patternsRef,
        activeIdxRef: bridgeState.activeIdxRef,
        setPatterns: bridgeState.setPatterns,
        setActiveIdx: bridgeState.setActiveIdx,
        setSelectedTrack: bridgeState.setSelectedTrack,
        setCurrentPage: bridgeState.setCurrentPage,
        setActiveSection: bridgeState.setActiveSection,
        setUiScale: bridgeState.setUiScale,
        setVisibleTracks: bridgeState.setVisibleTracks,
    });

    return {
        patterns: bridgeState.patterns,
        activeIdx: bridgeState.activeIdx,
        isPlaying: bridgeState.isPlaying,
        bpm: bridgeState.bpm,
        currentStep: bridgeState.currentStep,
        activeSection: bridgeState.activeSection,
        currentPage: bridgeState.currentPage,
        selectedTrack: bridgeState.selectedTrack,
        footerTab: bridgeState.footerTab,
        themeIdx: bridgeState.themeIdx,
        uiScale: bridgeState.uiScale,
        visibleTracks: bridgeState.visibleTracks,

        setActiveIdx: commands.changeActivePattern,
        setActiveSection: bridgeState.setActiveSection,
        setCurrentPage: commands.changeCurrentPage,
        setSelectedTrack: commands.changeSelectedTrack,
        setFooterTab: bridgeState.setFooterTab,
        setThemeIdx: bridgeState.setThemeIdx,
        updateUiScale: commands.updateUiScale,
        changeActivePattern: commands.changeActivePattern,
        changeSelectedTrack: commands.changeSelectedTrack,
        changeCurrentPage: commands.changeCurrentPage,
        changeVisibleTracks: commands.changeVisibleTracks,

        updateUiAndEngine: commands.updateUiAndEngine,
        syncPatternToEngine: commands.syncPatternToEngine,
        editStepActive: commands.editStepActive,
        editStepParameter: commands.editStepParameter,
        editTrackState: commands.editTrackState,
        editTrackMidiKey: commands.editTrackMidiKey,
        editTrackMidiChannel: commands.editTrackMidiChannel,
        editClearTrack: commands.editClearTrack,

        setTrackLength: commands.setTrackLength,
        setTrackSequence: commands.setTrackSequence,
        setTrackScale: commands.setTrackScale,
        setTrackTimeDivision: commands.setTrackTimeDivision,
        randomizeTrack: commands.randomizeTrack,
        randomizeParameter: commands.randomizeParameter,
        setTrackRandomAmount: commands.setTrackRandomAmount,
        resetAutomationLane: commands.resetAutomationLane,
        nudgeTrack: commands.nudgeTrack,

        backendReady: bridgeState.backendReady,
        uiReady: bridgeState.uiReady,
        backendStatus: bridgeState.backendStatus,
        debugInfo: bridgeState.debugInfo,
        hasHydrated: bridgeState.hasHydrated,
    };
}
