#include "EditorUiBridge.h"
#include "PluginProcessor.h"
#include "ParameterNames.h"

namespace {
    std::optional<juce::WebBrowserComponent::Resource> provideEditorResource(const juce::String& url)
    {
       #if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
        if (url.isEmpty() || url == "/" || url.contains("index.html"))
        {
            const auto* data = reinterpret_cast<const std::byte*>(BinaryData::index_html);
            std::vector<std::byte> html(data, data + BinaryData::index_htmlSize);
            return juce::WebBrowserComponent::Resource { std::move(html), juce::String("text/html") };
        }
       #else
        juce::ignoreUnused(url);
       #endif

        return std::nullopt;
    }
}

juce::WebBrowserComponent::Options makeEditorBrowserOptions(
    MiniLAB3StepSequencerAudioProcessor& processor,
    std::atomic<bool>& isUiConnected,
    std::function<void(double)> onScaleChanged)
{
    return juce::WebBrowserComponent::Options {}
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withNativeIntegrationEnabled()
        .withWinWebView2Options(
            juce::WebBrowserComponent::Options::WinWebView2 {}
                .withUserDataFolder(
                    juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
                        .getChildFile("MiniLAB3SeqCache")))
        .withNativeFunction("setStepActive", [&processor](const auto& args, auto completion) {
            if (args.size() == 4)
                processor.setStepActiveNative((int) args[0], (int) args[1], (int) args[2], (bool) args[3], false);
            completion(juce::var());
        })
        .withNativeFunction("setStepParameter", [&processor](const auto& args, auto completion) {
            if (args.size() == 5)
                processor.setStepParameterNative((int) args[0], (int) args[1], (int) args[2], args[3].toString(), (float) (double) args[4], false);
            completion(juce::var());
        })
        .withNativeFunction("setTrackState", [&processor](const auto& args, auto completion) {
            if (args.size() == 3)
                processor.setTrackStateNative((int) args[0], args[1].toString(), (bool) args[2], false);
            completion(juce::var());
        })
        .withNativeFunction("setTrackMidiKey", [&processor](const auto& args, auto completion) {
            if (args.size() == 2)
                processor.setTrackMidiKeyNative((int) args[0], (int) args[1], false);
            completion(juce::var());
        })
        .withNativeFunction("setTrackMidiChannel", [&processor](const auto& args, auto completion) {
            if (args.size() == 2)
                processor.setTrackMidiChannelNative((int) args[0], (int) args[1], false);
            completion(juce::var());
        })
        .withNativeFunction("setTrackScale", [&processor](const auto& args, auto completion) {
            if (args.size() == 2)
                processor.setTrackScaleNative((int) args[0], (int) args[1]);
            completion(juce::var());
        })
        .withNativeFunction("setTrackLength", [&processor](const auto& args, auto completion) {
            if (args.size() == 2)
                processor.setTrackLengthNative(processor.activePatternIndex.load(), (int) args[0], (int) args[1], false);
            completion(juce::var());
        })
        .withNativeFunction("setTrackTimeDivision", [&processor](const auto& args, auto completion) {
            if (args.size() == 2)
                processor.setTrackTimeDivisionNative(processor.activePatternIndex.load(), (int) args[0], (int) args[1]);
            completion(juce::var());
        })
        .withNativeFunction("setTrackRandomAmount", [&processor](const auto& args, auto completion) {
            if (args.size() == 3)
                processor.setTrackRandomAmountNative(processor.activePatternIndex.load(), (int) args[0], (int) args[1], (float) (double) args[2]);
            completion(juce::var());
        })
        .withNativeFunction("resetAutomationLane", [&processor](const auto& args, auto completion) {
            if (args.size() == 2)
                processor.resetAutomationLaneNative(processor.activePatternIndex.load(), (int) args[0], args[1].toString());
            completion(juce::var());
        })
        .withNativeFunction("setVisibleTracks", [&processor](const auto& args, auto completion) {
            if (args.size() == 1)
            {
                processor.visibleTracks.store(juce::jlimit(1, 16, (int) args[0]));
                processor.markUiStateDirty();
            }
            completion(juce::var());
        })
        .withNativeFunction("clearTrack", [&processor](const auto& args, auto completion) {
            if (args.size() == 2)
                processor.clearTrackNative((int) args[0], (int) args[1], false);
            completion(juce::var());
        })
        .withNativeFunction("setActivePattern", [&processor](const auto& args, auto completion) {
            if (args.size() == 1)
                processor.setActivePatternNative((int) args[0], false);
            completion(juce::var());
        })
        .withNativeFunction("setSelectedTrack", [&processor](const auto& args, auto completion) {
            if (args.size() == 1)
                processor.setSelectedTrackNative((int) args[0], false);
            completion(juce::var());
        })
        .withNativeFunction("setCurrentPage", [&processor](const auto& args, auto completion) {
            if (args.size() == 1)
                processor.setCurrentPageNative((int) args[0], false);
            completion(juce::var());
        })
        .withNativeFunction("saveUiMetadata", [&processor](const auto& args, auto completion) {
            if (!args.isEmpty())
            {
                juce::MessageManager::callAsync([&processor, stateVar = args[0]] {
                    processor.updateUiMetadataFromVar(stateVar);
                });
            }
            completion(juce::var());
        })
        .withNativeFunction("setSongModeEnabled", [&processor](const auto& args, auto completion) {
        if (args.size() == 1)
            processor.setSongModeEnabledNative((bool)args[0]);
        completion(juce::var());
            })
        .withNativeFunction("setSongModeChain", [&processor](const auto& args, auto completion) {
        if (args.size() == 2 && args[1].isArray()) {
            juce::Array<int> chain;
            for (auto& p : *args[1].getArray()) chain.add((int)p);
            processor.setSongModeChainNative((int)args[0], chain);
        }
        completion(juce::var());
            })
        .withNativeFunction("requestInitialState", [&processor](const auto&, auto completion) {
            completion(processor.buildFullUiStateVarForEditor());
        })
        .withNativeFunction("uiReadyForEngineState", [&processor, &isUiConnected](const auto&, auto completion) {
            juce::MessageManager::callAsync([&processor, &isUiConnected] {
                isUiConnected.store(true, std::memory_order_release);
                processor.claimHardwareOwnership();
            });
            completion(juce::var());
        })
        .withNativeFunction("setWindowScale", [onScaleChanged = std::move(onScaleChanged), &processor](const auto& args, auto completion) {
            if (!args.isEmpty() && (args[0].isDouble() || args[0].isInt()))
            {
                const double scale = static_cast<double>(args[0]);
                juce::MessageManager::callAsync([scale, onScaleChanged, &processor] {
                    processor.uiScale.store(static_cast<float>(scale), std::memory_order_release);
                    onScaleChanged(scale);
                });
            }
            completion(juce::var());
        })
       #if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
        .withResourceProvider([](const juce::String& url) {
            return provideEditorResource(url);
        })
       #endif
        ;
}

