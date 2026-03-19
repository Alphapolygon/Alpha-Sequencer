## 🎹 Alpha Sequencer: Arturia MiniLab 3 Edition
Alpha Sequencer is a professional VST3 step sequencer designed specifically to unlock the hidden production power of the Arturia MiniLab 3. By bridging the gap between Arturia’s high-quality hardware and a modern, browser-based UI, it provides a 16-track, 32-step sequencing environment with features typically reserved for high-end hardware like the BeatStep Pro.

## ☕ Support the Project
This plugin was developed to give the MiniLab/KeyLab features that Arturia left out. 
It took dozens of hours of MIDI reverse-engineering to get the pad lights working!
Found it useful? Buying me a coffee to support further updates (like minilab mk2m support or and other Arturia models support)


[![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/alphapolygon)

## ✨ Key Features
## 🚀 Advanced Sequencing Engine (C++)
16 Tracks & 32 Steps: Full polyphonic sequencing with independent track lengths for complex polyrhythms.

Stochastic Tools: Per-step Probability (0-100%) and Ratcheting/Repeats (1-4) for modern production styles.

Human Feel: High-resolution Micro-Timing (Nudge) and both Global and Per-Step Swing controls.

Pattern Matrix: Store and switch between 10 unique patterns (A-J) instantly.

## 💻 Modern Hybrid UI (React)
Hardware-Accelerated Webview: Built with React and Vite, rendered via JUCE WebView2 for a buttery-smooth 30Hz sync with your DAW.

Automation Lanes: dedicated visual editors for Velocity, Gate, Probability, Shift, and Swing.

MIDI Export: One-click generation of MIDI files for individual tracks or the entire 16-track pattern directly from the plugin.

Dynamic Themes: Includes Alpha, Cyberpunk, Midnight, Solar, and Forest interface themes.

## 🛠 Hardware Integration (MiniLab 3)
Active LED Feedback: Pads sync in real-time to show playhead position, active steps, and page context (Cyan/Magenta/Yellow/White).

Intelligent Paging: Navigate 32 steps across 8 physical pads using the designated hardware encoder.

Knob Mapping: Knobs 1-8 automatically map to velocity editing for the currently visible 8-step page.

OLED Support: Logic included for updating the MiniLab 3 screen during page and instrument changes.

## 🚀 Installation
For Users
Requirement: Windows users must have the WebView2 Runtime installed (standard on most modern Windows 10/11 installs).

Download the latest AlphaSequencer.vst3 from [Releases].

Place in your VST3 folder:

Windows: C:\Program Files\Common Files\VST3

macOS: /Library/Audio/Plug-Ins/VST3

Important: In your DAW, ensure the MiniLab 3 MIDI Output is enabled and not being used by another control surface script for full LED support.

## ⚖️ License & Terms
This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).

Non-Commercial: You may not use this material for commercial purposes (selling the plugin or derived code).

Porting: You are encouraged to port this to other Arturia models (KeyLab, etc.) provided you share the results under the same license.

Commercial Use: As the original author, I reserve the right to offer official compiled installers or professional support for a fee.

## 🛠 Developer API (Internal Bridge)
The plugin uses a JSON-based state bridge. Developers looking to build custom skins or ports can interface with the engine via these native calls:

requestInitialState(): Fetches the full serialized UI and Matrix state.

updateCPlusPlusState(json): Updates the C++ engine with new step, velocity, or timing data.

saveFullUiState(json): Persists non-audio UI settings (themes, tabs) into the VST's state.

## 🛠 Technical Specifications
Framework: JUCE 7/8 + React 18

Backend: WebView2 (Win) / WKWebView (Mac)

MIDI Buffer: Thread-safe scheduling with CriticalSection locks for jitter-free playback.




