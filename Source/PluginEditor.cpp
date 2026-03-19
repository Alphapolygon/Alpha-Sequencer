#include "PluginEditor.h"
#include <vector>

MiniLAB3StepSequencerAudioProcessorEditor::MiniLAB3StepSequencerAudioProcessorEditor(MiniLAB3StepSequencerAudioProcessor& processor)
    : AudioProcessorEditor(&processor),
      audioProcessor(processor),
      webComponent(createWebViewOptions(processor))
{
    addAndMakeVisible(webComponent);
    setSize(1460, 1024);
    initialiseBrowser();
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

juce::WebBrowserComponent::Options MiniLAB3StepSequencerAudioProcessorEditor::createWebViewOptions(
    MiniLAB3StepSequencerAudioProcessor& processor)
{
    auto options = juce::WebBrowserComponent::Options{}
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withWinWebView2Options(
            juce::WebBrowserComponent::Options::WinWebView2{}
                .withUserDataFolder(
                    juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
                        .getChildFile("MiniLAB3Sequencer")
                        .getChildFile("WebView2Cache")))
        .withNativeFunction(
            "updateCPlusPlusState",
            [&processor](const auto& args, auto completion)
            {
                if (!args.isEmpty())
                    processor.setStepDataFromVar(args[0]);
                completion(juce::var());
            })
        .withNativeFunction(
            "saveFullUiState",
            [&processor](const auto& args, auto completion)
            {
                if (!args.isEmpty())
                    processor.fullUiStateJson = juce::JSON::toString(args[0]);
                completion(juce::var());
            })
        .withNativeFunction(
            "requestInitialState",
            [&processor](const auto&, auto completion)
            {
                completion(juce::var(processor.buildFullUiStateJsonForEditor()));
            });

#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
    options = options.withResourceProvider(
        [](const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource>
        {
            if (url.isEmpty() || url == "/" || url.contains("index.html"))
            {
                const auto* data = reinterpret_cast<const std::byte*>(BinaryData::index_html);
                std::vector<std::byte> htmlVector(data, data + BinaryData::index_htmlSize);
                return juce::WebBrowserComponent::Resource{ std::move(htmlVector), juce::String("text/html") };
            }
            return std::nullopt;
        });
#endif

    return options;
}

void MiniLAB3StepSequencerAudioProcessorEditor::initialiseBrowser()
{
#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
    auto rootUrl = webComponent.getResourceProviderRoot();
    if (!rootUrl.endsWithChar('/'))
        rootUrl += "/";
    webComponent.goToURL(rootUrl + "index.html");
#else
    webComponent.goToURL("about:blank");
#endif
}

void MiniLAB3StepSequencerAudioProcessorEditor::timerCallback()
{
    pushPlaybackStateIfChanged();
    pushEngineStateIfChanged();
}

void MiniLAB3StepSequencerAudioProcessorEditor::pushPlaybackStateIfChanged()
{
    const double currentBpm = audioProcessor.currentBpm.load();
    const bool playing = audioProcessor.isPlaying.load();
    const int absoluteStep = audioProcessor.global16thNote.load();
    const int currentGridStep = (absoluteStep >= 0) ? (absoluteStep % MiniLAB3Seq::kNumSteps) : -1;

    if (currentBpm == lastBpm && playing == lastIsPlaying && currentGridStep == lastStep)
        return;

    lastBpm = currentBpm;
    lastIsPlaying = playing;
    lastStep = currentGridStep;

    juce::DynamicObject::Ptr state = new juce::DynamicObject();
    state->setProperty("bpm", currentBpm);
    state->setProperty("isPlaying", playing);
    state->setProperty("currentStep", currentGridStep);
    webComponent.emitEventIfBrowserIsVisible("playbackState", juce::var(state.get()));
}

void MiniLAB3StepSequencerAudioProcessorEditor::pushEngineStateIfChanged()
{
    const auto uiVersion = audioProcessor.getUiStateVersion();
    if (uiVersion == lastUiStateVersion)
        return;

    lastUiStateVersion = uiVersion;
    webComponent.emitEventIfBrowserIsVisible("engineState", audioProcessor.buildCurrentPatternStateVar());
}
