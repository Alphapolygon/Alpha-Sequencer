import React from 'react';
import { GRID_SECTIONS, STEPS_PER_SECTION } from '../../utils/patternConstants.js';
import SectionFrame from '../shared/SectionFrame.jsx';

export default function GridHeader({ theme, activeSection }) {
    return (
        <div className="flex items-center h-5 gap-2 px-2 mb-1">
            <div className="w-52 pr-2 border-r border-transparent" />
            <div className="w-[140px]" />
            <div className="flex gap-0.5 w-[54px]" />

            <div className="flex-1 flex gap-2 h-full px-2 relative min-w-[640px]">
                {GRID_SECTIONS.map((sectionIndex) => (
                    <SectionFrame
                        key={sectionIndex}
                        sectionIndex={sectionIndex}
                        activeSection={activeSection}
                        colors={theme.colors}
                        className="rounded-sm"
                        borderOpacity={0.4}
                    >
                        <div className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full opacity-60" style={{ backgroundColor: theme.colors[sectionIndex % theme.colors.length] }} />
                        {Array.from({ length: STEPS_PER_SECTION }).map((_, localIndex) => (
                            <div key={localIndex} className="flex-1 flex justify-center items-end pb-1">
                                <span className="text-[12px] font-mono font-bold transition-opacity" style={{ color: theme.text, opacity: 0.6 }}>
                                    {sectionIndex * STEPS_PER_SECTION + localIndex + 1}
                                </span>
                            </div>
                        ))}
                    </SectionFrame>
                ))}
            </div>
        </div>
    );
}
