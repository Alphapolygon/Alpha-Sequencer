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

        .withNativeFunction("setStepActive", [this](const auto& args, auto completion) {
            if (args.size() == 4) {
                audioProcessor.setStepActiveNative((int)args[0], (int)args[1], (int)args[2], (bool)args[3]);
            }
            completion(juce::var());
            })
        .withNativeFunction("setStepParameter", [this](const auto& args, auto completion) {
            if (args.size() == 5) {
                audioProcessor.setStepParameterNative((int)args[0], (int)args[1], (int)args[2], args[3].toString(), (float)(double)args[4]);
            }
            completion(juce::var());
            })
        .withNativeFunction("setTrackState", [this](const auto& args, auto completion) {
            if (args.size() == 3) {
                audioProcessor.setTrackStateNative((int)args[0], args[1].toString(), (bool)args[2]);
            }
            completion(juce::var());
            })
        .withNativeFunction("setTrackMidiKey", [this](const auto& args, auto completion) {
            if (args.size() == 2) {
                audioProcessor.setTrackMidiKeyNative((int)args[0], (int)args[1]);
            }
            completion(juce::var());
            })
        // NEW: MIDI Channel routing endpoint
        .withNativeFunction("setTrackMidiChannel", [this](const auto& args, auto completion) {
            if (args.size() == 2) {
                audioProcessor.setTrackMidiChannelNative((int)args[0], (int)args[1]);
            }
            completion(juce::var());
            })
        .withNativeFunction("clearTrack", [this](const auto& args, auto completion) {
            if (args.size() == 2) {
                audioProcessor.clearTrackNative((int)args[0], (int)args[1]);
            }
            completion(juce::var());
            })
        .withNativeFunction("updateCPlusPlusState", [this](const auto& args, auto completion) {
            if (!args.isEmpty()) juce::MessageManager::callAsync([this, stateVar = args[0]]() { audioProcessor.setStepDataFromVar(stateVar); });
            completion(juce::var());
            })
        .withNativeFunction("saveUiMetadata", [this](const auto& args, auto completion) {
            if (!args.isEmpty()) juce::MessageManager::callAsync([this, stateVar = args[0]]() { audioProcessor.updateUiMetadataFromVar(stateVar); });
            completion(juce::var());
            })
        .withNativeFunction("setWindowScale", [this](const auto& args, auto completion) {
            if (!args.isEmpty() && (args[0].isDouble() || args[0].isInt())) {
                const double scale = static_cast<double>(args[0]);
                juce::MessageManager::callAsync([this, scale]() {
                    audioProcessor.uiScale.store(static_cast<float>(scale), std::memory_order_release);
                    setSize(static_cast<int>(1460 * scale), static_cast<int>(1024 * scale));
                    });
            }
            completion(juce::var());
            })
        .withNativeFunction("requestInitialState", [this](const auto&, auto completion) {
            completion(audioProcessor.buildFullUiStateVarForEditor());
            })
        .withNativeFunction("uiReadyForEngineState", [this](const auto&, auto completion) {
            juce::MessageManager::callAsync([this]() {
                isUiConnected.store(true, std::memory_order_release);
                audioProcessor.requestUiStateBroadcast();
                audioProcessor.openHardwareOutput();
                });
            completion(juce::var());
            })
#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
        .withResourceProvider([](const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource> {
            if (url.isEmpty() || url == "/" || url.contains("index.html")) {
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

    const float scale = audioProcessor.uiScale.load(std::memory_order_acquire);
    setSize(static_cast<int>(1460 * scale), static_cast<int>(1024 * scale));

#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
    juce::String rootUrl = webComponent.getResourceProviderRoot();
    if (!rootUrl.endsWithChar('/')) rootUrl += "/";
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
    if (!isUiConnected.load(std::memory_order_acquire)) return;

    pushPlaybackStateIfChanged();
    pushEngineStateIfChanged();
}

void MiniLAB3StepSequencerAudioProcessorEditor::pushPlaybackStateIfChanged()
{
    const double currentBpm = audioProcessor.currentBpm.load(std::memory_order_acquire);
    const bool isPlaying = audioProcessor.isPlaying.load(std::memory_order_acquire);

    // We send absolute 16th notes now so React can wrap them per-track!
    const int absoluteStep = audioProcessor.global16thNote.load(std::memory_order_acquire);

    const int droppedNotes = audioProcessor.droppedNotesCount.load(std::memory_order_relaxed);
    const int droppedHWMsgs = audioProcessor.droppedHWMsgs.load(std::memory_order_relaxed);

    if (currentBpm != lastBpm
        || isPlaying != lastIsPlaying
        || absoluteStep != lastStep
        || droppedNotes != lastDroppedNotes
        || droppedHWMsgs != lastDroppedHWMsgs)
    {
        lastBpm = currentBpm;
        lastIsPlaying = isPlaying;
        lastStep = absoluteStep;
        lastDroppedNotes = droppedNotes;
        lastDroppedHWMsgs = droppedHWMsgs;

        juce::DynamicObject::Ptr stateObj = new juce::DynamicObject();
        stateObj->setProperty("bpm", currentBpm);
        stateObj->setProperty("isPlaying", isPlaying);
        stateObj->setProperty("currentStep", absoluteStep);
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
        webComponent.emitEventIfBrowserIsVisible("engineState", audioProcessor.buildFullUiStateVarForEditor());
    }
}