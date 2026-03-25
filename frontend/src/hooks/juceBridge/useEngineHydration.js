import { useEffect } from 'react';
import { requestNormalizedEngineState } from './nativeBridge.js';

export function useEngineHydration({
    backendReady,
    invokeNative,
    hasHydrated,
    setBackendStatus,
    setPatterns,
    setActiveIdx,
    setThemeIdx,
    setSelectedTrack,
    setCurrentPage,
    setActiveSection,
    setFooterTab,
    setUiScale,
    setVisibleTracks,
    setUiReady,
}) {
    useEffect(() => {
        if (!backendReady || hasHydrated.current) {
            return undefined;
        }

        let cancelled = false;

        const hydrate = async () => {
            let normalizedState = null;

            try {
                setBackendStatus('Calling requestInitialState...');
                normalizedState = await requestNormalizedEngineState(invokeNative);
            } catch (error) {
                console.error('requestInitialState failed', error);
            }

            if (cancelled) {
                return;
            }

            if (normalizedState) {
                setPatterns(normalizedState.patterns);
                setActiveIdx(normalizedState.activeIdx);
                setThemeIdx(normalizedState.themeIdx);
                setSelectedTrack(normalizedState.selectedTrack);
                setCurrentPage(normalizedState.currentPage);
                setActiveSection(normalizedState.activeSection ?? -1);
                setFooterTab(normalizedState.footerTab);
                setUiScale(normalizedState.uiScale ?? 1);
                setVisibleTracks(normalizedState.visibleTracks ?? 16);
            }

            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            if (cancelled) {
                return;
            }

            try {
                await invokeNative('uiReadyForEngineState');
            } catch (error) {
                console.error(error);
            }

            if (cancelled) {
                return;
            }

            hasHydrated.current = true;
            setUiReady(true);
            setBackendStatus('JUCE ready. UI hydrated.');
        };

        hydrate().catch(() => {
            if (!cancelled) {
                hasHydrated.current = true;
                setUiReady(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [
        backendReady,
        invokeNative,
        hasHydrated,
        setBackendStatus,
        setPatterns,
        setActiveIdx,
        setThemeIdx,
        setSelectedTrack,
        setCurrentPage,
        setActiveSection,
        setFooterTab,
        setUiScale,
        setVisibleTracks,
        setUiReady,
    ]);
}
