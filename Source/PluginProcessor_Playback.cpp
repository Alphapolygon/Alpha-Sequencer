#include "PluginProcessor.h"

namespace {
    struct EventComparator {
        bool operator()(const ScheduledMidiEvent& a, const ScheduledMidiEvent& b) const {
            return a.ppqTime > b.ppqTime;
        }
    };

    static constexpr double kGateSnaps[] = {
        0.0625, // 1/64
        0.125,  // 1/32
        0.25,   // 1/16
        0.5,    // 1/8
        1.0,    // 1/4
        2.0,    // 1/2
        3.0,    // Dot 1/2
        4.0     // 1 Bar
    };
}

void MiniLAB3StepSequencerAudioProcessor::prepareToPlay(double, int)
{
    global16thNote.store(-1, std::memory_order_release);
    lastProcessedStep = -1;
    queuedEventCount = 0;
    hwFifo.reset();

    playbackRandom.setSeed(0x31337);

    for (auto& event : eventQueue)
        event = {};

    droppedNotesCount.store(0, std::memory_order_release);
    droppedHWMsgs.store(0, std::memory_order_release);

    for (int i = 0; i < MiniLAB3Seq::kNumTracks; ++i) {
        lastNoteOnPerTrack[i] = -1;
        lastChannelOnPerTrack[i] = -1;
    }
}

void MiniLAB3StepSequencerAudioProcessor::scheduleMidiEvent(double ppqTime, const juce::MidiMessage& msg)
{
    if (queuedEventCount >= MaxMidiEvents)
    {
        droppedNotesCount.fetch_add(1, std::memory_order_relaxed);
        return;
    }

    eventQueue[queuedEventCount].ppqTime = ppqTime;
    eventQueue[queuedEventCount].message = msg;
    eventQueue[queuedEventCount].isActive = true;
    ++queuedEventCount;
    std::push_heap(eventQueue.begin(), eventQueue.begin() + queuedEventCount, EventComparator());
}

