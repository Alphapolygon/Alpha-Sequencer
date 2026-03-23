import React, { useRef, useEffect, useMemo } from 'react';
import { TAB_TO_KEY } from '../utils/constants';
import { hexToRgba } from '../utils/helpers';

export default function AutomationLanes({ t, activeP, selectedTrack, activeSection, footerTab, setFooterTab, bridge }) {
    const isDrawing = useRef(false);
    const { activeSteps, repeats } = activeP.data;

    const autoStepElsRef = useRef(Array.from({ length: 32 }, () => []));

    // Evaluate the wrapper length for the specific track being edited
    const trackLen = useMemo(() => {
        let max = -1;
        for (let i = 31; i >= 0; i--) { if (activeSteps[selectedTrack][i]) { max = i; break; } }
        if (max >= 24) return 32;
        if (max >= 16) return 24;
        if (max >= 8) return 16;
        return 8;
    }, [activeSteps, selectedTrack]);

    useEffect(() => {
        autoStepElsRef.current = Array.from({ length: 32 }, (_, i) =>
            Array.from(document.querySelectorAll(`[data-auto-step="${i}"]`))
        );

        let lastStep = -1;

        const handler = (e) => {
            const absoluteStep = e.detail;
            if (lastStep === absoluteStep) return;
            
            if (lastStep >= 0) {
                const sIdx = lastStep % trackLen;
                for (const el of autoStepElsRef.current[sIdx]) {
                    el.classList.remove('playhead-active');
                }
            }
            if (absoluteStep >= 0) {
                const sIdx = absoluteStep % trackLen;
                for (const el of autoStepElsRef.current[sIdx]) {
                    el.classList.add('playhead-active');
                }
            }
            lastStep = absoluteStep;
        };

        window.addEventListener('juce-playhead', handler);
        return () => {
            if (lastStep >= 0) {
                const sIdx = lastStep % trackLen;
                for (const el of autoStepElsRef.current[sIdx]) el.classList.remove('playhead-active');
            }
            window.removeEventListener('juce-playhead', handler);
        };
    }, [trackLen, activeP, footerTab, selectedTrack, activeSection]);

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
                        <button key={tab} onClick={() => setFooterTab(tab)}
                            className="px-4 py-2 rounded text-[9px] font-black uppercase text-left transition-all"
                            style={{ backgroundColor: footerTab === tab ? t.accent : 'transparent', color: footerTab === tab ? '#000' : t.text }}>{tab}</button>
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
                                    const i = secIdx * 8 + localIdx;
                                    const isActive = activeSteps[selectedTrack][i];
                                    return (
                                        <div key={i} className="flex-1 h-full flex flex-col justify-end group cursor-ns-resize relative"
                                            onMouseDown={(e) => handleDraw(i, e)} onMouseMove={(e) => handleDraw(i, e)} onContextMenu={(e) => handleDraw(i, e)}>
                                            <div className="w-full rounded-t-[1px] relative auto-cell overflow-hidden"
                                                data-auto-step={i}
                                                style={{ height: `${v}%`, backgroundColor: isActive ? t.colors[selectedTrack % t.colors.length] : 'rgba(255,255,255,0.05)', borderTop: 'none', boxShadow: 'none' }} />
                                        </div>
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
                                        <div key={sIdx} className="flex-1 flex flex-col gap-[1px]">
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