EditorUiBridge::EditorUiBridge(MiniLAB3StepSequencerAudioProcessor& processor,
                               juce::WebBrowserComponent& browser)
    : audioProcessor(processor), webComponent(browser)
{
}

void EditorUiBridge::pushPlaybackStateIfChanged()
{
    const double currentBpm = audioProcessor.currentBpm.load(std::memory_order_acquire);
    const bool isPlaying = audioProcessor.isPlaying.load(std::memory_order_acquire);
    const int absoluteStep = audioProcessor.global16thNote.load(std::memory_order_acquire);
    const int currentGridStep = absoluteStep >= 0 ? (absoluteStep % 32) : -1;
    const int droppedNotes = audioProcessor.droppedNotesCount.load(std::memory_order_relaxed);
    const int droppedHardwareMessages = audioProcessor.droppedHWMsgs.load(std::memory_order_relaxed);
    

    const bool changed = currentBpm != lastBpm
        || isPlaying != lastIsPlaying
        || currentGridStep != lastStep
        || droppedNotes != lastDroppedNotes
        || droppedHardwareMessages != lastDroppedHardwareMessages;

    if (!changed)
        return;

    lastBpm = currentBpm;
    lastIsPlaying = isPlaying;
    lastStep = currentGridStep;
    lastDroppedNotes = droppedNotes;
    lastDroppedHardwareMessages = droppedHardwareMessages;

    juce::DynamicObject::Ptr state = new juce::DynamicObject();
    state->setProperty("bpm", currentBpm);
    state->setProperty("isPlaying", isPlaying);
    state->setProperty("currentStep", currentGridStep);
    state->setProperty("droppedNotes", droppedNotes);
    state->setProperty("droppedHWMsgs", droppedHardwareMessages);

    webComponent.emitEventIfBrowserIsVisible("playbackState", juce::var(state.get()));
}

void EditorUiBridge::pushUiDiffEvents()
{
    UiDiffEvent diff;

    while (audioProcessor.popUiDiffEvent(diff))
    {
        juce::DynamicObject::Ptr payload = new juce::DynamicObject();

        switch (diff.type)
        {
            case UiDiffEventType::StepActive:
                payload->setProperty("type", "stepActiveChanged");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("stepIndex", diff.stepIndex);
                payload->setProperty("isActive", diff.boolValue);
                break;
            case UiDiffEventType::StepParameter:
            {   
                payload->setProperty("type", "stepParameterChanged");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("stepIndex", diff.stepIndex);
                payload->setProperty("paramName", ParameterNames::step(static_cast<UiDiffParam>(diff.field)));

                const auto paramType = static_cast<UiDiffParam>(diff.field);
                payload->setProperty("value", (paramType == UiDiffParam::Repeats || paramType == UiDiffParam::Pitch)
                    ? diff.value
                    : diff.floatValue * 100.0f);
                break;
            }
            case UiDiffEventType::TrackState:
                payload->setProperty("type", "trackStateChanged");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("stateName", ParameterNames::trackState(static_cast<UiDiffTrackState>(diff.field)));
                payload->setProperty("isEnabled", diff.boolValue);
                break;
            case UiDiffEventType::TrackMidiKey:
                payload->setProperty("type", "trackMidiKeyChanged");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("midiNote", diff.value);
                break;
            case UiDiffEventType::TrackMidiChannel:
                payload->setProperty("type", "trackMidiChannelChanged");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("midiChannel", diff.value);
                break;
            case UiDiffEventType::ActivePatternChanged:
                payload->setProperty("type", "activePatternChanged");
                payload->setProperty("activeIdx", diff.value);
                break;
            case UiDiffEventType::SelectedTrackChanged:
                payload->setProperty("type", "selectedTrackChanged");
                payload->setProperty("selectedTrack", diff.value);
                break;
            case UiDiffEventType::CurrentPageChanged:
                payload->setProperty("type", "currentPageChanged");
                payload->setProperty("currentPage", diff.value);
                payload->setProperty("activeSection", diff.extraValue);
                break;
            case UiDiffEventType::ClearPage:
                payload->setProperty("type", "pageCleared");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("pageIndex", diff.value);
                break;
            case UiDiffEventType::ClearTrack:
                payload->setProperty("type", "trackCleared");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                break;
            case UiDiffEventType::TrackLengthChanged:
                payload->setProperty("type", "trackLengthChanged");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("length", diff.value);
                break;
        }

        webComponent.emitEventIfBrowserIsVisible("engineDiff", juce::var(payload.get()));
    }
}
