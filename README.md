<img width="2656" height="1916" alt="image" src="https://github.com/user-attachments/assets/9b246ac4-20f2-4300-ad3e-714cedf30336" />



## 🎹 Alpha Sequencer
Alpha Sequencer is a 16-track step sequencer VST3. Originally built specifically for the Arturia MiniLab 3, it now features a fully modular controller registry. It bridges a highly optimized React-based user interface with a low-latency C++ engine to provide expanded sequencing capabilities not found in default hardware. 

## ☕ Support the Project
If this tool has improved your workflow, saved you from buying extra hardware, or helped you make music, please consider supporting its continued development. 
Your support helps keep the project alive and funds future ports to other Arturia devices)


[![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/alphapolygon)

## ✨ Core Features
## 🚀 High-Performance Engine (C++)
Modular Hardware Registry: A pluggable MidiControllerProfile architecture allows for seamless integration of new MIDI hardware without touching the core playback logic.

Sample-Accurate Song Mode: Chain patterns (A-J) together for seamless, sample-accurate sequence progression automatically handled by the C++ audio thread.

Ties & Portamento (Glide): Steps with a 100% Gate length automatically act as ties, utilizing legato cutoff to suppress NoteOff messages for smooth 303-style acid glides.

Double-Buffered State: Utilizes a MatrixSnapshot system and writerLock for thread-safe, jitter-free pattern modifications between the UI and audio threads.

Advanced Sequencing: Per-step control for Velocity, Probability (stochastic triggering), Gate (duration), Repeats (1-4x ratcheting), Shift (micro-timing), Swing, and Bipolar Pitch (-24 to +24 semitones).

## 💻 Modern Web UI (React 18 & Vite)
Track Nudging: Instantly shift entire track sequences left or right for quick off-beat syncopation.

Melodic Quantizer: Lock pitch automation to selectable scales (Major, Minor, Dorian, Mixolydian, Pentatonic, Chromatic).

Jitter Visualization: Drag-to-draw automation lanes feature a dynamic overlay showing the exact percentage of non-destructive random deviance applied to steps during playback.

Componentized "JUCE Redux" Architecture: Highly optimized React state management utilizing custom hooks (usePatternCommands, useEngineDiffSubscription) for strict one-way data flow, immutable updates, and minimal re-renders.

Dynamic Grid: Configurable track spacing (1/2 to 1/32), adjustable visible track presets (1 to 16), and clipping-aware dropdown menus.

Zero-CPU Playhead: Implements direct DOM manipulation for playhead tracking, bypassing React's render cycle for extreme UI efficiency.

## 🛠 Hardware Integration (Arturia MiniLab 3 Profile)
Contextual LED Feedback: Pads change color based on the current 8-step page (Cyan, Magenta, Yellow, White).

Sysex Color Engine: High-speed Sysex updates sync hardware LEDs to the DAW playhead in real-time.

Hardware Mappings:

Encoder (CC 114): Browse through 32-step patterns in 8-step banks.

Knob 1 (CC 1): Fast instrument/track selection.

Knobs 1-8: Direct velocity editing for the current 8-step page.

Note for Developers: You can add support for AKAI, Novation, or generic controllers easily by implementing a new MidiControllerProfile.

## 🚀 Installation & Requirements
For Users:

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
The C++ engine communicates with the React UI via a tightly coupled, asynchronous JSON bridge managed by EditorUiBridge:

requestInitialState(): Fetches the full normalized JSON state for UI hydration.

Granular Mutations: Functions like setStepActive, setStepParameter, setTrackLength, and setTrackState apply atomic changes directly to the C++ engine buffers.

Event Subscriptions: The UI listens to engineDiff (for instantaneous state synchronization) and playbackState (for playhead/BPM tracking).

Build the Frontend UI: ```bash
cd frontend
npm install
npm run build


** Generate the IDE Project:**
1. Open `MiniLAB3 Step Sequencer.jucer` in the Projucer.
2. Click "Save and Open in IDE".
3. Compile the VST3/Standalone application from Visual Studio or Xcode.
