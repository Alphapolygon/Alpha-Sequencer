#include "PluginProcessor.h"

namespace {
    struct PadColor { uint8_t r = 0, g = 0, b = 0; bool operator!=(const PadColor& o) const { return r != o.r || g != o.g || b != o.b; } };
    class ArturiaMiniLab3Profile : public ControllerProfile {
    public:
        juce::String getDeviceNameSubstring() const override { return "Minilab3"; }
        void initializeHardware(juce::MidiOutput* out) override { for (int i = 0;i < 8;++i) out->sendMessageNow(makePadColorSysex(i + 4, 0, 0, 0)); }
        void resetHardware(juce::MidiOutput* out) override { initializeHardware(out); }
        void updateLEDs(juce::MidiOutput* out, MiniLAB3StepSequencerAudioProcessor& processor, bool forceOverwrite) override {
            const int page = processor.currentPage.load(), instrument = processor.currentInstrument.load();
            const int pIdx = processor.activePatternIndex.load(), current16th = processor.global16thNote.load();
            const int playingStep = (current16th >= 0) ? (current16th % processor.trackLengths[pIdx][instrument].load()) : -1;
            const auto& trackData = processor.getActiveTrack(pIdx, instrument);

            for (int pad = 0; pad < 8; ++pad) {
                const int step = (page * 8) + pad; const bool active = trackData[step].isActive;
                uint8_t r = 0, g = 0, b = 0;
                if (step == playingStep) { r = active ? 127 : 15; g = active ? 127 : 15; b = active ? 127 : 15; }
                else if (active) {
                    const uint8_t c = static_cast<uint8_t>(127.0f * (0.1f + (trackData[step].velocity * 0.9f)));
                    if (page == 0) { r = 0; g = c; b = c; }
                    else if (page == 1) { r = c; g = 0; b = c; }
                    else if (page == 2) { r = c; g = c; b = 0; }
                    else if (page == 3) { r = c; g = c; b = c; }
                }
                const PadColor newColor{ r, g, b };
                if (forceOverwrite || newColor != lastPadColor[pad]) { lastPadColor[pad] = newColor; out->sendMessageNow(makePadColorSysex(pad + 4, r, g, b)); }
            }
        }
        bool handleMidiInput(const juce::MidiMessage& msg, MiniLAB3StepSequencerAudioProcessor& p) override {
            if (msg.isNoteOn() && msg.getNoteNumber() >= 36 && msg.getNoteNumber() <= 43) {
                const int inst = p.currentInstrument.load(), pIdx = p.activePatternIndex.load();
                const int step = (p.currentPage.load() * 8) + (msg.getNoteNumber() - 36);
                const bool state = p.getActiveTrack(pIdx, inst)[step].isActive;
                p.setStepActiveNative(pIdx, inst, step, !state, true);
                if (!state) p.setStepParameterNative(pIdx, inst, step, "velocities", msg.getFloatVelocity(), true);
                return true;
            }
            return false;
        }
    private:
        PadColor lastPadColor[8]{};
        juce::MidiMessage makePadColorSysex(uint8_t padIdx, uint8_t r, uint8_t g, uint8_t b) const {
            const uint8_t d[] = { 0xF0, 0x00, 0x20, 0x6B, 0x7F, 0x42, 0x02, 0x01, 0x16, padIdx, (uint8_t)(r & 0x7F), (uint8_t)(g & 0x7F), (uint8_t)(b & 0x7F), 0xF7 };
            return juce::MidiMessage(d, sizeof(d));
        }
    };
}

