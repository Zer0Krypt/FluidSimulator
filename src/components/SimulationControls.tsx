import React, { useState } from 'react';
import { SimulationConfig, PhysicsParams } from '../types/simulation';

export const SimulationControls: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [timeScale, setTimeScale] = useState(1.0);
    
    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };
    
    const handleTimeScaleChange = (scale: number) => {
        setTimeScale(scale);
    };
    
    return (
        <div className="simulation-controls">
            <button onClick={handlePlayPause}>
                {isPlaying ? 'Pause' : 'Play'}
            </button>
            <input 
                type="range" 
                min="0.1" 
                max="10" 
                step="0.1" 
                value={timeScale}
                onChange={(e) => handleTimeScaleChange(parseFloat(e.target.value))}
            />
        </div>
    );
};