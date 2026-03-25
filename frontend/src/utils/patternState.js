import { PATTERN_LABELS, TOTAL_TRACKS } from './patternConstants.js';
import { midiToNoteName } from './noteUtils.js';
import { createDefaultRandomAmounts, createDefaultStepMatrix, createDefaultTrackStates } from './sequencerDefaults.js';

const makePatternId = () => Math.random().toString(36).slice(2, 11);

export const createEmptyPattern = (name = 'Pattern') => ({
    id: makePatternId(),
    name,
    data: {
        activeSteps: createDefaultStepMatrix(false),
        velocities: createDefaultStepMatrix(100),
        probabilities: createDefaultStepMatrix(100),
        gates: createDefaultStepMatrix(75),
        shifts: createDefaultStepMatrix(50),
        swings: createDefaultStepMatrix(0),
        repeats: createDefaultStepMatrix(1),
        pitches: createDefaultStepMatrix(0),
        randomAmounts: createDefaultRandomAmounts(),
        midiKeys: Array(TOTAL_TRACKS).fill(0).map((_, index) => midiToNoteName(36 + index)),
        trackStates: createDefaultTrackStates(),
    },
});

export const getDefaultUiState = () => ({
    patterns: PATTERN_LABELS.map((label) => createEmptyPattern(`Pattern ${label}`)),
    activeIdx: 0,
    themeIdx: 0,
    selectedTrack: 0,
    currentPage: 0,
    activeSection: -1,
    footerTab: 'Velocity',
    uiScale: 1,
    visibleTracks: 16,
});

export const normalizeLoadedState = (savedState) => {
    const defaults = getDefaultUiState();
    if (!savedState) return defaults;

    try {
        const parsed = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
        if (Array.isArray(parsed)) {
            return { ...defaults, patterns: parsed };
        }

        return {
            patterns: Array.isArray(parsed.patterns) ? parsed.patterns : defaults.patterns,
            activeIdx: parsed.activeIdx ?? defaults.activeIdx,
            themeIdx: parsed.themeIdx ?? defaults.themeIdx,
            selectedTrack: parsed.selectedTrack ?? defaults.selectedTrack,
            currentPage: parsed.currentPage ?? defaults.currentPage,
            activeSection: parsed.activeSection ?? defaults.activeSection,
            footerTab: parsed.footerTab ?? defaults.footerTab,
            uiScale: parsed.uiScale ?? defaults.uiScale,
            visibleTracks: parsed.visibleTracks ?? defaults.visibleTracks,
        };
    } catch {
        return defaults;
    }
};
