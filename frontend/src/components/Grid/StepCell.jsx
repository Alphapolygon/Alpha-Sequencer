import React from 'react';

const StepCell = React.memo(function StepCell({ isActive, isPlayhead, isOutOfBounds, trackColor, onClick }) {
    return (
        <div
            onClick={onClick}
            className={`step-cell flex-1 rounded-[1px] cursor-pointer border relative overflow-hidden duration-75 ${isPlayhead ? 'playhead-active' : ''}`}
            style={{
                backgroundColor: isOutOfBounds ? 'rgba(0,0,0,0.4)' : (isActive ? trackColor : 'rgba(255,255,255,0.10)'),
                borderColor: isPlayhead ? trackColor : 'rgba(0,0,0,0.4)',
                opacity: isOutOfBounds ? 0.3 : 1,
                boxShadow: isPlayhead ? `inset 0 0 5px ${trackColor}` : 'none',
                transform: isPlayhead ? 'scaleY(1.1)' : 'none',
            }}
        />
    );
});

export default StepCell;
