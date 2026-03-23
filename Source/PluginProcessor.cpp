#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cstring>

namespace
{
    UiDiffParam toUiDiffParam(const juce::String& param)
    {
        if (param == "gates") return UiDiffParam::Gate;
        if (param == "probabilities") return UiDiffParam::Probability;
        if (param == "shifts") return UiDiffParam::Shift;
        if (param == "swings") return UiDiffParam::Swing;
        if (param == "repeats") return UiDiffParam::Repeats;
        return UiDiffParam::Velocity;
    }
}

juce::AudioProcessorValueTreeState::ParameterLayout MiniLAB3StepSequencerAudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterFloat>("master_vol", "Master Volume", 0.0f, 1.0f, 0.8f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("swing", "Swing", 0.0f, 1.0f, 0.0f));

    for (int i = 0; i < MiniLAB3Seq::kNumTracks; ++i)
    {
        const auto trackLabel = juce::String(i + 1);
        layout.add(std::make_unique<juce::AudioParameterBool>("mute_" + trackLabel, "Mute " + trackLabel, false));
        layout.add(std::make_unique<juce::AudioParameterBool>("solo_" + trackLabel, "Solo " + trackLabel, false));
        layout.add(std::make_unique<juce::AudioParameterInt>("note_" + trackLabel, "MIDI Note " + trackLabel, 0, 127, 36 + i));
        layout.add(std::make_unique<juce::AudioParameterFloat>(
            "nudge_" + trackLabel,
            "Micro-Timing " + trackLabel,
            juce::NormalisableRange<float>(minMicroTimingMs, maxMicroTimingMs, 0.1f),
            0.0f));
    }

    return layout;
}

MiniLAB3StepSequencerAudioProcessor::MiniLAB3StepSequencerAudioProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
    apvts(*this, nullptr, "PARAMETERS", createParameterLayout()),
    playbackRandom(0x31337)
{
    masterVolParam = apvts.getRawParameterValue("master_vol");
    swingParam = apvts.getRawParameterValue("swing");

    for (int i = 0; i < MiniLAB3Seq::kNumPatterns; ++i)
        patternUUIDs[i] = juce::Uuid().toString();

    modifySequencerState([this](MatrixSnapshot& writeMatrix)
        {
            for (int p = 0; p < MiniLAB3Seq::kNumPatterns; ++p)
            {
                for (int t = 0; t < MiniLAB3Seq::kNumTracks; ++t)
                {
                    if (p == 0)
                    {
                        instrumentNames[t] = juce::String(t + 1);
                        trackMidiChannels[t].store(1, std::memory_order_relaxed);
                        muteParams[t] = apvts.getRawParameterValue("mute_" + juce::String(t + 1));
                        soloParams[t] = apvts.getRawParameterValue("solo_" + juce::String(t + 1));
                        noteParams[t] = apvts.getRawParameterValue("note_" + juce::String(t + 1));
                        nudgeParams[t] = apvts.getRawParameterValue("nudge_" + juce::String(t + 1));
                    }

                    for (int s = 0; s < MiniLAB3Seq::kNumSteps; ++s)
                    {
                        writeMatrix[p][t][s] = { false, 0.8f, 1.0f, 0.75f, 1, 0.5f, 0.0f };
                        if (p == 0)
                            lastFiredVelocity[t][s] = 0.0f;
                    }
                }
            }
        });

    for (int p = 0; p < MiniLAB3Seq::kNumPatterns; ++p)
        for (int t = 0; t < MiniLAB3Seq::kNumTracks; ++t)
            updateTrackLength(p, t);

    markUiStateDirty();
    requestLedRefresh();
    startTimerHz(60);

    initialising.store(false, std::memory_order_release);
}

MiniLAB3StepSequencerAudioProcessor::~MiniLAB3StepSequencerAudioProcessor()
{
    stopTimer();

    // Release hardware ownership gracefully
    if (isHardwareOwner()) {
        resetHardwareState();
        hardwareManager->owner.store(nullptr, std::memory_order_release);
    }
}

