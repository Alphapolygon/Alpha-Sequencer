import React, { useState } from 'react';
import GridHeader from './GridHeader.jsx';
import TrackRow from './TrackRow.jsx';

export default function StepGrid({ theme, activePattern, visibleTracks, selectedTrack, activeSection, bridge }) {
    const [openMenuId, setOpenMenuId] = useState(null);
    const visibleRows = activePattern.data.activeSteps.slice(0, visibleTracks);

    return (
        <main className="flex-1 flex flex-col p-2 gap-[1px] overflow-y-auto custom-scrollbar theme-transition" style={{ backgroundColor: theme.bg }}>
            <GridHeader theme={theme} activeSection={activeSection} />

            {visibleRows.map((_, trackIndex) => (
                <TrackRow
                    key={trackIndex}
                    theme={theme}
                    activePattern={activePattern}
                    trackIndex={trackIndex}
                    selectedTrack={selectedTrack}
                    activeSection={activeSection}
                    currentStep={bridge.currentStep}
                    bridge={bridge}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                />
            ))}
        </main>
    );
}
