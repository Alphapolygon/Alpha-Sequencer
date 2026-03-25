import React from 'react';
import { PATTERN_LABELS } from '../../utils/patternConstants.js';
import { hexToRgba } from '../../utils/color.js';

export default function PatternMatrix({ theme, activeIdx, onChange }) {
    return (
        <div className="p-4 bg-black/20 border-b" style={{ borderColor: theme.border }}>
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: theme.accent }}>
                Pattern Matrix
            </h3>
            <div className="grid grid-cols-5 gap-2">
                {PATTERN_LABELS.map((label, index) => {
                    const isActive = activeIdx === index;
                    return (
                        <button
                            key={label}
                            onClick={() => onChange(index)}
                            className="aspect-square rounded flex items-center justify-center text-xs font-black transition-all border"
                            style={{
                                backgroundColor: isActive ? theme.accent : 'rgba(0,0,0,0.4)',
                                borderColor: isActive ? theme.accent : theme.border,
                                color: isActive ? '#000' : theme.text,
                                boxShadow: isActive ? `0 0 15px ${hexToRgba(theme.accent, 0.3)}` : 'none',
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
