import React, { useRef } from 'react';
import { TAB_TO_KEY } from '../utils/constants';
import { hexToRgba } from '../utils/helpers';

const AutoCell = React.memo(({ value, isActive, isPlayhead, isOutBounds, trackColor, onDraw, onContextMenu }) => {
    return (
        <div className="flex-1 h-full flex flex-col justify-end group cursor-ns-resize relative"
             onMouseDown={onDraw} onMouseMove={onDraw} onContextMenu={onContextMenu}
             style={{ opacity: isOutBounds ? 0.2 : 1 }}>
            <div className="w-full rounded-t-[1px] relative overflow-hidden transition-all duration-75"
                 style={{ 
                     height: `${value}%`, 
                     backgroundColor: isOutBounds ? 'rgba(0,0,0,0.4)' : (isActive ? trackColor : 'rgba(255,255,255,0.05)'),
                     borderTop: isPlayhead ? '2px solid #fff' : 'none',
                     boxShadow: isPlayhead ? '0 0 15px rgba(255,255,255,0.4)' : 'none'
                 }}>
                 {isPlayhead && <div className="absolute inset-0 bg-white/20 pointer-events-none" />}
            </div>
        </div>
    );
});

export default function AutomationLanes({ t, activeP, selectedTrack, activeSection, footerTab, setFooterTab, bridge }) {
    const isDrawing = useRef(false);
    const { activeSteps, repeats, trackStates } = activeP.data;
    const trackLen = trackStates[selectedTrack]?.length || 16;

    const handleDraw = (sIdx, e) => {
        const key = TAB_TO_KEY[footerTab];
        if (e.type === 'contextmenu') {
            e.preventDefault();
            const defaultValues = { velocities: 100, gates: 75, probabilities: 100, shifts: 50, swings: 0 };
            bridge.editStepParameter(bridge.activeIdx, selectedTrack, sIdx, key, defaultValues[key]);
            return;
        }

        if (e.type === 'mousedown' && e.button === 0) isDrawing.current = true;

        if ((isDrawing.current && e.buttons === 1) || (e.type === 'mousedown' && e.button === 0)) {
            const rect = e.currentTarget.getBoundingClientRect();
            const val = Math.round(Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100)));
            bridge.editStepParameter(bridge.activeIdx, selectedTrack, sIdx, key, val);
        }
    };

    return (
        <footer className="border-t flex p-3 gap-6 h-64 shadow-2xl z-40 theme-transition glass-panel"
            style={{ backgroundColor: t.panel, borderColor: t.border }}
            onMouseUp={() => isDrawing.current = false}
            onMouseLeave={() => isDrawing.current = false}>
            <div className="w-56 flex flex-col justify-between py-1 border-r pr-4" style={{ borderColor: t.border }}>
				<div className="bg-black/30 p-4 rounded-xl border flex flex-col gap-1" style={{ borderColor: t.border }}>
					{['Velocity', 'Gate', 'Probability', 'Shift', 'Swing'].map(tab => (
						<div key={tab} className="flex gap-1 group">
							<button onClick={() => setFooterTab(tab)}
								className="flex-1 px-4 py-2 rounded text-[9px] font-black uppercase text-left transition-all"
								style={{ backgroundColor: footerTab === tab ? t.accent : 'transparent', color: footerTab === tab ? '#000' : t.text }}>{tab}</button>
							
                            {/* FIX: Use TAB_TO_KEY to map exact strings for C++ */}
							<button onClick={() => bridge.randomizeParameter(selectedTrack, TAB_TO_KEY[tab])}
									className="px-2 rounded opacity-0 group-hover:opacity-40 hover:opacity-100 transition-all border border-transparent hover:border-white/20 text-[8px] font-black"
									title={`Randomize ${tab}`}>R</button>
						</div>
					))}
				</div>
                <div className="text-center"><span className="text-[9px] font-black uppercase tracking-tighter italic" style={{ color: t.accent }}>CH. {selectedTrack + 1} Automation</span></div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
                <div className="flex-1 flex gap-2 h-full py-1.5 px-2 relative border bg-black/40 rounded-xl" style={{ borderColor: t.border }}>
                    {[0, 1, 2, 3].map(secIdx => {
                        const isDimmed = activeSection !== -1 && activeSection !== secIdx;
                        const secColor = t.colors[secIdx % t.colors.length];
                        return (
                            <div key={secIdx} className="flex-1 flex gap-1 h-full transition-opacity"
                                style={{ opacity: isDimmed ? 0.3 : 1, borderLeft: secIdx > 0 ? `2px solid ${hexToRgba(secColor, 0.2)}` : 'none', paddingLeft: secIdx > 0 ? '6px' : '2px', marginLeft: secIdx > 0 ? '-2px' : '0' }}>
                                {activeP.data[TAB_TO_KEY[footerTab]][selectedTrack].slice(secIdx * 8, secIdx * 8 + 8).map((v, localIdx) => {
                                    const sIdx = secIdx * 8 + localIdx;
                                    return (
                                        <AutoCell 
                                            key={sIdx}
                                            value={v}
                                            isActive={activeSteps[selectedTrack][sIdx]}
                                            isPlayhead={bridge.currentStep >= 0 && (bridge.currentStep % trackLen === sIdx)}
                                            isOutBounds={sIdx >= trackLen}
                                            trackColor={t.colors[selectedTrack % t.colors.length]}
                                            onDraw={(e) => handleDraw(sIdx, e)}
                                            onContextMenu={(e) => handleDraw(sIdx, e)}
                                        />
                                    );
                                })}
                            </div>
                        )
                    })}
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
                                                    style={{ backgroundColor: c === val ? t.accent : 'rgba(255,255,255,0.05)', borderColor: c === val ? t.accent : t.border, color: c === val ? '#000' : hexToRgba(t.text, 0.4) }}>{val}</button>
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