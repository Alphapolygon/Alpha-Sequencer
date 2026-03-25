import React from 'react';
import { VISIBLE_TRACK_PRESETS } from '../../utils/musicConstants.js';

export default function VisibleTracksControl({ theme, visibleTracks, onChange }) {
    return (
        <div className="relative group">
            <button
                className="w-16 border rounded-lg py-2.5 text-[10px] font-black uppercase shadow-inner"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: theme.border, color: theme.text }}
            >
                {visibleTracks} TR
            </button>
            <div className="absolute top-full right-0 rounded-lg border shadow-2xl hidden group-hover:block z-50 overflow-hidden" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
                {VISIBLE_TRACK_PRESETS.map((count) => (
                    <button
                        key={count}
                        onClick={() => onChange(count)}
                        className="block w-16 py-2 text-[10px] font-black transition-colors hover:bg-white/10"
                        style={{ color: visibleTracks === count ? theme.accent : theme.text }}
                    >
                        {count}
                    </button>
                ))}
            </div>
        </div>
    );
}
