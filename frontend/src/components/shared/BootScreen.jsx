import React from 'react';

export default function BootScreen({ status, debugInfo }) {
    return (
        <div className="boot-screen">
            <h2>Alpha Sequencer Booting...</h2>
            <div className="boot-screen__panel">
                <p>Status: {status}</p>
                <p className="boot-screen__debug">{debugInfo}</p>
            </div>
        </div>
    );
}
