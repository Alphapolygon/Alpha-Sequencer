import React from 'react';
import { Icons } from '../../utils/icons.jsx';
import { hexToRgba } from '../../utils/color.js';

export default function MidiKeyDropdown({
    value,
    options,
    onChange,
    theme,
    trackColor,
    isSelected,
    isOpen,
    onToggle,
    onClose,
    openUpward,
}) {
    return (
        <div className="w-full relative" data-note-dropdown="true">
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                }}
                className="w-full rounded-md pl-2 pr-6 py-1.5 text-[9px] font-black uppercase outline-none border transition-all flex items-center justify-between"
                style={{
                    backgroundColor: isSelected ? theme.panel : theme.sidebar,
                    borderColor: isSelected ? hexToRgba(trackColor, 0.55) : theme.border,
                    color: isSelected ? '#fff' : theme.text,
                    boxShadow: isSelected ? `0 0 12px ${hexToRgba(trackColor, 0.16)}` : 'inset 0 0 0 1px rgba(255,255,255,0.05)',
                }}
            >
                <span className="truncate">{value}</span>
                <span
                    className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 transition-transform duration-200 ${isOpen ? (openUpward ? '-rotate-180' : 'rotate-180') : ''}`}
                    style={{ color: isSelected ? trackColor : theme.accent }}
                >
                    <Icons.ChevronDown />
                </span>
            </button>

            {isOpen && (
                <div
                    className={`absolute ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 right-0 rounded-lg border shadow-2xl overflow-hidden z-[120]`}
                    style={{ backgroundColor: theme.panel, borderColor: theme.border, boxShadow: `0 16px 30px ${hexToRgba(theme.bg, 0.7)}` }}
                >
                    <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
                        {options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onChange(option);
                                    onClose();
                                }}
                                className="w-full px-3 py-2 text-[9px] font-black uppercase text-left transition-colors flex items-center justify-between"
                                style={{
                                    backgroundColor: option === value ? hexToRgba(trackColor, 0.14) : 'transparent',
                                    color: option === value ? (isSelected ? '#fff' : theme.accent) : theme.text,
                                }}
                            >
                                <span>{option}</span>
                                {option === value && <span style={{ color: trackColor }}>●</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
