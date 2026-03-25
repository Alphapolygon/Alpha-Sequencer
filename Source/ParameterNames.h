#pragma once

#include <JuceHeader.h>
#include "PluginProcessorTypes.h"

namespace ParameterNames {
    inline juce::String step(UiDiffParam field)
    {
        switch (field)
        {
            case UiDiffParam::Gate: return "gates";
            case UiDiffParam::Probability: return "probabilities";
            case UiDiffParam::Shift: return "shifts";
            case UiDiffParam::Swing: return "swings";
            case UiDiffParam::Repeats: return "repeats";
            case UiDiffParam::Pitch: return "pitches";
            case UiDiffParam::Velocity:
            default: return "velocities";
        }
    }

    inline UiDiffParam step(const juce::String& name)
    {
        if (name == "gates") return UiDiffParam::Gate;
        if (name == "probabilities") return UiDiffParam::Probability;
        if (name == "shifts") return UiDiffParam::Shift;
        if (name == "swings") return UiDiffParam::Swing;
        if (name == "repeats") return UiDiffParam::Repeats;
        if (name == "pitches") return UiDiffParam::Pitch;
        return UiDiffParam::Velocity;
    }

    inline juce::String trackState(UiDiffTrackState field)
    {
        return field == UiDiffTrackState::Solo ? "solo" : "mute";
    }

    inline int randomAmountIndex(const juce::String& name)
    {
        if (name == "gates") return 1;
        if (name == "probabilities") return 2;
        if (name == "shifts") return 3;
        if (name == "swings") return 4;
        if (name == "pitches") return 5;
        return 0;
    }

    inline juce::String footerTabName(int index)
    {
        switch (index)
        {
            case 1: return "Gate";
            case 2: return "Probability";
            case 3: return "Shift";
            case 4: return "Swing";
            case 5: return "Pitch";
            default: return "Velocity";
        }
    }

    inline int footerTabIndex(const juce::String& name)
    {
        if (name == "Gate") return 1;
        if (name == "Probability") return 2;
        if (name == "Shift") return 3;
        if (name == "Swing") return 4;
        if (name == "Pitch") return 5;
        return 0;
    }
}
