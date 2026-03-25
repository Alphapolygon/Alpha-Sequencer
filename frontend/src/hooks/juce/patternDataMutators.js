import { TOTAL_STEPS } from '../../utils/patternConstants.js';
import { getAutomationDefaultValue, getParamRandomIndex } from '../../utils/sequencerDefaults.js';
import { midiToNoteName } from '../../utils/noteUtils.js';

export const updatePatternCollection = (patterns, patternIndex, updateData) => {
    if (patternIndex < 0 || patternIndex >= patterns.length) return patterns;

    const currentPattern = patterns[patternIndex];
    if (!currentPattern) return patterns;

    const nextData = typeof updateData === 'function' ? updateData(currentPattern.data) : updateData;
    if (!nextData || nextData === currentPattern.data) return patterns;

    const nextPatterns = [...patterns];
    nextPatterns[patternIndex] = { ...currentPattern, data: nextData };
    return nextPatterns;
};

const cloneMatrixRow = (matrix, rowIndex) => matrix.map((row, index) => (index === rowIndex ? [...row] : row));

export const setStepActiveInData = (data, trackIndex, stepIndex, isActive) => {
    const nextActiveSteps = cloneMatrixRow(data.activeSteps, trackIndex);
    nextActiveSteps[trackIndex][stepIndex] = isActive;
    return { ...data, activeSteps: nextActiveSteps };
};

export const setStepParameterInData = (data, trackIndex, stepIndex, paramName, value) => {
    const nextMatrix = cloneMatrixRow(data[paramName], trackIndex);
    nextMatrix[trackIndex][stepIndex] = value;
    return { ...data, [paramName]: nextMatrix };
};

export const setTrackStateInData = (data, trackIndex, stateName, value) => ({
    ...data,
    trackStates: data.trackStates.map((state, index) => (index === trackIndex ? { ...state, [stateName]: value } : state)),
});

export const setTrackMidiKeyInData = (data, trackIndex, midiNoteName) => {
    const nextMidiKeys = [...data.midiKeys];
    nextMidiKeys[trackIndex] = midiNoteName;
    return { ...data, midiKeys: nextMidiKeys };
};

export const clearTrackInData = (data, trackIndex) => ({
    ...data,
    activeSteps: data.activeSteps.map((row, index) => (index === trackIndex ? Array(TOTAL_STEPS).fill(false) : row)),
});

export const setTrackLengthInData = (data, trackIndex, length) => setTrackStateInData(data, trackIndex, 'length', length);
export const setTrackSequenceInData = (data, trackIndex, sequence) => setTrackStateInData(data, trackIndex, 'sequence', sequence);
export const setTrackScaleInData = (data, trackIndex, scale) => setTrackStateInData(data, trackIndex, 'scale', scale);
export const setTrackTimeDivisionInData = (data, trackIndex, timeDivision) => setTrackStateInData(data, trackIndex, 'timeDivision', timeDivision);
export const setTrackMidiChannelInData = (data, trackIndex, midiChannel) => setTrackStateInData(data, trackIndex, 'midiChannel', midiChannel);

export const setTrackRandomAmountInData = (data, trackIndex, paramIndex, amount) => {
    const nextRandomAmounts = data.randomAmounts.map((row, index) => (index === trackIndex ? [...row] : row));
    nextRandomAmounts[trackIndex][paramIndex] = amount;
    return { ...data, randomAmounts: nextRandomAmounts };
};

export const resetAutomationLaneInData = (data, trackIndex, paramName) => {
    const nextMatrix = cloneMatrixRow(data[paramName], trackIndex);
    const defaultValue = getAutomationDefaultValue(paramName);

    for (let step = 0; step < TOTAL_STEPS; step += 1) {
        nextMatrix[trackIndex][step] = defaultValue;
    }

    const randomIndex = getParamRandomIndex(paramName);
    const nextRandomAmounts = data.randomAmounts.map((row, index) => (index === trackIndex ? [...row] : row));
    nextRandomAmounts[trackIndex][randomIndex] = 0;

    return {
        ...data,
        [paramName]: nextMatrix,
        randomAmounts: nextRandomAmounts,
    };
};

export const applyEngineDiffToPatterns = (patterns, diff) => {
    if (!diff || typeof diff.type !== 'string') return patterns;

    const patchPattern = (patternIndex, updater) => updatePatternCollection(patterns, patternIndex, updater);

    switch (diff.type) {
        case 'stepActiveChanged':
            if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.stepIndex)) {
                return patchPattern(diff.patternIndex, (data) => setStepActiveInData(data, diff.trackIndex, diff.stepIndex, !!diff.isActive));
            }
            return patterns;

        case 'stepParameterChanged':
            if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.stepIndex) && typeof diff.paramName === 'string') {
                return patchPattern(diff.patternIndex, (data) => data[diff.paramName]
                    ? setStepParameterInData(data, diff.trackIndex, diff.stepIndex, diff.paramName, diff.value)
                    : data);
            }
            return patterns;

        case 'trackStateChanged':
            if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && typeof diff.stateName === 'string') {
                return patchPattern(diff.patternIndex, (data) => setTrackStateInData(data, diff.trackIndex, diff.stateName, !!diff.isEnabled));
            }
            return patterns;

        case 'trackMidiKeyChanged':
            if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.midiNote)) {
                return patchPattern(diff.patternIndex, (data) => setTrackMidiKeyInData(data, diff.trackIndex, midiToNoteName(diff.midiNote)));
            }
            return patterns;

        case 'trackMidiChannelChanged':
            if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.midiChannel)) {
                return patchPattern(diff.patternIndex, (data) => setTrackMidiChannelInData(data, diff.trackIndex, diff.midiChannel));
            }
            return patterns;

        case 'pageCleared':
            if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.pageIndex)) {
                const startStep = diff.pageIndex * 8;
                return patchPattern(diff.patternIndex, (data) => {
                    const nextActiveSteps = data.activeSteps.map((row, index) => (index === diff.trackIndex ? [...row] : row));
                    for (let step = startStep; step < startStep + 8; step += 1) {
                        nextActiveSteps[diff.trackIndex][step] = false;
                    }
                    return { ...data, activeSteps: nextActiveSteps };
                });
            }
            return patterns;

        case 'trackCleared':
            if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex)) {
                return patchPattern(diff.patternIndex, (data) => clearTrackInData(data, diff.trackIndex));
            }
            return patterns;

        case 'trackLengthChanged':
            if (Number.isInteger(diff.patternIndex) && Number.isInteger(diff.trackIndex) && Number.isInteger(diff.length)) {
                return patchPattern(diff.patternIndex, (data) => setTrackLengthInData(data, diff.trackIndex, diff.length));
            }
            return patterns;

        default:
            return patterns;
    }
};
