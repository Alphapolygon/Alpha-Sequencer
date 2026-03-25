import React from 'react';

export function TrackInfo({
    theme,
    trackIndex,
    selected,
    trackColor,
    currentLength,
    isTrackPlaying,
    onLengthChange,
    onClear,
}) {
    return (
        <div className="w-52 flex items-center gap-2 pr-2 border-r h-full" style={{ borderColor: theme.border }}>
            <div className={`track-dot w-2 h-2 rounded-full transition-all ${isTrackPlaying ? 'dot-playing' : ''}`} style={{ '--accent': trackColor }} />
            <span className="text-[10px] font-mono font-bold opacity-60 w-4">{String(trackIndex + 1).padStart(2, '0')}</span>
            <input
                type="number"
                min="1"
                max="32"
                value={currentLength}
                onChange={(event) => onLengthChange(parseInt(event.target.value, 10) || 16)}
                className="w-8 bg-transparent text-[10px] font-black text-center outline-none border-b border-white/20 focus:border-white/60"
            />
            <span className="text-[10px] font-black uppercase tracking-tight flex-1 truncate" style={{ color: selected ? '#fff' : theme.text }}>
                Track {trackIndex + 1}
            </span>
            <button
                onClick={(event) => {
                    event.stopPropagation();
                    onClear();
                }}
                className="p-1 opacity-50 hover:opacity-100 text-[8px] font-black uppercase border rounded transition-all"
                style={{ borderColor: theme.border, color: theme.text }}
            >
                CLR
            </button>
        </div>
    );
}

export function TrackToggles({ theme, trackState, onToggle }) {
    return (
        <div className="flex gap-0.5">
            {['M', 'S'].map((controlLabel) => {
                const type = controlLabel === 'M' ? 'mute' : 'solo';
                const isOn = !!trackState[type];
                const activeColor = type === 'mute' ? '#ef4444' : '#fbbf24';

                return (
                    <button
                        key={controlLabel}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggle(type, !isOn);
                        }}
                        className="w-6 h-6 rounded-sm text-[9px] font-black border transition-all"
                        style={{
                            backgroundColor: isOn ? activeColor : 'rgba(255,255,255,0.10)',
                            borderColor: isOn ? activeColor : theme.border,
                            color: isOn ? '#000' : theme.text,
                        }}
                    >
                        {controlLabel}
                    </button>
                );
            })}
        </div>
    );
}
