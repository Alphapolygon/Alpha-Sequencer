import React from 'react';
import { hexToRgba } from '../../utils/color.js';

export default function SectionFrame({
    sectionIndex,
    activeSection,
    colors,
    className = '',
    children,
    borderOpacity = 0.2,
}) {
    const tint = colors[sectionIndex % colors.length];
    const isDimmed = activeSection !== -1 && activeSection !== sectionIndex;

    return (
        <div
            className={`flex-1 flex gap-1 relative transition-opacity ${className}`}
            style={{
                opacity: isDimmed ? 0.35 : 1,
                borderLeft: sectionIndex > 0 ? `2px solid ${hexToRgba(tint, borderOpacity)}` : 'none',
                paddingLeft: sectionIndex > 0 ? '6px' : '2px',
                marginLeft: sectionIndex > 0 ? '-2px' : '0',
            }}
        >
            {children}
        </div>
    );
}
