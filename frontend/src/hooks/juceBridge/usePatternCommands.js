import { useCallback } from 'react';
import { noteNameToMidi } from '../../utils/noteUtils.js';
import {
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
} from '../juce/patternDataMutators.js';
import { toNativeParameterValue } from '../juce/nativePayloads.js';
import { requestNormalizedEngineState } from './nativeBridge.js';
import { syncPatternPatchToEngine } from './patternEngineSync.js';

export function usePatternCommands({
    backendReady,
    invokeNative,
    patternsRef,
    activeIdxRef,
    setPatterns,
    setActiveIdx,
    setSelectedTrack,
    setCurrentPage,
    setActiveSection,
    setUiScale,
    setVisibleTracks,
}) {
    const applyPatternDataPatch = useCallback((patternIndex, updater) => {
        setPatterns((previousPatterns) => updatePatternCollection(previousPatterns, patternIndex, updater));
    }, [setPatterns]);

    const patchActivePattern = useCallback((updater) => {
        applyPatternDataPatch(activeIdxRef.current, updater);
    }, [activeIdxRef, applyPatternDataPatch]);

    const callNativeIfReady = useCallback((name, args) => {
        if (!backendReady) {
            return;
        }

        invokeNative(name, args).catch(console.error);
    }, [backendReady, invokeNative]);

    const reloadPatternsFromEngine = useCallback(async () => {
        const normalizedState = await requestNormalizedEngineState(invokeNative);
        setPatterns(normalizedState.patterns);
    }, [invokeNative, setPatterns]);

    const editStepActive = useCallback((patternIndex, trackIndex, stepIndex, isActive) => {
        applyPatternDataPatch(patternIndex, (data) => (
            setStepActiveInData(data, trackIndex, stepIndex, isActive)
        ));
        callNativeIfReady('setStepActive', [patternIndex, trackIndex, stepIndex, isActive]);
    }, [applyPatternDataPatch, callNativeIfReady]);

    const editStepParameter = useCallback((patternIndex, trackIndex, stepIndex, paramName, value) => {
        applyPatternDataPatch(patternIndex, (data) => (
            setStepParameterInData(data, trackIndex, stepIndex, paramName, value)
        ));
        callNativeIfReady('setStepParameter', [
            patternIndex,
            trackIndex,
            stepIndex,
            paramName,
            toNativeParameterValue(paramName, value),
        ]);
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
    }, [callNativeIfReady, setActiveIdx]);

    const changeSelectedTrack = useCallback((index) => {
        setSelectedTrack(index);
        callNativeIfReady('setSelectedTrack', [index]);
    }, [callNativeIfReady, setSelectedTrack]);

    const changeCurrentPage = useCallback((index) => {
        setCurrentPage(index);
        callNativeIfReady('setCurrentPage', [index]);
    }, [callNativeIfReady, setCurrentPage]);

    const updateUiScale = useCallback((scale) => {
        setUiScale(scale);
        callNativeIfReady('setWindowScale', [scale]);
    }, [callNativeIfReady, setUiScale]);

    const changeVisibleTracks = useCallback((count) => {
        setVisibleTracks(count);
        callNativeIfReady('setVisibleTracks', [count]);
    }, [callNativeIfReady, setVisibleTracks]);

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
        if (!backendReady) {
            return;
        }

        await invokeNative('randomizeTrack', [trackIndex]);
        await reloadPatternsFromEngine();
    }, [backendReady, invokeNative, reloadPatternsFromEngine]);

    const randomizeParameter = useCallback(async (trackIndex, paramName) => {
        if (!backendReady) {
            return;
        }

        await invokeNative('randomizeParameter', [trackIndex, paramName]);
        await reloadPatternsFromEngine();
    }, [backendReady, invokeNative, reloadPatternsFromEngine]);

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
    }, [changeActivePattern, changeCurrentPage, changeSelectedTrack, setActiveSection]);

    const updateUiAndEngine = useCallback((patch) => {
        const patternIndex = activeIdxRef.current;
        const currentData = patternsRef.current[patternIndex]?.data;

        if (!currentData) {
            return;
        }

        applyPatternDataPatch(patternIndex, { ...currentData, ...patch });

        if (!backendReady) {
            return;
        }

        syncPatternPatchToEngine({
            patch,
            currentData,
            patternIndex,
            invokeNative,
        });
    }, [activeIdxRef, applyPatternDataPatch, backendReady, invokeNative, patternsRef]);
    
    const nudgeTrack = useCallback((trackIndex, direction) => {
        const patternIndex = activeIdxRef.current;
        const currentData = patternsRef.current[patternIndex]?.data;
        if (!currentData) return;

        const trackLength = currentData.trackStates[trackIndex]?.length || 16;
        const patch = {};

        const shiftArray = (arr) => {
            const row = [...arr];
            const activePart = row.slice(0, trackLength);
            const tailPart = row.slice(trackLength);

            if (direction === 1) { // Shift Right
                const last = activePart.pop();
                activePart.unshift(last);
            } else { // Shift Left
                const first = activePart.shift();
                activePart.push(first);
            }

            return [...activePart, ...tailPart];
        };

        patch.activeSteps = currentData.activeSteps.map((row, idx) => idx === trackIndex ? shiftArray(row) : row);

        const params = ['velocities', 'gates', 'probabilities', 'shifts', 'swings', 'repeats', 'pitches'];
        params.forEach((param) => {
            patch[param] = currentData[param].map((row, idx) => idx === trackIndex ? shiftArray(row) : row);
        });

        updateUiAndEngine(patch);
    }, [activeIdxRef, patternsRef, updateUiAndEngine]);
    

    return {
        applyPatternDataPatch,
        patchActivePattern,
        editStepActive,
        editStepParameter,
        editTrackState,
        editTrackMidiKey,
        editTrackMidiChannel,
        editClearTrack,
        changeActivePattern,
        changeSelectedTrack,
        changeCurrentPage,
        updateUiScale,
        changeVisibleTracks,
        setTrackLength,
        setTrackSequence,
        setTrackScale,
        setTrackTimeDivision,
        randomizeTrack,
        randomizeParameter,
        setTrackRandomAmount,
        resetAutomationLane,
        syncPatternToEngine,
        updateUiAndEngine,
        nudgeTrack,
    };
}
