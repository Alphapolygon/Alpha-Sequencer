#pragma once

#include "MidiControllerProfile.h"
#include <functional>
#include <memory>
#include <vector>

struct OpenMidiControllerResult {
    std::shared_ptr<juce::MidiOutput> output;
    std::shared_ptr<MidiControllerProfile> profile;
    juce::MidiDeviceInfo deviceInfo;

    bool isValid() const noexcept { return output != nullptr && profile != nullptr; }
};

class MidiControllerRegistry {
public:
    using Factory = std::function<std::shared_ptr<MidiControllerProfile>()>;

    void addFactory(Factory factory);

    template <typename ProfileType>
    void registerProfile()
    {
        addFactory([]() { return std::make_shared<ProfileType>(); });
    }

    OpenMidiControllerResult openFirstMatchingOutput() const;

private:
    std::vector<Factory> factories;
};

MidiControllerRegistry& getDefaultMidiControllerRegistry();
