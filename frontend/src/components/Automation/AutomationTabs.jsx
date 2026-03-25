import React from 'react';
import { FOOTER_TABS } from '../../utils/patternConstants.js';

export default function AutomationTabs({ theme, footerTab, setFooterTab }) {
    return (
        <div className="grid grid-cols-2 gap-1 mb-4">
            {FOOTER_TABS.map((tab) => {
                const isActive = footerTab === tab;
                return (
                    <button
                        key={tab}
                        onClick={() => setFooterTab(tab)}
                        className="px-3 py-2 rounded text-[9px] font-black uppercase text-left transition-all border"
                        style={{
                            backgroundColor: isActive ? theme.accent : 'transparent',
                            borderColor: isActive ? theme.accent : theme.border,
                            color: isActive ? '#000' : theme.text,
                        }}
                    >
                        {tab}
                    </button>
                );
            })}
        </div>
    );
}
