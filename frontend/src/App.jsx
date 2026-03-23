import React, { useEffect } from 'react';
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
        currentPage, selectedTrack, footerTab, themeIdx, uiScale,
        setActiveIdx, setActiveSection, setCurrentPage, setSelectedTrack,
        setFooterTab, setThemeIdx, updateUiScale, updateUiAndEngine, syncPatternToEngine,
        backendReady, uiReady, backendStatus, debugInfo
    } = bridge;

    // Safely grab the theme early
    const t = THEMES[themeIdx] || THEMES[0];

    useEffect(() => {
        document.body.style.backgroundColor = t.bg;
    }, [t.bg]);

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

    return (
        // FIX: Abandoned zoom. Uses GPU Transform on a strict, absolute canvas.
        <div className="flex flex-col font-sans select-none overflow-hidden theme-transition"
             style={{ 
                 backgroundColor: t.bg, 
                 color: t.text, 
                 '--theme-accent': t.accent, 
                 width: '1460px', 
                 height: '1024px', 
                 transform: `scale(${uiScale})`,
                 transformOrigin: 'top left',
                 position: 'absolute',
                 top: 0,
                 left: 0
             }}
             onContextMenu={(e) => e.preventDefault()}>

            <Header t={t} bpm={bpm} isPlaying={isPlaying} activeSection={activeSection}
                    setActiveSection={setActiveSection} setCurrentPage={setCurrentPage}
                    activeP={activeP} syncPatternToEngine={syncPatternToEngine} />

            <div className="flex-1 flex overflow-hidden">
                <StepGrid t={t} activeP={activeP} selectedTrack={selectedTrack} setSelectedTrack={setSelectedTrack} activeSection={activeSection} bpm={bpm} update={updateUiAndEngine} syncPatternToEngine={syncPatternToEngine} />
                <Sidebar t={t} activeIdx={activeIdx} setActiveIdx={setActiveIdx} themeIdx={themeIdx} setThemeIdx={setThemeIdx} uiScale={uiScale} setUiScale={updateUiScale} activeP={activeP} bpm={bpm} patterns={patterns} syncPatternToEngine={syncPatternToEngine} />
            </div>

            <AutomationLanes t={t} activeP={activeP} selectedTrack={selectedTrack} activeSection={activeSection} footerTab={footerTab} setFooterTab={setFooterTab} update={updateUiAndEngine} />
        </div>
    );
}