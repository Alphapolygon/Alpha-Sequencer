#include "PluginProcessor.h"

namespace {
    struct EventComparator {
        bool operator()(const ScheduledMidiEvent& a, const ScheduledMidiEvent& b) const {
            if (std::abs(a.ppqTime - b.ppqTime) < 1.0e-8) {
                int priorityA = a.message.isNoteOff() ? 0 : 1;
                int priorityB = b.message.isNoteOff() ? 0 : 1;
                if (priorityA != priorityB) return priorityA > priorityB;
            }
            return a.ppqTime > b.ppqTime;
        }
    };
    static constexpr double kGateSnaps[] = { 0.0625, 0.125, 0.25, 0.5, 1.0, 2.0, 3.0, 4.0 };
}

void MiniLAB3StepSequencerAudioProcessor::prepareToPlay(double, int) {
    global16thNote.store(-1, std::memory_order_release);
    lastProcessedStep = -1;
    queuedEventCount = 0;
    hwFifo.reset();
    playbackRandom.setSeed(0x31337);
    for (auto& event : eventQueue) event = {};
    for (int i = 0; i < MiniLAB3Seq::kNumTracks; ++i) {
        lastNoteOnPerTrack[i] = -1;
        lastChannelOnPerTrack[i] = -1;
    }
}

void MiniLAB3StepSequencerAudioProcessor::scheduleMidiEvent(double ppqTime, const juce::MidiMessage& msg) {
    if (queuedEventCount >= MaxMidiEvents) return;
    eventQueue[queuedEventCount] = { ppqTime, msg, true };
    ++queuedEventCount;
    std::push_heap(eventQueue.begin(), eventQueue.begin() + queuedEventCount, EventComparator());
}

