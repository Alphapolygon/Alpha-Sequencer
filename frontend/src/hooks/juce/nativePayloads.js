export const toNativeParameterValue = (paramName, value) => (
    paramName === 'repeats' || paramName === 'pitches' ? value : value / 100
);
