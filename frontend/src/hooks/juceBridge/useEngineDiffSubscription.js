import { useEffect } from 'react';
import { applyEngineDiffToPatterns } from '../juce/patternDataMutators.js';
import { backendSupportsEvents } from './nativeBridge.js';

export function useEngineDiffSubscription({
    backendReady,
    hasHydrated,
    setActiveIdx,
    setSelectedTrack,
    setCurrentPage,
    setActiveSection,
    setPatterns,
}) {
    useEffect(() => {
        if (!backendReady || !backendSupportsEvents()) {
            return undefined;
        }

        const handleEngineDiff = (event) => {
            if (!hasHydrated.current) {
                return;
            }

            if (event?.type === 'selectedTrackChanged' && Number.isInteger(event.selectedTrack)) {
                setSelectedTrack(event.selectedTrack);
                return;
            }

            if (event?.type === 'currentPageChanged') {
                if (Number.isInteger(event.currentPage)) {
                    setCurrentPage(event.currentPage);
                }

                if (Number.isInteger(event.activeSection)) {
                    setActiveSection(event.activeSection);
                }

                return;
            }

            if (event?.type === 'activePatternChanged' && Number.isInteger(event.activeIdx)) {
                setActiveIdx(event.activeIdx);
                return;
            }

            setPatterns((previousPatterns) => applyEngineDiffToPatterns(previousPatterns, event));
        };

        const listenerHandle = window.__JUCE__.backend.addEventListener('engineDiff', handleEngineDiff);
        return () => window.__JUCE__.backend.removeEventListener(listenerHandle);
    }, [
        backendReady,
        hasHydrated,
        setActiveIdx,
        setSelectedTrack,
        setCurrentPage,
        setActiveSection,
        setPatterns,
    ]);
}
