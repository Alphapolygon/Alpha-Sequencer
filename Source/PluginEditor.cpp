#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <vector>

MiniLAB3StepSequencerAudioProcessorEditor::MiniLAB3StepSequencerAudioProcessorEditor(MiniLAB3StepSequencerAudioProcessor& p)
    : AudioProcessorEditor(&p),
    audioProcessor(p),
    webComponent(
        juce::WebBrowserComponent::Options{}
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withNativeIntegrationEnabled()
        .withWinWebView2Options(
            juce::WebBrowserComponent::Options::WinWebView2{}
            .withUserDataFolder(
                juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
                .getChildFile("MiniLAB3Sequencer")
                .getChildFile("WebView2CacheV3")))
        .withNativeFunction("updateCPlusPlusState",
            [this](const auto& args, auto completion)
            {
                if (!args.isEmpty())
                {
                    juce::MessageManager::callAsync([this, stateVar = args[0]]()
                        {
                            audioProcessor.setStepDataFromVar(stateVar);
                        });
                }
                completion(juce::var());
            })
        .withNativeFunction("saveFullUiState",
            [this](const auto& args, auto completion)
            {
                if (!args.isEmpty())
                {
                    juce::MessageManager::callAsync([this, stateVar = args[0]]()
                        {
                            // CPU FIX: Fast Path. No matrix iterations. No stringifying. No dirty flags.
                            audioProcessor.updateUiMetadataFromVar(stateVar);
                        });
                }
                completion(juce::var());
            })
        .withNativeFunction("setWindowScale",
            [this](const auto& args, auto completion)
            {
                if (!args.isEmpty() && args[0].isDouble())
                {
                    const double scale = static_cast<double>(args[0]);
                    juce::MessageManager::callAsync([this, scale]()
                        {
                            audioProcessor.uiScale.store(static_cast<float>(scale), std::memory_order_release);
                            setSize(static_cast<int>(1460 * scale), static_cast<int>(1024 * scale));
                        });
                }
                completion(juce::var());
            })
        .withNativeFunction("requestInitialState",
            [this](const auto&, auto completion)
            {
                // CPU FIX: JSON string building/parsing totally eliminated.
                completion(audioProcessor.buildFullUiStateVarForEditor());
            })
        .withNativeFunction("uiReadyForEngineState",
            [this](const auto&, auto completion)
            {
                juce::MessageManager::callAsync([this]()
                    {
                        isUiConnected.store(true, std::memory_order_release);
                        audioProcessor.requestUiStateBroadcast();
                        audioProcessor.openHardwareOutput();
                    });
                completion(juce::var());
            })
#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
        .withResourceProvider(
            [](const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource>
            {
                if (url.isEmpty() || url == "/" || url.contains("index.html"))
                {
                    const auto* data = reinterpret_cast<const std::byte*>(BinaryData::index_html);
                    std::vector<std::byte> htmlVector(data, data + BinaryData::index_htmlSize);
                    return juce::WebBrowserComponent::Resource{ std::move(htmlVector), juce::String("text/html") };
                }
                return std::nullopt;
            })
#endif
    )
{
    addAndMakeVisible(webComponent);

    // Scale window correctly on initialization
    const float scale = audioProcessor.uiScale.load(std::memory_order_acquire);
    setSize(static_cast<int>(1460 * scale), static_cast<int>(1024 * scale));

#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
    juce::String rootUrl = webComponent.getResourceProviderRoot();
    if (!rootUrl.endsWithChar('/'))
        rootUrl += "/";
    webComponent.goToURL(rootUrl + "index.html");
#else
    webComponent.goToURL("about:blank");
#endif

    lastUiStateVersion = 0;
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

    pushPlaybackStateIfChanged();
    pushEngineStateIfChanged();
}

void MiniLAB3StepSequencerAudioProcessorEditor::pushPlaybackStateIfChanged()
{
    const double currentBpm = audioProcessor.currentBpm.load(std::memory_order_acquire);
    const bool isPlaying = audioProcessor.isPlaying.load(std::memory_order_acquire);
    const int absoluteStep = audioProcessor.global16thNote.load(std::memory_order_acquire);
    const int currentGridStep = (absoluteStep >= 0) ? (absoluteStep % 32) : -1;

    const int droppedNotes = audioProcessor.droppedNotesCount.load(std::memory_order_relaxed);
    const int droppedHWMsgs = audioProcessor.droppedHWMsgs.load(std::memory_order_relaxed);

    if (currentBpm != lastBpm || isPlaying != lastIsPlaying || currentGridStep != lastStep)
    {
        lastBpm = currentBpm;
        lastIsPlaying = isPlaying;
        lastStep = currentGridStep;

        juce::DynamicObject::Ptr stateObj = new juce::DynamicObject();
        stateObj->setProperty("bpm", currentBpm);
        stateObj->setProperty("isPlaying", isPlaying);
        stateObj->setProperty("currentStep", currentGridStep);
        stateObj->setProperty("droppedNotes", droppedNotes);
        stateObj->setProperty("droppedHWMsgs", droppedHWMsgs);

        webComponent.emitEventIfBrowserIsVisible("playbackState", juce::var(stateObj.get()));
    }
}

void MiniLAB3StepSequencerAudioProcessorEditor::pushEngineStateIfChanged()
{
    const auto uiVersion = audioProcessor.getUiStateVersion();
    if (uiVersion != lastUiStateVersion)
    {
        lastUiStateVersion = uiVersion;

        // CPU FIX: JSON string building/parsing totally eliminated! Just emits the Var tree!
        webComponent.emitEventIfBrowserIsVisible("engineState", audioProcessor.buildFullUiStateVarForEditor());
    }
}