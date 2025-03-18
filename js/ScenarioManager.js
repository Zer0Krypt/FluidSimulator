export class ScenarioManager {
    constructor() {
        this.currentScenario = null;
        this.seed = null;
    }

    createScenario(config) {
        const scenario = {
            seed: this.generateSeed(),
            parameters: {
                ...config
            },
            objects: [],
            forces: []
        };
        
        return this.encodeSeed(scenario);
    }

    loadScenario(seed) {
        try {
            const scenarioData = this.decodeSeed(seed);
            this.validateScenarioData(scenarioData);
            this.currentScenario = scenarioData;
            return scenarioData;
        } catch (error) {
            console.error('Failed to load scenario:', error);
            return null;
        }
    }

    generateSeed() {
        return Math.random().toString(36).substring(2, 15);
    }

    decodeSeed(seed) {
        try {
            // Base64 decode and parse JSON
            const decodedString = atob(seed);
            return JSON.parse(decodedString);
        } catch (error) {
            throw new Error('Invalid scenario seed');
        }
    }

    encodeSeed(scenario) {
        try {
            // Validate before encoding
            this.validateScenarioData(scenario);
            
            // Convert to JSON and Base64 encode
            const jsonString = JSON.stringify(scenario);
            return btoa(jsonString);
        } catch (error) {
            throw new Error('Failed to encode scenario');
        }
    }

    validateScenarioData(scenario) {
        if (!scenario || typeof scenario !== 'object') {
            throw new Error('Invalid scenario data: must be an object');
        }

        // Check for required properties
        const requiredProperties = ['parameters', 'objects', 'forces'];
        for (const prop of requiredProperties) {
            if (!(prop in scenario)) {
                throw new Error(`Missing required property: ${prop}`);
            }
        }

        // Validate parameters
        if (typeof scenario.parameters !== 'object') {
            throw new Error('Invalid parameters: must be an object');
        }

        // Validate arrays
        if (!Array.isArray(scenario.objects)) {
            throw new Error('Invalid objects: must be an array');
        }
        if (!Array.isArray(scenario.forces)) {
            throw new Error('Invalid forces: must be an array');
        }
    }

    createDefaultScenario() {
        return {
            seed: this.generateSeed(),
            parameters: {
                gravity: -9.81,
                particleCount: 1000,
                scale: 1.0,
                timeScale: 1.0,
                viscosity: 1.0
            },
            objects: [],
            forces: []
        };
    }
}

