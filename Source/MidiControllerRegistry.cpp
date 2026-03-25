#include "MidiControllerRegistry.h"
#include "ArturiaMiniLab3Profile.h"

void MidiControllerRegistry::addFactory(Factory factory)
{
    factories.push_back(std::move(factory));
}

OpenMidiControllerResult MidiControllerRegistry::openFirstMatchingOutput() const
{
    const auto devices = juce::MidiOutput::getAvailableDevices();

    for (const auto& device : devices)
    {
        for (const auto& factory : factories)
        {
            auto candidateProfile = factory();
            if (candidateProfile == nullptr)
                continue;

            if (!candidateProfile->matchesOutputDevice(device))
                continue;

            auto output = juce::MidiOutput::openDevice(device.identifier);
            if (output == nullptr)
                continue;

            candidateProfile->initializeHardware(*output);
            return { std::move(output), std::move(candidateProfile), device };
        }
    }

    return {};
}

MidiControllerRegistry& getDefaultMidiControllerRegistry()
{
    static MidiControllerRegistry registry = [] {
        MidiControllerRegistry value;
        value.registerProfile<ArturiaMiniLab3Profile>();
        return value;
    }();

    return registry;
}
