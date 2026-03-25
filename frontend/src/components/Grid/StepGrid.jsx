import React, { useState } from 'react';
import { Icons, MIDI_OPTIONS } from '../../utils/constants';
import { hexToRgba } from '../../utils/helpers';

const CustomDropdown = ({ value, options, onChange, theme, trackColor, isSelected, isOpen, onToggle, onClose, isBottom }) => {
    return (
        <div className="w-full relative" data-note-dropdown="true">
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className="w-full rounded-md pl-2 pr-6 py-1.5 text-[9px] font-black uppercase outline-none border transition-all flex items-center justify-between"
                style={{ backgroundColor: isSelected ? theme.panel : theme.sidebar, borderColor: isSelected ? hexToRgba(trackColor, 0.55) : theme.border, color: isSelected ? '#fff' : theme.text, boxShadow: isSelected ? `0 0 12px ${hexToRgba(trackColor, 0.16)}` : 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}>
                <span className="truncate">{value}</span>
                <span className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 transition-transform duration-200 ${isOpen ? (isBottom ? '-rotate-180' : 'rotate-180') : ''}`} style={{ color: isSelected ? trackColor : theme.accent }}><Icons.ChevronDown /></span>
            </button>
            {isOpen && (
                // 2. Conditionally apply 'bottom-full mb-1' instead of 'top-full mt-1'
                <div className={`absolute ${isBottom ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 right-0 rounded-lg border shadow-2xl overflow-hidden z-[120]`} style={{ backgroundColor: theme.panel, borderColor: theme.border, boxShadow: `0 16px 30px ${hexToRgba(theme.bg, 0.7)}` }}>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
                        {options.map((option) => (
                            <button key={option} type="button" onClick={(e) => { e.stopPropagation(); onChange(option); onClose(); }} className="w-full px-3 py-2 text-[9px] font-black uppercase text-left transition-colors flex items-center justify-between" style={{ backgroundColor: option === value ? hexToRgba(trackColor, 0.14) : 'transparent', color: option === value ? (isSelected ? '#fff' : theme.accent) : theme.text }}>
                                <span>{option}</span>{option === value && <span style={{ color: trackColor }}>●</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const StepCell = React.memo(({ isActive, isPlayhead, isOutBounds, trackColor, onClick }) => (
    <div onClick={onClick} className="flex-1 rounded-[1px] cursor-pointer border relative overflow-hidden transition-all duration-75"
        style={{ backgroundColor: isOutBounds ? 'rgba(0,0,0,0.4)' : (isActive ? trackColor : 'rgba(255,255,255,0.10)'), borderColor: isPlayhead ? trackColor : 'rgba(0,0,0,0.4)', opacity: isOutBounds ? 0.3 : 1, boxShadow: isPlayhead ? `inset 0 0 5px ${trackColor}` : 'none', transform: isPlayhead ? 'scaleY(1.1)' : 'none' }}>
        {isPlayhead && <div className="absolute inset-0 bg-white/10 pointer-events-none" />}
    </div>
));

export default function StepGrid({ t, activeP, visibleTracks, selectedTrack, activeSection, bridge }) {
    const [openMenuId, setOpenMenuId] = useState(null);
    const { activeSteps, trackStates, midiKeys } = activeP.data;

    return (
        <main className="flex-1 flex flex-col p-2 gap-[1px] overflow-y-auto custom-scrollbar theme-transition" style={{ backgroundColor: t.bg }}>
            <div className="flex items-center h-5 gap-2 px-2 mb-1">
                <div className="w-52 pr-2 border-r border-transparent"></div><div className="w-[140px]"></div><div className="flex gap-0.5 w-[54px]"></div>
                <div className="flex-1 flex gap-2 h-full px-2 relative min-w-[640px]">
                    {[0, 1, 2, 3].map(secIdx => {
                        const tint = t.colors[secIdx % t.colors.length];
                        return (
                            <div key={secIdx} className="flex-1 flex gap-1 rounded-sm relative transition-opacity" style={{ opacity: activeSection !== -1 && activeSection !== secIdx ? 0.4 : 1, borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(tint, 0.4)}` : 'none', paddingLeft: secIdx > 0 ? '6px' : '2px', marginLeft: secIdx > 0 ? '-2px' : '0' }}>
                                <div className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full opacity-60" style={{ backgroundColor: tint }} />
                                {Array(8).fill(0).map((_, i) => (
                                    <div key={i} className="flex-1 flex justify-center items-end pb-1"><span className="text-[12px] font-mono font-bold transition-opacity" style={{ color: t.text, opacity: 0.6 }}>{secIdx * 8 + i + 1}</span></div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            {activeSteps.slice(0, visibleTracks).map((track, tIdx) => {
                const trackColor = t.colors[tIdx % t.colors.length];
                const currentLen = trackStates[tIdx]?.length || 16;
                const isTrackPlaying = bridge.currentStep >= 0 && track[bridge.currentStep % currentLen];

                return (
                    <div key={tIdx} onClick={() => { bridge.changeSelectedTrack(tIdx); setOpenMenuId(null); }} className="flex items-center h-11 gap-2 rounded-sm transition-all px-2 border theme-transition" style={{ backgroundColor: selectedTrack === tIdx ? 'rgba(255,255,255,0.10)' : 'transparent', borderColor: selectedTrack === tIdx ? t.border : 'transparent' }}>
                        <div className="w-52 flex items-center gap-2 pr-2 border-r h-full" style={{ borderColor: t.border }}>
                            <div className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: isTrackPlaying ? trackColor : 'rgba(0,0,0,0.5)', boxShadow: isTrackPlaying ? `0 0 10px ${trackColor}` : 'none' }} />
                            <span className="text-[10px] font-mono font-bold opacity-60 w-4">{String(tIdx + 1).padStart(2, '0')}</span>
                            <input type="number" min="1" max="32" value={currentLen} onChange={(e) => bridge.setTrackLength(tIdx, parseInt(e.target.value) || 16)} className="w-8 bg-transparent text-[10px] font-black text-center outline-none border-b border-white/20 focus:border-white/60" />
                            <span className="text-[10px] font-black uppercase tracking-tight flex-1 truncate" style={{ color: selectedTrack === tIdx ? '#fff' : t.text }}>Track {tIdx + 1}</span>
                            <button onClick={(e) => { e.stopPropagation(); bridge.editClearTrack(bridge.activeIdx, tIdx); }} className="p-1 opacity-50 hover:opacity-100 text-[8px] font-black uppercase border rounded transition-all" style={{ borderColor: t.border, color: t.text }}>CLR</button>
                        </div>
                        
                        <div className="w-[140px] flex gap-1">
                            <div className="flex-1">
                                <CustomDropdown 
                                    value={midiKeys[tIdx]} 
                                    options={MIDI_OPTIONS} 
                                    theme={t} 
                                    trackColor={trackColor} 
                                    isSelected={selectedTrack === tIdx} 
                                    isOpen={openMenuId === `note-${tIdx}`} 
                                    onToggle={() => setOpenMenuId(prev => prev === `note-${tIdx}` ? null : `note-${tIdx}`)} 
                                    onClose={() => setOpenMenuId(null)} 
                                    onChange={(note) => bridge.editTrackMidiKey(tIdx, note)} 
                                    isBottom={tIdx >= 12} /* <--- ADD THIS HERE */
                                />
                            </div>
                        </div>

                        <div className="flex gap-0.5">
                            {['M', 'S'].map(ctrl => {
                                const type = ctrl === 'M' ? 'mute' : 'solo'; const isOn = trackStates[tIdx][type];
                                return (<button key={ctrl} onClick={(e) => { e.stopPropagation(); bridge.editTrackState(tIdx, type, !isOn); }} className="w-6 h-6 rounded-sm text-[9px] font-black border transition-all" style={{ backgroundColor: isOn ? (type === 'mute' ? '#ef4444' : '#fbbf24') : 'rgba(255,255,255,0.10)', borderColor: isOn ? (type === 'mute' ? '#ef4444' : '#fbbf24') : t.border, color: isOn ? '#000' : t.text }}>{ctrl}</button>);
                            })}
                        </div>

                        <div className="flex-1 flex gap-2 h-full py-1.5 px-2 relative min-w-[640px]">
                            {[0, 1, 2, 3].map(secIdx => (
                                <div key={secIdx} className="flex-1 flex gap-1 rounded-sm p-0.5 transition-all relative" style={{ backgroundColor: activeSection === secIdx ? 'rgba(255,255,255,0.10)' : 'transparent', opacity: activeSection !== -1 && activeSection !== secIdx ? 0.4 : 1, borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(t.colors[secIdx % t.colors.length], 0.2)}` : 'none', paddingLeft: secIdx > 0 ? '6px' : '2px', marginLeft: secIdx > 0 ? '-2px' : '0' }}>
                                    {Array(8).fill(0).map((_, i) => {
                                        const sIdx = (secIdx * 8) + i;
                                        return (<StepCell key={sIdx} isActive={track[sIdx]} isPlayhead={bridge.currentStep >= 0 && (bridge.currentStep % currentLen === sIdx)} isOutBounds={sIdx >= currentLen} trackColor={trackColor} onClick={(e) => { e.stopPropagation(); bridge.editStepActive(bridge.activeIdx, tIdx, sIdx, !track[sIdx]); }} />);
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </main>
    );
}