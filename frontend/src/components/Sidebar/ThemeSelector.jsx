import React, { useState } from 'react';
import DropdownButton from '../shared/DropdownButton.jsx';
import VisibleTracksControl from './VisibleTracksControl.jsx';
import { THEMES } from '../../utils/themeConstants.js';
import { Icons } from '../../utils/icons.jsx';

export default function ThemeSelector({ theme, themeIdx, visibleTracks, onThemeChange, onVisibleTracksChange }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <section>
            <div className="flex items-center justify-between mb-3 opacity-70">
                <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Icons.Palette /> Global UI
                </h3>
            </div>

            <div className="flex gap-2 relative">
                <DropdownButton
                    label={(
                        <span className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.accent }} />
                            {theme.name}
                        </span>
                    )}
                    onClick={() => setIsMenuOpen((value) => !value)}
                    isOpen={isMenuOpen}
                    className="flex-1"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderColor: theme.border, color: theme.text }}
                    iconColor={theme.accent}
                />

                <VisibleTracksControl theme={theme} visibleTracks={visibleTracks} onChange={onVisibleTracksChange} />

                {isMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-2xl z-[100] overflow-hidden" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
                        {THEMES.map((option, index) => (
                            <button
                                key={option.name}
                                onClick={() => {
                                    onThemeChange(index);
                                    setIsMenuOpen(false);
                                }}
                                className="w-full px-4 py-3 text-[10px] font-black uppercase flex items-center justify-between hover:bg-white/5 border-b last:border-0"
                                style={{ color: themeIdx === index ? option.accent : theme.text, borderColor: theme.border }}
                            >
                                {option.name}
                                <div className="flex gap-[2px] h-1.5 w-10 rounded-full overflow-hidden">
                                    {option.colors.slice(0, 3).map((color) => (
                                        <div key={color} className="flex-1" style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
