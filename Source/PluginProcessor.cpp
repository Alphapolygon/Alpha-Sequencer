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

                        trackScales[t].store(0, std::memory_order_relaxed);
                        trackSequenceLengths[t].store(1, std::memory_order_relaxed);
                        trackPitchSequences[t][0].store(1, std::memory_order_relaxed);
                        currentSequenceIndex[t].store(0, std::memory_order_release);
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

    // Default to 16 steps independently
    for (int p = 0; p < MiniLAB3Seq::kNumPatterns; ++p)
        for (int t = 0; t < MiniLAB3Seq::kNumTracks; ++t)
            trackLengths[p][t].store(16, std::memory_order_release);

    markUiStateDirty();
    requestLedRefresh();
    startTimerHz(60);

    initialising.store(false, std::memory_order_release);
}

MiniLAB3StepSequencerAudioProcessor::~MiniLAB3StepSequencerAudioProcessor()
{
    stopTimer();
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

// Independent lengths logic implemented
void MiniLAB3StepSequencerAudioProcessor::setTrackLengthNative(int pIdx, int tIdx, int length, bool emitUiDiff)
{
    trackLengths[pIdx][tIdx].store(juce::jlimit(1, MiniLAB3Seq::kNumSteps, length), std::memory_order_release);
    markUiStateDirty();
    if (emitUiDiff)
    {
        UiDiffEvent ev;
        ev.type = UiDiffEventType::TrackLengthChanged;
        ev.patternIndex = pIdx;
        ev.trackIndex = tIdx;
        ev.value = length;
        pushUiDiffEvent(ev);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setStepActiveNative(int pIdx, int tIdx, int sIdx, bool isActive, bool emitUiDiff)
{
    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite) { trackWrite[sIdx].isActive = isActive; });
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
    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite) {
        for (int s = 0; s < MiniLAB3Seq::kNumSteps; ++s) trackWrite[s].isActive = false;
        });
    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff) {
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

    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite) {
        for (int s = startStep; s < endStep; ++s) trackWrite[s].isActive = false;
        });

    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff) {
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

void MiniLAB3StepSequencerAudioProcessor::randomizeTrackNative(int pIdx, int tIdx)
{
    modifyTrackState(pIdx, tIdx, [&](TrackSnapshot& trackWrite)
        {
            juce::Random r;
            for (int s = 0; s < MiniLAB3Seq::kNumSteps; ++s)
            {
                trackWrite[s].isActive = r.nextBool();
                trackWrite[s].velocity = 0.5f + (r.nextFloat() * 0.5f);
                trackWrite[s].probability = 0.6f + (r.nextFloat() * 0.4f);
                trackWrite[s].gate = 0.1f + (r.nextFloat() * 0.8f);
            }
        });

    requestLedRefresh();
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::randomizeParameterNative(int pIdx, int tIdx, const juce::String& paramName)
{
    modifyTrackState(pIdx, tIdx, [&](TrackSnapshot& trackWrite)
        {
            juce::Random r;
            for (int s = 0; s < MiniLAB3Seq::kNumSteps; ++s)
            {
                auto& step = trackWrite[s];
                if (paramName == "velocities")      step.velocity = r.nextFloat();
                else if (paramName == "gates")      step.gate = r.nextFloat();
                else if (paramName == "probabilities") step.probability = r.nextFloat();
                else if (paramName == "shifts")     step.shift = r.nextFloat();
                else if (paramName == "swings")     step.swing = r.nextFloat();
                else if (paramName == "repeats")    step.repeats = r.nextInt(juce::Range<int>(1, 5));
            }
        });

    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::setTrackScaleNative(int tIdx, int scaleType, bool emitUiDiff)
{
    trackScales[tIdx].store(juce::jlimit(0, 6, scaleType), std::memory_order_release);
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::setTrackSequenceNative(int tIdx, const juce::String& seqString, bool emitUiDiff)
{
    juce::StringArray tokens;
    tokens.addTokens(seqString, " ,", "\"");

    int len = 0;
    for (int i = 0; i < juce::jmin(tokens.size(), MiniLAB3Seq::kMaxSequenceLength); ++i)
    {
        if (tokens[i].isNotEmpty()) {
            trackPitchSequences[tIdx][len].store(tokens[i].getIntValue(), std::memory_order_release);
            len++;
        }
    }

    if (len == 0) {
        trackPitchSequences[tIdx][0].store(1, std::memory_order_release);
        len = 1;
    }

    trackSequenceLengths[tIdx].store(len, std::memory_order_release);
    currentSequenceIndex[tIdx].store(0, std::memory_order_release);
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::appendNoteToTrackSequenceNative(int tIdx, int midiNote)
{
    const int rootNote = static_cast<int>(std::round(noteParams[tIdx]->load()));
    const int scaleType = trackScales[tIdx].load(std::memory_order_relaxed);

    int diff = midiNote - rootNote;
    int scaleLen = MiniLAB3Seq::kScaleLengths[scaleType];

    int octaveShift = (diff >= 0) ? (diff / 12) : ((diff - 11) / 12);
    int semitoneMod = (diff % 12);
    if (semitoneMod < 0) semitoneMod += 12;

    int closestIndex = 0;
    int minDistance = 12;
    for (int i = 0; i < scaleLen; ++i) {
        int dist = std::abs(MiniLAB3Seq::kScaleOffsets[scaleType][i] - semitoneMod);
        if (dist < minDistance) {
            minDistance = dist;
            closestIndex = i;
        }
    }

    int degree = closestIndex + 1 + (octaveShift * scaleLen);
    int currentLen = trackSequenceLengths[tIdx].load(std::memory_order_acquire);

    if (currentLen == 1 && trackPitchSequences[tIdx][0].load(std::memory_order_acquire) == 1) {
        currentLen = 0;
    }

    if (currentLen < MiniLAB3Seq::kMaxSequenceLength) {
        trackPitchSequences[tIdx][currentLen].store(degree, std::memory_order_release);
        currentLen++;
        trackSequenceLengths[tIdx].store(currentLen, std::memory_order_release);
    }

    juce::String seqStr;
    for (int i = 0; i < currentLen; ++i)
        seqStr += juce::String(trackPitchSequences[tIdx][i].load(std::memory_order_acquire)) + " ";

    seqStr = seqStr.trim();
    UiDiffEvent ev;
    ev.type = UiDiffEventType::TrackSequenceChanged;
    ev.trackIndex = tIdx;
    size_t bytesToCopy = juce::jmin((size_t)63, (size_t)seqStr.getNumBytesAsUTF8());
    std::memcpy(ev.text, seqStr.toRawUTF8(), bytesToCopy);
    ev.text[bytesToCopy] = '\0';
    pushUiDiffEvent(ev);
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::releaseResources() {}
bool MiniLAB3StepSequencerAudioProcessor::isBusesLayoutSupported(const juce::AudioProcessor::BusesLayout& layouts) const { return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo(); }
juce::AudioProcessorEditor* MiniLAB3StepSequencerAudioProcessor::createEditor() { return new MiniLAB3StepSequencerAudioProcessorEditor(*this); }
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new MiniLAB3StepSequencerAudioProcessor(); }