#pragma once

#include "MidiControllerProfile.h"

class ArturiaMiniLabMk2Profile final : public MidiControllerProfile {
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
    enum class PadColor : uint8_t {
        off = 0x00,
        red = 0x01,
        green = 0x04,
        yellow = 0x05,
        blue = 0x10,
        magenta = 0x11,
        cyan = 0x14,
        white = 0x7F
    };

    juce::MidiMessage makePadColorSysex(uint8_t padIndex, PadColor color) const;
    PadColor pickStepColor(MiniLAB3StepSequencerAudioProcessor& processor,
                           int page,
                           int step,
                           bool active,
                           int playingStep) const;

    PadColor lastPadColor[8] {
        PadColor::off, PadColor::off, PadColor::off, PadColor::off,
        PadColor::off, PadColor::off, PadColor::off, PadColor::off
    };
};
