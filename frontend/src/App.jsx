import React from 'react';
import { THEMES } from './utils/constants';
import { useJuceBridge } from './hooks/useJuceBridge';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import StepGrid from './components/StepGrid';
import AutomationLanes from './components/AutomationLanes';

export default function App() {
    const bridge = useJuceBridge();

    const {
        patterns, activeIdx, isPlaying, bpm, activeSection,
        currentPage, selectedTrack, footerTab, themeIdx,
        setActiveIdx, setActiveSection, setCurrentPage, setSelectedTrack,
        setFooterTab, setThemeIdx, updateUiAndEngine, syncPatternToEngine,
        backendReady, uiReady, backendStatus, debugInfo
    } = bridge;

    if (!backendReady || !uiReady) {
        return (
            <div style={{ backgroundColor: '#06080b', color: '#fb923c', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
                <h2>Alpha Sequencer Boot Sequence</h2>
                <div style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.1)', marginTop: '20px', borderRadius: '8px', backgroundColor: '#12151c', maxWidth: '600px', wordWrap: 'break-word', textAlign: 'center' }}>
                    <p style={{ fontWeight: 'bold' }}>Status: {backendStatus}</p>
                    <p style={{ marginTop: '10px', color: '#94a3b8' }}>{debugInfo}</p>
                </div>
            </div>
        );
    }

    const activeP = patterns[activeIdx];
    const t = THEMES[themeIdx];

    return (
        <div className="flex flex-col w-full h-screen font-sans select-none overflow-hidden theme-transition"
             style={{ backgroundColor: t.bg, color: t.text, '--theme-accent': t.accent }}
             onContextMenu={(e) => e.preventDefault()}>

            <Header t={t} bpm={bpm} isPlaying={isPlaying} activeSection={activeSection}
                    setActiveSection={setActiveSection} setCurrentPage={setCurrentPage}
                    activeP={activeP} syncPatternToEngine={syncPatternToEngine} />

            <div className="flex-1 flex overflow-hidden">
                <StepGrid t={t} activeP={activeP} selectedTrack={selectedTrack} setSelectedTrack={setSelectedTrack} activeSection={activeSection} bpm={bpm} update={updateUiAndEngine} syncPatternToEngine={syncPatternToEngine} />
                <Sidebar t={t} activeIdx={activeIdx} setActiveIdx={setActiveIdx} themeIdx={themeIdx} setThemeIdx={setThemeIdx} activeP={activeP} bpm={bpm} patterns={patterns} syncPatternToEngine={syncPatternToEngine} />
            </div>

            <AutomationLanes t={t} activeP={activeP} selectedTrack={selectedTrack} activeSection={activeSection} footerTab={footerTab} update={updateUiAndEngine} />
        </div>
    );
}