interface SimulationConfig {
    scale: {
        min: number;  // Minimum scale in meters
        max: number;  // Maximum scale in meters
        current: number;
    };
    timeScale: number;  // 1.0 is real-time
    particleCount: number;
    seed: string;  // For reproducible simulations
}

interface PhysicsParams {
    gravity: Vector3;
    temperature: number;
    pressure: number;
    viscosity: number;
    surfaceTension: number;
}

interface SimulationObject {
    id: string;
    type: 'static' | 'dynamic';
    shape: 'sphere' | 'box' | 'mesh';
    position: Vector3;
    rotation: Quaternion;
    velocity?: Vector3;
    angularVelocity?: Vector3;
    mass?: number;
    material: MaterialProperties;
}