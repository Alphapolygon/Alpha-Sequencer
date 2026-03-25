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
    if (message.isController())
    {
        const int cc = message.getControllerNumber();
        const int value = message.getControllerValue();

        // 1. Mod Wheel (Track Selector)
        if (cc == 1)
        {
            int newInstrument = (127 - value) / 8;
            newInstrument = juce::jlimit(0, 15, newInstrument); // 16 Tracks
            processor.setSelectedTrackNative(newInstrument, true);
            return true;
        }
        // 2. Knobs 1-8 (Dynamic Automation Control)
        else if (cc == 74 || cc == 71 || cc == 76 || cc == 77 || cc == 93 || cc == 18 || cc == 19 || cc == 16)
        {
            int knobIndex = -1;
            if (cc == 74) knobIndex = 0; else if (cc == 71) knobIndex = 1;
            else if (cc == 76) knobIndex = 2; else if (cc == 77) knobIndex = 3;
            else if (cc == 93) knobIndex = 4; else if (cc == 18) knobIndex = 5;
            else if (cc == 19) knobIndex = 6; else if (cc == 16) knobIndex = 7;

            if (knobIndex >= 0)
            {
                const int pIdx = processor.activePatternIndex.load(std::memory_order_acquire);
                const int step = (processor.currentPage.load(std::memory_order_acquire) * 8) + knobIndex;
                const int instrument = processor.currentInstrument.load(std::memory_order_acquire);

                // Check which UI tab is currently open
                const int currentTab = processor.footerTabIndex.load(std::memory_order_acquire);
                juce::String paramName = "velocities";
                float mappedValue = value / 127.0f; // Default 0.0 to 1.0 range

                switch (currentTab)
                {
                case 1: paramName = "gates"; break;
                case 2: paramName = "probabilities"; break;
                case 3: paramName = "shifts"; break;
                case 4: paramName = "swings"; break;
                case 5:
                    paramName = "pitches";
                    mappedValue = std::round((value / 127.0f) * 48.0f - 24.0f); // Map to -24 / +24
                    break;
                default: break;
                }

                // Only apply the parameter change if the step is currently active
                if (processor.getActiveTrack(pIdx, instrument)[step].isActive) {
                    processor.setStepParameterNative(pIdx, instrument, step, paramName, mappedValue, true);
                }
                return true;
            }
        }
        // 3. Main Encoder Turn (Page Selection)
        else if (cc == 114)
        {
            const auto page = processor.currentPage.load(std::memory_order_acquire);
            int newPage = page;
            if (value > 64) newPage = juce::jmin(3, page + 1);
            else if (value < 64) newPage = juce::jmax(0, page - 1);

            if (newPage != page)
                processor.setCurrentPageNative(newPage, true);

            return true;
        }
        // 4. Main Encoder Click (Clear Page)
        else if (cc == 115 && value == 127)
        {
            const int instrument = processor.currentInstrument.load(std::memory_order_acquire);
            const int pIdx = processor.activePatternIndex.load(std::memory_order_acquire);
            const int page = processor.currentPage.load(std::memory_order_acquire);

            processor.clearPageNative(pIdx, instrument, page, true);
            return true;
        }

        return false;
    }
    else if (message.isNoteOn() && message.getNoteNumber() >= 36 && message.getNoteNumber() <= 43)
    {
        // 5. Pads 1-8 (Step Toggles)
        const int instrument = processor.currentInstrument.load(std::memory_order_acquire);
        const int patternIndex = processor.activePatternIndex.load(std::memory_order_acquire);
        const int step = (processor.currentPage.load(std::memory_order_acquire) * 8) + (message.getNoteNumber() - 36);

        const bool currentState = processor.getActiveTrack(patternIndex, instrument)[step].isActive;
        processor.setStepActiveNative(patternIndex, instrument, step, !currentState, true);

        // If the pad just turned the step ON, record the velocity of the pad hit
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
