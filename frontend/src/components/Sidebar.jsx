import React, { useState, useEffect } from 'react';
import { PATTERN_LABELS, THEMES, Icons, TIME_DIVISIONS } from '../utils/constants';
import { hexToRgba, generateMidi } from '../utils/helpers';

const SCALES = ["Major", "Minor", "Dorian", "Mixolydian", "Pentatonic Maj", "Pentatonic Min", "Chromatic"];

export default function Sidebar({ t, activeIdx, themeIdx, activeP, bpm, bridge }) {
    const { selectedTrack } = bridge; 
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    
    const [scaleIdx, setScaleIdx] = useState(0); 
    const [divIdx, setDivIdx] = useState(3); 
    const [sequenceText, setSequenceText] = useState("1"); 

    useEffect(() => {
        if (activeP && activeP.data && activeP.data.trackStates) {
            const trackState = activeP.data.trackStates[selectedTrack];
            if (trackState) {
                setScaleIdx(trackState.scale ?? 0);
                setDivIdx(trackState.timeDivision ?? 3);
                setSequenceText(trackState.sequence ?? "1");
            }
        }
    }, [selectedTrack, activeP.data]);

    useEffect(() => {
        const handleEngineDiff = (event) => {
            const diff = event.detail;
            if (diff && diff.type === 'trackSequenceChanged' && diff.trackIndex === selectedTrack) {
                setSequenceText(diff.sequence);
            }
        };
        
        window.addEventListener('engineDiff', handleEngineDiff);
        return () => window.removeEventListener('engineDiff', handleEngineDiff);
    }, [selectedTrack]);

    const handleSequenceChange = (e) => {
        const val = e.target.value.replace(/[^0-9\s-]/g, '');
        setSequenceText(val);
    };

    const handleSequenceSubmit = () => {
        bridge.setTrackSequence(selectedTrack, sequenceText);
    };

    const handleScaleChange = (idx) => {
        setScaleIdx(idx);
        bridge.setTrackScale(selectedTrack, idx);
    };

    return (
        <aside className="w-80 border-l shadow-2xl z-40 flex flex-col theme-transition glass-panel" 
               style={{ backgroundColor: t.sidebar, borderColor: t.border }}>
            <div className="p-4 bg-black/20 border-b" style={{ borderColor: t.border }}>
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: t.accent }}>Pattern Matrix</h3>
                <div className="grid grid-cols-5 gap-2">
                    {PATTERN_LABELS.map((label, idx) => (
                        <button
                            key={label}
                            onClick={() => bridge.changeActivePattern(idx)}
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
                
                <section>
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3 flex items-center gap-2">
                        <Icons.Palette /> Interface Theme
                    </h3>
                    <div className="relative">
                        <button onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                                className="w-full flex items-center justify-between border rounded-lg py-3 px-4 text-[10px] font-black uppercase outline-none transition-all shadow-inner group"
                                style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: t.border, color: t.text }}>
                            <span className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.accent }} />
                                {t.name}
                            </span>
                            <div className={`transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                        </button>

                        {isThemeMenuOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border shadow-2xl overflow-hidden z-[100] theme-transition"
                                 style={{ backgroundColor: t.panel, borderColor: t.border }}>
                                {THEMES.map((theme, idx) => (
                                    <button key={theme.name} onClick={() => { bridge.setThemeIdx(idx); setIsThemeMenuOpen(false); }}
                                            className="w-full px-4 py-3 text-[10px] font-black uppercase text-left flex items-center justify-between hover:bg-white/[0.05] transition-colors border-b last:border-0"
                                            style={{ color: themeIdx === idx ? theme.accent : t.text, borderColor: t.border }}>
                                        {theme.name}
                                        <div className="flex gap-[2px] h-1.5 w-12 rounded-full overflow-hidden">
                                            {theme.colors.slice(0, 3).map(c => <div key={c} className="flex-1" style={{ backgroundColor: c }} />)}
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

                <section className="pt-4 border-t" style={{ borderColor: t.border }}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3">Track Spacing</h3>
                    <div className="grid grid-cols-5 gap-1">
                        {TIME_DIVISIONS.map((label, idx) => (
                            <button key={label} onClick={() => bridge.setTrackTimeDivision(selectedTrack, idx)}
                                className="py-2 text-[9px] font-bold rounded border transition-all"
                                style={{ 
                                    backgroundColor: divIdx === idx ? t.accent : 'rgba(0,0,0,0.3)',
                                    borderColor: divIdx === idx ? t.accent : t.border,
                                    color: divIdx === idx ? '#000' : t.text
                                }}>{label}</button>
                        ))}
                    </div>
                </section>

                <section className="pt-4 border-t" style={{ borderColor: t.border }}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3 flex items-center justify-between">
                        <span>Track {selectedTrack + 1} Pitch Seq</span>
                        <span style={{ color: t.accent }}>{SCALES[scaleIdx]}</span>
                    </h3>
                    
                    <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-1 mb-1">
                            {SCALES.map((scaleName, idx) => (
                                <button key={scaleName} 
                                        onClick={() => handleScaleChange(idx)}
                                        className="py-1.5 px-2 text-[9px] font-bold rounded border transition-colors text-left truncate"
                                        style={{ 
                                            backgroundColor: scaleIdx === idx ? hexToRgba(t.accent, 0.2) : 'rgba(0,0,0,0.3)',
                                            borderColor: scaleIdx === idx ? t.accent : t.border,
                                            color: scaleIdx === idx ? '#fff' : t.text
                                        }}>
                                    {scaleName}
                                </button>
                            ))}
                        </div>

                        <input 
                            type="text" 
                            value={sequenceText}
                            onChange={handleSequenceChange}
                            onBlur={handleSequenceSubmit}
                            onKeyDown={(e) => e.key === 'Enter' && handleSequenceSubmit()}
                            placeholder="e.g. 1 3 5 8 -1"
                            className="w-full bg-black/40 border rounded-lg py-3 px-4 text-xs font-mono font-bold outline-none focus:ring-1 transition-all"
                            style={{ 
                                borderColor: t.border, 
                                color: t.accent,
                                '--tw-ring-color': t.accent 
                            }}
                        />
                        <p className="text-[8px] opacity-60 uppercase tracking-wider text-right">Numbers = Scale Degrees</p>
                    </div>
                </section>

                <div className="mt-auto flex flex-col gap-2">
                    <button onClick={() => generateMidi(activeP.data, bpm)} className="w-full py-4 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-xl hover:scale-[1.02] active:scale-95"
                            style={{ backgroundColor: t.accent, color: '#000' }}>
                        Full MIDI Export
                    </button>
                </div>
            </div>
        </aside>
    );
}