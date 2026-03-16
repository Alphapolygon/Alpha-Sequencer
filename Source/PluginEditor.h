#pragma once
#include <JuceHeader.h>
#include "PluginProcessor.h"

class MiniLAB3StepSequencerAudioProcessorEditor : public juce::AudioProcessorEditor, public juce::Timer
{
public:
    MiniLAB3StepSequencerAudioProcessorEditor(MiniLAB3StepSequencerAudioProcessor&);
    ~MiniLAB3StepSequencerAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;
    void timerCallback() override;
    void mouseDown(const juce::MouseEvent& e) override;

private:
    MiniLAB3StepSequencerAudioProcessor& audioProcessor;
    float pageFlashAlpha = 0.0f;

    // Bitmap Assets for the Grid
    juce::Image inactiveBgA; // For steps 1-8, 17-24
    juce::Image inactiveBgB; // For steps 9-16, 25-32
    juce::Image activeKeys[16]; // Unique active colors for each of the 16 tracks
    juce::Image backgroundImage;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MiniLAB3StepSequencerAudioProcessorEditor)
};