import { NOTES, PATTERN_LABELS } from './constants';

export const noteNameToMidi = (noteName) => {
    if (!noteName || typeof noteName !== 'string') return 36;
    const match = noteName.trim().toUpperCase().match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return 36;
    const semitone = NOTES.indexOf(match[1]);
    if (semitone < 0) return 36;
    const octave = parseInt(match[2], 10);
    return Math.max(0, Math.min(127, ((octave + 1) * 12) + semitone));
};

export const midiToNoteName = (midi) => {
    const clamped = Math.max(0, Math.min(127, Number.isFinite(midi) ? midi : 36));
    const semitone = clamped % 12;
    const octave = Math.floor(clamped / 12) - 1;
    return `${NOTES[semitone]}${octave}`;
};

export const hexToRgba = (hex, opacity) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})` : hex;
};

export const createEmptyPattern = (name) => ({
    id: Math.random().toString(36).substr(2,9),
    name: name || "Pattern",
    data: {
        activeSteps: Array(16).fill(0).map(()=>Array(32).fill(false)),
        velocities: Array(16).fill(100).map(()=>Array(32).fill(100)),
        probabilities: Array(16).fill(100).map(()=>Array(32).fill(100)),
        gates: Array(16).fill(75).map(()=>Array(32).fill(75)),
        shifts: Array(16).fill(50).map(()=>Array(32).fill(50)),
        swings: Array(16).fill(0).map(()=>Array(32).fill(0)),
        repeats: Array(16).fill(1).map(()=>Array(32).fill(1)),
        pitches: Array(16).fill(0).map(()=>Array(32).fill(0)), // Bipolar -24 to +24
        randomAmounts: Array(16).fill(0).map(()=>[0,0,0,0,0,0]), // Jitter memory
        midiKeys: Array(16).fill(0).map((_,i)=>midiToNoteName(36 + i)),
        trackStates: Array(16).fill(0).map(()=>({mute:false,solo:false,midiChannel:1,scale:0,length:16,timeDivision:3})),
    }
});

export const normalizeLoadedState = (savedState) => {
    const defaultState = {
        patterns: PATTERN_LABELS.map(label => createEmptyPattern(`Pattern ${label}`)),
        activeIdx: 0, themeIdx: 0, selectedTrack: 0, currentPage: 0, activeSection: -1, footerTab: 'Velocity', uiScale: 1.0, visibleTracks: 16
    };
    if (!savedState) return defaultState;
    try {
        const parsed = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
        if (Array.isArray(parsed)) return { ...defaultState, patterns: parsed };
        return {
            patterns: Array.isArray(parsed.patterns) ? parsed.patterns : defaultState.patterns,
            activeIdx: parsed.activeIdx ?? 0, themeIdx: parsed.themeIdx ?? 0, selectedTrack: parsed.selectedTrack ?? 0,
            currentPage: parsed.currentPage ?? 0, activeSection: parsed.activeSection ?? -1, footerTab: parsed.footerTab ?? 'Velocity',
            uiScale: parsed.uiScale ?? 1.0, visibleTracks: parsed.visibleTracks ?? 16
        };
    } catch { return defaultState; }
};