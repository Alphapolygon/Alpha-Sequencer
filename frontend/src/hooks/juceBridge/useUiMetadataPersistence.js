import { useEffect, useMemo } from 'react';
import { SAVE_UI_DELAY_MS, selectUiMetadata } from '../juce/uiMetadata.js';

export function useUiMetadataPersistence({
    backendReady,
    hasHydrated,
    saveUiTimeoutRef,
    invokeNative,
    activeIdx,
    themeIdx,
    selectedTrack,
    currentPage,
    activeSection,
    footerTab,
    uiScale,
    visibleTracks,
}) {
    const uiMetadata = useMemo(() => selectUiMetadata({
        activeIdx,
        themeIdx,
        selectedTrack,
        currentPage,
        activeSection,
        footerTab,
        uiScale,
        visibleTracks,
    }), [
        activeIdx,
        themeIdx,
        selectedTrack,
        currentPage,
        activeSection,
        footerTab,
        uiScale,
        visibleTracks,
    ]);

    useEffect(() => {
        if (!hasHydrated.current || !backendReady) {
            return undefined;
        }

        if (saveUiTimeoutRef.current) {
            window.clearTimeout(saveUiTimeoutRef.current);
        }

        saveUiTimeoutRef.current = window.setTimeout(() => {
            invokeNative('saveUiMetadata', [JSON.stringify(uiMetadata)]).catch(console.error);
        }, SAVE_UI_DELAY_MS);

        return () => {
            if (saveUiTimeoutRef.current) {
                window.clearTimeout(saveUiTimeoutRef.current);
            }
        };
    }, [backendReady, hasHydrated, invokeNative, saveUiTimeoutRef, uiMetadata]);
}
