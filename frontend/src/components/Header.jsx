import React from 'react';

export default function Header({ t, bpm, isPlaying, activeSection, bridge }) {
    return (
        <header className="flex items-center justify-between px-6 py-2 border-b theme-transition shadow-lg z-50 glass-panel" 
                style={{ backgroundColor: t.panel, borderColor: t.border }}>
            <div className="flex items-center gap-6">
                <h1 className="text-xl font-black tracking-tighter flex items-center gap-2" style={{ color: t.accent }}>
                    <span className="text-black px-1.5 rounded-sm italic text-xs" style={{ backgroundColor: t.accent }}>A</span> 
                    ALPHA <span className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: t.text }}>SEQUENCER</span>
                </h1>
                
                <div className="flex flex-col items-center ml-2 border-l pl-6" style={{ borderColor: t.border }}>
                    <span className="text-[8px] font-black uppercase mb-0.5 opacity-50">DAW Sync</span>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full transition-all ${isPlaying ? 'active-glow' : ''}`} 
                             style={{ backgroundColor: isPlaying ? t.accent : 'rgba(255,255,255,0.2)', '--accent': t.accent }} />
                        <span className="text-sm font-mono font-black px-2.5 py-1 rounded border" style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: t.border, color: '#fff' }}>
                            {bpm} <span className="text-[9px] opacity-50 ml-1">BPM</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border theme-transition" style={{ borderColor: t.border }}>
                <button onClick={() => bridge.setActiveSection(-1)} 
                        className="px-5 py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all theme-transition"
                        style={{ backgroundColor: activeSection === -1 ? t.accent : 'transparent', color: activeSection === -1 ? '#000' : t.text }}>
                    All
                </button>
                {[0, 1, 2, 3].map(i => (
                    <button
                        key={i}
                        onClick={() => {
                            bridge.setActiveSection(i);
                            // FIX: Use the granular native bridge endpoint
                            bridge.changeCurrentPage(i);
                        }}
                        className="px-5 py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all theme-transition"
                        style={{ backgroundColor: activeSection === i ? t.accent : 'transparent', color: activeSection === i ? '#000' : t.text }}>
                        {i * 8 + 1}—{i * 8 + 8}
                    </button>
                ))}
            </div>
        </header>
    );
}