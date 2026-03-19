#include "PluginProcessor.h"

namespace
{
bool looksLikeMiniLab3Output(const juce::MidiDeviceInfo& device)
{
    return device.name.containsIgnoreCase("Minilab3")
        && device.name.containsIgnoreCase("MIDI")
        && !device.name.containsIgnoreCase("DIN")
        && !device.name.containsIgnoreCase("MCU");
}
} // namespace

uint8_t MiniLAB3StepSequencerAudioProcessor::getHardwarePadId(int softwareIndex)
{
    return static_cast<uint8_t>(softwareIndex + 4);
}

void MiniLAB3StepSequencerAudioProcessor::openHardwareOutput()
{
    if (hardwareOutput != nullptr || isAttemptingConnection)
        return;

    isAttemptingConnection = true;

    for (const auto& device : juce::MidiOutput::getAvailableDevices())
    {
        if (!looksLikeMiniLab3Output(device))
            continue;

        hardwareOutput = juce::MidiOutput::openDevice(device.identifier);
        if (hardwareOutput != nullptr)
        {
            for (int pad = 0; pad < MiniLAB3Seq::kPadsPerPage; ++pad)
            {
                hardwareOutput->sendMessageNow(MiniLAB3Seq::makeMiniLab3PadColorSysex(
                    getHardwarePadId(pad), 0, 0, 0));
            }

            requestLedRefresh();
        }

        break;
    }

    isAttemptingConnection = false;
}

void MiniLAB3StepSequencerAudioProcessor::resetHardwareState()
{
    if (hardwareOutput == nullptr)
        return;

    for (int pad = 0; pad < MiniLAB3Seq::kPadsPerPage; ++pad)
    {
        hardwareOutput->sendMessageNow(MiniLAB3Seq::makeMiniLab3PadColorSysex(
            getHardwarePadId(pad), 0, 0, 0));
    }

    juce::Thread::sleep(30);
}

void MiniLAB3StepSequencerAudioProcessor::requestLedRefresh()
{
    updateHardwareLEDs(true);
    ledRefreshCountdown.store(3);
}

void MiniLAB3StepSequencerAudioProcessor::timerCallback()
{
    if (hardwareOutput == nullptr)
    {
        static int connectionRetry = 0;
        if (++connectionRetry >= 25)
        {
            openHardwareOutput();
            connectionRetry = 0;
        }
    }

    const int currentCountdown = ledRefreshCountdown.load();
    if (currentCountdown > 0)
    {
        updateHardwareLEDs(true);
        ledRefreshCountdown.store(currentCountdown - 1);
    }
    else
    {
        updateHardwareLEDs(false);
    }
}

void MiniLAB3StepSequencerAudioProcessor::updateHardwareLEDs(bool forceOverwrite)
{
    if (hardwareOutput == nullptr)
        return;

    const int page = currentPage.load();
    const int startStep = page * MiniLAB3Seq::kPadsPerPage;
    const int instrument = currentInstrument.load();
    const int current16th = global16thNote.load();
    const int trackLength = trackLengths[instrument];
    const int playingStep = (current16th >= 0 && trackLength > 0) ? (current16th % trackLength) : -1;

    const juce::ScopedLock lock(stateLock);
    for (int pad = 0; pad < MiniLAB3Seq::kPadsPerPage; ++pad)
    {
        const int step = startStep + pad;
        const bool active = sequencerMatrix[instrument][step].isActive;
        const float velocity = sequencerMatrix[instrument][step].velocity;
        const bool isPlayhead = (step == playingStep);

        uint8_t r = 0;
        uint8_t g = 0;
        uint8_t b = 0;

        if (isPlayhead)
        {
            r = active ? 127 : 15;
            g = active ? 127 : 15;
            b = active ? 127 : 15;
        }
        else if (active)
        {
            const float brightness = 0.1f + (velocity * 0.9f);
            const uint8_t c = static_cast<uint8_t>(127.0f * brightness);

            if (page == 0)      { r = 0; g = c; b = c; }
            else if (page == 1) { r = c; g = 0; b = c; }
            else if (page == 2) { r = c; g = c; b = 0; }
            else if (page == 3) { r = c; g = c; b = c; }
        }

        const PadColor newColor{ r, g, b };
        if (forceOverwrite || newColor != lastPadColor[pad])
        {
            lastPadColor[pad] = newColor;
            hardwareOutput->sendMessageNow(MiniLAB3Seq::makeMiniLab3PadColorSysex(
                getHardwarePadId(pad), r, g, b));
        }
    }
}

