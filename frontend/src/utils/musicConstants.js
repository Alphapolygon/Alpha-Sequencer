export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const MIDI_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap((octave) => NOTES.map((note) => `${note}${octave}`));
export const TIME_DIVISIONS = ['1/2', '1/4', '1/8', '1/16', '1/32'];
export const SCALES = ['None', 'Major', 'Minor', 'Dorian', 'Mixolydian', 'Pentatonic Maj', 'Pentatonic Min', 'Chromatic'];
export const VISIBLE_TRACK_PRESETS = [1, 4, 8, 12, 16];
