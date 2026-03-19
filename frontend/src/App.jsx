import React, { useState, useEffect, useCallback, useRef } from 'react';

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIDI_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap(o => NOTES.map(n => `${n}${o}`));
const PATTERN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];


const noteNameToMidi = (noteName) => {
    if (!noteName || typeof noteName !== 'string') return 36;
    const match = noteName.trim().toUpperCase().match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return 36;
    const semitone = NOTES.indexOf(match[1]);
    if (semitone < 0) return 36;
    const octave = parseInt(match[2], 10);
    return Math.max(0, Math.min(127, ((octave + 1) * 12) + semitone));
};

const midiToNoteName = (midi) => {
    const clamped = Math.max(0, Math.min(127, Number.isFinite(midi) ? midi : 36));
    const semitone = clamped % 12;
    const octave = Math.floor(clamped / 12) - 1;
    return `${NOTES[semitone]}${octave}`;
};

const clone2D = (matrix) => matrix.map(row => [...row]);

const hexToRgba = (hex, opacity) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})` : hex;
};

const THEMES = [
    { name: "Alpha", bg: "#06080b", panel: "#12151c", sidebar: "#0d1015", border: "rgba(255,255,255,0.05)", text: "#94a3b8", accent: "#fb923c", colors: ["#e879f9", "#fb923c", "#facc15", "#4ade80"] },
    { name: "Cyberpunk", bg: "#0d0221", panel: "#190e2f", sidebar: "#120a24", border: "rgba(0,255,255,0.1)", text: "#00ffff", accent: "#ff00ff", colors: ["#ff00ff", "#00ffff", "#ffff00", "#7cfc00"] },
    { name: "Midnight", bg: "#020617", panel: "#0f172a", sidebar: "#080c1a", border: "rgba(99,102,241,0.15)", text: "#94a3b8", accent: "#6366f1", colors: ["#6366f1", "#a855f7", "#d946ef", "#ec4899"] },
    { name: "Solar", bg: "#1c0a00", panel: "#2d1400", sidebar: "#220f00", border: "rgba(251,146,60,0.1)", text: "#fdba74", accent: "#f97316", colors: ["#fcd34d", "#fb923c", "#f87171", "#ef4444"] },
    { name: "Forest", bg: "#020d08", panel: "#061f13", sidebar: "#04150d", border: "rgba(74,222,128,0.1)", text: "#86efac", accent: "#22c55e", colors: ["#4ade80", "#22c55e", "#16a34a", "#15803d"] },
    { name: "Monochrome", bg: "#0f172a", panel: "#1e293b", sidebar: "#111827", border: "rgba(255,255,255,0.1)", text: "#cbd5e1", accent: "#ffffff", colors: ["#f8fafc", "#cbd5e1", "#94a3b8", "#64748b"] }
];

const tabToKey = { 'Velocity': 'velocities', 'Gate': 'gates', 'Probability': 'probabilities', 'Shift': 'shifts', 'Swing': 'swings' };

const Icons = {
    Download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
    ChevronDown: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
    Palette: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H17c2.8 0 5-2.2 5-5 0-5.5-4.5-10-10-10z"/></svg>
};

const createEmptyPattern = (name) => ({
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

const generateMidi = (patternData, bpm, trackIdx = null) => {
    const { activeSteps, velocities, gates, repeats, midiKeys, shifts } = patternData;
    const PPQ = 480;
    const ticksPerStep = 120;
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
        const l = bytes.length;
        return [0x4d,0x54,0x72,0x6b,(l>>24)&0xff,(l>>16)&0xff,(l>>8)&0xff,l&0xff,...bytes];
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


const normalizeLoadedState = (savedState) => {
    if (!savedState) {
        return {
            patterns: PATTERN_LABELS.map(label => createEmptyPattern(`Pattern ${label}`)),
            activeIdx: 0,
            themeIdx: 0,
            selectedTrack: 0,
            currentPage: 0,
            footerTab: 'Velocity'
        };
    }

    try {
        const parsed = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
        if (Array.isArray(parsed)) {
            return {
                patterns: parsed,
                activeIdx: 0,
                themeIdx: 0,
                selectedTrack: 0,
                currentPage: 0,
                footerTab: 'Velocity'
            };
        }

        return {
            patterns: Array.isArray(parsed.patterns) ? parsed.patterns : PATTERN_LABELS.map(label => createEmptyPattern(`Pattern ${label}`)),
            activeIdx: parsed.activeIdx ?? 0,
            themeIdx: parsed.themeIdx ?? 0,
            selectedTrack: parsed.selectedTrack ?? 0,
            currentPage: parsed.currentPage ?? 0,
            footerTab: parsed.footerTab ?? 'Velocity'
        };
    } catch {
        return {
            patterns: PATTERN_LABELS.map(label => createEmptyPattern(`Pattern ${label}`)),
            activeIdx: 0,
            themeIdx: 0,
            selectedTrack: 0,
            currentPage: 0,
            footerTab: 'Velocity'
        };
    }
};

const CustomNoteDropdown = ({ value, options, onChange, theme, trackColor, isSelected, isOpen, onToggle, onClose }) => {
    const menuBg = isSelected ? theme.panel : theme.sidebar;
    const borderColor = isSelected ? hexToRgba(trackColor, 0.55) : theme.border;
    const textColor = isSelected ? '#fff' : theme.text;

    return (
        <div className="w-28 relative" data-note-dropdown="true">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
                className="w-full rounded-md pl-2 pr-7 py-1.5 text-[9px] font-black uppercase outline-none border transition-all flex items-center justify-between"
                style={{
                    backgroundColor: menuBg,
                    borderColor,
                    color: textColor,
                    boxShadow: isSelected ? `0 0 12px ${hexToRgba(trackColor, 0.16)}` : 'inset 0 0 0 1px rgba(255,255,255,0.02)'
                }}
            >
                <span className="truncate">{value}</span>
                <span
                    className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    style={{ color: isSelected ? trackColor : theme.accent }}
                >
                    <Icons.ChevronDown />
                </span>
            </button>

            {isOpen && (
                <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-2xl overflow-hidden z-[120]"
                    style={{
                        backgroundColor: theme.panel,
                        borderColor,
                        boxShadow: `0 16px 30px ${hexToRgba(theme.bg, 0.7)}`
                    }}
                >
                    <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
                        {options.map((note) => {
                            const active = note === value;
                            return (
                                <button
                                    key={note}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange(note);
                                        onClose();
                                    }}
                                    className="w-full px-3 py-2 text-[9px] font-black uppercase text-left transition-colors flex items-center justify-between"
                                    style={{
                                        backgroundColor: active ? hexToRgba(trackColor, 0.14) : 'transparent',
                                        color: active ? (isSelected ? '#fff' : theme.accent) : theme.text
                                    }}
                                >
                                    <span>{note}</span>
                                    {active && <span style={{ color: trackColor }}>●</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function App() {
    const [patterns, setPatterns] = useState(PATTERN_LABELS.map(l => createEmptyPattern(`Pattern ${l}`)));
    const [activeIdx, setActiveIdx] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [activeSection, setActiveSection] = useState(-1);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedTrack, setSelectedTrack] = useState(0);
    const [footerTab, setFooterTab] = useState('Velocity');
    const [themeIdx, setThemeIdx] = useState(0);
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [openNoteMenuTrack, setOpenNoteMenuTrack] = useState(null);
    const isDrawing = useRef(false);
    const themeMenuRef = useRef(null);
    const hasHydrated = useRef(false);
    const pendingUiCommit = useRef(null);

    const buildUiSnapshot = useCallback((patternState = patterns, overrides = {}) => ({
        patterns: patternState,
        activeIdx: overrides.activeIdx ?? activeIdx,
        themeIdx: overrides.themeIdx ?? themeIdx,
        selectedTrack: overrides.selectedTrack ?? selectedTrack,
        currentPage: overrides.currentPage ?? currentPage,
        footerTab: overrides.footerTab ?? footerTab
    }), [patterns, activeIdx, themeIdx, selectedTrack, currentPage, footerTab]);

    const saveUiSnapshot = useCallback((snapshot) => {
        if (window.__JUCE__?.backend?.saveFullUiState) {
            window.__JUCE__.backend.saveFullUiState(JSON.stringify(snapshot));
        }
    }, []);

    const syncPatternToEngine = useCallback((patternData, overrides = {}) => {
        if (window.__JUCE__?.backend?.updateCPlusPlusState) {
            window.__JUCE__.backend.updateCPlusPlusState(JSON.stringify({
                ...patternData,
                activePatternIndex: overrides.activeIdx ?? activeIdx,
                selectedTrack: overrides.selectedTrack ?? selectedTrack,
                currentPage: overrides.currentPage ?? currentPage
            }));
        }
    }, [activeIdx, selectedTrack, currentPage]);

    const activeP = patterns[activeIdx] || patterns[0];
    const t = THEMES[themeIdx];
    const { activeSteps, trackStates, repeats, midiKeys } = activeP.data;

    useEffect(() => {
        const handlePlaybackState = (event) => {
            if (event.bpm) setBpm(Math.round(event.bpm));
            setIsPlaying(event.isPlaying);
            if (event.isPlaying && event.currentStep >= 0) {
                setCurrentStep(event.currentStep);
            } else if (!event.isPlaying) {
                setCurrentStep(0);
            }
        };
        if (window.__JUCE__ && window.__JUCE__.backend) {
            window.__JUCE__.backend.addEventListener("playbackState", handlePlaybackState);
        }
        return () => {
            if (window.__JUCE__ && window.__JUCE__.backend) {
                window.__JUCE__.backend.removeEventListener("playbackState", handlePlaybackState);
            }
        };
    }, []); 


    useEffect(() => {
        const handleEngineState = (event) => {
            if (!event?.patternData) return;

            const enginePatternIndex = Number.isInteger(event.activePatternIndex) ? event.activePatternIndex : activeIdx;
            setPatterns(prev => {
                const next = [...prev];
                if (!next[enginePatternIndex]) return prev;
                next[enginePatternIndex] = { ...next[enginePatternIndex], data: event.patternData };
                saveUiSnapshot(buildUiSnapshot(next, {
                    activeIdx: enginePatternIndex,
                    selectedTrack: event.currentInstrument ?? selectedTrack,
                    currentPage: event.currentPage ?? currentPage
                }));
                return next;
            });

            if (Number.isInteger(event.currentInstrument)) {
                setSelectedTrack(event.currentInstrument);
            }

            if (Number.isInteger(event.currentPage)) {
                setCurrentPage(event.currentPage);
                setActiveSection(event.currentPage);
            }
        };

        if (window.__JUCE__?.backend) {
            window.__JUCE__.backend.addEventListener("engineState", handleEngineState);
        }
        return () => {
            if (window.__JUCE__?.backend) {
                window.__JUCE__.backend.removeEventListener("engineState", handleEngineState);
            }
        };
    }, [activeIdx, buildUiSnapshot, saveUiSnapshot, selectedTrack, currentPage]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
                setIsThemeMenuOpen(false);
            }
            if (!event.target.closest('[data-note-dropdown="true"]')) {
                setOpenNoteMenuTrack(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
	
    useEffect(() => {
        if (window.__JUCE__?.backend?.requestInitialState) {
            window.__JUCE__.backend.requestInitialState().then(savedState => {
                const normalized = normalizeLoadedState(savedState);
                setPatterns(normalized.patterns);
                setActiveIdx(normalized.activeIdx);
                setThemeIdx(normalized.themeIdx);
                setSelectedTrack(normalized.selectedTrack);
                setCurrentPage(normalized.currentPage);
                setActiveSection(normalized.currentPage);
                setFooterTab(normalized.footerTab);
                const loadedPattern = normalized.patterns[normalized.activeIdx]?.data || normalized.patterns[0]?.data;
                if (loadedPattern) {
                    syncPatternToEngine(loadedPattern, {
                        activeIdx: normalized.activeIdx,
                        selectedTrack: normalized.selectedTrack,
                        currentPage: normalized.currentPage
                    });
                }
                hasHydrated.current = true;
            });
        }
    }, [syncPatternToEngine]);

    useEffect(() => {
        if (!hasHydrated.current) return;
        const activePatternData = patterns[activeIdx]?.data;
        if (activePatternData) {
            syncPatternToEngine(activePatternData);
        }
    }, [activeIdx, patterns, syncPatternToEngine]);

    useEffect(() => {
        if (!hasHydrated.current) return;
        saveUiSnapshot(buildUiSnapshot());
    }, [activeIdx, themeIdx, selectedTrack, currentPage, footerTab, buildUiSnapshot, saveUiSnapshot]);

    useEffect(() => {
        if (!pendingUiCommit.current) return;
        const { updatedData, snapshot } = pendingUiCommit.current;
        pendingUiCommit.current = null;
        syncPatternToEngine(updatedData);
        saveUiSnapshot(snapshot);
    }, [patterns, saveUiSnapshot, syncPatternToEngine]);

    const update = useCallback((newData) => {
        setPatterns(prev => {
            const next = [...prev];
            if (!next[activeIdx]) return prev;
            const updatedData = { ...next[activeIdx].data, ...newData };
            next[activeIdx] = { ...next[activeIdx], data: updatedData };
            pendingUiCommit.current = {
                updatedData,
                snapshot: buildUiSnapshot(next)
            };
            return next;
        });
    }, [activeIdx, buildUiSnapshot]);

    const handleDraw = (sIdx, e) => {
        const key = tabToKey[footerTab];
        
        if (e.type === 'contextmenu') {
            e.preventDefault(); 
            const defaultValues = { velocities: 100, gates: 75, probabilities: 100, shifts: 50, swings: 0 };
            const next = [...activeP.data[key]];
            next[selectedTrack] = [...next[selectedTrack]];
            next[selectedTrack][sIdx] = defaultValues[key];
            update({ [key]: next });
            return; 
        }

        if (e.type === 'mousedown' && e.button === 0) isDrawing.current = true;
        
        if ((isDrawing.current && e.buttons === 1) || (e.type === 'mousedown' && e.button === 0)) {
            const rect = e.currentTarget.getBoundingClientRect();
            const val = Math.round(Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100)));
            const next = [...activeP.data[key]];
            next[selectedTrack] = [...next[selectedTrack]];
            next[selectedTrack][sIdx] = val;
            update({ [key]: next });
        }
    };

    return (
        <div className="flex flex-col w-full h-screen font-sans select-none overflow-hidden theme-transition" 
             style={{ backgroundColor: t.bg, color: t.text }}
             onMouseUp={() => isDrawing.current = false}
             onContextMenu={(e) => e.preventDefault()}>
            
            {/* HEADER */}
            <header className="flex items-center justify-between px-6 py-2 border-b theme-transition shadow-lg z-50 glass-panel" 
                    style={{ backgroundColor: t.panel, borderColor: t.border }}>
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-black tracking-tighter flex items-center gap-2" style={{ color: t.accent }}>
                        <span className="text-black px-1.5 rounded-sm italic text-xs" style={{ backgroundColor: t.accent }}>A</span> ALPHA <span className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: t.text }}>SEQUENCER</span>
                    </h1>
                    
                    <div className="flex flex-col items-center ml-2 border-l pl-6" style={{ borderColor: t.border }}>
                        <span className="text-[8px] font-black uppercase mb-0.5 opacity-50">DAW Sync</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full transition-all ${isPlaying ? 'active-glow' : ''}`} 
                                 style={{ backgroundColor: isPlaying ? t.accent : 'rgba(255,255,255,0.2)', '--accent': t.accent }} />
                            <span className="text-sm font-mono font-black px-2.5 py-1 rounded border" style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: t.border, color: '#fff' }}>
                                {bpm} <span className="text-[9px] opacity-50 ml-1">BPM</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* LOOP SELECTORS */}
                <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border theme-transition" style={{ borderColor: t.border }}>
                    <button onClick={() => setActiveSection(-1)} 
                            className="px-5 py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all theme-transition"
                            style={{ backgroundColor: activeSection === -1 ? t.accent : 'transparent', color: activeSection === -1 ? '#000' : t.text }}>
                        All
                    </button>
                    {[0,1,2,3].map(i => (
                        <button key={i} onClick={() => { setActiveSection(i); setCurrentPage(i); syncPatternToEngine(activeP.data, { currentPage: i }); }} 
                                className="px-5 py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all theme-transition"
                                style={{ backgroundColor: activeSection === i ? t.accent : 'transparent', color: activeSection === i ? '#000' : t.text }}>
                            {i*8+1}—{i*8+8}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* MAIN GRID */}
                <main className="flex-1 flex flex-col p-2 gap-[1px] overflow-y-auto custom-scrollbar theme-transition" style={{ backgroundColor: t.bg }}>
                    
                    {/* STEP NUMBERS & COLORED HEADER DIVIDERS */}
                    <div className="flex items-center h-5 gap-2 px-2 mb-1">
                        <div className="w-52 pr-2 border-r border-transparent"></div> {/* Track Info Spacer */}
                        <div className="w-28"></div> {/* Note Selector Spacer */}
                        <div className="flex gap-0.5 w-[54px]"></div> {/* M/S Spacer */}
                        <div className="flex-1 flex gap-2 h-full px-2 relative min-w-[640px]">
                            {[0,1,2,3].map(secIdx => {
                                const tint = t.colors[secIdx % t.colors.length];
                                const isSecDimmed = activeSection !== -1 && activeSection !== secIdx;
                                return (
                                    <div key={secIdx} className="flex-1 flex gap-1 rounded-sm relative transition-opacity" 
                                         style={{ 
                                             opacity: isSecDimmed ? 0.3 : 1,
                                             borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(tint, 0.4)}` : 'none',
                                             paddingLeft: secIdx > 0 ? '6px' : '2px',
                                             marginLeft: secIdx > 0 ? '-2px' : '0'
                                         }}>
                                        <div className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full opacity-40" style={{ backgroundColor: tint }} />
                                        {Array(8).fill(0).map((_, i) => {
                                            const sIdx = (secIdx * 8) + i;
                                            return (
                                                <div key={sIdx} className="flex-1 flex justify-center items-end pb-1">
                                                    <span className="text-[8px] font-mono font-bold" style={{ color: t.text, opacity: currentStep === sIdx ? 1 : 0.4 }}>
                                                        {sIdx + 1}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* TRACK ROWS */}
                    {activeSteps.map((track, tIdx) => {
                        const isNotePlaying = track[currentStep] && isPlaying;
                        const trackColor = t.colors[tIdx % t.colors.length];
                        return (
                            <div key={tIdx} onClick={() => { setSelectedTrack(tIdx); setOpenNoteMenuTrack(null); syncPatternToEngine(activeP.data, { selectedTrack: tIdx }); }} 
                                 className="flex items-center h-11 gap-2 rounded-sm transition-all px-2 border theme-transition"
                                 style={{ 
                                     backgroundColor: selectedTrack === tIdx ? 'rgba(255,255,255,0.03)' : 'transparent',
                                     borderColor: selectedTrack === tIdx ? t.border : 'transparent'
                                 }}>
                                <div className="w-52 flex items-center gap-2 pr-2 border-r h-full" style={{ borderColor: t.border }}>
                                    <div className={`w-2 h-2 rounded-full transition-all duration-75 ${isNotePlaying ? 'active-glow' : ''}`} 
                                         style={{ 
                                             backgroundColor: isNotePlaying ? trackColor : 'rgba(0,0,0,0.5)', 
                                             boxShadow: isNotePlaying ? `0 0 10px ${trackColor}` : 'none',
                                             '--accent': trackColor 
                                         }} />
                                    <span className="text-[10px] font-mono font-bold opacity-30 w-4">{String(tIdx + 1).padStart(2,'0')}</span>
                                    <span className="text-[10px] font-black uppercase tracking-tight flex-1 truncate" style={{ color: selectedTrack === tIdx ? '#fff' : t.text }}>Track {tIdx+1}</span>
								
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            const n = clone2D(activeSteps); 
                                            n[tIdx].fill(false); 
                                            update({ activeSteps: n }); 
                                        }} 
                                        className="p-1 opacity-30 hover:opacity-100 text-[8px] font-black uppercase border rounded transition-all" 
                                        style={{ borderColor: t.border, color: t.text }}
                                    >
                                        CLR
                                    </button>
									
                                    <button onClick={(e) => { e.stopPropagation(); generateMidi(activeP.data, bpm, tIdx); }} className="p-1.5 opacity-30 hover:opacity-100"><Icons.Download/></button>
                                </div>
                                <CustomNoteDropdown
                                    value={midiKeys[tIdx]}
                                    options={MIDI_OPTIONS}
                                    theme={t}
                                    trackColor={trackColor}
                                    isSelected={selectedTrack === tIdx}
                                    isOpen={openNoteMenuTrack === tIdx}
                                    onToggle={() => setOpenNoteMenuTrack(prev => prev === tIdx ? null : tIdx)}
                                    onClose={() => setOpenNoteMenuTrack(null)}
                                    onChange={(note) => {
                                        const next = [...midiKeys];
                                        next[tIdx] = note;
                                        update({ midiKeys: next });
                                    }}
                                />

                                <div className="flex gap-0.5">
                                    {['M','S'].map(ctrl => {
                                        const type = ctrl === 'M' ? 'mute' : 'solo';
                                        const isOn = trackStates[tIdx][type];
                                        const color = type === 'mute' ? '#ef4444' : '#fbbf24';
                                        return (
                                            <button key={ctrl} onClick={(e) => { e.stopPropagation(); 
                                                const n = [...trackStates]; n[tIdx] = {...n[tIdx], [type]: !isOn}; update({ trackStates: n });
                                            }} className="w-6 h-6 rounded-sm text-[9px] font-black border transition-all"
                                               style={{ 
                                                   backgroundColor: isOn ? color : 'rgba(0,0,0,0.2)', 
                                                   borderColor: isOn ? color : t.border,
                                                   color: isOn ? '#000' : t.text 
                                               }}>{ctrl}</button>
                                        );
                                    })}
                                </div>

                                <div className="flex-1 flex gap-2 h-full py-1.5 px-2 relative min-w-[640px]">
                                    {[0,1,2,3].map(secIdx => {
                                        const isSecDimmed = activeSection !== -1 && activeSection !== secIdx;
                                        const secColor = t.colors[secIdx % t.colors.length];
                                        return (
                                            <div key={secIdx} className="flex-1 flex gap-1 rounded-sm p-0.5 transition-all relative"
                                                 style={{ 
                                                     backgroundColor: activeSection === secIdx ? 'rgba(255,255,255,0.02)' : 'transparent', 
                                                     opacity: isSecDimmed ? 0.3 : 1,
                                                     borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(secColor, 0.2)}` : 'none',
                                                     paddingLeft: secIdx > 0 ? '6px' : '2px',
                                                     marginLeft: secIdx > 0 ? '-2px' : '0'
                                                 }}>
                                                {Array(8).fill(0).map((_, i) => {
                                                    const sIdx = (secIdx * 8) + i;
                                                    const isActive = track[sIdx];
                                                    const isCurrent = currentStep === sIdx;
                                                    return (
                                                        <div key={sIdx} onClick={(e) => { e.stopPropagation(); 
                                                            const n = clone2D(activeSteps); n[tIdx][sIdx] = !n[tIdx][sIdx]; update({ activeSteps: n });
                                                        }} className="flex-1 rounded-[1px] cursor-pointer transition-all border"
                                                           style={{ 
                                                               backgroundColor: isActive ? trackColor : 'rgba(0,0,0,0.2)',
                                                               borderColor: isCurrent ? hexToRgba(t.accent, 0.4) : 'rgba(0,0,0,0.4)',
                                                               boxShadow: isCurrent ? `inset 0 0 5px ${t.accent}` : 'none',
                                                               transform: isCurrent ? 'scaleY(1.1)' : 'none'
                                                           }}>
                                                            {isCurrent && <div className="absolute inset-0 bg-white/5 pointer-events-none" />}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </main>

                {/* RIGHT SIDEBAR */}
                <aside className="w-80 border-l shadow-2xl z-40 flex flex-col theme-transition glass-panel" 
                       style={{ backgroundColor: t.sidebar, borderColor: t.border }}>
                    <div className="p-4 bg-black/20 border-b" style={{ borderColor: t.border }}>
                        <h3 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: t.accent }}>Pattern Matrix</h3>
                        <div className="grid grid-cols-5 gap-2">
                            {PATTERN_LABELS.map((label, idx) => (
                                <button key={label} onClick={() => { setActiveIdx(idx); setOpenNoteMenuTrack(null); }}
                                    className="aspect-square rounded flex items-center justify-center text-xs font-black transition-all border"
                                    style={{ 
                                        backgroundColor: activeIdx === idx ? t.accent : 'rgba(0,0,0,0.4)', 
                                        borderColor: activeIdx === idx ? t.accent : t.border,
                                        color: activeIdx === idx ? '#000' : t.text,
                                        boxShadow: activeIdx === idx ? `0 0 15px ${hexToRgba(t.accent, 0.3)}` : 'none'
                                    }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                        <section ref={themeMenuRef}>
                            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-3 flex items-center gap-2">
                                <Icons.Palette /> Interface Theme
                            </h3>
                            
                            <div className="relative">
                                <button 
                                    onClick={() => { setIsThemeMenuOpen(!isThemeMenuOpen); setOpenNoteMenuTrack(null); }}
                                    className="w-full flex items-center justify-between border rounded-lg py-3 px-4 text-[10px] font-black uppercase outline-none transition-all shadow-inner group"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: t.border, color: t.text }}
                                >
                                    <span className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.accent }} />
                                        {t.name}
                                    </span>
                                    <div className={`transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`}>
                                        <Icons.ChevronDown />
                                    </div>
                                </button>

                                {isThemeMenuOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border shadow-2xl overflow-hidden z-[100] theme-transition"
                                         style={{ backgroundColor: t.panel, borderColor: t.border }}>
                                        {THEMES.map((theme, idx) => (
                                            <button 
                                                key={theme.name}
                                                onClick={() => {
                                                    setThemeIdx(idx);
                                                    setIsThemeMenuOpen(false);
                                                }}
                                                className="w-full px-4 py-3 text-[10px] font-black uppercase text-left flex items-center justify-between hover:bg-white/[0.05] transition-colors border-b last:border-0"
                                                style={{ color: themeIdx === idx ? theme.accent : t.text, borderColor: t.border }}
                                            >
                                                {theme.name}
                                                <div className="flex gap-[2px] h-1.5 w-12 rounded-full overflow-hidden">
                                                    {theme.colors.slice(0,3).map(c => <div key={c} className="flex-1" style={{ backgroundColor: c }} />)}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-3 flex gap-[1px] h-1.5 w-full rounded-full overflow-hidden bg-black/40">
                                    {t.colors.map((c, i) => <div key={i} className="flex-1" style={{ backgroundColor: c }} />)}
                                </div>
                            </div>
                        </section>

                        <div className="mt-auto flex flex-col gap-2">
                            <button onClick={() => generateMidi(activeP.data, bpm)} className="w-full py-4 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-xl hover:scale-[1.02] active:scale-95"
                                    style={{ backgroundColor: t.accent, color: '#000' }}>
                                Full MIDI Export
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-black/30 border-t text-center" style={{ borderColor: t.border }}>
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-20">Alpha Engine v1.0</span>
                    </div>
                </aside>
            </div>

            {/* FOOTER AUTOMATION LANES */}
            <footer className="border-t flex p-3 gap-6 h-64 shadow-2xl z-40 theme-transition glass-panel" 
                    style={{ backgroundColor: t.panel, borderColor: t.border }}>
                <div className="w-56 flex flex-col justify-between py-1 border-r pr-4" style={{ borderColor: t.border }}>
                    <div className="bg-black/30 p-4 rounded-xl border flex flex-col gap-1" style={{ borderColor: t.border }}>
                        {['Velocity', 'Gate', 'Probability', 'Shift', 'Swing'].map(tab => (
                            <button key={tab} onClick={() => setFooterTab(tab)} 
                                    className="px-4 py-2 rounded text-[9px] font-black uppercase text-left transition-all"
                                    style={{ 
                                        backgroundColor: footerTab === tab ? t.accent : 'transparent',
                                        color: footerTab === tab ? '#000' : t.text
                                    }}>{tab}</button>
                        ))}
                    </div>
                    <div className="text-center"><span className="text-[9px] font-black uppercase tracking-tighter italic" style={{ color: t.accent }}>CH. {selectedTrack + 1} Automation</span></div>
                </div>
                
                <div className="flex-1 flex flex-col gap-4">
                    {/* MAIN AUTOMATION DRAW GRID */}
                    <div className="flex-1 flex gap-2 h-full py-1.5 px-2 relative border bg-black/40 rounded-xl" style={{ borderColor: t.border }}>
                        {[0,1,2,3].map(secIdx => {
                            const isDimmed = activeSection !== -1 && activeSection !== secIdx;
                            const secColor = t.colors[secIdx % t.colors.length];
                            
                            return (
                                <div key={secIdx} className="flex-1 flex gap-1 h-full transition-opacity"
                                     style={{ 
                                         opacity: isDimmed ? 0.3 : 1,
                                         borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(secColor, 0.2)}` : 'none',
                                         paddingLeft: secIdx > 0 ? '6px' : '2px',
                                         marginLeft: secIdx > 0 ? '-2px' : '0'
                                     }}>
                                    {activeP.data[tabToKey[footerTab]][selectedTrack].slice(secIdx*8, secIdx*8+8).map((v, localIdx) => {
                                        const i = secIdx * 8 + localIdx;
                                        const isP = currentStep === i;
                                        const isActive = activeSteps[selectedTrack][i];
                                        
                                        return (
                                            <div key={i} className="flex-1 h-full flex flex-col justify-end group cursor-ns-resize transition-opacity relative"
                                                 onMouseDown={(e)=>handleDraw(i,e)} 
                                                 onMouseMove={(e)=>handleDraw(i,e)}
                                                 onContextMenu={(e)=>handleDraw(i,e)}>
                                                <div className="w-full rounded-t-[1px] transition-all relative"
                                                     style={{ 
                                                         height: `${v}%`, 
                                                         backgroundColor: isActive ? t.colors[selectedTrack % t.colors.length] : 'rgba(255,255,255,0.05)',
                                                         borderTop: isP ? `2px solid #fff` : 'none',
                                                         boxShadow: isP ? `0 0 15px rgba(255,255,255,0.4)` : 'none'
                                                     }}>
                                                     {isP && <div className="absolute inset-0 bg-white/20" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        })}
                    </div>

                    {/* RATCETING/REPEATS LANE */}
                    <div className="h-16 flex gap-2 px-2">
                        {[0,1,2,3].map(secIdx => {
                            const isDimmed = activeSection !== -1 && activeSection !== secIdx;
                            const secColor = t.colors[secIdx % t.colors.length];
                            return (
                                <div key={secIdx} className="flex-1 flex gap-1 h-full transition-opacity"
                                     style={{ 
                                         opacity: isDimmed ? 0.3 : 1,
                                         borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(secColor, 0.2)}` : 'none',
                                         paddingLeft: secIdx > 0 ? '6px' : '2px',
                                         marginLeft: secIdx > 0 ? '-2px' : '0'
                                     }}>
                                    {repeats[selectedTrack].slice(secIdx*8, secIdx*8+8).map((c, localIdx) => {
                                        const sIdx = secIdx * 8 + localIdx;
                                        return (
                                            <div key={sIdx} className="flex-1 flex flex-col gap-[1px]">
                                                {[1,2,3,4].map(val => (
                                                    <button key={val} onClick={() => { const n = clone2D(repeats); n[selectedTrack][sIdx] = val; update({ repeats: n }); }}
                                                        className="flex-1 rounded-[1px] text-[7px] font-black transition-all border"
                                                        style={{ 
                                                            backgroundColor: c === val ? t.accent : 'rgba(255,255,255,0.05)',
                                                            borderColor: c === val ? t.accent : t.border,
                                                            color: c === val ? '#000' : hexToRgba(t.text, 0.4)
                                                        }}>{val}</button>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </footer>
        </div>
    );
}