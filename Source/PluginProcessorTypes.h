#pragma once

#include <JuceHeader.h>
#include <cstdint>

struct ScheduledMidiEvent {
    double ppqTime = 0.0;
    juce::MidiMessage message;
    bool isActive = false;
};

struct StepData {
    bool isActive = false;
    float velocity = 0.8f;
    float probability = 1.0f;
    float gate = 0.75f;
    int repeats = 1;
    float shift = 0.5f;
    float swing = 0.0f;
    int pitch = 0;
};

enum class UiDiffEventType : uint8_t {
    StepActive = 0, StepParameter, TrackState, TrackMidiKey, TrackMidiChannel,
    ActivePatternChanged, SelectedTrackChanged, CurrentPageChanged, ClearPage, ClearTrack, TrackLengthChanged
};

enum class UiDiffParam : uint8_t {
    Velocity = 0, Gate, Probability, Shift, Swing, Repeats, Pitch
};

enum class UiDiffTrackState : uint8_t { Mute = 0, Solo };

struct UiDiffEvent {
    UiDiffEventType type = UiDiffEventType::StepActive;
    int patternIndex = 0;
    int trackIndex = 0;
    int stepIndex = 0;
    int value = 0;
    int extraValue = 0;
    float floatValue = 0.0f;
    bool boolValue = false;
    uint8_t field = 0;
    char text[64] = { 0 };
};
