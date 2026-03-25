#include "PluginProcessor.h"
#include "ParameterNames.h"

void MiniLAB3StepSequencerAudioProcessor::setTrackTimeDivisionNative(int pIdx, int tIdx, int divisionIdx)
{
    trackTimeDivisions[pIdx][tIdx].store(juce::jlimit(0, 4, divisionIdx), std::memory_order_release);
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::setTrackLengthNative(int pIdx, int tIdx, int length, bool emitUiDiff)
{
    trackLengths[pIdx][tIdx].store(juce::jlimit(1, MiniLAB3Seq::kNumSteps, length), std::memory_order_release);
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent event;
        event.type = UiDiffEventType::TrackLengthChanged;
        event.patternIndex = pIdx;
        event.trackIndex = tIdx;
        event.value = length;
        pushUiDiffEvent(event);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setStepActiveNative(int pIdx, int tIdx, int sIdx, bool isActive, bool emitUiDiff)
{
    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite) {
        trackWrite[sIdx].isActive = isActive;
    });

    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent event;
        event.type = UiDiffEventType::StepActive;
        event.patternIndex = pIdx;
        event.trackIndex = tIdx;
        event.stepIndex = sIdx;
        event.boolValue = isActive;
        pushUiDiffEvent(event);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setTrackRandomAmountNative(int pIdx, int tIdx, int paramIdx, float amount)
{
    trackRandomAmounts[pIdx][tIdx][paramIdx].store(juce::jlimit(0.0f, 1.0f, amount), std::memory_order_release);
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::resetAutomationLaneNative(int pIdx, int tIdx, const juce::String& paramName)
{
    modifyTrackState(pIdx, tIdx, [&](TrackSnapshot& trackWrite) {
        for (int s = 0; s < MiniLAB3Seq::kNumSteps; ++s)
        {
            if (paramName == "velocities") trackWrite[s].velocity = 1.0f;
            else if (paramName == "gates") trackWrite[s].gate = 0.75f;
            else if (paramName == "probabilities") trackWrite[s].probability = 1.0f;
            else if (paramName == "shifts") trackWrite[s].shift = 0.5f;
            else if (paramName == "swings") trackWrite[s].swing = 0.0f;
            else if (paramName == "pitches") trackWrite[s].pitch = 0;
        }
    });

    trackRandomAmounts[pIdx][tIdx][ParameterNames::randomAmountIndex(paramName)].store(0.0f, std::memory_order_release);
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::setStepParameterNative(int pIdx,
                                                                 int tIdx,
                                                                 int sIdx,
                                                                 const juce::String& paramName,
                                                                 float value,
                                                                 bool emitUiDiff)
{
    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite) {
        auto& step = trackWrite[sIdx];
        if (paramName == "velocities") step.velocity = value;
        else if (paramName == "gates") step.gate = value;
        else if (paramName == "probabilities") step.probability = value;
        else if (paramName == "shifts") step.shift = value;
        else if (paramName == "swings") step.swing = value;
        else if (paramName == "pitches") step.pitch = static_cast<int>(std::round(value));
        else if (paramName == "repeats") step.repeats = juce::jmax(1, static_cast<int>(std::round(value)));
    });

    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent event;
        event.type = UiDiffEventType::StepParameter;
        event.patternIndex = pIdx;
        event.trackIndex = tIdx;
        event.stepIndex = sIdx;
        event.field = static_cast<uint8_t>(ParameterNames::step(paramName));
        event.floatValue = value;
        event.value = static_cast<int>(std::round(value));
        pushUiDiffEvent(event);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setTrackStateNative(int tIdx,
                                                              const juce::String& stateName,
                                                              bool isEnabled,
                                                              bool emitUiDiff)
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
        UiDiffEvent event;
        event.type = UiDiffEventType::TrackState;
        event.patternIndex = activePatternIndex.load(std::memory_order_acquire);
        event.trackIndex = tIdx;
        event.boolValue = isEnabled;
        event.field = static_cast<uint8_t>(stateName == "solo" ? UiDiffTrackState::Solo : UiDiffTrackState::Mute);
        pushUiDiffEvent(event);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setTrackMidiKeyNative(int tIdx, int midiNote, bool emitUiDiff)
{
    setParameterFromPlainValue("note_" + juce::String(tIdx + 1), static_cast<float>(midiNote));
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent event;
        event.type = UiDiffEventType::TrackMidiKey;
        event.patternIndex = activePatternIndex.load(std::memory_order_acquire);
        event.trackIndex = tIdx;
        event.value = juce::jlimit(0, 127, midiNote);
        pushUiDiffEvent(event);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setTrackMidiChannelNative(int tIdx, int channel, bool emitUiDiff)
{
    trackMidiChannels[tIdx].store(juce::jlimit(1, 16, channel), std::memory_order_release);
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent event;
        event.type = UiDiffEventType::TrackMidiChannel;
        event.patternIndex = activePatternIndex.load(std::memory_order_acquire);
        event.trackIndex = tIdx;
        event.value = trackMidiChannels[tIdx].load(std::memory_order_acquire);
        pushUiDiffEvent(event);
    }
}

void MiniLAB3StepSequencerAudioProcessor::clearTrackNative(int pIdx, int tIdx, bool emitUiDiff)
{
    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite) {
        for (int s = 0; s < MiniLAB3Seq::kNumSteps; ++s)
            trackWrite[s].isActive = false;
    });

    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent event;
        event.type = UiDiffEventType::ClearTrack;
        event.patternIndex = pIdx;
        event.trackIndex = tIdx;
        pushUiDiffEvent(event);
    }
}

void MiniLAB3StepSequencerAudioProcessor::clearPageNative(int pIdx, int tIdx, int pageIdx, bool emitUiDiff)
{
    const int safePage = juce::jlimit(0, MiniLAB3Seq::kNumPages - 1, pageIdx);
    const int startStep = safePage * MiniLAB3Seq::kPadsPerPage;
    const int endStep = startStep + MiniLAB3Seq::kPadsPerPage;

    modifyTrackState(pIdx, tIdx, [=](TrackSnapshot& trackWrite) {
        for (int s = startStep; s < endStep; ++s)
            trackWrite[s].isActive = false;
    });

    requestLedRefresh();
    markUiStateDirty();

    if (emitUiDiff)
    {
        UiDiffEvent event;
        event.type = UiDiffEventType::ClearPage;
        event.patternIndex = pIdx;
        event.trackIndex = tIdx;
        event.value = safePage;
        pushUiDiffEvent(event);
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
        UiDiffEvent event;
        event.type = UiDiffEventType::ActivePatternChanged;
        event.value = safeIndex;
        pushUiDiffEvent(event);
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
        UiDiffEvent event;
        event.type = UiDiffEventType::SelectedTrackChanged;
        event.value = safeIndex;
        pushUiDiffEvent(event);
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
        UiDiffEvent event;
        event.type = UiDiffEventType::CurrentPageChanged;
        event.value = safeIndex;
        event.extraValue = safeIndex;
        pushUiDiffEvent(event);
    }
}

void MiniLAB3StepSequencerAudioProcessor::setSongModeEnabledNative(bool isEnabled)
{
    isSongModeEnabled.store(isEnabled, std::memory_order_release);
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::setSongModeChainNative(int length, const juce::Array<int>& newChain)
{
    songModeChainLength.store(juce::jlimit(1, 32, length), std::memory_order_release);

    for (int i = 0; i < juce::jmin(32, newChain.size()); ++i)
    {
        songModeChain[i].store(juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, newChain[i]), std::memory_order_release);
    }
    markUiStateDirty();
}
