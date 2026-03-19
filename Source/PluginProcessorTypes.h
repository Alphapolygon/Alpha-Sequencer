#pragma once

#include <JuceHeader.h>

struct ScheduledMidiEvent
{
    double ppqTime = 0.0;
    juce::MidiMessage message;
    bool isActive = false;
};

struct StepData
{
    bool isActive = false;
    float velocity = 0.8f;
    float probability = 1.0f;
    float gate = 0.75f;
    int repeats = 1;
    float shift = 0.5f;
    float swing = 0.0f;
};

struct PadColor
{
    uint8_t r = 0;
    uint8_t g = 0;
    uint8_t b = 0;

    bool operator!=(const PadColor& other) const
    {
        return r != other.r || g != other.g || b != other.b;
    }
};