void MiniLAB3StepSequencerAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    const int numSamples = buffer.getNumSamples();
    juce::MidiBuffer incoming;
    incoming.swapWith(midiMessages);

    for (const auto metadata : incoming)
    {
        const auto msg = metadata.getMessage();

        bool isHardwareControl = false;
        if ((msg.isNoteOn() || msg.isNoteOff()) && msg.getNoteNumber() >= 36 && msg.getNoteNumber() <= 43)
            isHardwareControl = true;

        if (msg.isController())
        {
            const int cc = msg.getControllerNumber();
            if (cc == 1 || cc == 7 || cc == 11 || cc == 114 || cc == 115 || cc == 74 || cc == 71
                || cc == 76 || cc == 77 || cc == 93 || cc == 18 || cc == 19 || cc == 16)
            {
                isHardwareControl = true;
            }
        }

        if (isHardwareControl && msg.getRawDataSize() <= 3)
        {
            if (isHardwareOwner())
            {
                auto writeHandle = hwFifo.write(1);
                if (writeHandle.blockSize1 > 0) {
                    auto& qMsg = hwQueue[writeHandle.startIndex1];
                    qMsg.len = msg.getRawDataSize();
                    std::memcpy(qMsg.d, msg.getRawData(), qMsg.len);
                }
                else {
                    droppedHWMsgs.fetch_add(1, std::memory_order_relaxed);
                }
            }
        }
        else
        {
            midiMessages.addEvent(msg, metadata.samplePosition);
        }
    }

    buffer.clear();

    bool anySolo = false;
    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
    {
        if (soloParams[track]->load() > 0.5f)
        {
            anySolo = true;
            break;
        }
    }

    if (auto* playHead = getPlayHead())
    {
        if (auto position = playHead->getPosition())
        {
            const bool playing = position->getIsPlaying();
            isPlaying.store(playing, std::memory_order_release);

            if (playing)
            {
                const double ppqStart = position->getPpqPosition().orFallback(0.0);
                const double bpm = position->getBpm().orFallback(120.0);
                const double sampleRate = getSampleRate();
                const double ppqPerSample = bpm / (60.0 * juce::jmax(1.0, sampleRate));
                const double blockEndPpq = ppqStart + (numSamples * ppqPerSample);

                currentBpm.store(bpm, std::memory_order_release);

                if (ppqStart < (lastProcessedStep * 0.03125))
                {
                    lastProcessedStep = -1;
                    queuedEventCount = 0;
                    for (int t = 0; t < MiniLAB3Seq::kNumTracks; ++t) {
                        midiMessages.addEvent(juce::MidiMessage::allNotesOff(t + 1), 0);
                        currentSequenceIndex[t].store(0, std::memory_order_release);
                        lastNoteOnPerTrack[t] = -1;
                    }
                }

                const int pIdx = activePatternIndex.load(std::memory_order_acquire);
                const int firstTick = static_cast<int>(std::floor(ppqStart / 0.03125));
                const int lastTick = static_cast<int>(std::floor(blockEndPpq / 0.03125));

                for (int tick = firstTick; tick <= lastTick; ++tick)
                {
                    if (tick <= lastProcessedStep) continue;
                    lastProcessedStep = tick;
                    const double tickPpq = tick * 0.03125;

                    global16thNote.store(static_cast<int>(std::floor(tickPpq * 4.0)), std::memory_order_release);

                    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
                    {
                        const bool canPlay = anySolo ? (soloParams[track]->load() > 0.5f) : (muteParams[track]->load() < 0.5f);
                        if (!canPlay) continue;

                        static constexpr double kDivValues[] = { 2.0, 1.0, 0.5, 0.25, 0.125 };
                        const double stepLengthPpq = kDivValues[trackTimeDivisions[pIdx][track].load(std::memory_order_relaxed)];

                        if (std::fmod(tickPpq + 0.0001, stepLengthPpq) >= 0.03125) continue;

                        const int stepIndex = static_cast<int>(std::round(tickPpq / stepLengthPpq));
                        const int length = trackLengths[pIdx][track].load(std::memory_order_acquire);
                        const int wrappedStep = stepIndex % length;

                        const auto& stepData = getActiveTrack(pIdx, track)[wrappedStep];
                        if (!stepData.isActive || playbackRandom.nextFloat() >= stepData.probability) continue;

                        if (lastNoteOnPerTrack[track] != -1) {
                            scheduleMidiEvent(tickPpq, juce::MidiMessage::noteOff(lastChannelOnPerTrack[track], lastNoteOnPerTrack[track], 0.0f));
                        }

                        const int rootNote = static_cast<int>(std::round(noteParams[track]->load()));
                        const int scaleType = trackScales[track].load(std::memory_order_relaxed);
                        const int seqLen = trackSequenceLengths[track].load(std::memory_order_relaxed);
                        const int seqIdx = currentSequenceIndex[track].load(std::memory_order_relaxed) % seqLen;

                        int degree = trackPitchSequences[track][seqIdx].load(std::memory_order_relaxed);
                        int zeroBasedDegree = degree - 1;

                        const int scaleLen = MiniLAB3Seq::kScaleLengths[scaleType];
                        int octaveShift = (zeroBasedDegree >= 0) ? (zeroBasedDegree / scaleLen) : ((zeroBasedDegree - scaleLen + 1) / scaleLen);
                        int noteIndex = (zeroBasedDegree % scaleLen);
                        if (noteIndex < 0) noteIndex += scaleLen;

                        const int noteOffset = MiniLAB3Seq::kScaleOffsets[scaleType][noteIndex];
                        int note = juce::jlimit(0, 127, rootNote + noteOffset + (octaveShift * 12));

                        currentSequenceIndex[track].store((seqIdx + 1) % seqLen, std::memory_order_release);

                        int snapIdx = static_cast<int>(std::round(stepData.gate * 7.0f));
                        double noteDurationPpq = kGateSnaps[juce::jlimit(0, 7, snapIdx)];

                        const int channel = juce::jlimit(1, 16, trackMidiChannels[track].load(std::memory_order_relaxed));
                        const float velocity = juce::jlimit(0.0f, 1.0f, stepData.velocity * masterVolParam->load());

                        const int repeats = juce::jlimit(1, 4, stepData.repeats);
                        const float shift = stepData.shift;
                        const float stepSwing = juce::jlimit(0.0f, 1.0f, stepData.swing);

                        const double shiftPpq = (shift - 0.5f) * (stepLengthPpq / 2.0);
                        const double globalSwingPpqOffset = (stepIndex % 2 != 0) ? (swingParam->load() * (stepLengthPpq / 2.0)) : 0.0;
                        const double localSwingPpqOffset = (stepIndex % 2 != 0) ? (stepSwing * (stepLengthPpq / 2.0)) : 0.0;
                        const double nudgePpqOffset = nudgeParams[track]->load() * 0.001 * bpm / 60.0;
                        const double basePpq = tickPpq + shiftPpq + globalSwingPpqOffset + localSwingPpqOffset + nudgePpqOffset;
                        const double repeatIntervalPpq = stepLengthPpq / repeats;

                        for (int repeatIndex = 0; repeatIndex < repeats; ++repeatIndex)
                        {
                            const double onPpq = basePpq + (repeatIndex * repeatIntervalPpq);
                            const double offPpq = onPpq + (noteDurationPpq / repeats);

                            scheduleMidiEvent(onPpq, juce::MidiMessage::noteOn(channel, note, velocity));
                            scheduleMidiEvent(offPpq, juce::MidiMessage::noteOff(channel, note, 0.0f));
                        }

                        lastFiredVelocity[track][wrappedStep] = velocity;
                        lastNoteOnPerTrack[track] = note;
                        lastChannelOnPerTrack[track] = channel;
                    }
                }

                const double blockLengthPpq = juce::jmax(1.0e-9, blockEndPpq - ppqStart);

                while (queuedEventCount > 0)
                {
                    const auto& event = eventQueue.front();

                    if (event.ppqTime >= blockEndPpq)
                        break;

                    if (event.ppqTime >= ppqStart)
                    {
                        const double ratio = (event.ppqTime - ppqStart) / blockLengthPpq;
                        int sampleOffset = static_cast<int>(ratio * numSamples);
                        sampleOffset = juce::jlimit(0, juce::jmax(0, numSamples - 1), sampleOffset);
                        midiMessages.addEvent(event.message, sampleOffset);
                    }
                    else if (event.message.isNoteOff())
                    {
                        midiMessages.addEvent(event.message, 0);
                    }

                    std::pop_heap(eventQueue.begin(), eventQueue.begin() + queuedEventCount, EventComparator());
                    --queuedEventCount;
                }
            }
            else if (lastProcessedStep != -1)
            {
                global16thNote.store(-1, std::memory_order_release);
                lastProcessedStep = -1;
                queuedEventCount = 0;
                for (int channel = 1; channel <= MiniLAB3Seq::kNumTracks; ++channel)
                    midiMessages.addEvent(juce::MidiMessage::allNotesOff(channel), 0);
            }
        }
    }

    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
    {
        for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step)
            lastFiredVelocity[track][step] *= 0.85f;
    }
}