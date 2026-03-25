import * as Juce from 'juce-framework-frontend';
import { normalizeLoadedState } from '../../utils/patternState.js';
import { REQUIRED_NATIVE_FUNCTIONS } from '../juce/nativeFunctionNames.js';

export const backendSupportsEvents = () => (
    !!window.__JUCE__?.backend?.addEventListener && !!window.__JUCE__?.backend?.removeEventListener
);

export const waitForMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function resolveNativeFunctions() {
    const nextFunctions = {};

    for (const name of REQUIRED_NATIVE_FUNCTIONS) {
        nextFunctions[name] = Juce.getNativeFunction(name);
    }

    return nextFunctions;
}

export function createNativeInvoker(nativeFunctionsRef) {
    return async (name, args = []) => {
        const nativeFunction = nativeFunctionsRef.current[name];

        if (!nativeFunction) {
            throw new Error(`Native function "${name}" is unavailable`);
        }

        return nativeFunction(...args);
    };
}

export async function requestNormalizedEngineState(invokeNative) {
    const savedState = await invokeNative('requestInitialState');
    const parsedState = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
    return normalizeLoadedState(parsedState);
}