void MiniLAB3StepSequencerAudioProcessor::modifyTrackState(int patternIndex, int trackIndex, const std::function<void(TrackSnapshot&)>& modifier)
{
    const int safePattern = juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, patternIndex);
    const int safeTrack = juce::jlimit(0, MiniLAB3Seq::kNumTracks - 1, trackIndex);

    const juce::ScopedLock lock(writerLock);
    const uint8_t activeIdx = activeTrackBufferIndex[safePattern][safeTrack].load(std::memory_order_acquire);
    const uint8_t inactiveIdx = static_cast<uint8_t>(1 - activeIdx);

    std::memcpy(sequencerTrackBuffers[inactiveIdx][safePattern][safeTrack],
        sequencerTrackBuffers[activeIdx][safePattern][safeTrack],
        sizeof(TrackSnapshot));

    modifier(sequencerTrackBuffers[inactiveIdx][safePattern][safeTrack]);
    activeTrackBufferIndex[safePattern][safeTrack].store(inactiveIdx, std::memory_order_release);
}

void MiniLAB3StepSequencerAudioProcessor::modifyPatternState(int patternIndex, const std::function<void(PatternSnapshot&)>& modifier)
{
    const int safePattern = juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, patternIndex);
    PatternSnapshot staged{};

    {
        const juce::ScopedLock lock(writerLock);
        for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
        {
            const uint8_t activeIdx = activeTrackBufferIndex[safePattern][track].load(std::memory_order_acquire);
            std::memcpy(staged[track],
                sequencerTrackBuffers[activeIdx][safePattern][track],
                sizeof(TrackSnapshot));
        }

        modifier(staged);

        for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
        {
            const uint8_t activeIdx = activeTrackBufferIndex[safePattern][track].load(std::memory_order_acquire);
            const uint8_t inactiveIdx = static_cast<uint8_t>(1 - activeIdx);
            std::memcpy(sequencerTrackBuffers[inactiveIdx][safePattern][track], staged[track], sizeof(TrackSnapshot));
            activeTrackBufferIndex[safePattern][track].store(inactiveIdx, std::memory_order_release);
        }
    }
}

void MiniLAB3StepSequencerAudioProcessor::modifySequencerState(const std::function<void(MatrixSnapshot&)>& modifier)
{
    MatrixSnapshot staged{};

    {
        const juce::ScopedLock lock(writerLock);
        for (int pattern = 0; pattern < MiniLAB3Seq::kNumPatterns; ++pattern)
        {
            for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
            {
                const uint8_t activeIdx = activeTrackBufferIndex[pattern][track].load(std::memory_order_acquire);
                std::memcpy(staged[pattern][track],
                    sequencerTrackBuffers[activeIdx][pattern][track],
                    sizeof(TrackSnapshot));
            }
        }

        modifier(staged);

        for (int pattern = 0; pattern < MiniLAB3Seq::kNumPatterns; ++pattern)
        {
            for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
            {
                const uint8_t activeIdx = activeTrackBufferIndex[pattern][track].load(std::memory_order_acquire);
                const uint8_t inactiveIdx = static_cast<uint8_t>(1 - activeIdx);
                std::memcpy(sequencerTrackBuffers[inactiveIdx][pattern][track], staged[pattern][track], sizeof(TrackSnapshot));
                activeTrackBufferIndex[pattern][track].store(inactiveIdx, std::memory_order_release);
            }
        }
    }
}

const MiniLAB3StepSequencerAudioProcessor::TrackSnapshot& MiniLAB3StepSequencerAudioProcessor::getActiveTrack(int patternIndex, int trackIndex) const
{
    const int safePattern = juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, patternIndex);
    const int safeTrack = juce::jlimit(0, MiniLAB3Seq::kNumTracks - 1, trackIndex);
    const uint8_t activeIdx = activeTrackBufferIndex[safePattern][safeTrack].load(std::memory_order_acquire);
    return sequencerTrackBuffers[activeIdx][safePattern][safeTrack];
}

void MiniLAB3StepSequencerAudioProcessor::copyActivePattern(int patternIndex, PatternSnapshot& dest) const
{
    const int safePattern = juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, patternIndex);
    const juce::ScopedLock lock(writerLock);

    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
    {
        const uint8_t activeIdx = activeTrackBufferIndex[safePattern][track].load(std::memory_order_acquire);
        std::memcpy(dest[track], sequencerTrackBuffers[activeIdx][safePattern][track], sizeof(TrackSnapshot));
    }
}

void MiniLAB3StepSequencerAudioProcessor::buildActiveMatrixSnapshot(MatrixSnapshot& dest) const
{
    const juce::ScopedLock lock(writerLock);

    for (int pattern = 0; pattern < MiniLAB3Seq::kNumPatterns; ++pattern)
    {
        for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
        {
            const uint8_t activeIdx = activeTrackBufferIndex[pattern][track].load(std::memory_order_acquire);
            std::memcpy(dest[pattern][track], sequencerTrackBuffers[activeIdx][pattern][track], sizeof(TrackSnapshot));
        }
    }
}

