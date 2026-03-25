import React, { useEffect, useState } from 'react';
import { THEMES } from './utils/constants';
import { useJuceBridge } from './hooks/useJuceBridge';
import Header from './components/Header';
import Sidebar from './components/Sidebar/Sidebar';
import StepGrid from './components/Grid/StepGrid';
import AutomationLanes from './components/Automation/AutomationLanes';

export default function App() {
    const bridge = useJuceBridge();

    const {
        patterns, activeIdx, isPlaying, bpm, activeSection,
        selectedTrack, footerTab, themeIdx, visibleTracks,
        setActiveSection, setCurrentPage, setSelectedTrack, setFooterTab,
        backendReady, uiReady, backendStatus, debugInfo
    } = bridge;

    const t = THEMES[themeIdx] || THEMES[0];
    const [scale, setScale] = useState({ x: 1, y: 1 });

    useEffect(() => {
        const handleResize = () => {
            setScale({ x: window.innerWidth / 1460, y: window.innerHeight / 1024 });
        };
        window.addEventListener('resize', handleResize);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', handleResize);
        handleResize(); setTimeout(handleResize, 10); 
        return () => {
            window.removeEventListener('resize', handleResize);
            if (window.visualViewport) window.visualViewport.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => { document.body.style.backgroundColor = t.bg; }, [t.bg]);

    if (!backendReady || !uiReady) {
        return (
            <div style={{ backgroundColor: '#06080b', color: '#fb923c', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
                <h2>Alpha Sequencer Booting...</h2>
                <div style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.1)', marginTop: '20px', borderRadius: '8px', backgroundColor: '#12151c' }}>
                    <p>Status: {backendStatus}</p><p style={{ color: '#94a3b8' }}>{debugInfo}</p>
                </div>
            </div>
        );
    }

    const activeP = patterns[activeIdx];

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', backgroundColor: t.bg }}>
            <div className="flex flex-col font-sans select-none overflow-hidden theme-transition"
                 style={{ backgroundColor: t.bg, color: t.text, '--theme-accent': t.accent, width: '1460px', height: '1024px', transform: `scale(${scale.x}, ${scale.y})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
                 onContextMenu={(e) => e.preventDefault()}>

                <Header t={t} bpm={bpm} isPlaying={isPlaying} activeSection={activeSection} setActiveSection={setActiveSection} setCurrentPage={setCurrentPage} bridge={bridge} />

                <div className="flex-1 flex overflow-hidden">
                    <StepGrid t={t} activeP={activeP} visibleTracks={visibleTracks} selectedTrack={selectedTrack} activeSection={activeSection} bridge={bridge} />
                    <Sidebar t={t} bridge={bridge} activeP={activeP} />
                </div>

                <AutomationLanes t={t} activeP={activeP} selectedTrack={selectedTrack} activeSection={activeSection} footerTab={footerTab} setFooterTab={setFooterTab} bridge={bridge} />
            </div>
        </div>
    );
}