#include "PluginEditor.h"

MiniLAB3StepSequencerAudioProcessorEditor::MiniLAB3StepSequencerAudioProcessorEditor(
    MiniLAB3StepSequencerAudioProcessor& processor)
    : AudioProcessorEditor(&processor)
    , audioProcessor(processor)
    , webComponent(makeEditorBrowserOptions(audioProcessor,
                                            isUiConnected,
                                            [this](double scale) { applyUiScale(scale); }))
    , uiBridge(audioProcessor, webComponent)
{
    addAndMakeVisible(webComponent);
    setResizable(true, true);

    if (auto* constrainer = getConstrainer())
        constrainer->setFixedAspectRatio(1460.0 / 1024.0);

    setResizeLimits(730, 512, 2920, 2048);
    applyUiScale(audioProcessor.uiScale.load(std::memory_order_acquire));

   #if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
    juce::String rootUrl = webComponent.getResourceProviderRoot();
    if (!rootUrl.endsWithChar('/'))
        rootUrl += "/";
    webComponent.goToURL(rootUrl + "index.html");
   #else
    webComponent.goToURL("about:blank");
   #endif

    startTimerHz(30);
}

MiniLAB3StepSequencerAudioProcessorEditor::~MiniLAB3StepSequencerAudioProcessorEditor()
{
    stopTimer();
}

void MiniLAB3StepSequencerAudioProcessorEditor::resized()
{
    webComponent.setBounds(getLocalBounds());
}

void MiniLAB3StepSequencerAudioProcessorEditor::timerCallback()
{
    if (!isUiConnected.load(std::memory_order_acquire))
        return;

    if (auto* peer = getPeer())
    {
        if (peer->isFocused())
            audioProcessor.claimHardwareOwnership();
    }

    uiBridge.pushPlaybackStateIfChanged();
    uiBridge.pushUiDiffEvents();
}

void MiniLAB3StepSequencerAudioProcessorEditor::applyUiScale(double scale)
{
    setSize(static_cast<int>(1460.0 * scale), static_cast<int>(1024.0 * scale));
}
