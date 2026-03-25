import { useEffect } from 'react';
import { backendSupportsEvents } from './nativeBridge.js';

export function usePlaybackSubscription({
    backendReady,
    setBpm,
    setIsPlaying,
    setCurrentStep,
}) {
    useEffect(() => {
        if (!backendReady || !backendSupportsEvents()) {
            return undefined;
        }

        const handlePlaybackState = (event) => {
            if (event?.bpm) {
                setBpm(Math.round(event.bpm));
            }

            setIsPlaying(!!event?.isPlaying);

            const nextStep = event?.isPlaying && event?.currentStep >= 0
                ? event.currentStep
                : -1;

            setCurrentStep(nextStep);
            window.dispatchEvent(new CustomEvent('juce-playhead', { detail: nextStep }));
        };

        const listenerHandle = window.__JUCE__.backend.addEventListener('playbackState', handlePlaybackState);

        return () => window.__JUCE__.backend.removeEventListener(listenerHandle);
    }, [backendReady, setBpm, setCurrentStep, setIsPlaying]);
}
