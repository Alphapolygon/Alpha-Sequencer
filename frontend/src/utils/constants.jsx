import React from 'react';

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const MIDI_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap(o => NOTES.map(n => `${n}${o}`));
export const PATTERN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const TAB_TO_KEY = { 'Velocity': 'velocities', 'Gate': 'gates', 'Probability': 'probabilities', 'Shift': 'shifts', 'Swing': 'swings' };

export const THEMES = [
    { name: "Alpha", bg: "#06080b", panel: "#12151c", sidebar: "#0d1015", border: "rgba(255,255,255,0.05)", text: "#94a3b8", accent: "#fb923c", colors: ["#e879f9", "#fb923c", "#facc15", "#4ade80"] },
    { name: "Cyberpunk", bg: "#0d0221", panel: "#190e2f", sidebar: "#120a24", border: "rgba(0,255,255,0.1)", text: "#00ffff", accent: "#ff00ff", colors: ["#ff00ff", "#00ffff", "#ffff00", "#7cfc00"] },
    { name: "Midnight", bg: "#020617", panel: "#0f172a", sidebar: "#080c1a", border: "rgba(99,102,241,0.15)", text: "#94a3b8", accent: "#6366f1", colors: ["#6366f1", "#a855f7", "#d946ef", "#ec4899"] },
    { name: "Solar", bg: "#1c0a00", panel: "#2d1400", sidebar: "#220f00", border: "rgba(251,146,60,0.1)", text: "#fdba74", accent: "#f97316", colors: ["#fcd34d", "#fb923c", "#f87171", "#ef4444"] },
    { name: "Forest", bg: "#020d08", panel: "#061f13", sidebar: "#04150d", border: "rgba(74,222,128,0.1)", text: "#86efac", accent: "#22c55e", colors: ["#4ade80", "#22c55e", "#16a34a", "#15803d"] },
    { name: "Monochrome", bg: "#0f172a", panel: "#1e293b", sidebar: "#111827", border: "rgba(255,255,255,0.1)", text: "#cbd5e1", accent: "#ffffff", colors: ["#f8fafc", "#cbd5e1", "#94a3b8", "#64748b"] }
];

export const Icons = {
    Download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
    ChevronDown: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
    Palette: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H17c2.8 0 5-2.2 5-5 0-5.5-4.5-10-10-10z"/></svg>
};