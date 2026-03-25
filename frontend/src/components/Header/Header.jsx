import React from 'react';
import BrandBlock from './BrandBlock.jsx';
import DawSyncStatus from './DawSyncStatus.jsx';
import SectionSelector from './SectionSelector.jsx';

export default function Header({ theme, bpm, isPlaying, activeSection, bridge }) {
    return (
        <header
            className="flex items-center justify-between px-6 py-2 border-b theme-transition shadow-lg z-50 glass-panel"
            style={{ backgroundColor: theme.panel, borderColor: theme.border }}
        >
            <div className="flex items-center gap-6">
                <BrandBlock theme={theme} />
                <DawSyncStatus theme={theme} bpm={bpm} isPlaying={isPlaying} />
            </div>

            <SectionSelector theme={theme} activeSection={activeSection} bridge={bridge} />
        </header>
    );
}
