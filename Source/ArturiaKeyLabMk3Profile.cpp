#include "ArturiaKeyLabMk3Profile.h"
#include "PluginProcessor.h"

juce::String ArturiaKeyLabMk3Profile::id() const {
    return "arturia.keylab_mk3_premium";
}

bool ArturiaKeyLabMk3Profile::matchesOutputDevice(const juce::MidiDeviceInfo& device) const {
    // Matches 49, 61, and 88 key versions, but explicitly ignores the "Essential" line
    return device.name.containsIgnoreCase("KeyLab") &&
        device.name.containsIgnoreCase("mk3") &&
        !device.name.containsIgnoreCase("Essential");
}

bool ArturiaKeyLabMk3Profile::claimsIncomingMessage(const juce::MidiMessage& message) const {
    // 12 Pads (Notes 36 through 47)
    if ((message.isNoteOn() || message.isNoteOff()) && message.getNoteNumber() >= 36 && message.getNoteNumber() <= 47)
        return true;

    if (!message.isController()) return false;

    // Claim Encoders, Faders, and Mod Wheel
    switch (message.getControllerNumber()) {
    case 1: case 7: case 11:
    case 73: case 75: case 79: case 72: case 80: case 61: // Faders 1-6 (Jitter)
    case 74: case 71: case 76: case 77: case 93: case 18: case 19: case 16: // Encoders 1-8
    case 114: case 115: // Main Encoder
        return true;
    default: return false;
    }
}

void ArturiaKeyLabMk3Profile::initializeHardware(juce::MidiOutput& output) {
    for (int i = 0; i < 12; ++i)
        output.sendMessageNow(makePadColorSysex(static_cast<uint8_t>(i + 4), 0, 0, 0));
}

void ArturiaKeyLabMk3Profile::resetHardware(juce::MidiOutput& output) {
    initializeHardware(output);
}

void ArturiaKeyLabMk3Profile::updateLEDs(juce::MidiOutput& output, MiniLAB3StepSequencerAudioProcessor& processor, bool forceOverwrite) {
    const int page = processor.currentPage.load();
    const int instrument = processor.currentInstrument.load();
    const int pIdx = processor.activePatternIndex.load();
    const int current16th = processor.global16thNote.load();
    const int trackLength = processor.trackLengths[pIdx][instrument].load();
    const int playingStep = (current16th >= 0 && trackLength > 0) ? (current16th % trackLength) : -1;

    const auto& trackData = processor.getActiveTrack(pIdx, instrument);

    // 1. Update the 8 Sequencer Pads
    for (int pad = 0; pad < 8; ++pad) {
        const int step = (page * 8) + pad;
        const bool active = trackData[step].isActive;
        uint8_t r = 0, g = 0, b = 0;

        if (step == playingStep) {
            r = active ? 127 : 15; g = active ? 127 : 15; b = active ? 127 : 15;
        }
        else if (active) {
            const uint8_t brightness = static_cast<uint8_t>(127.0f * (0.1f + (trackData[step].velocity * 0.9f)));
            if (page == 0) { g = brightness; b = brightness; }
            else if (page == 1) { r = brightness; b = brightness; }
            else if (page == 2) { r = brightness; g = brightness; }
            else if (page == 3) { r = brightness; g = brightness; b = brightness; }
        }

        PadColor newColor{ r, g, b };
        if (forceOverwrite || newColor != lastPadColor[pad]) {
            lastPadColor[pad] = newColor;
            output.sendMessageNow(makePadColorSysex(static_cast<uint8_t>(pad + 4), r, g, b));
        }
    }

    // 2. Update the 4 Utility Pads (Mute, Solo, Clear Page, Clear Track)
    bool isMuted = processor.muteParams[instrument]->load() > 0.5f;
    bool isSoloed = processor.soloParams[instrument]->load() > 0.5f;

    PadColor pad9Color = isMuted ? PadColor{ 127, 0, 0 } : PadColor{ 15, 0, 0 };      // Red for Mute
    PadColor pad10Color = isSoloed ? PadColor{ 127, 127, 0 } : PadColor{ 15, 15, 0 };  // Yellow for Solo
    PadColor pad11Color = { 20, 20, 20 }; // Dim White for Clear Page
    PadColor pad12Color = { 20, 20, 20 }; // Dim White for Clear Track

    PadColor utilityColors[4] = { pad9Color, pad10Color, pad11Color, pad12Color };

    for (int i = 0; i < 4; ++i) {
        int padIdx = 8 + i;
        if (forceOverwrite || utilityColors[i] != lastPadColor[padIdx]) {
            lastPadColor[padIdx] = utilityColors[i];
            output.sendMessageNow(makePadColorSysex(static_cast<uint8_t>(padIdx + 4), utilityColors[i].r, utilityColors[i].g, utilityColors[i].b));
        }
    }
}

