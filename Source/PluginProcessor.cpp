#include "PluginProcessor.h"
#include "PluginEditor.h"

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
        layout.add(std::make_unique<juce::AudioParameterFloat>("nudge_" + trackLabel,
            "Micro-Timing",
            juce::NormalisableRange<float>(-10.0f, 10.0f, 0.1f), 
            0.0f));
    }

    return layout;
}

MiniLAB3StepSequencerAudioProcessor::MiniLAB3StepSequencerAudioProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true))
    , apvts(*this, nullptr, "PARAMETERS", createParameterLayout())
    , playbackRandom(0x31337)
{
    masterVolParam = apvts.getRawParameterValue("master_vol");
    swingParam = apvts.getRawParameterValue("swing");

    for (int i = 0; i < MiniLAB3Seq::kNumPatterns; ++i)
        patternUUIDs[i] = juce::Uuid().toString();

    modifySequencerState([this](MatrixSnapshot& writeMatrix) {
        for (int pattern = 0; pattern < MiniLAB3Seq::kNumPatterns; ++pattern)
        {
            for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
            {
                if (pattern == 0)
                {
                    instrumentNames[track] = juce::String(track + 1);
                    trackMidiChannels[track].store(1, std::memory_order_relaxed);
                    muteParams[track] = apvts.getRawParameterValue("mute_" + juce::String(track + 1));
                    soloParams[track] = apvts.getRawParameterValue("solo_" + juce::String(track + 1));
                    noteParams[track] = apvts.getRawParameterValue("note_" + juce::String(track + 1));
                    nudgeParams[track] = apvts.getRawParameterValue("nudge_" + juce::String(track + 1));
                    trackScales[track].store(0, std::memory_order_relaxed);
                }

                for (int randomIndex = 0; randomIndex < 6; ++randomIndex)
                    trackRandomAmounts[pattern][track][randomIndex].store(0.0f, std::memory_order_relaxed);

                trackLengths[pattern][track].store(16, std::memory_order_relaxed);
                trackTimeDivisions[pattern][track].store(3, std::memory_order_relaxed);

                for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step)
                    writeMatrix[pattern][track][step] = { false, 0.8f, 1.0f, 0.75f, 1, 0.5f, 0.0f, 0 };
            }
        }
    });

    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
    {
        lastNoteOnPerTrack[track] = -1;
        lastChannelOnPerTrack[track] = -1;
    }

    markUiStateDirty();
    requestLedRefresh();
    startTimerHz(60);
    initialising.store(false, std::memory_order_release);
}

MiniLAB3StepSequencerAudioProcessor::~MiniLAB3StepSequencerAudioProcessor()
{
    stopTimer();

    if (isHardwareOwner())
    {
        resetHardwareState();
        hardwareManager->owner.store(nullptr, std::memory_order_release);
    }
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

void MiniLAB3StepSequencerAudioProcessor::setTrackScaleNative(int tIdx, int scaleType)
{
    trackScales[tIdx].store(juce::jlimit(0, 7, scaleType), std::memory_order_release);
    markUiStateDirty();
}

void MiniLAB3StepSequencerAudioProcessor::releaseResources() {}

bool MiniLAB3StepSequencerAudioProcessor::isBusesLayoutSupported(const juce::AudioProcessor::BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

juce::AudioProcessorEditor* MiniLAB3StepSequencerAudioProcessor::createEditor()
{
    return new MiniLAB3StepSequencerAudioProcessorEditor(*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MiniLAB3StepSequencerAudioProcessor();
}
