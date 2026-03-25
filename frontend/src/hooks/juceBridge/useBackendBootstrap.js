import { useEffect } from 'react';
import {
    backendSupportsEvents,
    resolveNativeFunctions,
    waitForMs,
} from './nativeBridge.js';

const BOOTSTRAP_RETRIES = 120;
const BOOTSTRAP_WAIT_MS = 50;

export function useBackendBootstrap({
    nativeFunctionsRef,
    setBackendReady,
    setBackendStatus,
    setDebugInfo,
}) {
    useEffect(() => {
        let cancelled = false;

        const initBackend = async () => {
            try {
                let retries = BOOTSTRAP_RETRIES;

                while (!window.__JUCE__?.backend && retries > 0) {
                    if (!cancelled) {
                        setBackendStatus('Waiting for JUCE backend...');
                    }

                    await waitForMs(BOOTSTRAP_WAIT_MS);
                    retries -= 1;
                }

                if (window.__JUCE__?.initialisationPromise) {
                    await window.__JUCE__.initialisationPromise;
                }

                retries = BOOTSTRAP_RETRIES;
                while (retries > 0) {
                    try {
                        nativeFunctionsRef.current = resolveNativeFunctions();

                        if (!backendSupportsEvents()) {
                            throw new Error('JUCE backend event API is unavailable');
                        }

                        if (!cancelled) {
                            setBackendReady(true);
                            setBackendStatus('JUCE bridge ready. Starting hydration...');
                            setDebugInfo('Resolved native functions and event bridge');
                        }

                        return;
                    } catch (error) {
                        if (!cancelled) {
                            setBackendStatus('Waiting for JUCE native functions...');
                            setDebugInfo(error.message);
                        }

                        await waitForMs(BOOTSTRAP_WAIT_MS);
                        retries -= 1;
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    setBackendStatus(`Init failed: ${error.message}`);
                    setDebugInfo(error.stack || String(error));
                }
            }
        };

        initBackend();

        return () => {
            cancelled = true;
        };
    }, [nativeFunctionsRef, setBackendReady, setBackendStatus, setDebugInfo]);
}
