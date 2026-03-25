import { noteNameToMidi } from '../../utils/noteUtils.js';
import { toNativeParameterValue } from '../juce/nativePayloads.js';

const STEP_PARAMETER_NAMES = [
    'velocities',
    'gates',
    'probabilities',
    'shifts',
    'swings',
    'repeats',
    'pitches',
];

function syncActiveSteps({ patch, currentData, patternIndex, invokeNative }) {
    if (!patch.activeSteps) {
        return;
    }

    patch.activeSteps.forEach((trackSteps, trackIndex) => {
        trackSteps.forEach((value, stepIndex) => {
            if (value !== currentData.activeSteps[trackIndex][stepIndex]) {
                invokeNative('setStepActive', [patternIndex, trackIndex, stepIndex, value]).catch(console.error);
            }
        });
    });
}

function syncStepParameters({ patch, currentData, patternIndex, invokeNative }) {
    STEP_PARAMETER_NAMES.forEach((paramName) => {
        if (!patch[paramName]) {
            return;
        }

        patch[paramName].forEach((trackValues, trackIndex) => {
            trackValues.forEach((value, stepIndex) => {
                if (value !== currentData[paramName][trackIndex][stepIndex]) {
                    invokeNative('setStepParameter', [
                        patternIndex,
                        trackIndex,
                        stepIndex,
                        paramName,
                        toNativeParameterValue(paramName, value),
                    ]).catch(console.error);
                }
            });
        });
    });
}

function syncMidiKeys({ patch, currentData, invokeNative }) {
    if (!patch.midiKeys) {
        return;
    }

    patch.midiKeys.forEach((noteName, trackIndex) => {
        if (noteName !== currentData.midiKeys[trackIndex]) {
            invokeNative('setTrackMidiKey', [trackIndex, noteNameToMidi(noteName)]).catch(console.error);
        }
    });
}

function syncTrackStates({ patch, currentData, invokeNative }) {
    if (!patch.trackStates) {
        return;
    }

    patch.trackStates.forEach((nextState, trackIndex) => {
        const previousState = currentData.trackStates[trackIndex] || {};

        if (nextState.mute !== previousState.mute) {
            invokeNative('setTrackState', [trackIndex, 'mute', !!nextState.mute]).catch(console.error);
        }

        if (nextState.solo !== previousState.solo) {
            invokeNative('setTrackState', [trackIndex, 'solo', !!nextState.solo]).catch(console.error);
        }

        if (
            typeof nextState.midiChannel === 'number'
            && nextState.midiChannel !== previousState.midiChannel
        ) {
            invokeNative('setTrackMidiChannel', [trackIndex, nextState.midiChannel]).catch(console.error);
        }
    });
}

export function syncPatternPatchToEngine({ patch, currentData, patternIndex, invokeNative }) {
    syncActiveSteps({ patch, currentData, patternIndex, invokeNative });
    syncStepParameters({ patch, currentData, patternIndex, invokeNative });
    syncMidiKeys({ patch, currentData, invokeNative });
    syncTrackStates({ patch, currentData, invokeNative });
}
