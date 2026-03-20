#pragma once

#include <JuceHeader.h>

namespace MiniLAB3Seq
{
    inline constexpr int kNumTracks = 16;
    inline constexpr int kNumSteps = 32;
    inline constexpr int kPadsPerPage = 8;
    inline constexpr int kNumPages = 4;
    inline constexpr int kNumPatterns = 10;

    inline constexpr const char* kNoteNames[12] =
    {
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
    };

    inline constexpr const char* kPatternLabels[kNumPatterns] =
    {
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J"
    };

    inline int parseMidiNoteName(const juce::String& noteName)
    {
        auto s = noteName.replace("\"", "").replace("'", "").trim().toUpperCase();
        if (s.isEmpty()) return 36;

        int octaveIndex = 0;
        while (octaveIndex < s.length() && !juce::CharacterFunctions::isDigit(s[octaveIndex]) && s[octaveIndex] != '-')
            ++octaveIndex;

        const auto namePart = s.substring(0, octaveIndex).trim();
        const auto octavePart = s.substring(octaveIndex).trim();

        int semitone = 0;
        for (int i = 0; i < 12; ++i)
        {
            if (namePart == kNoteNames[i])
            {
                semitone = i;
                break;
            }
        }

        const int octave = octavePart.isEmpty() ? 2 : octavePart.getIntValue();
        return juce::jlimit(0, 127, (octave + 1) * 12 + semitone);
    }

    inline juce::String midiNoteToName(int midiNote)
    {
        const int clamped = juce::jlimit(0, 127, midiNote);
        const int semitone = clamped % 12;
        const int octave = (clamped / 12) - 1;
        return juce::String(kNoteNames[semitone]) + juce::String(octave);
    }

    inline juce::var makeEmptyPatternDataVar()
    {
        juce::DynamicObject::Ptr data = new juce::DynamicObject();
        juce::Array<juce::var> activeSteps, velocities, probabilities, gates, shifts, swings, repeats;
        juce::Array<juce::var> midiKeys, trackStates;

        for (int t = 0; t < kNumTracks; ++t)
        {
            juce::Array<juce::var> activeRow, velocityRow, probabilityRow, gateRow, shiftRow, swingRow, repeatRow;

            for (int s = 0; s < kNumSteps; ++s)
            {
                activeRow.add(false);
                velocityRow.add(100);
                probabilityRow.add(100);
                gateRow.add(75);
                shiftRow.add(50);
                swingRow.add(0);
                repeatRow.add(1);
            }

            activeSteps.add(activeRow);
            velocities.add(velocityRow);
            probabilities.add(probabilityRow);
            gates.add(gateRow);
            shifts.add(shiftRow);
            swings.add(swingRow);
            repeats.add(repeatRow);
            midiKeys.add(midiNoteToName(36 + t));

            juce::DynamicObject::Ptr state = new juce::DynamicObject();
            state->setProperty("mute", false);
            state->setProperty("solo", false);
            trackStates.add(juce::var(state.get()));
        }

        data->setProperty("activeSteps", activeSteps);
        data->setProperty("velocities", velocities);
        data->setProperty("probabilities", probabilities);
        data->setProperty("gates", gates);
        data->setProperty("shifts", shifts);
        data->setProperty("swings", swings);
        data->setProperty("repeats", repeats);
        data->setProperty("midiKeys", midiKeys);
        data->setProperty("trackStates", trackStates);
        return juce::var(data.get());
    }

} // namespace MiniLAB3Seq