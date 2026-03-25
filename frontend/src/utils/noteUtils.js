import { NOTES } from './musicConstants.js';

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
