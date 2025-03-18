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
            const scenarioData = JSON.parse(decodedString);
            
            // Validate scenario data
            this.validateScenarioData(scenarioData);
            
            return scenarioData;
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
        const requiredProperties = ['parameters', 'objects', 'forces'];
        requiredProperties.forEach(prop => {
            if (!(prop in scenario)) {
                throw new Error(`Missing required property: ${prop}`);
            }
        });
    }

    addObject(object) {
        if (!this.currentScenario) {
            this.currentScenario = this.createDefaultScenario();
        }
        this.currentScenario.objects.push(object);
    }

    addForce(force) {
        if (!this.currentScenario) {
            this.currentScenario = this.createDefaultScenario();
        }
        this.currentScenario.forces.push(force);
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
