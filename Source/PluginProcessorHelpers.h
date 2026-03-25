#pragma once
#include <JuceHeader.h>

namespace MiniLAB3Seq {
    inline constexpr int kNumTracks = 16;
    inline constexpr int kNumSteps = 32;
    inline constexpr int kPadsPerPage = 8;
    inline constexpr int kNumPages = 4;
    inline constexpr int kNumPatterns = 10;

    inline constexpr const char* kNoteNames[12] = { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" };
    inline constexpr const char* kPatternLabels[kNumPatterns] = { "A", "B", "C", "D", "E", "F", "G", "H", "I", "J" };

    inline int parseMidiNoteName(const juce::String& noteName) {
        auto s = noteName.replace("\"", "").replace("'", "").trim().toUpperCase();
        if (s.isEmpty()) return 36;
        int octaveIndex = 0;
        while (octaveIndex < s.length() && !juce::CharacterFunctions::isDigit(s[octaveIndex]) && s[octaveIndex] != '-') ++octaveIndex;
        const auto namePart = s.substring(0, octaveIndex).trim();
        const auto octavePart = s.substring(octaveIndex).trim();
        int semitone = 0;
        for (int i = 0; i < 12; ++i) { if (namePart == kNoteNames[i]) { semitone = i; break; } }
        return juce::jlimit(0, 127, (octavePart.isEmpty() ? 2 : octavePart.getIntValue() + 1) * 12 + semitone);
    }

    inline juce::String midiNoteToName(int midiNote) {
        const int clamped = juce::jlimit(0, 127, midiNote);
        return juce::String(kNoteNames[clamped % 12]) + juce::String((clamped / 12) - 1);
    }

    inline juce::var makeEmptyPatternDataVar() {
        juce::DynamicObject::Ptr data = new juce::DynamicObject();
        juce::Array<juce::var> activeSteps, velocities, probabilities, gates, shifts, swings, repeats, pitches;
        juce::Array<juce::var> midiKeys, trackStates, randomAmounts;

        for (int t = 0; t < kNumTracks; ++t) {
            juce::Array<juce::var> aRow, vRow, pRow, gRow, shRow, swRow, rRow, piRow;
            for (int s = 0; s < kNumSteps; ++s) {
                aRow.add(false); vRow.add(100); pRow.add(100); gRow.add(75);
                shRow.add(50); swRow.add(0); rRow.add(1); piRow.add(0);
            }
            activeSteps.add(aRow); velocities.add(vRow); probabilities.add(pRow); gates.add(gRow);
            shifts.add(shRow); swings.add(swRow); repeats.add(rRow); pitches.add(piRow);
            midiKeys.add(midiNoteToName(36 + t));

            juce::DynamicObject::Ptr state = new juce::DynamicObject();
            state->setProperty("mute", false); state->setProperty("solo", false);
            state->setProperty("scale", 0); state->setProperty("length", 16); state->setProperty("timeDivision", 3);
            trackStates.add(juce::var(state.get()));

            juce::Array<juce::var> randArr; for (int i = 0; i < 6; i++) randArr.add(0.0f);
            randomAmounts.add(randArr);
        }

        data->setProperty("activeSteps", activeSteps); data->setProperty("velocities", velocities);
        data->setProperty("probabilities", probabilities); data->setProperty("gates", gates);
        data->setProperty("shifts", shifts); data->setProperty("swings", swings);
        data->setProperty("repeats", repeats); data->setProperty("pitches", pitches);
        data->setProperty("midiKeys", midiKeys); data->setProperty("trackStates", trackStates);
        data->setProperty("randomAmounts", randomAmounts);
        return juce::var(data.get());
    }
}