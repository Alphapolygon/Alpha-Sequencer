#pragma once

#include <JuceHeader.h>

struct ScheduledMidiEvent
{
    double ppqTime = 0.0;
    juce::MidiMessage message;
    bool isActive = false;
};

struct StepData
{
    bool isActive = false;
    float velocity = 0.8f;
    float probability = 1.0f;
    float gate = 0.75f;
    int repeats = 1;
    float shift = 0.5f;
    float swing = 0.0f;
};

// --- NEW: Granular UI Patch Event ---
enum class UiPatchType { StepActive, StepParam, PageChanged, TrackChanged };

struct UiPatchEvent {
    UiPatchType type;
    int pIdx = 0;
    int tIdx = 0;
    int sIdx = 0;
    float fVal = 0.0f;
    bool bVal = false;
    int iVal = 0;
    char stringVal[16] = { 0 };
};

class MiniLAB3StepSequencerAudioProcessor; // Forward declaration

class ControllerProfile
{
public:
    virtual ~ControllerProfile() = default;

    virtual juce::String getDeviceNameSubstring() const = 0;
    virtual void initializeHardware(juce::MidiOutput* out) = 0;
    virtual void resetHardware(juce::MidiOutput* out) = 0;
    virtual void updateLEDs(juce::MidiOutput* out, MiniLAB3StepSequencerAudioProcessor& processor, bool forceOverwrite) = 0;
    virtual bool handleMidiInput(const juce::MidiMessage& msg, MiniLAB3StepSequencerAudioProcessor& processor) = 0;
};