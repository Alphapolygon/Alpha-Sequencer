#include "PluginProcessor.h"
#include <cstring>

void MiniLAB3StepSequencerAudioProcessor::modifyTrackState(int patternIndex,
                                                           int trackIndex,
                                                           const std::function<void(TrackSnapshot&)>& modifier)
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

void MiniLAB3StepSequencerAudioProcessor::modifyPatternState(int patternIndex,
                                                             const std::function<void(PatternSnapshot&)>& modifier)
{
    const int safePattern = juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, patternIndex);
    PatternSnapshot staged{};

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

void MiniLAB3StepSequencerAudioProcessor::modifySequencerState(const std::function<void(MatrixSnapshot&)>& modifier)
{
    MatrixSnapshot staged{};

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

const MiniLAB3StepSequencerAudioProcessor::TrackSnapshot& MiniLAB3StepSequencerAudioProcessor::getActiveTrack(int patternIndex,
                                                                                                              int trackIndex) const
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