void MiniLAB3StepSequencerAudioProcessor::pushUiDiffEvent(const UiDiffEvent& event) noexcept
{
    int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
    uiDiffFifo.prepareToWrite(1, start1, size1, start2, size2);

    if (size1 <= 0)
    {
        droppedUiDiffs.fetch_add(1, std::memory_order_relaxed);
        return;
    }

    uiDiffQueue[static_cast<size_t>(start1)] = event;
    uiDiffFifo.finishedWrite(1);
}

bool MiniLAB3StepSequencerAudioProcessor::popUiDiffEvent(UiDiffEvent& event) noexcept
{
    int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
    uiDiffFifo.prepareToRead(1, start1, size1, start2, size2);

    if (size1 <= 0)
        return false;

    event = uiDiffQueue[static_cast<size_t>(start1)];
    uiDiffFifo.finishedRead(1);
    return true;
}

void MiniLAB3StepSequencerAudioProcessor::setStepActiveNative(int pIdx, int tIdx, int sIdx, bool isActive, bool emitUiDiff)
{
    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite)
        {
            trackWrite[sIdx].isActive = isActive;
        });

    updateTrackLength(pIdx, tIdx);
    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::StepActive;
        ev.patternIndex = pIdx;
        ev.trackIndex = tIdx;
        ev.stepIndex = sIdx;
        ev.boolValue = isActive;
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setStepParameterNative(int pIdx, int tIdx, int sIdx, const juce::String& paramName, float value, bool emitUiDiff)
{
    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite)
        {
            auto& step = trackWrite[sIdx];
            if (paramName == "velocities")      step.velocity = value;
            else if (paramName == "gates")      step.gate = value;
            else if (paramName == "probabilities") step.probability = value;
            else if (paramName == "shifts")     step.shift = value;
            else if (paramName == "swings")     step.swing = value;
            else if (paramName == "repeats")    step.repeats = juce::jmax(1, static_cast<int>(std::round(value)));
        });

    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::StepParameter;
        ev.patternIndex = pIdx;
        ev.trackIndex = tIdx;
        ev.stepIndex = sIdx;
        ev.field = static_cast<uint8_t>(toUiDiffParam(paramName));
        ev.floatValue = value;
        ev.value = juce::jmax(1, static_cast<int>(std::round(value)));
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setTrackStateNative(int tIdx, const juce::String& stateName, bool isEnabled, bool emitUiDiff)
{
    if (stateName == "mute")
        setParameterFromPlainValue("mute_" + juce::String(tIdx + 1), isEnabled ? 1.0f : 0.0f);
    else if (stateName == "solo")
        setParameterFromPlainValue("solo_" + juce::String(tIdx + 1), isEnabled ? 1.0f : 0.0f);
    else
        return;

    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::TrackState;
        ev.patternIndex = activePatternIndex.load(std::memory_order_acquire);
        ev.trackIndex = tIdx;
        ev.boolValue = isEnabled;
        ev.field = static_cast<uint8_t>(stateName == "solo" ? UiDiffTrackState::Solo : UiDiffTrackState::Mute);
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setTrackMidiKeyNative(int tIdx, int midiNote, bool emitUiDiff)
{
    setParameterFromPlainValue("note_" + juce::String(tIdx + 1), static_cast<float>(midiNote));
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::TrackMidiKey;
        ev.patternIndex = activePatternIndex.load(std::memory_order_acquire);
        ev.trackIndex = tIdx;
        ev.value = juce::jlimit(0, 127, midiNote);
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setTrackMidiChannelNative(int tIdx, int channel, bool emitUiDiff)
{
    trackMidiChannels[tIdx].store(juce::jlimit(1, 16, channel), std::memory_order_release);
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::TrackMidiChannel;
        ev.patternIndex = activePatternIndex.load(std::memory_order_acquire);
        ev.trackIndex = tIdx;
        ev.value = trackMidiChannels[tIdx].load(std::memory_order_acquire);
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::clearTrackNative(int pIdx, int tIdx, bool emitUiDiff)
{
    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite)
        {
            for (int s = 0; s < MiniLAB3Seq::kNumSteps; ++s)
                trackWrite[s].isActive = false;
        });

    updateTrackLength(pIdx, tIdx);
    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::ClearTrack;
        ev.patternIndex = pIdx;
        ev.trackIndex = tIdx;
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::clearPageNative(int pIdx, int tIdx, int pageIdx, bool emitUiDiff)
{
    const int safePage = juce::jlimit(0, MiniLAB3Seq::kNumPages - 1, pageIdx);
    const int startStep = safePage * MiniLAB3Seq::kPadsPerPage;
    const int endStep = startStep + MiniLAB3Seq::kPadsPerPage;

    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite)
        {
            for (int s = startStep; s < endStep; ++s)
                trackWrite[s].isActive = false;
        });

    updateTrackLength(pIdx, tIdx);
    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::ClearPage;
        ev.patternIndex = pIdx;
        ev.trackIndex = tIdx;
        ev.value = safePage;
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setActivePatternNative(int pIdx, bool emitUiDiff)
{
    const int safeIndex = juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, pIdx);
    activePatternIndex.store(safeIndex, std::memory_order_release);
    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::ActivePatternChanged;
        ev.value = safeIndex;
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setSelectedTrackNative(int tIdx, bool emitUiDiff)
{
    const int safeIndex = juce::jlimit(0, MiniLAB3Seq::kNumTracks - 1, tIdx);
    currentInstrument.store(safeIndex, std::memory_order_release);
    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::SelectedTrackChanged;
        ev.value = safeIndex;
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setCurrentPageNative(int pageIdx, bool emitUiDiff)
{
    const int safeIndex = juce::jlimit(0, MiniLAB3Seq::kNumPages - 1, pageIdx);
    currentPage.store(safeIndex, std::memory_order_release);
    activeSection.store(safeIndex, std::memory_order_release);
    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::CurrentPageChanged;
        ev.value = safeIndex;
        ev.extraValue = safeIndex;
        pushUiDiffEvent(ev);
    }
}

int MiniLAB3StepSequencerAudioProcessor::getGeneralMidiNote(int trackIndex)
{
    return 36 + trackIndex;
}

void MiniLAB3StepSequencerAudioProcessor::updateTrackLength(int patternIndex, int trackIndex)
{
    const auto& trackData = getActiveTrack(patternIndex, trackIndex);
    int maxActiveStep = -1;

    for (int step = MiniLAB3Seq::kNumSteps - 1; step >= 0; --step)
    {
        if (trackData[step].isActive)
        {
            maxActiveStep = step;
            break;
        }
    }

    int length = 8;
    if (maxActiveStep >= 24)      length = 32;
    else if (maxActiveStep >= 16) length = 24;
    else if (maxActiveStep >= 8)  length = 16;

    trackLengths[patternIndex][trackIndex].store(length, std::memory_order_release);
}

void MiniLAB3StepSequencerAudioProcessor::setParameterFromPlainValue(const juce::String& parameterId, float plainValue)
{
    if (auto* parameter = apvts.getParameter(parameterId))
    {
        const float normalizedValue = juce::jlimit(0.0f, 1.0f, parameter->convertTo0to1(plainValue));
        const float currentValue = parameter->getValue();

        if (currentValue > normalizedValue - 0.0001f && currentValue < normalizedValue + 0.0001f)
            return;

        parameter->setValueNotifyingHost(normalizedValue);
    }
}

void MiniLAB3StepSequencerAudioProcessor::applyPendingParameterUpdates()
{
    const float pendingMaster = pendingMasterVolNormalized.exchange(-1.0f, std::memory_order_acq_rel);
    if (pendingMaster >= 0.0f)
    {
        if (auto* parameter = apvts.getParameter("master_vol"))
            parameter->setValueNotifyingHost(juce::jlimit(0.0f, 1.0f, pendingMaster));
    }

    const float pendingSwing = pendingSwingNormalized.exchange(-1.0f, std::memory_order_acq_rel);
    if (pendingSwing >= 0.0f)
    {
        if (auto* parameter = apvts.getParameter("swing"))
            parameter->setValueNotifyingHost(juce::jlimit(0.0f, 1.0f, pendingSwing));
    }
}

void MiniLAB3StepSequencerAudioProcessor::markUiStateDirty() noexcept
{
    uiStateVersion.fetch_add(1, std::memory_order_relaxed);
}

void MiniLAB3StepSequencerAudioProcessor::releaseResources() {}
bool MiniLAB3StepSequencerAudioProcessor::isBusesLayoutSupported(const juce::AudioProcessor::BusesLayout& layouts) const { return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo(); }
juce::AudioProcessorEditor* MiniLAB3StepSequencerAudioProcessor::createEditor() { return new MiniLAB3StepSequencerAudioProcessorEditor(*this); }
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MiniLAB3StepSequencerAudioProcessor(); }

