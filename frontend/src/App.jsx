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
        patterns, activeIdx, currentStep, isPlaying, bpm, activeSection, 
        currentPage, selectedTrack, footerTab, themeIdx,
        setActiveIdx, setActiveSection, setCurrentPage, setSelectedTrack, 
        setFooterTab, setThemeIdx, updateUiAndEngine, syncPatternToEngine, backendReady
    } = bridge;

    if (!backendReady) return null;

    const activeP = patterns[activeIdx];
    const t = THEMES[themeIdx];

    return (
        <div className="flex flex-col w-full h-screen font-sans select-none overflow-hidden theme-transition" 
             style={{ backgroundColor: t.bg, color: t.text }}
             onContextMenu={(e) => e.preventDefault()}>
            
            <Header t={t} bpm={bpm} isPlaying={isPlaying} activeSection={activeSection} 
                    setActiveSection={setActiveSection} setCurrentPage={setCurrentPage} 
                    activeP={activeP} syncPatternToEngine={syncPatternToEngine} />

            <div className="flex-1 flex overflow-hidden">
                <StepGrid 
                    t={t} 
                    activeP={activeP} 
                    isPlaying={isPlaying} 
                    currentStep={currentStep} 
                    selectedTrack={selectedTrack} 
                    setSelectedTrack={setSelectedTrack} 
                    activeSection={activeSection} 
                    bpm={bpm} 
                    update={updateUiAndEngine} 
                    syncPatternToEngine={syncPatternToEngine} 
                />

                <Sidebar t={t} activeIdx={activeIdx} setActiveIdx={setActiveIdx} 
                         themeIdx={themeIdx} setThemeIdx={setThemeIdx} 
                         activeP={activeP} bpm={bpm} patterns={patterns}
                         syncPatternToEngine={syncPatternToEngine} />
            </div>

            <AutomationLanes 
                t={t} 
                activeP={activeP} 
                selectedTrack={selectedTrack} 
                currentStep={currentStep} 
                activeSection={activeSection} 
                footerTab={footerTab} 
                setFooterTab={setFooterTab} 
                update={updateUiAndEngine} 
            />
        </div>
    );
}