void MiniLAB3StepSequencerAudioProcessor::handleMidiInput(const juce::MidiMessage& msg, juce::MidiBuffer&)
{
    if (msg.isController())
    {
        const int cc = msg.getControllerNumber();
        const int value = msg.getControllerValue();

        if (cc == 1)
        {
            int newInstrument = (127 - value) / 8;
            newInstrument = juce::jlimit(0, MiniLAB3Seq::kNumTracks - 1, newInstrument);

            if (currentInstrument.load() != newInstrument)
            {
                currentInstrument.store(newInstrument);
                requestLedRefresh();
                markUiStateDirty();
            }
        }
        else if (cc == 74 || cc == 71 || cc == 76 || cc == 77 || cc == 93 || cc == 18 || cc == 19 || cc == 16)
        {
            int knobIndex = -1;
            if (cc == 74) knobIndex = 0;
            else if (cc == 71) knobIndex = 1;
            else if (cc == 76) knobIndex = 2;
            else if (cc == 77) knobIndex = 3;
            else if (cc == 93) knobIndex = 4;
            else if (cc == 18) knobIndex = 5;
            else if (cc == 19) knobIndex = 6;
            else if (cc == 16) knobIndex = 7;

            if (knobIndex >= 0)
            {
                const int page = currentPage.load();
                const int instrument = currentInstrument.load();
                const int step = (page * MiniLAB3Seq::kPadsPerPage) + knobIndex;
                bool changed = false;

                {
                    const juce::ScopedLock lock(stateLock);
                    if (sequencerMatrix[instrument][step].isActive)
                    {
                        sequencerMatrix[instrument][step].velocity = value / 127.0f;
                        changed = true;
                    }
                }

                if (changed)
                {
                    requestLedRefresh();
                    markUiStateDirty();
                }
            }
        }
        else if (cc == 114)
        {
            const auto page = currentPage.load();
            if (value > 64)      currentPage.store(juce::jmin(MiniLAB3Seq::kNumPages - 1, page + 1));
            else if (value < 64) currentPage.store(juce::jmax(0, page - 1));

            pageChangedTrigger.store(true);
            requestLedRefresh();
            markUiStateDirty();
        }
        else if (cc == 115 && value == 127)
        {
            const int page = currentPage.load();
            const int instrument = currentInstrument.load();

            {
                const juce::ScopedLock lock(stateLock);
                for (int step = page * MiniLAB3Seq::kPadsPerPage;
                     step < (page * MiniLAB3Seq::kPadsPerPage) + MiniLAB3Seq::kPadsPerPage;
                     ++step)
                {
                    sequencerMatrix[instrument][step].isActive = false;
                }
            }

            updateTrackLength(instrument);
            requestLedRefresh();
            markUiStateDirty();
        }
        else if (cc == 7)
        {
            if (auto* parameter = apvts.getParameter("master_vol"))
                parameter->setValueNotifyingHost(value / 127.0f);
        }
        else if (cc == 11)
        {
            if (auto* parameter = apvts.getParameter("swing"))
                parameter->setValueNotifyingHost(value / 127.0f);
        }
    }
    else if ((msg.isNoteOn() || msg.isNoteOff()) && msg.isNoteOn())
    {
        const int note = msg.getNoteNumber();
        if (note >= 36 && note <= 43)
        {
            const int page = currentPage.load();
            const int instrument = currentInstrument.load();
            const int step = (page * MiniLAB3Seq::kPadsPerPage) + (note - 36);

            {
                const juce::ScopedLock lock(stateLock);
                sequencerMatrix[instrument][step].isActive = !sequencerMatrix[instrument][step].isActive;
                if (sequencerMatrix[instrument][step].isActive)
                    sequencerMatrix[instrument][step].velocity = msg.getFloatVelocity();
            }

            updateTrackLength(instrument);
            requestLedRefresh();
            markUiStateDirty();
        }
    }
}
