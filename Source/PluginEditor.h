#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"
#include "EditorUiBridge.h"

class MiniLAB3StepSequencerAudioProcessorEditor : public juce::AudioProcessorEditor,
                                                 public juce::Timer
{
public:
    explicit MiniLAB3StepSequencerAudioProcessorEditor(MiniLAB3StepSequencerAudioProcessor&);
    ~MiniLAB3StepSequencerAudioProcessorEditor() override;

    void paint(juce::Graphics&) override {}
    void resized() override;
    void timerCallback() override;

private:
    void applyUiScale(double scale);

    MiniLAB3StepSequencerAudioProcessor& audioProcessor;
    std::atomic<bool> isUiConnected { false };
    juce::WebBrowserComponent webComponent;
    EditorUiBridge uiBridge;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MiniLAB3StepSequencerAudioProcessorEditor)
};
