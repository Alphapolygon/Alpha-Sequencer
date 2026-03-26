#include "ArturiaMiniLabMk2Profile.h"
#include "PluginProcessor.h"

juce::String ArturiaMiniLabMk2Profile::id() const
{
    return "arturia.minilabmk2";
}

bool ArturiaMiniLabMk2Profile::matchesOutputDevice(const juce::MidiDeviceInfo& device) const
{
    return device.name.containsIgnoreCase("minilab")
        && (device.name.containsIgnoreCase("mkII") || device.name.containsIgnoreCase("mkii"));
}

bool ArturiaMiniLabMk2Profile::claimsIncomingMessage(const juce::MidiMessage& message) const
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
    case 1: case 7: case 11:
    case 16: case 18: case 19: case 71: case 74: // Knobs
    case 76: case 77: case 93: case 114: case 115: // Knobs & Encoder
        return true;
    default:
        return false;
    }
}

void ArturiaMiniLabMk2Profile::initializeHardware(juce::MidiOutput& output)
{
    for (uint8_t i = 0; i < 8; ++i)
        output.sendMessageNow(makePadColorSysex(i, PadColor::off));
}

void ArturiaMiniLabMk2Profile::resetHardware(juce::MidiOutput& output)
{
    initializeHardware(output);
}

void ArturiaMiniLabMk2Profile::updateLEDs(juce::MidiOutput& output,
                                          MiniLAB3StepSequencerAudioProcessor& processor,
                                          bool forceOverwrite)
{
    const int page = processor.currentPage.load();
    const int instrument = processor.currentInstrument.load();
    const int patternIndex = processor.activePatternIndex.load();
    const int current16th = processor.global16thNote.load();
    const int trackLength = processor.trackLengths[patternIndex][instrument].load();
    const int playingStep = (current16th >= 0 && trackLength > 0)
        ? (current16th % trackLength)
        : -1;

    const auto& trackData = processor.getActiveTrack(patternIndex, instrument);

    for (int pad = 0; pad < 8; ++pad)
    {
        const int step = (page * 8) + pad;
        const bool active = trackData[step].isActive;
        const auto color = pickStepColor(processor, page, step, active, playingStep);

        if (forceOverwrite || color != lastPadColor[pad])
        {
            lastPadColor[pad] = color;
            output.sendMessageNow(makePadColorSysex(static_cast<uint8_t>(pad), color));
        }
    }
}

bool ArturiaMiniLabMk2Profile::handleMidiInput(const juce::MidiMessage& message,
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
            processor.setSelectedTrackNative(juce::jlimit(0, 15, newInstrument), true);
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
                const int pIdx = processor.activePatternIndex.load();
                const int step = (processor.currentPage.load() * 8) + knobIndex;
                const int instrument = processor.currentInstrument.load();

                const int currentTab = processor.footerTabIndex.load();
                juce::String paramName = "velocities";
                float mappedValue = value / 127.0f;

                switch (currentTab)
                {
                case 1: paramName = "gates"; break;
                case 2: paramName = "probabilities"; break;
                case 3: paramName = "shifts"; break;
                case 4: paramName = "swings"; break;
                case 5:
                    paramName = "pitches";
                    mappedValue = std::round((value / 127.0f) * 48.0f - 24.0f);
                    break;
                default: break;
                }

                if (processor.getActiveTrack(pIdx, instrument)[step].isActive) {
                    processor.setStepParameterNative(pIdx, instrument, step, paramName, mappedValue, true);
                }
                return true;
            }
        }
        // 3. Main Encoder Turn (Page Selection)
        else if (cc == 114)
        {
            const auto page = processor.currentPage.load();
            int newPage = page;
            if (value > 64) newPage = juce::jmin(3, page + 1);
            else if (value < 64) newPage = juce::jmax(0, page - 1);

            if (newPage != page) processor.setCurrentPageNative(newPage, true);
            return true;
        }
        // 4. Main Encoder Click (Clear Page)
        else if (cc == 115 && value == 127)
        {
            processor.clearPageNative(processor.activePatternIndex.load(), processor.currentInstrument.load(), processor.currentPage.load(), true);
            return true;
        }
        return false;
    }
    else if (message.isNoteOn() && message.getNoteNumber() >= 36 && message.getNoteNumber() <= 43)
    {
        // 5. Pads 1-8 (Step Toggles)
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

juce::MidiMessage ArturiaMiniLabMk2Profile::makePadColorSysex(uint8_t padIndex, PadColor color) const
{
    const uint8_t data[] = {
        0xF0, 0x00, 0x20, 0x6B, 0x7F, 0x42, 0x02, 0x00,
        0x10, static_cast<uint8_t>(0x70 | (padIndex & 0x0F)), static_cast<uint8_t>(color), 0xF7
    };

    return juce::MidiMessage(data, static_cast<int>(sizeof(data)));
}

ArturiaMiniLabMk2Profile::PadColor ArturiaMiniLabMk2Profile::pickStepColor(MiniLAB3StepSequencerAudioProcessor&,
                                                                            int page,
                                                                            int step,
                                                                            bool active,
                                                                            int playingStep) const
{
    if (step == playingStep)
        return active ? PadColor::white : PadColor::blue;

    if (!active)
        return PadColor::off;

    switch (page)
    {
        case 0: return PadColor::cyan;
        case 1: return PadColor::magenta;
        case 2: return PadColor::yellow;
        case 3: return PadColor::white;
        default: return PadColor::green;
    }
}
