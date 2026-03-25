import React from 'react';
import { Icons } from '../../utils/icons.jsx';

export default function JitterPanel({ theme, footerTab, currentJitter, onReset, onChange }) {
    return (
        <div className="mt-auto bg-black/30 p-3 rounded-lg border flex flex-col gap-2" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase" style={{ color: theme.accent }}>
                    {footerTab} Jitter
                </span>
                <button onClick={onReset} className="opacity-50 hover:opacity-100 transition-all" title="Reset Lane to Defaults">
                    <Icons.Reset />
                </button>
            </div>

            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={currentJitter}
                    onChange={(event) => onChange(parseFloat(event.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 outline-none"
                    style={{ accentColor: theme.accent }}
                />
                <span className="text-[10px] font-mono w-8 text-right">{Math.round(currentJitter * 100)}%</span>
            </div>

            <p className="text-[8px] opacity-40 uppercase leading-tight">
                Adds random deviance during playback. Non-destructive.
            </p>
        </div>
    );
}
