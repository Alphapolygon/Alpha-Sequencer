## 🎹 Arturia Pad Sequencer (VST3)
Turn your MiniLab 3 / KeyLab Essential pads into a fully functional 16-step sequencer.

Arturia makes great hardware, but they left a gap: the "Lab" series lacks a hardware step sequencer. This VST3 plugin bridges that gap by hijacking the MIDI data from your pads and providing a synced, visual sequencing interface directly integrated with your DAW.

## ☕ Support the Project
This plugin was developed to give the MiniLab/KeyLab features that Arturia left out. 
It took dozens of hours of MIDI reverse-engineering to get the pad lights working!
Found it useful? Buying me a coffee to support further updates (like minilab mk2m support or and other Arturia models support)


[![Ko-Fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/alphapolygon)

## ✨ Features
8-32-Step Sequencing: Toggle steps using the physical pads on your controller.
16 tracks, ability to change what note the track sends (C1,d2 etc)
Each track can have 8 - 32 steps, these are played in sync. Example track 1 can have 16 steps and track 2 8 steps.

LED Feedback: Pads light up to show active steps and the current playhead.

DAW Sync: Perfect timing with your project BPM via the JUCE framework.

Velocity Sensitive:  Uses pad pressure for step accents and knobs 1 - 8 to tune those values

## 🎹 Hardware Integration
Intelligent LED Feedback: Pads update in real-time to show active steps, playhead position, and page context using custom Sysex coloring.

OLED Support: Optimized to work with the MiniLab 3 display for clear feedback on current Page and Instrument selection.

Smart Paging: Browse 32-step patterns via 8-pad "banks." If a page is empty, the sequencer intelligently loops back to provide a tighter performance.

Encoder Mapping: * Knob 1 (Main): Instrument Selection.

Encoder (CC 114): Page Navigation.

Knobs 1-8: Per-step velocity editing for the current page.

## 🚀 Advanced MIDI Engine
Micro-Timing (Nudge): Shift individual tracks by +/- 20ms for a "laid-back" or "rushed" human feel.

Per-Track Length: Each of the 16 tracks can have an independent length (8, 16, 24, or 32 steps) for complex polyrhythms.

Full Automation: Every parameter—including Mute, Solo, Swing, and Nudge—is linked to the DAW's APVTS for total recall and automation.

## 🛠 Developer API & Integration Guide
This plugin uses a Decoupled Architecture: the C++ "Engine" handles high-speed MIDI timing and hardware Sysex, while a React/Webview layer handles the User Interface. They communicate via JSON and JUCE Native Functions.

1. The C++ ↔ UI BridgeThe UI sends the full state of the sequencer to the C++ engine using the updateCPlusPlusState native function.To update the engine from your UI, call:JavaScriptwindow.window.updateCPlusPlusState(JSON.stringify(sequencerState));
   
3. Supported JSON SchemaThe engine expects a JSON object with the following structure. If you are porting this to a new UI or adding features, ensure your state matches these arrays:
   
   PropertyTypeDescriptionactiveStepsboolean[16][32] Primary toggle for note triggers.
   
   velocitiesint[16][32]Range 0–100 (scaled to 0.0–1.0 in C++).
   
   probabilitiesint[16][32]0–100% chance of the note firing.gatesint[16][32]0–100% (Note duration relative to step).
   
   shiftsint[16][32]0–100 (50 is "on-grid"; <50 is rushed; >50 is lazy).
   
   repeatsint[16][32]1–4 (Ratcheting/Sub-steps).
   
   trackStatesobject[]Contains mute (bool) and solo (bool) per track.3.
   
   Sysex & Hardware LED LogicIf you are porting this to the KeyLab Essential or BeatStep, you only need to modify the updateHardwareLEDs method in PluginProcessor.cpp.
   
   The Header: 0xF0 0x00 0x20 0x6B 0x7F 0x42 targets the MiniLab 3 specifically.
   
   The Command: 0x02 0x01 0x16 is the Arturia command for "Set Pad Color."Color Handling: The engine uses 7-bit values (0–127) for R, G, and B.4.
   
   Build RequirementsFramework: JUCE 7.x or 8.xModule Dependencies: juce_gui_extra (for WebBrowser), juce_audio_utils, juce_midi_ci.Assets:
   
   The React build must be placed in the Source/BinaryData folder as index.html for the ResourceProvider to inject it into the VST window.

## ⚖️ License & Terms
This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).

Free for Personal Use: Use it in your music, live sets, and videos for free.

Open for Porting: You are encouraged to adapt this code for other Arturia models.

Non-Commercial: You cannot sell this plugin, its source code, or any derivative versions.

ShareAlike: If you modify or build upon this work, you must distribute your contributions under the same license.

Note: As the original author, I reserve the right to offer "Official" compiled installers or support packages for a fee to support the ongoing development of this project.




