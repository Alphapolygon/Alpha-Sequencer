## 🎹 Alpha Sequencer: Arturia MiniLab 3 Edition
Alpha Sequencer is a professional-grade VST3 step sequencer that transforms the Arturia MiniLab 3 into a 16-track production powerhouse. It features a hybrid architecture combining a low-latency C++ MIDI engine with a modern React-based automation interface.

## ☕ Support the Project
This plugin was developed to give the MiniLab/KeyLab features that Arturia left out. 
It took dozens of hours of MIDI reverse-engineering to get the pad lights working!
Found it useful? Buying me a coffee to support further updates (like minilab mk2m support or and other Arturia models support)


[![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/alphapolygon)

## ✨ Core Features
## 🚀 High-Performance Engine (C++)
Double-Buffered State: Implements a MatrixSnapshot system for thread-safe, jitter-free pattern modifications between the UI and audio threads.

10-Pattern Memory: Instant switching between 10 full 16-track patterns (Patterns A–J).

Pro-Grade Parameters: Per-step control for Velocity, Probability (stochastic triggering), Gate (duration), Repeats (1-4x ratcheting), Shift (micro-timing), and Swing.

Sub-Millisecond Timing: MIDI events are scheduled with sample-accurate precision using a PPQ-based priority heap.

Internal Telemetry: Active monitoring of dropped MIDI notes and hardware FIFO overflows to ensure peak performance.

## 💻 Modern Web UI (React & Vite)
Automation Lanes: Drag-to-draw visual editors for all step parameters with 100-point resolution.

Theme Engine: Six high-contrast themes including Alpha, Cyberpunk, Midnight, Solar, Forest, and Monochrome.

MIDI Export: Integrated utility to generate and download .mid files for individual tracks or the entire pattern directly from the plugin window.

Persistence: State-of-the-art XML persistence with a versioned migration pipeline to keep your patterns safe through updates.

## 🛠 MiniLab 3 Hardware Integration
Contextual LED Feedback: Pads change color based on the current 8-step page (Cyan, Magenta, Yellow, White).

Playhead Tracking: High-speed Sysex updates sync the hardware LEDs to the DAW playhead in real-time.

Hardware Navigation: * Encoder (CC 114): Browse through 32-step patterns in 8-step banks.

Knob 1 (CC 1): Fast instrument/track selection.

Knobs 1-8: Direct velocity editing for the current page.

## 🚀 Installation & Requirements
For Users
Requirement: Windows users must have the WebView2 Runtime installed.

Place AlphaSequencer.vst3 in your system VST3 folder:

Windows: C:\Program Files\Common Files\VST3

macOS: /Library/Audio/Plug-Ins/VST3

Hardware Setup: Ensure "MiniLab 3 MIDI" is enabled as a MIDI Output in your DAW settings to allow for LED feedback.

For Developers
Framework: JUCE 8 (WebView2/WKWebView backend).

UI Stack: React 18, Tailwind CSS, Vite.

Internal API: The engine communicates via a JSON bridge using updateCPlusPlusState and requestInitialState native functions.

## ⚖️ License
This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).

Free for Personal Use: You are free to use this in any musical project.

Non-Commercial: You may not sell this plugin or any derivative software.

ShareAlike: Any modifications or ports must be distributed under the same license.

Note: As the original author, I reserve the right to offer official binaries or professional support for a fee.




