#include "MidiControllerRegistry.h"
#include "ArturiaMiniLab3Profile.h"
#include "ArturiaMiniLabMk2Profile.h"
#include "GenericMidiDeviceProfile.h"
#include "ArturiaKeyLabEssentialMk3Profile.h"
#include "ArturiaKeyLabMk3Profile.h"

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
        value.registerProfile<ArturiaMiniLabMk2Profile>();
        value.registerProfile<ArturiaKeyLabMk3Profile>();
        value.registerProfile<ArturiaKeyLabEssentialMk3Profile>();

        // Keep the generic profile opt-in for now. A catch-all auto-match is too risky
        // because it can hijack the wrong MIDI output when multiple controllers are connected.
        // Enable it only after you add an explicit device-selection preference or identifier check.
        // value.registerProfile<GenericMidiDeviceProfile>();

        return value;
        }();

    return registry;
}
