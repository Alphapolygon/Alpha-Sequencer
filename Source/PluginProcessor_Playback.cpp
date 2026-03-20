#include "PluginProcessor.h"

void MiniLAB3StepSequencerAudioProcessor::prepareToPlay(double, int)
{
    global16thNote.store(-1);
    lastProcessedStep = -1;

    for (auto& event : eventQueue)
        event.isActive = false;

    droppedNotesCount.store(0);
}

void MiniLAB3StepSequencerAudioProcessor::scheduleMidiEvent(double ppqTime, const juce::MidiMessage& msg)
{
    for (auto& event : eventQueue)
    {
        if (!event.isActive)
        {
            event.ppqTime = ppqTime;
            event.message = msg;
            event.isActive = true;
            return;
        }
    }

    // Safety overflow fallback to prevent memory blowout
    droppedNotesCount.fetch_add(1, std::memory_order_relaxed);
    DBG("WARNING: MIDI Event Queue Overflow! Note dropped.");
}

void MiniLAB3StepSequencerAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    const int numSamples = buffer.getNumSamples();
    juce::MidiBuffer incoming;
    incoming.swapWith(midiMessages);

    for (const auto metadata : incoming)
    {
        const auto msg = metadata.getMessage();
        handleMidiInput(msg, midiMessages);

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

        if (!isHardwareControl)
            midiMessages.addEvent(msg, metadata.samplePosition);
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
            isPlaying.store(playing);

            if (playing)
            {
                const double ppqStart = position->getPpqPosition().orFallback(0.0);
                const double bpm = position->getBpm().orFallback(120.0);
                const double sampleRate = getSampleRate();
                const double ppqPerSample = bpm / (60.0 * juce::jmax(1.0, sampleRate));
                const double blockEndPpq = ppqStart + (numSamples * ppqPerSample);

                currentBpm.store(bpm);

                if (ppqStart < (lastProcessedStep * 0.25))
                {
                    lastProcessedStep = static_cast<int>(std::floor(ppqStart * 4.0)) - 1;
                    for (auto& event : eventQueue)
                        event.isActive = false;
                    for (int channel = 1; channel <= MiniLAB3Seq::kNumTracks; ++channel)
                        midiMessages.addEvent(juce::MidiMessage::allNotesOff(channel), 0);
                }

                const int firstStep = static_cast<int>(std::floor(ppqStart * 4.0));
                const int lastStepInBlock = static_cast<int>(std::floor(blockEndPpq * 4.0));

                // Lock-Free state access
                const auto& readMatrix = getActiveMatrix();

                for (int step = firstStep; step <= lastStepInBlock; ++step)
                {
                    if (step <= lastProcessedStep)
                        continue;

                    lastProcessedStep = step;
                    global16thNote.store(step);

                    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
                    {
                        const bool canPlay = anySolo ? (soloParams[track]->load() > 0.5f)
                            : (muteParams[track]->load() < 0.5f);
                        if (!canPlay)
                            continue;

                        const int length = juce::jlimit(1, MiniLAB3Seq::kNumSteps, trackLengths[track]);
                        const int wrappedStep = step % length;

                        const auto& stepData = readMatrix[track][wrappedStep];
                        if (!stepData.isActive)
                            continue;

                        const float probability = stepData.probability;
                        if ((juce::Random::getSystemRandom().nextInt(100) / 100.0f) >= probability)
                            continue;

                        // Dynamic MIDI Channel routing
                        const int channel = juce::jlimit(1, 16, trackMidiChannels[track].load(std::memory_order_relaxed));
                        const int note = static_cast<int>(std::round(noteParams[track]->load()));

                        const float velocity = juce::jlimit(0.0f, 1.0f, stepData.velocity * masterVolParam->load());
                        const float gate = juce::jlimit(0.0f, 1.0f, stepData.gate);
                        const int repeats = juce::jlimit(1, 4, stepData.repeats);
                        const float shift = stepData.shift;
                        const float stepSwing = juce::jlimit(0.0f, 1.0f, stepData.swing);

                        constexpr double stepLengthPpq = 0.25;
                        const double shiftPpq = (shift - 0.5f) * (stepLengthPpq / 2.0);
                        const double globalSwingPpqOffset = (step % 2 != 0) ? (swingParam->load() * (stepLengthPpq / 2.0)) : 0.0;
                        const double localSwingPpqOffset = (step % 2 != 0) ? (stepSwing * (stepLengthPpq / 2.0)) : 0.0;
                        const double nudgePpqOffset = nudgeParams[track]->load() * 0.001 * bpm / 60.0;
                        const double basePpq = (step * stepLengthPpq) + shiftPpq + globalSwingPpqOffset + localSwingPpqOffset + nudgePpqOffset;
                        const double repeatIntervalPpq = stepLengthPpq / repeats;

                        for (int repeatIndex = 0; repeatIndex < repeats; ++repeatIndex)
                        {
                            const double onPpq = basePpq + (repeatIndex * repeatIntervalPpq);
                            const double offPpq = onPpq + (repeatIntervalPpq * gate);

                            scheduleMidiEvent(onPpq, juce::MidiMessage::noteOn(channel, note, velocity));
                            scheduleMidiEvent(offPpq, juce::MidiMessage::noteOff(channel, note, 0.0f));
                        }

                        lastFiredVelocity[track][wrappedStep] = velocity;
                    }
                }

                for (auto& event : eventQueue)
                {
                    if (!event.isActive)
                        continue;

                    if (event.ppqTime >= ppqStart && event.ppqTime < blockEndPpq)
                    {
                        const double ratio = (event.ppqTime - ppqStart) / (blockEndPpq - ppqStart);
                        int sampleOffset = static_cast<int>(ratio * numSamples);
                        sampleOffset = juce::jlimit(0, numSamples - 1, sampleOffset);
                        midiMessages.addEvent(event.message, sampleOffset);
                        event.isActive = false;
                    }
                    else if (event.ppqTime < ppqStart)
                    {
                        if (event.message.isNoteOff())
                            midiMessages.addEvent(event.message, 0);
                        event.isActive = false;
                    }
                }
            }
            else if (lastProcessedStep != -1)
            {
                global16thNote.store(-1);
                lastProcessedStep = -1;
                for (auto& event : eventQueue)
                    event.isActive = false;
                for (int channel = 1; channel <= MiniLAB3Seq::kNumTracks; ++channel)
                    midiMessages.addEvent(juce::MidiMessage::allNotesOff(channel), 0);
            }
        }
    }

    // Decay the UI velocity tracking (It's okay to do this lock-free here, it's just visual)
    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
    {
        for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step)
            lastFiredVelocity[track][step] *= 0.85f;
    }
}