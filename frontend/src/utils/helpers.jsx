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

export const clone2D = (matrix) => matrix.map(row => [...row]);

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
        midiKeys: Array(16).fill(0).map((_,i)=>midiToNoteName(36 + i)),
        trackStates: Array(16).fill(0).map(()=>({mute:false,solo:false})),
    }
});

export const normalizeLoadedState = (savedState) => {
    const defaultState = {
        patterns: PATTERN_LABELS.map(label => createEmptyPattern(`Pattern ${label}`)),
        activeIdx: 0, themeIdx: 0, selectedTrack: 0, currentPage: 0, footerTab: 'Velocity'
    };
    if (!savedState) return defaultState;
    try {
        const parsed = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
        if (Array.isArray(parsed)) return { ...defaultState, patterns: parsed };
        return {
            patterns: Array.isArray(parsed.patterns) ? parsed.patterns : defaultState.patterns,
            activeIdx: parsed.activeIdx ?? 0,
            themeIdx: parsed.themeIdx ?? 0,
            selectedTrack: parsed.selectedTrack ?? 0,
            currentPage: parsed.currentPage ?? 0,
            footerTab: parsed.footerTab ?? 'Velocity'
        };
    } catch { return defaultState; }
};

export const generateMidi = (patternData, bpm, trackIdx = null) => {
    const { activeSteps, velocities, gates, repeats, midiKeys, shifts } = patternData;
    const PPQ = 480; const ticksPerStep = 120;
    const isMulti = trackIdx === null;
    const header = [0x4d,0x54,0x68,0x64,0,0,0,6,0,isMulti?1:0,0,isMulti?16:1,(PPQ>>8)&0xff,PPQ&0xff];

    const makeTrack = (idx) => {
        const note = noteNameToMidi(midiKeys[idx]);
        let events = [];
        activeSteps[idx].forEach((active, sIdx) => {
            if (!active) return;
            const v = Math.round((velocities[idx][sIdx]/100)*127);
            const g = gates[idx][sIdx]/100;
            const r = repeats[idx][sIdx];
            const start = sIdx * ticksPerStep + Math.round(((shifts[idx][sIdx] - 50)/50)*ticksPerStep);
            const interval = ticksPerStep / r;
            for(let i=0; i<r; i++) {
                const on = Math.round(start + (i*interval));
                const off = Math.round(on + (interval*g));
                events.push({t:on,type:0x90,n:note,v:v},{t:off,type:0x80,n:note,v:0});
            }
        });
        events.sort((a,b)=>a.t-b.t);
        let last = 0, bytes = [];
        events.forEach(e => {
            let d = e.t - last; last = e.t;
            let vlq = [d & 0x7f]; while((d>>=7)>0) vlq.unshift((d&0x7f)|0x80);
            bytes.push(...vlq, e.type, e.n, e.v);
        });
        bytes.push(0, 0xff, 0x2f, 0);
        return [0x4d,0x54,0x72,0x6b,(bytes.length>>24)&0xff,(bytes.length>>16)&0xff,(bytes.length>>8)&0xff,bytes.length&0xff,...bytes];
    };

    let body = [];
    if(isMulti) for(let i=0;i<16;i++) body.push(...makeTrack(i));
    else body.push(...makeTrack(trackIdx));

    const blob = new Uint8Array([...header, ...body]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([blob], {type:'audio/midi'}));
    link.download = isMulti ? `Pattern_Full.mid` : `Track_${trackIdx+1}.mid`;
    link.click();
};