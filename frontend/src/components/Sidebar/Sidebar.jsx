import React from 'react';
import PatternMatrix from './PatternMatrix.jsx';
import ThemeSelector from './ThemeSelector.jsx';
import TrackSpacingSection from './TrackSpacingSection.jsx';
import ScaleSelector from './ScaleSelector.jsx';

export default function Sidebar({ theme, activePattern, bridge }) {
    const { activeIdx, themeIdx, visibleTracks, selectedTrack } = bridge;
    const trackState = activePattern?.data?.trackStates[selectedTrack] || {};
    const divisionIndex = trackState.timeDivision ?? 3;
    const scaleIndex = trackState.scale ?? 0;

    return (
        <aside className="w-80 border-l shadow-2xl z-40 flex flex-col theme-transition glass-panel" style={{ backgroundColor: theme.sidebar, borderColor: theme.border }}>
            <PatternMatrix theme={theme} activeIdx={activeIdx} onChange={bridge.changeActivePattern} />

            <div className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                <ThemeSelector
                    theme={theme}
                    themeIdx={themeIdx}
                    visibleTracks={visibleTracks}
                    onThemeChange={bridge.setThemeIdx}
                    onVisibleTracksChange={bridge.changeVisibleTracks}
                />

                <TrackSpacingSection
                    theme={theme}
                    currentDivisionIndex={divisionIndex}
                    onChange={(index) => bridge.setTrackTimeDivision(selectedTrack, index)}
                />

                <ScaleSelector
                    theme={theme}
                    scaleIndex={scaleIndex}
                    onChange={(index) => bridge.setTrackScale(selectedTrack, index)}
                />
            </div>
        </aside>
    );
}
