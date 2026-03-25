import React from 'react';
import { TIME_DIVISIONS } from '../../utils/musicConstants.js';

export default function TrackSpacingSection({ theme, currentDivisionIndex, onChange }) {
    return (
        <section className="pt-4 border-t" style={{ borderColor: theme.border }}>
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3">Track Spacing</h3>
            <div className="grid grid-cols-5 gap-1">
                {TIME_DIVISIONS.map((label, index) => {
                    const isActive = currentDivisionIndex === index;
                    return (
                        <button
                            key={label}
                            onClick={() => onChange(index)}
                            className="py-2 text-[9px] font-bold rounded border transition-all"
                            style={{
                                backgroundColor: isActive ? theme.accent : 'rgba(0,0,0,0.3)',
                                borderColor: isActive ? theme.accent : theme.border,
                                color: isActive ? '#000' : theme.text,
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