bool ArturiaKeyLabMk3Profile::handleMidiInput(const juce::MidiMessage& message, MiniLAB3StepSequencerAudioProcessor& processor) {
    const int instrument = processor.currentInstrument.load();
    const int pIdx = processor.activePatternIndex.load();

    // --- PADS ---
    if (message.isNoteOn()) {
        int note = message.getNoteNumber();

        // Pads 1-8: Step Toggles
        if (note >= 36 && note <= 43) {
            const int step = (processor.currentPage.load() * 8) + (note - 36);
            const bool currentState = processor.getActiveTrack(pIdx, instrument)[step].isActive;
            processor.setStepActiveNative(pIdx, instrument, step, !currentState, true);
            if (!currentState) processor.setStepParameterNative(pIdx, instrument, step, "velocities", message.getFloatVelocity(), true);
            return true;
        }
        // Pads 9-12: Utility Shortcuts
        else if (note == 44) { // Pad 9: Mute Toggle
            bool isMuted = processor.muteParams[instrument]->load() > 0.5f;
            processor.setTrackStateNative(instrument, "mute", !isMuted, true);
            return true;
        }
        else if (note == 45) { // Pad 10: Solo Toggle
            bool isSolo = processor.soloParams[instrument]->load() > 0.5f;
            processor.setTrackStateNative(instrument, "solo", !isSolo, true);
            return true;
        }
        else if (note == 46) { // Pad 11: Clear Page
            processor.clearPageNative(pIdx, instrument, processor.currentPage.load(), true);
            return true;
        }
        else if (note == 47) { // Pad 12: Clear Track
            processor.clearTrackNative(pIdx, instrument, true);
            return true;
        }
    }

    // --- KNOBS & FADERS ---
    if (message.isController()) {
        const int cc = message.getControllerNumber();
        const float val = message.getControllerValue() / 127.0f;

        if (cc == 1) { // Mod Wheel -> Track Select
            processor.setSelectedTrackNative(juce::jlimit(0, 15, (int)((1.0f - val) * 16.0f)), true);
            return true;
        }

        // Faders 1-6 -> Jitter Amounts (Live Chaos Control)
        int jitterIdx = -1;
        if (cc == 73) jitterIdx = 0;      // Velocity
        else if (cc == 75) jitterIdx = 1; // Gate
        else if (cc == 79) jitterIdx = 2; // Probability
        else if (cc == 72) jitterIdx = 3; // Shift
        else if (cc == 80) jitterIdx = 4; // Swing
        else if (cc == 61) jitterIdx = 5; // Pitch

        if (jitterIdx != -1) {
            processor.setTrackRandomAmountNative(pIdx, instrument, jitterIdx, val);
            return true;
        }

        // Encoders 1-8 -> Step Automation
        int knobIndex = -1;
        if (cc == 74) knobIndex = 0; else if (cc == 71) knobIndex = 1;
        else if (cc == 76) knobIndex = 2; else if (cc == 77) knobIndex = 3;
        else if (cc == 93) knobIndex = 4; else if (cc == 18) knobIndex = 5;
        else if (cc == 19) knobIndex = 6; else if (cc == 16) knobIndex = 7;

        if (knobIndex >= 0) {
            const int step = (processor.currentPage.load() * 8) + knobIndex;
            const int currentTab = processor.footerTabIndex.load();
            juce::String paramName = "velocities";
            float mappedValue = val;

            switch (currentTab) {
            case 1: paramName = "gates"; break;
            case 2: paramName = "probabilities"; break;
            case 3: paramName = "shifts"; break;
            case 4: paramName = "swings"; break;
            case 5: paramName = "pitches"; mappedValue = std::round((val) * 48.0f - 24.0f); break;
            default: break;
            }

            if (processor.getActiveTrack(pIdx, instrument)[step].isActive) {
                processor.setStepParameterNative(pIdx, instrument, step, paramName, mappedValue, true);
            }
            return true;
        }

        // Main Encoder -> Page Scroll
        if (cc == 114) {
            const auto page = processor.currentPage.load();
            int newPage = page;
            if (message.getControllerValue() > 64) newPage = juce::jmin(3, page + 1);
            else if (message.getControllerValue() < 64) newPage = juce::jmax(0, page - 1);
            if (newPage != page) processor.setCurrentPageNative(newPage, true);
            return true;
        }
    }
    return false;
}

juce::MidiMessage ArturiaKeyLabMk3Profile::makePadColorSysex(uint8_t padIndex, uint8_t red, uint8_t green, uint8_t blue) const {
    const uint8_t data[] = {
        0xF0, 0x00, 0x20, 0x6B, 0x7F, 0x42, 0x02, 0x01,
        0x16, padIndex,
        static_cast<uint8_t>(red & 0x7F),
        static_cast<uint8_t>(green & 0x7F),
        static_cast<uint8_t>(blue & 0x7F),
        0xF7
    };
    return juce::MidiMessage(data, static_cast<int>(sizeof(data)));
}