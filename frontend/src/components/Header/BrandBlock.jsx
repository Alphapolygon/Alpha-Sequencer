import React from 'react';

export default function BrandBlock({ theme }) {
    return (
        <h1 className="text-xl font-black tracking-tighter flex items-center gap-2" style={{ color: theme.accent }}>
            <span className="text-black px-1.5 rounded-sm italic text-xs" style={{ backgroundColor: theme.accent }}>
                A
            </span>
            ALPHA
            <span className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: theme.text }}>
                SEQUENCER
            </span>
        </h1>
    );
}
