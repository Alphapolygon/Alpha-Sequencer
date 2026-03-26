#pragma once

#include "MidiControllerProfile.h"

class GenericMidiDeviceProfile final : public MidiControllerProfile {
public:
    juce::String id() const override;
    bool matchesOutputDevice(const juce::MidiDeviceInfo& device) const override;
    bool claimsIncomingMessage(const juce::MidiMessage& message) const override;

    void initializeHardware(juce::MidiOutput& output) override;
    void resetHardware(juce::MidiOutput& output) override;
    void updateLEDs(juce::MidiOutput& output,
                    MiniLAB3StepSequencerAudioProcessor& processor,
                    bool forceOverwrite) override;
    bool handleMidiInput(const juce::MidiMessage& message,
                         MiniLAB3StepSequencerAudioProcessor& processor) override;

private:
    static constexpr int firstStepPadNote = 36;
    static constexpr int lastStepPadNote = 43;
};
