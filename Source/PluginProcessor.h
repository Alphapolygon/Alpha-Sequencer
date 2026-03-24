#pragma once

#include <JuceHeader.h>
#include <array>
#include <atomic>
#include <vector>
#include <algorithm>
#include <cstring>

#include "PluginProcessorTypes.h"
#include "PluginProcessorHelpers.h"

struct HardwareMsg { uint8_t d[3]; int len; };
class MiniLAB3StepSequencerAudioProcessor;

struct HardwareManager {
    std::shared_ptr<juce::MidiOutput> output;
    std::shared_ptr<ControllerProfile> profile;
    juce::SpinLock lock;
    std::atomic<MiniLAB3StepSequencerAudioProcessor*> owner{ nullptr };
};

class MiniLAB3StepSequencerAudioProcessor : public juce::AudioProcessor, public juce::Timer
{
public:
    MiniLAB3StepSequencerAudioProcessor();
    ~MiniLAB3StepSequencerAudioProcessor() override;

    int getGeneralMidiNote(int trackIndex);
    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const juce::AudioProcessor::BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return "MiniLAB3Seq"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return true; }
    bool isMidiEffect() const override { return true; }
    double getTailLengthSeconds() const override { return 0.0; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    void openHardwareOutput();
    void resetHardwareState();
    void claimHardwareOwnership();
    bool isHardwareOwner() const;
    bool isHardwareConnected() const { return hardwareManager->output != nullptr; }
    void requestLedRefresh();
    void timerCallback() override;

    static constexpr float minMicroTimingMs = -20.0f;
    static constexpr float maxMicroTimingMs = 20.0f;

    juce::AudioProcessorValueTreeState apvts;
    juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    std::atomic<float>* masterVolParam = nullptr;
    std::atomic<float>* swingParam = nullptr;
    std::atomic<float>* muteParams[MiniLAB3Seq::kNumTracks] = {};
    std::atomic<float>* soloParams[MiniLAB3Seq::kNumTracks] = {};
    std::atomic<float>* noteParams[MiniLAB3Seq::kNumTracks] = {};
    std::atomic<float>* nudgeParams[MiniLAB3Seq::kNumTracks] = {};
    std::atomic<bool> initialising{ true };

    using TrackSnapshot = StepData[MiniLAB3Seq::kNumSteps];
    using PatternSnapshot = TrackSnapshot[MiniLAB3Seq::kNumTracks];
    using MatrixSnapshot = PatternSnapshot[MiniLAB3Seq::kNumPatterns];

    void modifyTrackState(int patternIndex, int trackIndex, const std::function<void(TrackSnapshot&)>& modifier);
    void modifyPatternState(int patternIndex, const std::function<void(PatternSnapshot&)>& modifier);
    void modifySequencerState(const std::function<void(MatrixSnapshot&)>& modifier);
    const TrackSnapshot& getActiveTrack(int patternIndex, int trackIndex) const;
    void copyActivePattern(int patternIndex, PatternSnapshot& dest) const;
    void buildActiveMatrixSnapshot(MatrixSnapshot& dest) const;

    void setStepActiveNative(int pIdx, int tIdx, int sIdx, bool isActive, bool emitUiDiff = false);
    void setStepParameterNative(int pIdx, int tIdx, int sIdx, const juce::String& paramName, float value, bool emitUiDiff = false);
    void setTrackStateNative(int tIdx, const juce::String& stateName, bool isEnabled, bool emitUiDiff = false);
    void setTrackMidiKeyNative(int tIdx, int midiNote, bool emitUiDiff = false);
    void setTrackMidiChannelNative(int tIdx, int channel, bool emitUiDiff = false);

    void setTrackScaleNative(int tIdx, int scaleType, bool emitUiDiff = false);
    void setTrackSequenceNative(int tIdx, const juce::String& seqString, bool emitUiDiff = false);
    void appendNoteToTrackSequenceNative(int tIdx, int midiNote);

    // NEW: Polymeter Endpoint
    void setTrackLengthNative(int pIdx, int tIdx, int length, bool emitUiDiff = false);

    void randomizeTrackNative(int pIdx, int tIdx);
    void randomizeParameterNative(int pIdx, int tIdx, const juce::String& paramName);

    void clearTrackNative(int pIdx, int tIdx, bool emitUiDiff = false);
    void clearPageNative(int pIdx, int tIdx, int pageIdx, bool emitUiDiff = false);

    void setActivePatternNative(int pIdx, bool emitUiDiff = false);
    void setSelectedTrackNative(int tIdx, bool emitUiDiff = false);
    void setCurrentPageNative(int pageIdx, bool emitUiDiff = false);

    void pushUiDiffEvent(const UiDiffEvent& event) noexcept;
    bool popUiDiffEvent(UiDiffEvent& event) noexcept;

    std::atomic<int> trackMidiChannels[MiniLAB3Seq::kNumTracks];
    float lastFiredVelocity[MiniLAB3Seq::kNumTracks][MiniLAB3Seq::kNumSteps];
    std::atomic<int> trackLengths[MiniLAB3Seq::kNumPatterns][MiniLAB3Seq::kNumTracks] = {};
    juce::String instrumentNames[MiniLAB3Seq::kNumTracks];

    std::atomic<int> trackScales[MiniLAB3Seq::kNumTracks];
    std::atomic<int> trackSequenceLengths[MiniLAB3Seq::kNumTracks];
    std::atomic<int> trackPitchSequences[MiniLAB3Seq::kNumTracks][MiniLAB3Seq::kMaxSequenceLength];
    std::atomic<int> currentSequenceIndex[MiniLAB3Seq::kNumTracks];

    juce::String patternUUIDs[MiniLAB3Seq::kNumPatterns];

    std::atomic<int> currentInstrument{ 0 };
    std::atomic<int> currentPage{ 0 };
    std::atomic<int> activeSection{ -1 };
    std::atomic<int> global16thNote{ -1 };
    std::atomic<int> activePatternIndex{ 0 };

    std::atomic<int> themeIndex{ 0 };
    std::atomic<int> footerTabIndex{ 0 };
    std::atomic<float> uiScale{ 1.0f };

    std::atomic<double> currentBpm{ 120.0 };
    std::atomic<bool> isPlaying{ false };
    std::atomic<uint32_t> uiStateVersion{ 1 };

    void setStepDataFromVar(const juce::var& stateVar);
    void updateUiMetadataFromVar(const juce::var& stateVar);

    juce::var buildPatternDataVar(int patternIndex) const;
    juce::var buildCurrentPatternStateVar() const;
    juce::var buildFullUiStateVarForEditor() const;

    uint32_t getUiStateVersion() const noexcept { return uiStateVersion.load(); }
    void requestUiStateBroadcast() noexcept { markUiStateDirty(); }
    void markUiStateDirty() noexcept;

    std::atomic<int> droppedNotesCount{ 0 };
    std::atomic<int> droppedHWMsgs{ 0 };
    std::atomic<int> droppedUiDiffs{ 0 };

private:
    mutable juce::CriticalSection writerLock;
    std::atomic<uint8_t> activeTrackBufferIndex[MiniLAB3Seq::kNumPatterns][MiniLAB3Seq::kNumTracks]{};
    StepData sequencerTrackBuffers[2][MiniLAB3Seq::kNumPatterns][MiniLAB3Seq::kNumTracks][MiniLAB3Seq::kNumSteps]{};
    juce::SharedResourcePointer<HardwareManager> hardwareManager;

    std::atomic<bool> isAttemptingConnection{ false };
    std::atomic<int> ledRefreshCountdown{ 0 };
    std::atomic<float> pendingMasterVolNormalized{ -1.0f };
    std::atomic<float> pendingSwingNormalized{ -1.0f };

    int lastProcessedStep = -1;
    static constexpr size_t MaxMidiEvents = 8192;
    std::array<ScheduledMidiEvent, MaxMidiEvents> eventQueue{};
    size_t queuedEventCount = 0;

    static constexpr int MaxUiDiffEvents = 2048;
    juce::AbstractFifo uiDiffFifo{ MaxUiDiffEvents };
    std::array<UiDiffEvent, MaxUiDiffEvents> uiDiffQueue{};

    juce::AbstractFifo hwFifo{ 4096 };
    std::array<HardwareMsg, 4096> hwQueue{};

    juce::Random playbackRandom;

    void scheduleMidiEvent(double ppqTime, const juce::MidiMessage& msg);
    void handleMidiInput(const juce::MidiMessage& msg, juce::MidiBuffer& midiMessages);
    void updateHardwareLEDs(bool forceOverwrite);
    void setParameterFromPlainValue(const juce::String& parameterId, float plainValue);
    void applyPendingParameterUpdates();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MiniLAB3StepSequencerAudioProcessor)
};