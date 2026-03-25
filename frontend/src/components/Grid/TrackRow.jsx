import React from 'react';
import { MIDI_OPTIONS } from '../../utils/musicConstants.js';
import MidiKeyDropdown from './MidiKeyDropdown.jsx';
import { TrackInfo, TrackToggles } from './TrackControls.jsx';
import StepSections from './StepSections.jsx';

export default function TrackRow({
    theme,
    activePattern,
    trackIndex,
    selectedTrack,
    activeSection,
    currentStep,
    bridge,
    openMenuId,
    setOpenMenuId,
}) {
    const track = activePattern.data.activeSteps[trackIndex];
    const trackState = activePattern.data.trackStates[trackIndex] || {};
    const trackColor = theme.colors[trackIndex % theme.colors.length];
    const currentLength = trackState.length || 16;
    const isTrackPlaying = currentStep >= 0 && track[currentStep % currentLength];
    const isSelected = selectedTrack === trackIndex;

    return (
        <div
            onClick={() => {
                bridge.changeSelectedTrack(trackIndex);
                setOpenMenuId(null);
            }}
            className="flex items-center h-11 gap-2 rounded-sm transition-all px-2 border theme-transition"
            style={{
                backgroundColor: isSelected ? 'rgba(255,255,255,0.10)' : 'transparent',
                borderColor: isSelected ? theme.border : 'transparent',
            }}
        >
            <TrackInfo
                theme={theme}
                trackIndex={trackIndex}
                selected={isSelected}
                trackColor={trackColor}
                currentLength={currentLength}
                isTrackPlaying={isTrackPlaying}
                onLengthChange={(length) => bridge.setTrackLength(trackIndex, length)}
                onClear={() => bridge.editClearTrack(bridge.activeIdx, trackIndex)}
            />

            <div className="w-[140px] flex gap-1">
                <div className="flex-1">
                    <MidiKeyDropdown
                        value={activePattern.data.midiKeys[trackIndex]}
                        options={MIDI_OPTIONS}
                        theme={theme}
                        trackColor={trackColor}
                        isSelected={isSelected}
                        isOpen={openMenuId === `note-${trackIndex}`}
                        onToggle={() => setOpenMenuId((previousId) => (previousId === `note-${trackIndex}` ? null : `note-${trackIndex}`))}
                        onClose={() => setOpenMenuId(null)}
                        onChange={(note) => bridge.editTrackMidiKey(trackIndex, note)}
                        openUpward={trackIndex >= 12}
                    />
                </div>
            </div>

            <TrackToggles
                theme={theme}
                trackState={trackState}
                onToggle={(stateName, value) => bridge.editTrackState(trackIndex, stateName, value)}
            />

            <StepSections
                theme={theme}
                track={track}
                trackIndex={trackIndex}
                trackColor={trackColor}
                currentLength={currentLength}
                activeSection={activeSection}
                currentStep={currentStep}
                onToggleStep={(stepIndex, isActive) => bridge.editStepActive(bridge.activeIdx, trackIndex, stepIndex, isActive)}
            />
        </div>
    );
}
