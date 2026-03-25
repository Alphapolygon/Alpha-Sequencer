import React from 'react';
import { GRID_SECTIONS, STEPS_PER_SECTION } from '../../utils/patternConstants.js';
import SectionFrame from '../shared/SectionFrame.jsx';
import StepCell from './StepCell.jsx';

export default function StepSections({
    theme,
    track,
    trackIndex,
    trackColor,
    currentLength,
    activeSection,
    currentStep,
    onToggleStep,
}) {
    return (
        <div className="flex-1 flex gap-2 h-full py-1.5 px-2 relative min-w-[640px]">
            {GRID_SECTIONS.map((sectionIndex) => (
                <SectionFrame
                    key={sectionIndex}
                    sectionIndex={sectionIndex}
                    activeSection={activeSection}
                    colors={theme.colors}
                    className="rounded-sm p-0.5"
                >
                    {Array.from({ length: STEPS_PER_SECTION }).map((_, localIndex) => {
                        const stepIndex = sectionIndex * STEPS_PER_SECTION + localIndex;
                        const isPlayhead = currentStep >= 0 && currentStep % currentLength === stepIndex;

                        return (
                            <StepCell
                                key={stepIndex}
                                isActive={track[stepIndex]}
                                isPlayhead={isPlayhead}
                                isOutOfBounds={stepIndex >= currentLength}
                                trackColor={trackColor}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleStep(stepIndex, !track[stepIndex]);
                                }}
                            />
                        );
                    })}
                </SectionFrame>
            ))}
        </div>
    );
}
