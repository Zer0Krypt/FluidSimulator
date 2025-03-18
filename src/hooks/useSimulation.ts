import { useState, useEffect, useRef } from 'react';
import init, { SimulationEngine } from '../../wasm/pkg';

export const useSimulation = (config: SimulationConfig) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const engineRef = useRef<SimulationEngine | null>(null);

    useEffect(() => {
        const initSimulation = async () => {
            await init();
            engineRef.current = new SimulationEngine(config);
            setIsInitialized(true);
        };

        initSimulation();

        return () => {
            if (engineRef.current) {
                engineRef.current.free();
            }
        };
    }, []);

    const step = (dt: number) => {
        if (engineRef.current) {
            engineRef.current.step(dt);
            return engineRef.current.get_particle_positions();
        }
        return null;
    };

    return {
        isInitialized,
        step
    };
};