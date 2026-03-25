#include "PluginProcessor.h"
#include "MidiControllerRegistry.h"

void MiniLAB3StepSequencerAudioProcessor::claimHardwareOwnership()
{
    if (hardwareManager->owner.load() == this)
        return;

    hardwareManager->owner.store(this);

    if (hardwareManager->output == nullptr)
        openHardwareOutput();
    else
        requestLedRefresh();
}

bool MiniLAB3StepSequencerAudioProcessor::isHardwareOwner() const
{
    return hardwareManager->owner.load() == this;
}

void MiniLAB3StepSequencerAudioProcessor::openHardwareOutput()
{
    bool expected = false;
    if (!isAttemptingConnection.compare_exchange_strong(expected, true))
        return;

    {
        const juce::SpinLock::ScopedLockType lock(hardwareManager->lock);
        if (hardwareManager->output != nullptr)
        {
            hardwareManager->owner.store(this);
            isAttemptingConnection.store(false);
            requestLedRefresh();
            return;
        }
    }

    auto result = getDefaultMidiControllerRegistry().openFirstMatchingOutput();

    if (result.isValid())
    {
        const juce::SpinLock::ScopedLockType lock(hardwareManager->lock);
        hardwareManager->output = std::move(result.output);
        hardwareManager->profile = std::move(result.profile);
        hardwareManager->owner.store(this);
        requestLedRefresh();
    }

    isAttemptingConnection.store(false);
}

void MiniLAB3StepSequencerAudioProcessor::resetHardwareState()
{
    if (!isHardwareOwner())
        return;

    std::shared_ptr<juce::MidiOutput> output;
    std::shared_ptr<MidiControllerProfile> profile;

    {
        const juce::SpinLock::ScopedLockType lock(hardwareManager->lock);
        output = hardwareManager->output;
        profile = hardwareManager->profile;
    }

    if (output && profile)
    {
        profile->resetHardware(*output);
        juce::Thread::sleep(30);
    }
}

void MiniLAB3StepSequencerAudioProcessor::requestLedRefresh()
{
    ledRefreshCountdown.store(3);
}

void MiniLAB3StepSequencerAudioProcessor::timerCallback()
{
    applyPendingParameterUpdates();
    if (initialising.load())
        return;

    if (!isHardwareOwner())
    {
        hwFifo.read(hwFifo.getNumReady());
        return;
    }

    auto readHandle = hwFifo.read(hwFifo.getNumReady());

    auto processQueue = [&](int start, int size)
    {
        juce::MidiBuffer discardBuffer;
        for (int i = 0; i < size; ++i)
        {
            juce::MidiMessage message(hwQueue[start + i].d, hwQueue[start + i].len, 0);
            handleMidiInput(message, discardBuffer);
        }
    };

    processQueue(readHandle.startIndex1, readHandle.blockSize1);
    processQueue(readHandle.startIndex2, readHandle.blockSize2);

    if (hardwareManager->output == nullptr)
    {
        static int retryCounter = 0;
        if (++retryCounter >= 25)
        {
            openHardwareOutput();
            retryCounter = 0;
        }
    }

    const int refreshCount = ledRefreshCountdown.load();
    if (refreshCount > 0)
    {
        updateHardwareLEDs(true);
        ledRefreshCountdown.store(refreshCount - 1);
    }
    else
    {
        updateHardwareLEDs(false);
    }
}

void MiniLAB3StepSequencerAudioProcessor::updateHardwareLEDs(bool forceOverwrite)
{
    if (!isHardwareOwner())
        return;

    std::shared_ptr<juce::MidiOutput> output;
    std::shared_ptr<MidiControllerProfile> profile;

    {
        const juce::SpinLock::ScopedLockType lock(hardwareManager->lock);
        output = hardwareManager->output;
        profile = hardwareManager->profile;
    }

    if (output && profile)
        profile->updateLEDs(*output, *this, forceOverwrite);
}

void MiniLAB3StepSequencerAudioProcessor::handleMidiInput(const juce::MidiMessage& message, juce::MidiBuffer&)
{
    if (initialising.load() || !isHardwareOwner())
        return;

    std::shared_ptr<MidiControllerProfile> profile;
    {
        const juce::SpinLock::ScopedLockType lock(hardwareManager->lock);
        profile = hardwareManager->profile;
    }

    if (profile && profile->handleMidiInput(message, *this))
    {
        requestLedRefresh();
        markUiStateDirty();
    }

    if (message.isController())
    {
        const int cc = message.getControllerNumber();
        const float normalized = message.getControllerValue() / 127.0f;

        if (cc == 7)
            pendingMasterVolNormalized.store(normalized);
        else if (cc == 11)
            pendingSwingNormalized.store(normalized);
    }
}
