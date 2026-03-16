#include "PluginProcessor.h"
#include "PluginEditor.h"

MiniLAB3StepSequencerAudioProcessorEditor::MiniLAB3StepSequencerAudioProcessorEditor(MiniLAB3StepSequencerAudioProcessor& p)
    : AudioProcessorEditor(&p), audioProcessor(p)
{
    
    backgroundImage = juce::ImageCache::getFromMemory(BinaryData::MainBackground_png, BinaryData::MainBackground_pngSize);

    setSize(1050, 600);
    startTimerHz(60);

    inactiveBgA = juce::ImageCache::getFromMemory(BinaryData::bg_dark_png, BinaryData::bg_dark_pngSize);
    inactiveBgB = juce::ImageCache::getFromMemory(BinaryData::bg_light_png, BinaryData::bg_light_pngSize);

    activeKeys[0] = juce::ImageCache::getFromMemory(BinaryData::active_track_1_png, BinaryData::active_track_1_pngSize);
    activeKeys[1] = juce::ImageCache::getFromMemory(BinaryData::active_track_2_png, BinaryData::active_track_2_pngSize);
    activeKeys[2] = juce::ImageCache::getFromMemory(BinaryData::active_track_3_png, BinaryData::active_track_3_pngSize);
    activeKeys[3] = juce::ImageCache::getFromMemory(BinaryData::active_track_4_png, BinaryData::active_track_4_pngSize);
    activeKeys[4] = juce::ImageCache::getFromMemory(BinaryData::active_track_5_png, BinaryData::active_track_5_pngSize);
    activeKeys[5] = juce::ImageCache::getFromMemory(BinaryData::active_track_6_png, BinaryData::active_track_6_pngSize);
    activeKeys[6] = juce::ImageCache::getFromMemory(BinaryData::active_track_7_png, BinaryData::active_track_7_pngSize);
    activeKeys[7] = juce::ImageCache::getFromMemory(BinaryData::active_track_8_png, BinaryData::active_track_8_pngSize);
    activeKeys[8] = juce::ImageCache::getFromMemory(BinaryData::active_track_9_png, BinaryData::active_track_9_pngSize);
    activeKeys[9] = juce::ImageCache::getFromMemory(BinaryData::active_track_10_png, BinaryData::active_track_10_pngSize);
    activeKeys[10] = juce::ImageCache::getFromMemory(BinaryData::active_track_11_png, BinaryData::active_track_11_pngSize);
    activeKeys[11] = juce::ImageCache::getFromMemory(BinaryData::active_track_12_png, BinaryData::active_track_12_pngSize);
    activeKeys[12] = juce::ImageCache::getFromMemory(BinaryData::active_track_13_png, BinaryData::active_track_13_pngSize);
    activeKeys[13] = juce::ImageCache::getFromMemory(BinaryData::active_track_14_png, BinaryData::active_track_14_pngSize);
    activeKeys[14] = juce::ImageCache::getFromMemory(BinaryData::active_track_15_png, BinaryData::active_track_15_pngSize);
    activeKeys[15] = juce::ImageCache::getFromMemory(BinaryData::active_track_16_png, BinaryData::active_track_16_pngSize);
}

MiniLAB3StepSequencerAudioProcessorEditor::~MiniLAB3StepSequencerAudioProcessorEditor() {
    stopTimer();
}

void MiniLAB3StepSequencerAudioProcessorEditor::timerCallback()
{
    if (!audioProcessor.isHardwareConnected()) {
        static int connectionRetry = 0;
        if (++connectionRetry >= 30) {
            audioProcessor.openHardwareOutput();
            connectionRetry = 0;
        }
    }

    if (audioProcessor.pageChangedTrigger.exchange(false))
        pageFlashAlpha = 1.0f;

    if (pageFlashAlpha > 0.0f)
        pageFlashAlpha *= 0.85f;

    repaint();
}

