import React from 'react';
import './App.css';
import { THEMES } from './utils/constants.jsx';
import { useJuceBridge } from './hooks/useJuceBridge.jsx';
import { useViewportScale } from './hooks/useViewportScale.js';
import { useBodyTheme } from './hooks/useBodyTheme.js';
import BootScreen from './components/shared/BootScreen.jsx';
import Header from './components/Header/Header.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import StepGrid from './components/Grid/StepGrid.jsx';
import AutomationLanes from './components/Automation/AutomationLanes.jsx';

const BASE_WIDTH = 1460;
const BASE_HEIGHT = 1024;

export default function App() {
    const bridge = useJuceBridge();
    const {
        patterns,
        activeIdx,
        isPlaying,
        bpm,
        activeSection,
        selectedTrack,
        footerTab,
        themeIdx,
        visibleTracks,
        setFooterTab,
        backendReady,
        uiReady,
        backendStatus,
        debugInfo,
    } = bridge;

    const theme = THEMES[themeIdx] || THEMES[0];
    const scale = useViewportScale(BASE_WIDTH, BASE_HEIGHT);
    useBodyTheme(theme.bg);

    if (!backendReady || !uiReady) {
        return <BootScreen status={backendStatus} debugInfo={debugInfo} />;
    }

    const activePattern = patterns[activeIdx];

    return (
        <div
            className="app-root"
            style={{ backgroundColor: theme.bg }}
        >
            <div
                className="app-stage flex flex-col font-sans select-none overflow-hidden theme-transition"
                style={{
                    backgroundColor: theme.bg,
                    color: theme.text,
                    '--theme-accent': theme.accent,
                    width: `${BASE_WIDTH}px`,
                    height: `${BASE_HEIGHT}px`,
                    transform: `scale(${scale.x}, ${scale.y})`,
                }}
                onContextMenu={(event) => event.preventDefault()}
            >
                <Header
                    theme={theme}
                    bpm={bpm}
                    isPlaying={isPlaying}
                    activeSection={activeSection}
                    bridge={bridge}
                />

                <div className="flex-1 flex overflow-hidden">
                    <StepGrid
                        theme={theme}
                        activePattern={activePattern}
                        visibleTracks={visibleTracks}
                        selectedTrack={selectedTrack}
                        activeSection={activeSection}
                        bridge={bridge}
                    />

                    <Sidebar
                        theme={theme}
                        activePattern={activePattern}
                        bridge={bridge}
                    />
                </div>

                <AutomationLanes
                    theme={theme}
                    activePattern={activePattern}
                    selectedTrack={selectedTrack}
                    activeSection={activeSection}
                    footerTab={footerTab}
                    setFooterTab={setFooterTab}
                    bridge={bridge}
                />
            </div>
        </div>
    );
}