void MiniLAB3StepSequencerAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) {
    const int numSamples = buffer.getNumSamples();
    juce::MidiBuffer incoming;
    incoming.swapWith(midiMessages);

    std::shared_ptr<MidiControllerProfile> activeProfile;
    {
        const juce::SpinLock::ScopedLockType lock(hardwareManager->lock);
        activeProfile = hardwareManager->profile;
    }

    for (const auto metadata : incoming) {
        const auto msg = metadata.getMessage();
        const bool isHardwareControl = isHardwareOwner()
            && activeProfile != nullptr
            && activeProfile->claimsIncomingMessage(msg);

        if (isHardwareControl && msg.getRawDataSize() <= 3) {
            auto writeHandle = hwFifo.write(1);
            if (writeHandle.blockSize1 > 0) {
                auto& qMsg = hwQueue[writeHandle.startIndex1];
                qMsg.len = msg.getRawDataSize();
                std::memcpy(qMsg.d, msg.getRawData(), qMsg.len);
            }
        } else {
            midiMessages.addEvent(msg, metadata.samplePosition);
        }
    }

    buffer.clear();

    bool anySolo = false;
    for (int t = 0; t < MiniLAB3Seq::kNumTracks; ++t) {
        if (soloParams[t]->load() > 0.5f) {
            anySolo = true;
            break;
        }
    }

    if (auto* playHead = getPlayHead()) {
        if (auto position = playHead->getPosition()) {
            const bool playing = position->getIsPlaying();
            isPlaying.store(playing, std::memory_order_release);

            if (playing) {
                const double ppqStart = position->getPpqPosition().orFallback(0.0);
                const double bpm = position->getBpm().orFallback(120.0);
                currentBpm.store(bpm, std::memory_order_release);
                const double blockEndPpq = ppqStart + (numSamples * (bpm / (60.0 * getSampleRate())));

                if (ppqStart < (lastProcessedStep * 0.03125)) {
                    lastProcessedStep = -1;
                    queuedEventCount = 0;
                    for (int t = 0; t < MiniLAB3Seq::kNumTracks; ++t) {
                        midiMessages.addEvent(juce::MidiMessage::allNotesOff(t + 1), 0);
                        lastNoteOnPerTrack[t] = -1;
                    }
                }

                const int pIdx = activePatternIndex.load(std::memory_order_acquire);
                const int firstTick = static_cast<int>(std::floor(ppqStart / 0.03125));
                const int lastTick = static_cast<int>(std::floor(blockEndPpq / 0.03125));

                for (int tick = firstTick; tick <= lastTick; ++tick) {
                    if (tick <= lastProcessedStep) continue;
                    lastProcessedStep = tick;
                    const double tickPpq = tick * 0.03125;
                    global16thNote.store(static_cast<int>(std::floor(tickPpq * 4.0)), std::memory_order_release);

                    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track) {
                        if (anySolo ? (soloParams[track]->load() <= 0.5f) : (muteParams[track]->load() > 0.5f)) continue;

                        static constexpr double kDivValues[] = { 2.0, 1.0, 0.5, 0.25, 0.125 };
                        const double stepLengthPpq = kDivValues[trackTimeDivisions[pIdx][track].load(std::memory_order_relaxed)];
                        if (std::fmod(tickPpq + 0.0001, stepLengthPpq) >= 0.03125) continue;

                        const int stepIndex = static_cast<int>(std::round(tickPpq / stepLengthPpq));
                        const int wrappedStep = stepIndex % trackLengths[pIdx][track].load(std::memory_order_acquire);
                        const auto& stepData = getActiveTrack(pIdx, track)[wrappedStep];

                        float vJitter = MelodicEngine::applyJitter(stepData.velocity, trackRandomAmounts[pIdx][track][0].load(), playbackRandom);
                        float gJitter = MelodicEngine::applyJitter(stepData.gate, trackRandomAmounts[pIdx][track][1].load(), playbackRandom);
                        float pJitter = MelodicEngine::applyJitter(stepData.probability, trackRandomAmounts[pIdx][track][2].load(), playbackRandom);
                        float shJitter = MelodicEngine::applyJitter(stepData.shift, trackRandomAmounts[pIdx][track][3].load(), playbackRandom);
                        float swJitter = MelodicEngine::applyJitter(stepData.swing, trackRandomAmounts[pIdx][track][4].load(), playbackRandom);
                        int piJitter = MelodicEngine::applyPitchJitter(stepData.pitch, trackRandomAmounts[pIdx][track][5].load(), playbackRandom);

                        if (!stepData.isActive || playbackRandom.nextFloat() >= pJitter) continue;

                        if (lastNoteOnPerTrack[track] != -1)
                            scheduleMidiEvent(tickPpq, juce::MidiMessage::noteOff(lastChannelOnPerTrack[track], lastNoteOnPerTrack[track], 0.0f));

                        const int rootNote = static_cast<int>(std::round(noteParams[track]->load()));
                        int note = MelodicEngine::getQuantizedMidiNote(rootNote, piJitter, trackScales[track].load(std::memory_order_relaxed));

                        int snapIdx = static_cast<int>(std::round(gJitter * 7.0f));
                        double noteDurationPpq = kGateSnaps[juce::jlimit(0, 7, snapIdx)];

                        const int channel = juce::jlimit(1, 16, trackMidiChannels[track].load(std::memory_order_relaxed));
                        const float velocity = juce::jlimit(0.0f, 1.0f, vJitter * masterVolParam->load());

                        const int repeats = juce::jlimit(1, 4, stepData.repeats);
                        const double shiftPpq = (shJitter - 0.5f) * (stepLengthPpq / 2.0);
                        const double globalSwingPpqOffset = (stepIndex % 2 != 0) ? (swingParam->load() * (stepLengthPpq / 2.0)) : 0.0;
                        const double localSwingPpqOffset = (stepIndex % 2 != 0) ? (swJitter * (stepLengthPpq / 2.0)) : 0.0;
                        const double basePpq = tickPpq + shiftPpq + globalSwingPpqOffset + localSwingPpqOffset + (nudgeParams[track]->load() * 0.001 * bpm / 60.0);

                        for (int r = 0; r < repeats; ++r) {
                            const double onPpq = basePpq + (r * (stepLengthPpq / repeats));
                            scheduleMidiEvent(onPpq, juce::MidiMessage::noteOn(channel, note, velocity));
                            scheduleMidiEvent(onPpq + (noteDurationPpq / repeats), juce::MidiMessage::noteOff(channel, note, 0.0f));
                        }

                        lastNoteOnPerTrack[track] = note;
                        lastChannelOnPerTrack[track] = channel;
                    }
                }

                const double blockLengthPpq = juce::jmax(1.0e-9, blockEndPpq - ppqStart);
                while (queuedEventCount > 0) {
                    const auto& event = eventQueue.front();
                    if (event.ppqTime >= blockEndPpq) break;
                    if (event.ppqTime >= ppqStart) {
                        int sampleOffset = static_cast<int>(((event.ppqTime - ppqStart) / blockLengthPpq) * numSamples);
                        midiMessages.addEvent(event.message, juce::jlimit(0, juce::jmax(0, numSamples - 1), sampleOffset));
                    } else if (event.message.isNoteOff()) {
                        midiMessages.addEvent(event.message, 0);
                    }
                    std::pop_heap(eventQueue.begin(), eventQueue.begin() + queuedEventCount, EventComparator());
                    --queuedEventCount;
                }
            } else if (lastProcessedStep != -1) {
                global16thNote.store(-1, std::memory_order_release);
                lastProcessedStep = -1;
                queuedEventCount = 0;
                for (int channel = 1; channel <= MiniLAB3Seq::kNumTracks; ++channel)
                    midiMessages.addEvent(juce::MidiMessage::allNotesOff(channel), 0);
            }
        }
    }
}
