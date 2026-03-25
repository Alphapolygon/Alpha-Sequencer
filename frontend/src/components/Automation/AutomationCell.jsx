import React from 'react';
import { hexToRgba } from '../../utils/color.js';

const AutomationCell = React.memo(function AutomationCell({
    value,
    isActive,
    isPlayhead,
    isOutOfBounds,
    trackColor,
    onDraw,
    onContextMenu,
    isBipolar,
    currentJitter,
}) {
    return (
        <div
            className={`auto-cell flex-1 h-full flex flex-col justify-end group cursor-ns-resize relative overflow-hidden ${isPlayhead ? 'playhead-active' : ''}`}
            onMouseDown={onDraw}
            onMouseMove={onDraw}
            onContextMenu={onContextMenu}
            style={{ opacity: isOutOfBounds ? 0.2 : 1 }}
        >
            {currentJitter > 0 && (
                <div
                    className="absolute w-full pointer-events-none"
                    style={{
                        backgroundColor: hexToRgba(trackColor, 0.3),
                        height: isBipolar ? `${currentJitter * 100}%` : `${currentJitter * 200}%`,
                        bottom: isBipolar
                            ? `calc(50% + ${value * 50}% - ${currentJitter * 50}%)`
                            : `calc(${value}% - ${currentJitter * 100}%)`,
                        zIndex: 0,
                    }}
                />
            )}

            <div
                className="w-full absolute transition-colors duration-75 border-l border-r border-black"
                style={{
                    height: isBipolar ? `${Math.abs(value) * 50}%` : `${value}%`,
                    bottom: isBipolar ? (value > 0 ? '50%' : 'auto') : '0',
                    top: isBipolar && value < 0 ? '50%' : 'auto',
                    backgroundColor: isOutOfBounds ? 'rgba(0,0,0,0.4)' : (isActive ? trackColor : 'rgba(255,255,255,0.05)'),
                    borderTop: isPlayhead ? '2px solid #fff' : 'none',
                    boxShadow: isPlayhead ? `0 0 10px ${trackColor}` : 'none',
                    zIndex: 1,
                }}
            >
                {isPlayhead && <div className="absolute inset-0 bg-white/20 pointer-events-none" />}
            </div>

            {isBipolar && <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/20 pointer-events-none z-10" />}
        </div>
    );
});

export default AutomationCell;
