import React, { useRef } from 'react';
import { TAB_TO_IDX, TAB_TO_KEY } from '../../utils/patternConstants.js';
import AutomationTabs from './AutomationTabs.jsx';
import JitterPanel from './JitterPanel.jsx';
import AutomationGrid from './AutomationGrid.jsx';
import RepeatsGrid from './RepeatsGrid.jsx';

function getDrawValue(event, paramKey) {
    const rect = event.currentTarget.getBoundingClientRect();
    const yPercent = 1 - ((event.clientY - rect.top) / rect.height);

    if (paramKey === 'pitches') {
        return Math.round((yPercent * 48) - 24);
    }

    return Math.round(Math.max(0, Math.min(100, yPercent * 100)));
}

function getContextResetValue(paramKey) {
    switch (paramKey) {
        case 'pitches':
            return 0;
        case 'gates':
            return 75;
        case 'shifts':
            return 50;
        case 'swings':
            return 0;
        default:
            return 100;
    }
}

export default function AutomationLanes({ theme, activePattern, selectedTrack, activeSection, footerTab, setFooterTab, bridge }) {
    const isDrawingRef = useRef(false);
    const paramKey = TAB_TO_KEY[footerTab];

    const { activeSteps, repeats, trackStates, randomAmounts } = activePattern.data;
    const trackLength = trackStates[selectedTrack]?.length || 16;
    const currentJitter = randomAmounts[selectedTrack]?.[TAB_TO_IDX[footerTab]] || 0;
    const automationValues = activePattern.data[paramKey][selectedTrack];
    const isPitch = footerTab === 'Pitch';

    const handleDraw = (stepIndex, event) => {
        if (event.type === 'contextmenu') {
            event.preventDefault();
            bridge.editStepParameter(bridge.activeIdx, selectedTrack, stepIndex, paramKey, getContextResetValue(paramKey));
            return;
        }

        if (event.type === 'mousedown' && event.button === 0) {
            isDrawingRef.current = true;
        }

        if ((isDrawingRef.current && event.buttons === 1) || (event.type === 'mousedown' && event.button === 0)) {
            bridge.editStepParameter(bridge.activeIdx, selectedTrack, stepIndex, paramKey, getDrawValue(event, paramKey));
        }
    };

    return (
        <footer
            className="border-t flex p-3 gap-6 h-64 shadow-2xl z-40 theme-transition glass-panel"
            style={{ backgroundColor: theme.panel, borderColor: theme.border }}
            onMouseUp={() => { isDrawingRef.current = false; }}
            onMouseLeave={() => { isDrawingRef.current = false; }}
        >
            <div className="w-56 flex flex-col py-1 border-r pr-4" style={{ borderColor: theme.border }}>
                <AutomationTabs theme={theme} footerTab={footerTab} setFooterTab={setFooterTab} />

                <JitterPanel
                    theme={theme}
                    footerTab={footerTab}
                    currentJitter={currentJitter}
                    onReset={() => bridge.resetAutomationLane(selectedTrack, paramKey)}
                    onChange={(amount) => bridge.setTrackRandomAmount(selectedTrack, TAB_TO_IDX[footerTab], amount)}
                />
            </div>

            <div className="flex-1 flex flex-col gap-4">
                <AutomationGrid
                    theme={theme}
                    values={automationValues}
                    activeSteps={activeSteps[selectedTrack]}
                    selectedTrack={selectedTrack}
                    activeSection={activeSection}
                    trackLength={trackLength}
                    currentStep={bridge.currentStep}
                    currentJitter={currentJitter}
                    isPitch={isPitch}
                    onDraw={handleDraw}
                />

                <RepeatsGrid
                    theme={theme}
                    repeats={repeats[selectedTrack]}
                    selectedTrack={selectedTrack}
                    trackLength={trackLength}
                    activeSection={activeSection}
                    onChange={(stepIndex, value) => bridge.editStepParameter(bridge.activeIdx, selectedTrack, stepIndex, 'repeats', value)}
                />
            </div>
        </footer>
    );
}
