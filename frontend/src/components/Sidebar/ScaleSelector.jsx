import React from 'react';
import { SCALES } from '../../utils/musicConstants.js';
import { hexToRgba } from '../../utils/color.js';

export default function ScaleSelector({ theme, scaleIndex, onChange }) {
    return (
        <section className="pt-4 border-t" style={{ borderColor: theme.border }}>
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3 flex items-center justify-between">
                <span>Melodic Quantizer</span>
                <span style={{ color: theme.accent }}>{SCALES[scaleIndex]}</span>
            </h3>
            <div className="grid grid-cols-2 gap-1 mb-1">
                {SCALES.map((scaleName, index) => {
                    const isActive = scaleIndex === index;
                    return (
                        <button
                            key={scaleName}
                            onClick={() => onChange(index)}
                            className="py-1.5 px-2 text-[9px] font-bold rounded border transition-colors text-left truncate"
                            style={{
                                backgroundColor: isActive ? hexToRgba(theme.accent, 0.2) : 'rgba(0,0,0,0.3)',
                                borderColor: isActive ? theme.accent : theme.border,
                                color: isActive ? '#fff' : theme.text,
                            }}
                        >
                            {scaleName}
                        </button>
                    );
                })}
            </div>
            <p className="text-[8px] opacity-60 uppercase tracking-wider mt-2">Draw sequence in the Pitch Automation Lane below.</p>
        </section>
    );
}
