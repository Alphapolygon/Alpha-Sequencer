#pragma once
#include "MidiControllerProfile.h"

class ArturiaKeyLabMk3Profile final : public MidiControllerProfile {
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
    struct PadColor {
        uint8_t r = 0; uint8_t g = 0; uint8_t b = 0;
        bool operator!=(const PadColor& other) const noexcept {
            return r != other.r || g != other.g || b != other.b;
        }
    };

    juce::MidiMessage makePadColorSysex(uint8_t padIndex, uint8_t red, uint8_t green, uint8_t blue) const;
    PadColor lastPadColor[12]{}; // 12 Pads on the Premium KeyLab MK3
};