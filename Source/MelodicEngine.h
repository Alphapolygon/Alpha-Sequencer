#pragma once
#include <JuceHeader.h>
#include <cmath>

namespace MelodicEngine {
    enum ScaleType { None = 0, Major, Minor, Dorian, Mixolydian, PentatonicMajor, PentatonicMinor, Chromatic };

    inline constexpr int kScaleOffsets[][12] = {
        {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, // None (Semitones)
        {0, 2, 4, 5, 7, 9, 11},                 // Major
        {0, 2, 3, 5, 7, 8, 10},                 // Minor
        {0, 2, 3, 5, 7, 9, 10},                 // Dorian
        {0, 2, 4, 5, 7, 9, 10},                 // Mixolydian
        {0, 2, 4, 7, 9},                        // Pentatonic Major
        {0, 3, 5, 7, 10},                       // Pentatonic Minor
        {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}  // Chromatic
    };

    inline constexpr int kScaleLengths[] = { 12, 7, 7, 7, 7, 5, 5, 12 };

    // Snaps any raw pitch integer to the nearest valid note in the chosen scale
    inline int getQuantizedMidiNote(int rootNote, int pitchOffset, int scaleType) {
        const int sType = juce::jlimit(0, 7, scaleType);
        const int scaleLen = kScaleLengths[sType];

        int octaveShift = (pitchOffset >= 0) ? (pitchOffset / scaleLen) : ((pitchOffset - scaleLen + 1) / scaleLen);
        int noteIndex = (pitchOffset % scaleLen);
        if (noteIndex < 0) noteIndex += scaleLen;

        return juce::jlimit(0, 127, rootNote + kScaleOffsets[sType][noteIndex] + (octaveShift * 12));
    }

    // Calculates live, non-destructive jitter for floats (Velocity, Gate, etc)
    inline float applyJitter(float baseValue, float jitterAmount, juce::Random& rng, float minVal = 0.0f, float maxVal = 1.0f) {
        if (jitterAmount <= 0.001f) return baseValue;
        float offset = (rng.nextFloat() * 2.0f - 1.0f) * jitterAmount; // -jitter to +jitter
        return juce::jlimit(minVal, maxVal, baseValue + offset);
    }

    // Calculates live jitter for integer pitch steps
    inline int applyPitchJitter(int basePitch, float jitterAmount, juce::Random& rng) {
        if (jitterAmount <= 0.001f) return basePitch;
        int maxOffset = static_cast<int>(std::round(jitterAmount * 12.0f)); // Max 12 steps of random jitter
        if (maxOffset == 0) return basePitch;
        int offset = rng.nextInt(juce::Range<int>(-maxOffset, maxOffset + 1));
        return juce::jlimit(-24, 24, basePitch + offset);
    }
}