#pragma once

#include <JuceHeader.h>

class MiniLAB3StepSequencerAudioProcessor;

class MidiControllerProfile {
public:
    virtual ~MidiControllerProfile() = default;

    virtual juce::String id() const = 0;
    virtual bool matchesOutputDevice(const juce::MidiDeviceInfo& device) const = 0;
    virtual bool claimsIncomingMessage(const juce::MidiMessage& message) const = 0;

    virtual void initializeHardware(juce::MidiOutput& output) = 0;
    virtual void resetHardware(juce::MidiOutput& output) = 0;
    virtual void updateLEDs(juce::MidiOutput& output,
                            MiniLAB3StepSequencerAudioProcessor& processor,
                            bool forceOverwrite) = 0;
    virtual bool handleMidiInput(const juce::MidiMessage& message,
                                 MiniLAB3StepSequencerAudioProcessor& processor) = 0;
};
