import React from 'react';

export default function DawSyncStatus({ theme, bpm, isPlaying }) {
    return (
        <div className="flex flex-col items-center ml-2 border-l pl-6" style={{ borderColor: theme.border }}>
            <span className="text-[8px] font-black uppercase mb-0.5 opacity-70">DAW Sync</span>
            <div className="flex items-center gap-2">
                <div
                    className={`w-2 h-2 rounded-full transition-all ${isPlaying ? 'active-glow' : ''}`}
                    style={{ backgroundColor: isPlaying ? theme.accent : 'rgba(255,255,255,0.2)', '--accent': theme.accent }}
                />
                <span
                    className="text-sm font-mono font-black px-2.5 py-1 rounded border"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: theme.border, color: '#fff' }}
                >
                    {bpm} <span className="text-[9px] opacity-70 ml-1">BPM</span>
                </span>
            </div>
        </div>
    );
}
