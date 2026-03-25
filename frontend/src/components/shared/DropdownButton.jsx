import React from 'react';
import { Icons } from '../../utils/icons.jsx';

export default function DropdownButton({
    label,
    onClick,
    isOpen,
    className = '',
    style,
    iconColor,
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-lg border py-2.5 px-3 text-[10px] font-black uppercase flex items-center justify-between shadow-inner transition-all ${className}`}
            style={style}
        >
            <span>{label}</span>
            <span className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: iconColor }}>
                <Icons.ChevronDown />
            </span>
        </button>
    );
}
