import React from 'react';
import { GRID_SECTIONS, STEPS_PER_SECTION } from '../../utils/patternConstants.js';
import SectionFrame from '../shared/SectionFrame.jsx';
import AutomationCell from './AutomationCell.jsx';

export default function AutomationGrid({
    theme,
    values,
    activeSteps,
    selectedTrack,
    activeSection,
    trackLength,
    currentStep,
    currentJitter,
    isPitch,
    onDraw,
}) {
    const trackColor = theme.colors[selectedTrack % theme.colors.length];

    return (
        <div className="flex-1 flex gap-2 h-full py-1.5 px-2 relative border bg-black/40 rounded-xl" style={{ borderColor: theme.border }}>
            {GRID_SECTIONS.map((sectionIndex) => (
                <SectionFrame
                    key={sectionIndex}
                    sectionIndex={sectionIndex}
                    activeSection={activeSection}
                    colors={theme.colors}
                >
                    {values.slice(sectionIndex * STEPS_PER_SECTION, sectionIndex * STEPS_PER_SECTION + STEPS_PER_SECTION).map((value, localIndex) => {
                        const stepIndex = sectionIndex * STEPS_PER_SECTION + localIndex;
                        return (
                            <div key={stepIndex} className="group flex-1 relative h-full flex items-end">
                                <AutomationCell
                                    value={isPitch ? value / 24 : value}
                                    currentJitter={currentJitter}
                                    isActive={activeSteps[stepIndex]}
                                    isPlayhead={currentStep >= 0 && currentStep % trackLength === stepIndex}
                                    isOutOfBounds={stepIndex >= trackLength}
                                    trackColor={trackColor}
                                    onDraw={(event) => onDraw(stepIndex, event)}
                                    onContextMenu={(event) => onDraw(stepIndex, event)}
                                    isBipolar={isPitch}
                                />

                                {isPitch && activeSteps[stepIndex] && (
                                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-black text-black bg-white/80 px-1 rounded pointer-events-none opacity-0 group-hover:opacity-100">
                                        {value > 0 ? `+${value}` : value}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </SectionFrame>
            ))}
        </div>
    );
}
