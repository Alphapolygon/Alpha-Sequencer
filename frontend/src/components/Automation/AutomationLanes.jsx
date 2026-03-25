import React, { useRef } from 'react';
import { TAB_TO_KEY, TAB_TO_IDX, Icons } from '../../utils/constants';
import { hexToRgba, midiToNoteName } from '../../utils/helpers';


const AutoCell = React.memo(({ value, isActive, isPlayhead, isOutBounds, trackColor, onDraw, onContextMenu, isBipolar, currentJitter }) => {
    return (
        // Added overflow-hidden so the jitter visualization doesn't bleed out of the box
        <div className="flex-1 h-full flex flex-col justify-end group cursor-ns-resize relative overflow-hidden" onMouseDown={onDraw} onMouseMove={onDraw} onContextMenu={onContextMenu} style={{ opacity: isOutBounds ? 0.2 : 1 }}>
            
            {/* JITTER VISUALIZATION OVERLAY */}
            {currentJitter > 0 && (
                <div className="absolute w-full pointer-events-none"
                     style={{
                         backgroundColor: hexToRgba(trackColor, 0.3), // 30% opacity of track color
                         height: isBipolar ? `${currentJitter * 100}%` : `${currentJitter * 200}%`,
                         bottom: isBipolar
                             ? `calc(50% + ${value * 50}% - ${currentJitter * 50}%)`
                             : `calc(${value}% - ${currentJitter * 100}%)`,
                         zIndex: 0
                     }}
                />
            )}

            {/* MAIN AUTOMATION BAR - Changed transition-all to transition-colors */}
            <div className="w-full absolute transition-colors duration-75 border-l border-r border-black"
                 style={{ 
                     height: isBipolar ? `${Math.abs(value) * 50}%` : `${value}%`, 
                     bottom: isBipolar ? (value > 0 ? '50%' : 'auto') : '0',
                     top: isBipolar && value < 0 ? '50%' : 'auto',
                     backgroundColor: isOutBounds ? 'rgba(0,0,0,0.4)' : (isActive ? trackColor : 'rgba(255,255,255,0.05)'),
                     borderTop: isPlayhead ? '2px solid #fff' : 'none', boxShadow: isPlayhead ? `0 0 10px ${trackColor}` : 'none',
                     zIndex: 1
                 }}>
                 {isPlayhead && <div className="absolute inset-0 bg-white/20 pointer-events-none" />}
            </div>
            {isBipolar && <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/20 pointer-events-none z-10" />}
        </div>
    );
});

export default function AutomationLanes({ t, activeP, selectedTrack, activeSection, footerTab, setFooterTab, bridge }) {
    const isDrawing = useRef(false);
    const { activeSteps, repeats, trackStates, randomAmounts } = activeP.data;
    const trackLen = trackStates[selectedTrack]?.length || 16;
    const currentJitter = randomAmounts[selectedTrack]?.[TAB_TO_IDX[footerTab]] || 0;

    const handleDraw = (sIdx, e) => {
        const key = TAB_TO_KEY[footerTab];
        if (e.type === 'contextmenu') { e.preventDefault(); bridge.editStepParameter(bridge.activeIdx, selectedTrack, sIdx, key, key==='pitches'?0: (key==='gates'?75: (key==='shifts'?50: (key==='swings'?0:100)))); return; }
        if (e.type === 'mousedown' && e.button === 0) isDrawing.current = true;

        if ((isDrawing.current && e.buttons === 1) || (e.type === 'mousedown' && e.button === 0)) {
            const rect = e.currentTarget.getBoundingClientRect();
            const yPercent = 1 - ((e.clientY - rect.top) / rect.height);
            let val;
            if (key === 'pitches') val = Math.round((yPercent * 48) - 24); // -24 to +24
            else val = Math.round(Math.max(0, Math.min(100, yPercent * 100)));
            bridge.editStepParameter(bridge.activeIdx, selectedTrack, sIdx, key, val);
        }
    };

    return (
        <footer className="border-t flex p-3 gap-6 h-64 shadow-2xl z-40 theme-transition glass-panel" style={{ backgroundColor: t.panel, borderColor: t.border }} onMouseUp={() => isDrawing.current = false} onMouseLeave={() => isDrawing.current = false}>
            <div className="w-56 flex flex-col py-1 border-r pr-4" style={{ borderColor: t.border }}>
				<div className="grid grid-cols-2 gap-1 mb-4">
					{['Velocity', 'Gate', 'Probability', 'Shift', 'Swing', 'Pitch'].map(tab => (
                        <button key={tab} onClick={() => setFooterTab(tab)} className="px-3 py-2 rounded text-[9px] font-black uppercase text-left transition-all border" style={{ backgroundColor: footerTab === tab ? t.accent : 'transparent', borderColor: footerTab === tab ? t.accent : t.border, color: footerTab === tab ? '#000' : t.text }}>{tab}</button>
					))}
				</div>
                
                {/* LIVE JITTER CONTROLS */}
                <div className="mt-auto bg-black/30 p-3 rounded-lg border flex flex-col gap-2" style={{ borderColor: t.border }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase" style={{ color: t.accent }}>{footerTab} Jitter</span>
                        <button onClick={() => bridge.resetAutomationLane(selectedTrack, TAB_TO_KEY[footerTab])} className="opacity-50 hover:opacity-100 transition-all" title="Reset Lane to Defaults"><Icons.Reset /></button>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="range" min="0" max="1" step="0.01" value={currentJitter} onChange={(e) => bridge.setTrackRandomAmount(selectedTrack, TAB_TO_IDX[footerTab], parseFloat(e.target.value))} className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 outline-none" style={{ accentColor: t.accent }} />
                        <span className="text-[10px] font-mono w-8 text-right">{Math.round(currentJitter * 100)}%</span>
                    </div>
                    <p className="text-[8px] opacity-40 uppercase leading-tight">Adds random deviance during playback. Non-destructive.</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
                <div className="flex-1 flex gap-2 h-full py-1.5 px-2 relative border bg-black/40 rounded-xl" style={{ borderColor: t.border }}>
                    {[0, 1, 2, 3].map(secIdx => (
                        <div key={secIdx} className="flex-1 flex gap-1 h-full transition-opacity relative group" style={{ opacity: activeSection !== -1 && activeSection !== secIdx ? 0.3 : 1, borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(t.colors[secIdx % t.colors.length], 0.2)}` : 'none', paddingLeft: secIdx > 0 ? '6px' : '2px', marginLeft: secIdx > 0 ? '-2px' : '0' }}>
                            {activeP.data[TAB_TO_KEY[footerTab]][selectedTrack].slice(secIdx * 8, secIdx * 8 + 8).map((v, localIdx) => {
                                const sIdx = secIdx * 8 + localIdx;
                                const isPitch = footerTab === 'Pitch';
                                return (
                                    <div key={sIdx} className="flex-1 relative h-full flex items-end">
                                        <AutoCell value={isPitch ? (v/24) : v} currentJitter={currentJitter} isActive={activeSteps[selectedTrack][sIdx]} isPlayhead={bridge.currentStep >= 0 && (bridge.currentStep % trackLen === sIdx)} isOutBounds={sIdx >= trackLen} trackColor={t.colors[selectedTrack % t.colors.length]} onDraw={(e) => handleDraw(sIdx, e)} onContextMenu={(e) => handleDraw(sIdx, e)} isBipolar={isPitch} />
                                        {/* Pitch Tooltip inside the bar */}
                                        {isPitch && activeSteps[selectedTrack][sIdx] && (
                                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-black text-black bg-white/80 px-1 rounded pointer-events-none opacity-0 group-hover:opacity-100">{v > 0 ? `+${v}` : v}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="h-16 flex gap-2 px-2">
                    {[0, 1, 2, 3].map(secIdx => {
                        const isDimmed = activeSection !== -1 && activeSection !== secIdx;
                        const secColor = t.colors[secIdx % t.colors.length];
                        return (
                            <div key={secIdx} className="flex-1 flex gap-1 h-full transition-opacity"
                                style={{ opacity: isDimmed ? 0.3 : 1, borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(secColor, 0.2)}` : 'none', paddingLeft: secIdx > 0 ? '6px' : '2px', marginLeft: secIdx > 0 ? '-2px' : '0' }}>
                                {repeats[selectedTrack].slice(secIdx * 8, secIdx * 8 + 8).map((c, localIdx) => {
                                    const sIdx = secIdx * 8 + localIdx;
                                    return (
                                        <div key={sIdx} className="flex-1 flex flex-col gap-[1px]" style={{ opacity: sIdx >= trackLen ? 0.2 : 1 }}>
                                            {[1, 2, 3, 4].map(val => (
                                                <button key={val} onClick={() => bridge.editStepParameter(bridge.activeIdx, selectedTrack, sIdx, 'repeats', val)}
                                                    className="flex-1 rounded-[1px] text-[7px] font-black transition-all border"
                                                    style={{ backgroundColor: c === val ? t.accent : 'rgba(255,255,255,0.05)', borderColor: c === val ? t.accent : t.border, color: c === val ? '#000' : hexToRgba(t.text, 0.6) }}>{val}</button>
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
    );
}