void MiniLAB3StepSequencerAudioProcessor::claimHardwareOwnership() {
    if (hardwareManager->owner.load() == this) return;
    hardwareManager->owner.store(this);
    if (hardwareManager->output == nullptr) openHardwareOutput(); else requestLedRefresh();
}
bool MiniLAB3StepSequencerAudioProcessor::isHardwareOwner() const { return hardwareManager->owner.load() == this; }
void MiniLAB3StepSequencerAudioProcessor::openHardwareOutput() {
    bool expected = false; if (!isAttemptingConnection.compare_exchange_strong(expected, true)) return;
    { const juce::SpinLock::ScopedLockType lock(hardwareManager->lock); if (hardwareManager->output != nullptr) { hardwareManager->owner.store(this); isAttemptingConnection.store(false); requestLedRefresh(); return; } }
    auto devices = juce::MidiOutput::getAvailableDevices(); std::shared_ptr<juce::MidiOutput> newOutput; std::shared_ptr<ControllerProfile> newProfile;
    for (const auto& dev : devices) {
        if (dev.name.containsIgnoreCase("Minilab3") && dev.name.containsIgnoreCase("MIDI")) {
            auto out = juce::MidiOutput::openDevice(dev.identifier);
            if (out != nullptr) { newOutput = std::move(out); newProfile = std::make_shared<ArturiaMiniLab3Profile>(); newProfile->initializeHardware(newOutput.get()); break; }
        }
    }
    if (newOutput != nullptr) { const juce::SpinLock::ScopedLockType lock(hardwareManager->lock); hardwareManager->output = std::move(newOutput); hardwareManager->profile = std::move(newProfile); hardwareManager->owner.store(this); requestLedRefresh(); }
    isAttemptingConnection.store(false);
}
void MiniLAB3StepSequencerAudioProcessor::resetHardwareState() {
    if (!isHardwareOwner()) return;
    std::shared_ptr<juce::MidiOutput> out; std::shared_ptr<ControllerProfile> prof;
    { const juce::SpinLock::ScopedLockType lock(hardwareManager->lock); out = hardwareManager->output; prof = hardwareManager->profile; }
    if (out && prof) { prof->resetHardware(out.get()); juce::Thread::sleep(30); }
}
void MiniLAB3StepSequencerAudioProcessor::requestLedRefresh() { ledRefreshCountdown.store(3); }
void MiniLAB3StepSequencerAudioProcessor::timerCallback() {
    applyPendingParameterUpdates(); if (initialising.load()) return;
    if (!isHardwareOwner()) { hwFifo.read(hwFifo.getNumReady()); return; }
    auto readHandle = hwFifo.read(hwFifo.getNumReady());
    auto processQueue = [&](int start, int size) { juce::MidiBuffer db; for (int i = 0; i < size; ++i) { juce::MidiMessage msg(hwQueue[start + i].d, hwQueue[start + i].len, 0); handleMidiInput(msg, db); } };
    processQueue(readHandle.startIndex1, readHandle.blockSize1); processQueue(readHandle.startIndex2, readHandle.blockSize2);
    if (hardwareManager->output == nullptr) { static int retry = 0; if (++retry >= 25) { openHardwareOutput(); retry = 0; } }
    const int c = ledRefreshCountdown.load(); if (c > 0) { updateHardwareLEDs(true); ledRefreshCountdown.store(c - 1); }
    else updateHardwareLEDs(false);
}
void MiniLAB3StepSequencerAudioProcessor::updateHardwareLEDs(bool f) {
    if (!isHardwareOwner()) return;
    std::shared_ptr<juce::MidiOutput> out; std::shared_ptr<ControllerProfile> prof;
    { const juce::SpinLock::ScopedLockType lock(hardwareManager->lock); out = hardwareManager->output; prof = hardwareManager->profile; }
    if (out && prof) prof->updateLEDs(out.get(), *this, f);
}
void MiniLAB3StepSequencerAudioProcessor::handleMidiInput(const juce::MidiMessage& msg, juce::MidiBuffer&) {
    if (initialising.load() || !isHardwareOwner()) return;
    std::shared_ptr<ControllerProfile> prof;
    { const juce::SpinLock::ScopedLockType lock(hardwareManager->lock); prof = hardwareManager->profile; }
    if (prof) { if (prof->handleMidiInput(msg, *this)) { requestLedRefresh(); markUiStateDirty(); } }
    if (msg.isController()) {
        const int cc = msg.getControllerNumber(); const float val = msg.getControllerValue() / 127.0f;
        if (cc == 7) pendingMasterVolNormalized.store(val); else if (cc == 11) pendingSwingNormalized.store(val);
    }
}