void MiniLAB3StepSequencerAudioProcessorEditor::paint(juce::Graphics& g)
{

    // 1. Draw the Main Background Image
    if (backgroundImage.isValid()) {
        // This stamps your image starting at the top-left corner (0, 0)
        g.drawImageAt(backgroundImage, 0, 0);
    }
    else {
        // Fallback color just in case the image fails to load
        g.fillAll(juce::Colour::fromRGB(15, 15, 18));
    }

  

    const int currentPage = audioProcessor.currentPage.load();
    const int currentInstrument = audioProcessor.currentInstrument.load();
    const int global16thNote = audioProcessor.global16thNote.load();

    // --- NEW HARDCODED POSITIONS ---
    int startX = 136;
    int topY = 124;

    // Calculate cell widths and heights based on the remaining space
    int gridAreaW = getWidth() - startX - 25; // 25px right margin
    int cellW = gridAreaW / 32;
    int cellH = (getHeight() - topY - 20) / 16; // 20px bottom margin

    if (pageFlashAlpha > 0.0f) {
        g.setColour(juce::Colours::white.withAlpha(pageFlashAlpha * 0.12f));
        g.fillRect(startX + (currentPage * 8 * cellW), topY, cellW * 8, cellH * 16);
    }

    const juce::ScopedLock sl(audioProcessor.stateLock);

    if (audioProcessor.instrumentNames[0].isEmpty()) {
        g.setColour(juce::Colours::white);
        g.drawText("Initializing Sequencer...", getLocalBounds(), juce::Justification::centred);
        return;
    }

    for (int t = 0; t < 16; ++t) {
        int y = topY + (t * cellH);
        const int len = juce::jmax(1, audioProcessor.trackLengths[t]);
        const bool isCurrent = (t == currentInstrument);

        // Draw Left Panel stuff (adjusted to fit within the 136px space before the grid)
        juce::String name = audioProcessor.instrumentNames[t].isNotEmpty() ? audioProcessor.instrumentNames[t] : "Track";
        g.setColour(isCurrent ? juce::Colours::cyan : juce::Colours::white.withAlpha(0.5f));
        g.setFont(juce::FontOptions(13.0f, isCurrent ? juce::Font::bold : juce::Font::plain));
        g.drawFittedText(name, 10, y, 80, cellH, juce::Justification::centredLeft, 1);

        g.setColour(juce::Colours::red.withAlpha(0.2f));
        g.fillRoundedRectangle(95, y + 4, 22, cellH - 8, 4.0f);
        g.setColour(juce::Colours::red.withAlpha(0.7f));
        g.drawText("X", 95, y, 22, cellH, juce::Justification::centred);

        for (int s = 0; s < 32; ++s) {
            int x = startX + (s * cellW);

            float assetSize = 24.0f;
            float drawX = x + (cellW - assetSize) / 2.0f;
            float drawY = y + (cellH - assetSize) / 2.0f;
            juce::Rectangle<float> assetRect(drawX, drawY, assetSize, assetSize);

            int stepPage = s / 8;
            bool isFocusPage = (stepPage == currentPage);

            juce::Image* bgImage = (stepPage % 2 == 0) ? &inactiveBgA : &inactiveBgB;

            // 1. Draw Inactive Background
            if (s < len && bgImage->isValid()) {
                float bgAlpha = isFocusPage ? 1.0f : 0.6f;
                g.setOpacity(bgAlpha);
                g.drawImage(*bgImage, assetRect);
                g.setOpacity(1.0f);
            }

            // 2. Draw Active Note
            if (s < len && audioProcessor.sequencerMatrix[t][s].isActive) {
                float vel = audioProcessor.sequencerMatrix[t][s].velocity;
                float alpha = isFocusPage ? 1.0f : 0.4f;
                alpha *= (0.2f + (vel * 0.8f));

                if (activeKeys[t].isValid()) {
                    g.setOpacity(alpha);
                    g.drawImage(activeKeys[t], assetRect);
                    g.setOpacity(1.0f);
                }
            }

            // 3. Draw Playhead Box
            if (global16thNote >= 0 && s == (global16thNote % len)) {
                g.setColour(juce::Colours::white.withAlpha(0.7f));
                g.drawRect(assetRect, 1.5f);
            }
        }
    }

    g.setColour(juce::Colours::white);
    g.setFont(juce::FontOptions(22.0f, juce::Font::bold));
    g.drawText("PAGE " + juce::String(currentPage + 1), getWidth() - 150, 20, 130, 40, juce::Justification::centredRight);
}

void MiniLAB3StepSequencerAudioProcessorEditor::mouseDown(const juce::MouseEvent& e)
{
    // --- MATCH THE HARDCODED POSITIONS ---
    int startX = 136;
    int topY = 124;

    int gridAreaW = getWidth() - startX - 25;
    int cellW = gridAreaW / 32;
    int cellH = (getHeight() - topY - 20) / 16;

    const int row = (e.y - topY) / cellH;

    const juce::ScopedLock sl(audioProcessor.stateLock);

    // X Button clicked (adjusted to match new layout)
    if (e.x > 95 && e.x < 117) {
        if (row >= 0 && row < 16) {
            for (int s = 0; s < 32; ++s) {
                audioProcessor.sequencerMatrix[row][s].isActive = false;
            }
            audioProcessor.updateTrackLength(row);
            audioProcessor.requestLedRefresh();
        }
    }

    // Grid clicked
    const int col = (e.x - startX) / cellW;
    if (col >= 0 && col < 32 && row >= 0 && row < 16) {
        audioProcessor.sequencerMatrix[row][col].isActive = !audioProcessor.sequencerMatrix[row][col].isActive;
        audioProcessor.sequencerMatrix[row][col].velocity = 0.8f;

        audioProcessor.updateTrackLength(row);
        audioProcessor.requestLedRefresh();
    }

    repaint();
}

void MiniLAB3StepSequencerAudioProcessorEditor::resized() {}