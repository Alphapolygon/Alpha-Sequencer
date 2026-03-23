<img width="2656" height="1916" alt="image" src="https://github.com/user-attachments/assets/9b246ac4-20f2-4300-ad3e-714cedf30336" />



## 🎹 Alpha Sequencer: Arturia MiniLab 3 Edition
Alpha Sequencer is a 16-track step sequencer VST3 built specifically for the Arturia MiniLab 3. It bridges a React-based user interface with a low-latency C++ engine to provide expanded sequencing capabilities not found in the default hardware.  

## ☕ Support the Project
If this tool has improved your workflow, saved you from buying extra hardware, or helped you make music, please consider supporting its continued development. 
Your support helps keep the project alive and funds future ports to other Arturia devices)


[![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/alphapolygon)

## ✨ Core Features
## 🚀 High-Performance Engine (C++)
Double-Buffered State: Utilizes a MatrixSnapshot system and writerLock for thread-safe, jitter-free pattern modifications between the UI and audio threads.

60Hz Hardware Timer: Ensures sub-millisecond response for hardware LEDs and knob interactions.

10-Pattern Memory: Instant switching between 10 full 16-track patterns (Patterns A–J).

Advanced Sequencing: Per-step control for Velocity, Probability (stochastic triggering), Gate (duration), Repeats (1-4x ratcheting), Shift (micro-timing), and Swing.

Telemetry Monitoring: Real-time tracking of dropped MIDI notes and hardware FIFO overflows for diagnostic transparency.

## 💻 Modern Web UI (React 18 & Vite)
Automation Lanes: Drag-to-draw visual editors for all parameters with 100-point resolution.

Zero-CPU Playhead: Implements direct DOM manipulation for playhead tracking, bypassing React's render cycle for extreme UI efficiency.

Theme Engine: Six high-contrast themes including Alpha, Cyberpunk, Midnight, Solar, Forest, and Monochrome.

MIDI Export: Integrated utility to generate and download .mid files for individual tracks or the entire 16-track pattern.

Persistence: State-of-the-art XML persistence with a versioned migration pipeline to protect your patterns during updates.

## 🛠 MiniLab 3 Hardware Integration
Contextual LED Feedback: Pads change color based on the current 8-step page (Cyan, Magenta, Yellow, White).

Sysex Color Engine: High-speed Sysex updates sync hardware LEDs to the DAW playhead in real-time.

Hardware Mappings:

Encoder (CC 114): Browse through 32-step patterns in 8-step banks.

Knob 1 (CC 1): Fast instrument/track selection.

Knobs 1-8: Direct velocity editing for the current 8-step page.

## 🚀 Installation & Requirements
For Users
Requirement: Windows users must have the WebView2 Runtime installed.

Place AlphaSequencer.vst3 in your system VST3 folder:

Windows: C:\Program Files\Common Files\VST3

macOS: /Library/Audio/Plug-Ins/VST3

Hardware Setup: Ensure "MiniLab 3 MIDI" is enabled as a MIDI Output in your DAW settings to allow for LED feedback.

## ⚖️ License
This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).

Free for Personal Use: You are free to use this in any musical project.

Non-Commercial: You may not sell this plugin or any derivative software.

ShareAlike: Any modifications or ports must be distributed under the same license.

Note: As the original author, I reserve the right to offer official binaries or professional support for a fee.

## 🛠 Developer API (Internal Bridge)
The engine communicates with the UI via a JSON bridge. Developers can interface with the core using these native JUCE functions:

requestInitialState(): Fetches the full serialized state for UI hydration.

updateCPlusPlusState(json): Updates the C++ engine with new step or timing data.

uiReadyForEngineState(): Notifies the engine that the UI is ready to receive hardware updates.

## Build the Frontend UI: 
cd frontend

npm install

npm run build


## Generate the IDE Project:

Open MiniLAB3 Step Sequencer.jucer in the Projucer.

Click "Save and Open in IDE".

Compile the VST3/Standalone application from Visual Studio or Xcode.




