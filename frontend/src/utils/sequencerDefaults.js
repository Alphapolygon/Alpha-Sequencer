import { TAB_TO_IDX, TOTAL_STEPS, TOTAL_TRACKS } from './patternConstants.js';

const AUTOMATION_DEFAULTS = {
    velocities: 100,
    probabilities: 100,
    gates: 75,
    shifts: 50,
    swings: 0,
    repeats: 1,
    pitches: 0,
};

export const getAutomationDefaultValue = (paramName) => AUTOMATION_DEFAULTS[paramName] ?? 0;

export const createDefaultStepMatrix = (value) => Array(TOTAL_TRACKS).fill(0).map(() => Array(TOTAL_STEPS).fill(value));

export const createDefaultTrackStates = () => (
    Array(TOTAL_TRACKS).fill(0).map(() => ({ mute: false, solo: false, midiChannel: 1, scale: 0, length: 16, timeDivision: 3 }))
);

export const createDefaultRandomAmounts = () => Array(TOTAL_TRACKS).fill(0).map(() => [0, 0, 0, 0, 0, 0]);

export const getParamRandomIndex = (paramName) => TAB_TO_IDX[
    Object.entries({
        Velocity: 'velocities',
        Gate: 'gates',
        Probability: 'probabilities',
        Shift: 'shifts',
        Swing: 'swings',
        Pitch: 'pitches',
    }).find(([, key]) => key == paramName)?.[0] || 'Velocity'
];
