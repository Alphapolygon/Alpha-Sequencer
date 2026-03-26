#include "GenericMidiDeviceProfile.h"
#include "PluginProcessor.h"

juce::String GenericMidiDeviceProfile::id() const
{
    return "generic.midi.device";
}

bool GenericMidiDeviceProfile::matchesOutputDevice(const juce::MidiDeviceInfo& device) const
{
    juce::ignoreUnused(device);
    return false;
}

bool GenericMidiDeviceProfile::claimsIncomingMessage(const juce::MidiMessage& message) const
{
    if ((message.isNoteOn() || message.isNoteOff())
        && message.getNoteNumber() >= firstStepPadNote
        && message.getNoteNumber() <= lastStepPadNote)
    {
        return true;
    }

    if (!message.isController())
        return false;

    return message.getControllerNumber() == 7 || message.getControllerNumber() == 11;
}

void GenericMidiDeviceProfile::initializeHardware(juce::MidiOutput& output)
{
    juce::ignoreUnused(output);
}

void GenericMidiDeviceProfile::resetHardware(juce::MidiOutput& output)
{
    juce::ignoreUnused(output);
}

void GenericMidiDeviceProfile::updateLEDs(juce::MidiOutput& output,
                                          MiniLAB3StepSequencerAudioProcessor& processor,
                                          bool forceOverwrite)
{
    juce::ignoreUnused(output, processor, forceOverwrite);
}

bool GenericMidiDeviceProfile::handleMidiInput(const juce::MidiMessage& message,
                                               MiniLAB3StepSequencerAudioProcessor& processor)
{
    if (message.isNoteOn() && message.getNoteNumber() >= firstStepPadNote && message.getNoteNumber() <= lastStepPadNote)
    {
        const int instrument = processor.currentInstrument.load();
        const int patternIndex = processor.activePatternIndex.load();
        const int step = (processor.currentPage.load() * 8) + (message.getNoteNumber() - firstStepPadNote);

        const bool currentState = processor.getActiveTrack(patternIndex, instrument)[step].isActive;
        processor.setStepActiveNative(patternIndex, instrument, step, !currentState, true);

        if (!currentState)
            processor.setStepParameterNative(patternIndex, instrument, step, "velocities", message.getFloatVelocity(), true);

        return true;
    }

    return false;
}
