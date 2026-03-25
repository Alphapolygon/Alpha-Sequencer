import React from 'react';
import { GRID_SECTIONS } from '../../utils/patternConstants.js';

export default function SectionSelector({ theme, activeSection, bridge }) {
    const buttonStyle = (isActive) => ({
        backgroundColor: isActive ? theme.accent : 'transparent',
        color: isActive ? '#000' : theme.text,
    });

    return (
        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border theme-transition" style={{ borderColor: theme.border }}>
            <button
                onClick={() => bridge.setActiveSection(-1)}
                className="px-5 py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all theme-transition"
                style={buttonStyle(activeSection === -1)}
            >
                All
            </button>

            {GRID_SECTIONS.map((sectionIndex) => (
                <button
                    key={sectionIndex}
                    onClick={() => {
                        bridge.setActiveSection(sectionIndex);
                        bridge.changeCurrentPage(sectionIndex);
                    }}
                    className="px-5 py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all theme-transition"
                    style={buttonStyle(activeSection === sectionIndex)}
                >
                    {sectionIndex * 8 + 1}—{sectionIndex * 8 + 8}
                </button>
            ))}
        </div>
    );
}
