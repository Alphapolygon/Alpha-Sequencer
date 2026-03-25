import React from 'react';
import { GRID_SECTIONS, STEPS_PER_SECTION } from '../../utils/patternConstants.js';
import { hexToRgba } from '../../utils/color.js';
import SectionFrame from '../shared/SectionFrame.jsx';

export default function RepeatsGrid({ theme, repeats, selectedTrack, trackLength, activeSection, onChange }) {
    return (
        <div className="h-16 flex gap-2 px-2">
            {GRID_SECTIONS.map((sectionIndex) => (
                <SectionFrame
                    key={sectionIndex}
                    sectionIndex={sectionIndex}
                    activeSection={activeSection}
                    colors={theme.colors}
                >
                    {repeats.slice(sectionIndex * STEPS_PER_SECTION, sectionIndex * STEPS_PER_SECTION + STEPS_PER_SECTION).map((count, localIndex) => {
                        const stepIndex = sectionIndex * STEPS_PER_SECTION + localIndex;
                        return (
                            <div key={stepIndex} className="flex-1 flex flex-col gap-[1px]" style={{ opacity: stepIndex >= trackLength ? 0.2 : 1 }}>
                                {[1, 2, 3, 4].map((value) => {
                                    const isActive = count === value;
                                    return (
                                        <button
                                            key={value}
                                            onClick={() => onChange(stepIndex, value)}
                                            className="flex-1 rounded-[1px] text-[7px] font-black transition-all border"
                                            style={{
                                                backgroundColor: isActive ? theme.accent : 'rgba(255,255,255,0.05)',
                                                borderColor: isActive ? theme.accent : theme.border,
                                                color: isActive ? '#000' : hexToRgba(theme.text, 0.6),
                                            }}
                                        >
                                            {value}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </SectionFrame>
            ))}
        </div>
    );
}
