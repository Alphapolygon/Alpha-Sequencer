import React, { useState, useEffect } from 'react';
import { Icons, MIDI_OPTIONS } from '../utils/constants';
import { clone2D, hexToRgba, generateMidi } from '../utils/helpers';

const CustomNoteDropdown = ({ value, options, onChange, theme, trackColor, isSelected, isOpen, onToggle, onClose }) => {
    const menuBg = isSelected ? theme.panel : theme.sidebar;
    const borderColor = isSelected ? hexToRgba(trackColor, 0.55) : theme.border;
    const textColor = isSelected ? '#fff' : theme.text;

    return (
        <div className="w-28 relative" data-note-dropdown="true">
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className="w-full rounded-md pl-2 pr-7 py-1.5 text-[9px] font-black uppercase outline-none border transition-all flex items-center justify-between"
                style={{ backgroundColor: menuBg, borderColor, color: textColor, boxShadow: isSelected ? `0 0 12px ${hexToRgba(trackColor, 0.16)}` : 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}>
                <span className="truncate">{value}</span>
                <span className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: isSelected ? trackColor : theme.accent }}>
                    <Icons.ChevronDown />
                </span>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-2xl overflow-hidden z-[120]"
                    style={{ backgroundColor: theme.panel, borderColor, boxShadow: `0 16px 30px ${hexToRgba(theme.bg, 0.7)}` }}>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
                        {options.map((note) => {
                            const active = note === value;
                            return (
                                <button key={note} type="button" onClick={(e) => { e.stopPropagation(); onChange(note); onClose(); }}
                                    className="w-full px-3 py-2 text-[9px] font-black uppercase text-left transition-colors flex items-center justify-between"
                                    style={{ backgroundColor: active ? hexToRgba(trackColor, 0.14) : 'transparent', color: active ? (isSelected ? '#fff' : theme.accent) : theme.text }}>
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

export default function StepGrid({ t, activeP, selectedTrack, setSelectedTrack, activeSection, bpm, update, syncPatternToEngine }) {
    const [openNoteMenuTrack, setOpenNoteMenuTrack] = useState(null);
    const { activeSteps, trackStates, midiKeys } = activeP.data;

    // DIRECT DOM MANIPULATION FOR ZERO-CPU PLAYHEAD
    useEffect(() => {
        let lastStep = -1;
        const handler = (e) => {
            const step = e.detail;
            if (lastStep === step) return;
            
            if (lastStep >= 0) {
                document.querySelectorAll(`[data-step="${lastStep}"]`).forEach(el => {
                    el.classList.remove('playhead-active');
                    if (el.dataset.active === 'true') {
                        const dot = document.querySelector(`[data-track-dot="${el.dataset.track}"]`);
                        if (dot) dot.classList.remove('dot-playing');
                    }
                });
            }
            if (step >= 0) {
                document.querySelectorAll(`[data-step="${step}"]`).forEach(el => {
                    el.classList.add('playhead-active');
                    if (el.dataset.active === 'true') {
                        const dot = document.querySelector(`[data-track-dot="${el.dataset.track}"]`);
                        if (dot) dot.classList.add('dot-playing');
                    }
                });
            }
            lastStep = step;
        };
        window.addEventListener('juce-playhead', handler);
        return () => {
            if (lastStep >= 0) document.querySelectorAll(`[data-step="${lastStep}"]`).forEach(el => el.classList.remove('playhead-active'));
            window.removeEventListener('juce-playhead', handler);
        };
    }, []);

    return (
        <main className="flex-1 flex flex-col p-2 gap-[1px] overflow-y-auto custom-scrollbar theme-transition" style={{ backgroundColor: t.bg }}>
            {/* STEP NUMBERS & COLORED HEADER DIVIDERS */}
            <div className="flex items-center h-5 gap-2 px-2 mb-1">
                <div className="w-52 pr-2 border-r border-transparent"></div>
                <div className="w-28"></div>
                <div className="flex gap-0.5 w-[54px]"></div>
                <div className="flex-1 flex gap-2 h-full px-2 relative min-w-[640px]">
                    {[0, 1, 2, 3].map(secIdx => {
                        const tint = t.colors[secIdx % t.colors.length];
                        const isSecDimmed = activeSection !== -1 && activeSection !== secIdx;
                        return (
                            <div key={secIdx} className="flex-1 flex gap-1 rounded-sm relative transition-opacity"
                                style={{ opacity: isSecDimmed ? 0.3 : 1, borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(tint, 0.4)}` : 'none', paddingLeft: secIdx > 0 ? '6px' : '2px', marginLeft: secIdx > 0 ? '-2px' : '0' }}>
                                <div className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full opacity-40" style={{ backgroundColor: tint }} />
                                {Array(8).fill(0).map((_, i) => (
                                    <div key={(secIdx * 8) + i} className="flex-1 flex justify-center items-end pb-1">
                                        <span className="text-[12px] font-mono font-bold step-label" data-step={(secIdx * 8) + i} style={{ color: t.text, opacity: 0.4 }}>{(secIdx * 8) + i + 1}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* TRACK ROWS */}
            {activeSteps.map((track, tIdx) => {
                const trackColor = t.colors[tIdx % t.colors.length];
                return (
                    <div key={tIdx}
                        onClick={() => { setSelectedTrack(tIdx); setOpenNoteMenuTrack(null); syncPatternToEngine(activeP.data, { selectedTrack: tIdx }); }}
                        className="flex items-center h-11 gap-2 rounded-sm transition-all px-2 border theme-transition"
                        style={{ backgroundColor: selectedTrack === tIdx ? 'rgba(255,255,255,0.10)' : 'transparent', borderColor: selectedTrack === tIdx ? t.border : 'transparent' }}>
                        <div className="w-52 flex items-center gap-2 pr-2 border-r h-full" style={{ borderColor: t.border }}>
                            <div data-track-dot={tIdx} className="w-2 h-2 rounded-full track-dot" style={{ '--accent': trackColor }} />
                            <span className="text-[10px] font-mono font-bold opacity-30 w-4">{String(tIdx + 1).padStart(2, '0')}</span>
                            <span className="text-[10px] font-black uppercase tracking-tight flex-1 truncate" style={{ color: selectedTrack === tIdx ? '#fff' : t.text }}>Track {tIdx + 1}</span>
                            <button onClick={(e) => { e.stopPropagation(); const n = clone2D(activeSteps); n[tIdx].fill(false); update({ activeSteps: n }); }} className="p-1 opacity-30 hover:opacity-100 text-[8px] font-black uppercase border rounded transition-all" style={{ borderColor: t.border, color: t.text }}>CLR</button>
                            <button onClick={(e) => { e.stopPropagation(); generateMidi(activeP.data, bpm, tIdx); }} className="p-1.5 opacity-30 hover:opacity-100"><Icons.Download /></button>
                        </div>
                        
                        <CustomNoteDropdown value={midiKeys[tIdx]} options={MIDI_OPTIONS} theme={t} trackColor={trackColor} isSelected={selectedTrack === tIdx} isOpen={openNoteMenuTrack === tIdx} onToggle={() => setOpenNoteMenuTrack(prev => prev === tIdx ? null : tIdx)} onClose={() => setOpenNoteMenuTrack(null)} onChange={(note) => { const next = [...midiKeys]; next[tIdx] = note; update({ midiKeys: next }); }} />

                        <div className="flex gap-0.5">
                            {['M', 'S'].map(ctrl => {
                                const type = ctrl === 'M' ? 'mute' : 'solo';
                                const isOn = trackStates[tIdx][type];
                                const color = type === 'mute' ? '#ef4444' : '#fbbf24';
                                return (
                                    <button key={ctrl} onClick={(e) => { e.stopPropagation(); const n = [...trackStates]; n[tIdx] = { ...n[tIdx], [type]: !isOn }; update({ trackStates: n }); }} className="w-6 h-6 rounded-sm text-[9px] font-black border transition-all" style={{ backgroundColor: isOn ? color : 'rgba(255,255,255,0.10)', borderColor: isOn ? color : t.border, color: isOn ? '#000' : t.text }}>{ctrl}</button>
                                );
                            })}
                        </div>

                        <div className="flex-1 flex gap-2 h-full py-1.5 px-2 relative min-w-[640px]">
                            {[0, 1, 2, 3].map(secIdx => {
                                const isSecDimmed = activeSection !== -1 && activeSection !== secIdx;
                                const secColor = t.colors[secIdx % t.colors.length];
                                return (
                                    <div key={secIdx} className="flex-1 flex gap-1 rounded-sm p-0.5 transition-all relative" style={{ backgroundColor: activeSection === secIdx ? 'rgba(255,255,255,0.10)' : 'transparent', opacity: isSecDimmed ? 0.3 : 1, borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(secColor, 0.2)}` : 'none', paddingLeft: secIdx > 0 ? '6px' : '2px', marginLeft: secIdx > 0 ? '-2px' : '0' }}>
                                        {Array(8).fill(0).map((_, i) => {
                                            const sIdx = (secIdx * 8) + i;
                                            const isActive = track[sIdx];
                                            return (
                                                <div key={sIdx} onClick={(e) => { e.stopPropagation(); const n = clone2D(activeSteps); n[tIdx][sIdx] = !n[tIdx][sIdx]; update({ activeSteps: n }); }}
                                                    className="flex-1 rounded-[1px] cursor-pointer border step-cell relative overflow-hidden"
                                                    data-step={sIdx} data-track={tIdx} data-active={isActive ? 'true' : 'false'}
                                                    style={{ backgroundColor: isActive ? trackColor : 'rgba(255,255,255,0.10)', borderColor: 'rgba(0,0,0,0.4)' }} />
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
    );
}