#pragma once

#include <JuceHeader.h>
#include <atomic>
#include <functional>

class MiniLAB3StepSequencerAudioProcessor;

juce::WebBrowserComponent::Options makeEditorBrowserOptions(
    MiniLAB3StepSequencerAudioProcessor& processor,
    std::atomic<bool>& isUiConnected,
    std::function<void(double)> onScaleChanged);

class EditorUiBridge {
public:
    EditorUiBridge(MiniLAB3StepSequencerAudioProcessor& processor,
                   juce::WebBrowserComponent& browser);

    void pushPlaybackStateIfChanged();
    void pushUiDiffEvents();

private:
    MiniLAB3StepSequencerAudioProcessor& audioProcessor;
    juce::WebBrowserComponent& webComponent;

    double lastBpm = 0.0;
    bool lastIsPlaying = false;
    int lastStep = -1;
    int lastDroppedNotes = -1;
    int lastDroppedHardwareMessages = -1;
};
