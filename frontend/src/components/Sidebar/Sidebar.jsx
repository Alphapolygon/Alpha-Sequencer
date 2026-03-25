import React, { useState } from 'react';
import { PATTERN_LABELS, THEMES, Icons, TIME_DIVISIONS, SCALES, VISIBLE_TRACK_PRESETS } from '../../utils/constants';
import { hexToRgba, generateMidi } from '../../utils/helpers';

export default function Sidebar({ t, activeP, bridge }) {
    const { activeIdx, themeIdx, visibleTracks, selectedTrack } = bridge; 
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    
    const trackState = activeP?.data?.trackStates[selectedTrack] || {};
    const divIdx = trackState.timeDivision ?? 3;
    const scaleIdx = trackState.scale ?? 0;

    return (
        <aside className="w-80 border-l shadow-2xl z-40 flex flex-col theme-transition glass-panel" style={{ backgroundColor: t.sidebar, borderColor: t.border }}>
            <div className="p-4 bg-black/20 border-b" style={{ borderColor: t.border }}>
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: t.accent }}>Pattern Matrix</h3>
                <div className="grid grid-cols-5 gap-2">
                    {PATTERN_LABELS.map((label, idx) => (
                        <button key={label} onClick={() => bridge.changeActivePattern(idx)}
                            className="aspect-square rounded flex items-center justify-center text-xs font-black transition-all border"
                            style={{ backgroundColor: activeIdx === idx ? t.accent : 'rgba(0,0,0,0.4)', borderColor: activeIdx === idx ? t.accent : t.border, color: activeIdx === idx ? '#000' : t.text, boxShadow: activeIdx === idx ? `0 0 15px ${hexToRgba(t.accent, 0.3)}` : 'none' }}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                <section>
                    <div className="flex items-center justify-between mb-3 opacity-70">
                        <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Icons.Palette /> Global UI</h3>
                    </div>
                    <div className="flex gap-2 relative">
                        <button onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} className="flex-1 border rounded-lg py-2.5 px-3 text-[10px] font-black uppercase flex items-center justify-between shadow-inner transition-all" style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: t.border, color: t.text }}>
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.accent }} />{t.name}</span>
                            <div className={`transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                        </button>

                        {/* Visible Tracks Dropdown */}
                       <div className="relative group">
                            <button className="w-16 border rounded-lg py-2.5 text-[10px] font-black uppercase shadow-inner" style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: t.border, color: t.text }}>{visibleTracks} TR</button>
                            {/* Removed "mt-1" from the class list below */}
                            <div className="absolute top-full right-0 rounded-lg border shadow-2xl hidden group-hover:block z-50 overflow-hidden" style={{ backgroundColor: t.panel, borderColor: t.border }}>
                                {VISIBLE_TRACK_PRESETS.map(num => (
                                    <button key={num} onClick={() => bridge.changeVisibleTracks(num)} className="block w-16 py-2 text-[10px] font-black transition-colors hover:bg-white/10" style={{ color: visibleTracks === num ? t.accent : t.text }}>{num}</button>
                                ))}
                            </div>
                        </div>

                        {isThemeMenuOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-2xl z-[100] overflow-hidden" style={{ backgroundColor: t.panel, borderColor: t.border }}>
                                {THEMES.map((theme, idx) => (
                                    <button key={theme.name} onClick={() => { bridge.setThemeIdx(idx); setIsThemeMenuOpen(false); }} className="w-full px-4 py-3 text-[10px] font-black uppercase flex items-center justify-between hover:bg-white/5 border-b last:border-0" style={{ color: themeIdx === idx ? theme.accent : t.text, borderColor: t.border }}>
                                        {theme.name} <div className="flex gap-[2px] h-1.5 w-10 rounded-full overflow-hidden">{theme.colors.slice(0, 3).map(c => <div key={c} className="flex-1" style={{ backgroundColor: c }} />)}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="pt-4 border-t" style={{ borderColor: t.border }}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3">Track Spacing</h3>
                    <div className="grid grid-cols-5 gap-1">
                        {TIME_DIVISIONS.map((label, idx) => (
                            <button key={label} onClick={() => bridge.setTrackTimeDivision(selectedTrack, idx)}
                                className="py-2 text-[9px] font-bold rounded border transition-all"
                                style={{ backgroundColor: divIdx === idx ? t.accent : 'rgba(0,0,0,0.3)', borderColor: divIdx === idx ? t.accent : t.border, color: divIdx === idx ? '#000' : t.text }}>{label}</button>
                        ))}
                    </div>
                </section>

                <section className="pt-4 border-t" style={{ borderColor: t.border }}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3 flex items-center justify-between">
                        <span>Melodic Quantizer</span><span style={{ color: t.accent }}>{SCALES[scaleIdx]}</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-1 mb-1">
                        {SCALES.map((scaleName, idx) => (
                            <button key={scaleName} onClick={() => bridge.setTrackScale(selectedTrack, idx)}
                                className="py-1.5 px-2 text-[9px] font-bold rounded border transition-colors text-left truncate"
                                style={{ backgroundColor: scaleIdx === idx ? hexToRgba(t.accent, 0.2) : 'rgba(0,0,0,0.3)', borderColor: scaleIdx === idx ? t.accent : t.border, color: scaleIdx === idx ? '#fff' : t.text }}>{scaleName}</button>
                        ))}
                    </div>
                    <p className="text-[8px] opacity-60 uppercase tracking-wider mt-2">Draw sequence in the Pitch Automation Lane below.</p>
                </section>
            </div>
        </aside>
    );
}