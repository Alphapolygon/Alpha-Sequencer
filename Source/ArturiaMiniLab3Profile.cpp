#include "ArturiaMiniLab3Profile.h"
#include "PluginProcessor.h"

juce::String ArturiaMiniLab3Profile::id() const
{
    return "arturia.minilab3";
}

bool ArturiaMiniLab3Profile::matchesOutputDevice(const juce::MidiDeviceInfo& device) const
{
    return device.name.containsIgnoreCase("Minilab3")
        && device.name.containsIgnoreCase("MIDI");
}

bool ArturiaMiniLab3Profile::claimsIncomingMessage(const juce::MidiMessage& message) const
{
    if ((message.isNoteOn() || message.isNoteOff())
        && message.getNoteNumber() >= 36
        && message.getNoteNumber() <= 43)
    {
        return true;
    }

    if (!message.isController())
        return false;

    switch (message.getControllerNumber())
    {
        case 1:
        case 7:
        case 11:
        case 16:
        case 18:
        case 19:
        case 71:
        case 74:
        case 76:
        case 77:
        case 93:
        case 114:
        case 115:
            return true;
        default:
            return false;
    }
}

void ArturiaMiniLab3Profile::initializeHardware(juce::MidiOutput& output)
{
    for (int i = 0; i < 8; ++i)
        output.sendMessageNow(makePadColorSysex(static_cast<uint8_t>(i + 4), 0, 0, 0));
}

void ArturiaMiniLab3Profile::resetHardware(juce::MidiOutput& output)
{
    initializeHardware(output);
}

void ArturiaMiniLab3Profile::updateLEDs(juce::MidiOutput& output,
                                        MiniLAB3StepSequencerAudioProcessor& processor,
                                        bool forceOverwrite)
{
    const int page = processor.currentPage.load();
    const int instrument = processor.currentInstrument.load();
    const int patternIndex = processor.activePatternIndex.load();
    const int current16th = processor.global16thNote.load();
    const int playingStep = (current16th >= 0)
        ? (current16th % processor.trackLengths[patternIndex][instrument].load())
        : -1;

    const auto& trackData = processor.getActiveTrack(patternIndex, instrument);

    for (int pad = 0; pad < 8; ++pad)
    {
        const int step = (page * 8) + pad;
        const bool active = trackData[step].isActive;

        uint8_t red = 0;
        uint8_t green = 0;
        uint8_t blue = 0;

        if (step == playingStep)
        {
            red = active ? 127 : 15;
            green = active ? 127 : 15;
            blue = active ? 127 : 15;
        }
        else if (active)
        {
            const uint8_t brightness = static_cast<uint8_t>(127.0f * (0.1f + (trackData[step].velocity * 0.9f)));

            if (page == 0)
            {
                green = brightness;
                blue = brightness;
            }
            else if (page == 1)
            {
                red = brightness;
                blue = brightness;
            }
            else if (page == 2)
            {
                red = brightness;
                green = brightness;
            }
            else if (page == 3)
            {
                red = brightness;
                green = brightness;
                blue = brightness;
            }
        }

        const PadColor newColor { red, green, blue };
        if (forceOverwrite || newColor != lastPadColor[pad])
        {
            lastPadColor[pad] = newColor;
            output.sendMessageNow(makePadColorSysex(static_cast<uint8_t>(pad + 4), red, green, blue));
        }
    }
}

bool ArturiaMiniLab3Profile::handleMidiInput(const juce::MidiMessage& message,
                                             MiniLAB3StepSequencerAudioProcessor& processor)
{
    if (message.isNoteOn() && message.getNoteNumber() >= 36 && message.getNoteNumber() <= 43)
    {
        const int instrument = processor.currentInstrument.load();
        const int patternIndex = processor.activePatternIndex.load();
        const int step = (processor.currentPage.load() * 8) + (message.getNoteNumber() - 36);

        const bool currentState = processor.getActiveTrack(patternIndex, instrument)[step].isActive;
        processor.setStepActiveNative(patternIndex, instrument, step, !currentState, true);

        if (!currentState)
            processor.setStepParameterNative(patternIndex, instrument, step, "velocities", message.getFloatVelocity(), true);

        return true;
    }

    return false;
}

juce::MidiMessage ArturiaMiniLab3Profile::makePadColorSysex(uint8_t padIndex,
                                                            uint8_t red,
                                                            uint8_t green,
                                                            uint8_t blue) const
{
    const uint8_t data[] = {
        0xF0, 0x00, 0x20, 0x6B, 0x7F, 0x42, 0x02, 0x01,
        0x16, padIndex,
        static_cast<uint8_t>(red & 0x7F),
        static_cast<uint8_t>(green & 0x7F),
        static_cast<uint8_t>(blue & 0x7F),
        0xF7
    };

    return juce::MidiMessage(data, static_cast<int>(sizeof(data)));
}
