#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <vector>

namespace
{
    juce::String toParamName(UiDiffParam field)
    {
        switch (field)
        {
            case UiDiffParam::Gate: return "gates";
            case UiDiffParam::Probability: return "probabilities";
            case UiDiffParam::Shift: return "shifts";
            case UiDiffParam::Swing: return "swings";
            case UiDiffParam::Repeats: return "repeats";
            case UiDiffParam::Velocity:
            default: return "velocities";
        }
    }

    juce::String toTrackStateName(UiDiffTrackState field)
    {
        return field == UiDiffTrackState::Solo ? "solo" : "mute";
    }
}

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
                              .getChildFile("MiniLAB3SeqCache")))

              .withNativeFunction("setStepActive", [this](const auto& args, auto completion)
              {
                  if (args.size() == 4)
                      audioProcessor.setStepActiveNative((int) args[0], (int) args[1], (int) args[2], (bool) args[3], false);
                  completion(juce::var());
              })
              .withNativeFunction("setStepParameter", [this](const auto& args, auto completion)
              {
                  if (args.size() == 5)
                      audioProcessor.setStepParameterNative((int) args[0], (int) args[1], (int) args[2], args[3].toString(), (float) (double) args[4], false);
                  completion(juce::var());
              })
              .withNativeFunction("setTrackState", [this](const auto& args, auto completion)
              {
                  if (args.size() == 3)
                      audioProcessor.setTrackStateNative((int) args[0], args[1].toString(), (bool) args[2], false);
                  completion(juce::var());
              })
              .withNativeFunction("setTrackMidiKey", [this](const auto& args, auto completion)
              {
                  if (args.size() == 2)
                      audioProcessor.setTrackMidiKeyNative((int) args[0], (int) args[1], false);
                  completion(juce::var());
              })
              .withNativeFunction("setTrackMidiChannel", [this](const auto& args, auto completion)
              {
                  if (args.size() == 2)
                      audioProcessor.setTrackMidiChannelNative((int) args[0], (int) args[1], false);
                  completion(juce::var());
              })
              .withNativeFunction("clearTrack", [this](const auto& args, auto completion)
              {
                  if (args.size() == 2)
                      audioProcessor.clearTrackNative((int) args[0], (int) args[1], false);
                  completion(juce::var());
              })
              .withNativeFunction("setActivePattern", [this](const auto& args, auto completion)
              {
                  if (args.size() == 1)
                      audioProcessor.setActivePatternNative((int) args[0], false);
                  completion(juce::var());
              })
              .withNativeFunction("setSelectedTrack", [this](const auto& args, auto completion)
              {
                  if (args.size() == 1)
                      audioProcessor.setSelectedTrackNative((int) args[0], false);
                  completion(juce::var());
              })
              .withNativeFunction("setCurrentPage", [this](const auto& args, auto completion)
              {
                  if (args.size() == 1)
                      audioProcessor.setCurrentPageNative((int) args[0], false);
                  completion(juce::var());
              })
              .withNativeFunction("saveUiMetadata", [this](const auto& args, auto completion)
              {
                  if (!args.isEmpty())
                      juce::MessageManager::callAsync([this, stateVar = args[0]]() { audioProcessor.updateUiMetadataFromVar(stateVar); });
                  completion(juce::var());
              })
              .withNativeFunction("requestInitialState", [this](const auto&, auto completion)
              {
                  completion(audioProcessor.buildFullUiStateVarForEditor());
              })
              .withNativeFunction("uiReadyForEngineState", [this](const auto&, auto completion)
              {
                  juce::MessageManager::callAsync([this]()
                  {
                      isUiConnected.store(true, std::memory_order_release);
                      audioProcessor.openHardwareOutput();
                  });
                  completion(juce::var());
              })
              .withNativeFunction("setWindowScale", [this](const auto& args, auto completion)
              {
                  if (!args.isEmpty() && (args[0].isDouble() || args[0].isInt()))
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
#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
              .withResourceProvider([](const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource>
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

    setResizable(true, true);
    if (auto* constrainer = getConstrainer())
        constrainer->setFixedAspectRatio(1460.0 / 1024.0);

    setResizeLimits(730, 512, 2920, 2048);

    const float initialScale = audioProcessor.uiScale.load(std::memory_order_acquire);
    setSize(static_cast<int>(1460 * initialScale), static_cast<int>(1024 * initialScale));

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

    pushPlaybackStateIfChanged();
    pushUiDiffEvents();
}

void MiniLAB3StepSequencerAudioProcessorEditor::pushPlaybackStateIfChanged()
{
    const double currentBpm = audioProcessor.currentBpm.load(std::memory_order_acquire);
    const bool isPlaying = audioProcessor.isPlaying.load(std::memory_order_acquire);
    const int absoluteStep = audioProcessor.global16thNote.load(std::memory_order_acquire);
    const int currentGridStep = (absoluteStep >= 0) ? (absoluteStep % 32) : -1;
    const int droppedNotes = audioProcessor.droppedNotesCount.load(std::memory_order_relaxed);
    const int droppedHWMsgs = audioProcessor.droppedHWMsgs.load(std::memory_order_relaxed);

    if (currentBpm != lastBpm || isPlaying != lastIsPlaying || currentGridStep != lastStep
        || droppedNotes != lastDroppedNotes || droppedHWMsgs != lastDroppedHWMsgs)
    {
        lastBpm = currentBpm;
        lastIsPlaying = isPlaying;
        lastStep = currentGridStep;
        lastDroppedNotes = droppedNotes;
        lastDroppedHWMsgs = droppedHWMsgs;

        juce::DynamicObject::Ptr stateObj = new juce::DynamicObject();
        stateObj->setProperty("bpm", currentBpm);
        stateObj->setProperty("isPlaying", isPlaying);
        stateObj->setProperty("currentStep", currentGridStep);
        stateObj->setProperty("droppedNotes", droppedNotes);
        stateObj->setProperty("droppedHWMsgs", droppedHWMsgs);

        webComponent.emitEventIfBrowserIsVisible("playbackState", juce::var(stateObj.get()));
    }
}

void MiniLAB3StepSequencerAudioProcessorEditor::pushUiDiffEvents()
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
                payload->setProperty("type", "stepParameterChanged");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("stepIndex", diff.stepIndex);
                payload->setProperty("paramName", toParamName(static_cast<UiDiffParam>(diff.field)));
                payload->setProperty("value", static_cast<UiDiffParam>(diff.field) == UiDiffParam::Repeats ? diff.value : diff.floatValue * 100.0f);
                break;

            case UiDiffEventType::TrackState:
                payload->setProperty("type", "trackStateChanged");
                payload->setProperty("patternIndex", diff.patternIndex);
                payload->setProperty("trackIndex", diff.trackIndex);
                payload->setProperty("stateName", toTrackStateName(static_cast<UiDiffTrackState>(diff.field)));
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
        }

        webComponent.emitEventIfBrowserIsVisible("engineDiff", juce::var(payload.get()));
    }
}
