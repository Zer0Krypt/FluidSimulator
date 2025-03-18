export class UIController {
    constructor(app) {
        this.app = app;
        this.isPlaying = false;
        this.setupEventListeners();
        this.createControls();
        this.debounceTimeout = null;
    }

    setupEventListeners() {
        document.getElementById('play-pause').addEventListener('click', () => {
            requestAnimationFrame(() => this.toggleSimulation());
        });
        
        document.getElementById('reset').addEventListener('click', () => {
            requestAnimationFrame(() => this.resetSimulation());
        });
        
        document.getElementById('seed').addEventListener('change', (e) => {
            this.debounceLoadScenario(e.target.value);
        });
    }

    debounceLoadScenario(seed) {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        this.debounceTimeout = setTimeout(() => {
            requestAnimationFrame(() => this.loadScenario(seed));
        }, 250);
    }

    createControls() {
        const physicsControls = document.getElementById('physics-controls');
        
        const controlGroups = {
            basic: [
                { name: 'scale', min: 0.001, max: 1000000, step: 0.001, default: 1.0, type: 'exponential' },
                { name: 'timeScale', min: 0.01, max: 10, step: 0.01, default: 1.0 },
                { name: 'particleCount', min: 100, max: 10000, step: 100, default: 1000 }
            ],
            physics: [
                { name: 'gravity', min: -100, max: 100, step: 0.1, default: -9.81 },
                { name: 'viscosity', min: 0, max: 10, step: 0.01, default: 1.0 },
                { name: 'density', min: 0.1, max: 10000, step: 0.1, default: 1000.0 },
                { name: 'pressure', min: 0, max: 10, step: 0.1, default: 1.0 },
                { name: 'surfaceTension', min: 0, max: 1, step: 0.001, default: 0.072 }
            ],
            advanced: [
                { name: 'smoothingLength', min: 0.01, max: 1, step: 0.01, default: 0.1 },
                { name: 'boundaryDamping', min: 0, max: 1, step: 0.01, default: 0.5 },
                { name: 'gasConstant', min: 100, max: 10000, step: 100, default: 2000 }
            ]
        };

        Object.entries(controlGroups).forEach(([groupName, controls]) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'control-group';
            const groupTitle = document.createElement('h4');
            groupTitle.textContent = groupName.charAt(0).toUpperCase() + groupName.slice(1) + ' Controls';
            groupDiv.appendChild(groupTitle);

            controls.forEach(control => {
                const container = document.createElement('div');
                container.className = 'control-item';
                
                const label = document.createElement('label');
                label.textContent = control.name;
                
                const input = document.createElement('input');
                input.type = 'number';
                input.min = control.min;
                input.max = control.max;
                input.step = control.step;
                input.value = control.default;
                input.className = 'number-input';
                input.setAttribute('data-param', control.name);
                
                // Add min/max display
                const rangeInfo = document.createElement('span');
                rangeInfo.className = 'range-info';
                rangeInfo.textContent = `(${control.min} - ${control.max})`;

                input.addEventListener('change', (e) => {
                    let value = parseFloat(e.target.value);
                    
                    // Clamp value to min/max
                    value = Math.max(control.min, Math.min(control.max, value));
                    
                    if (control.type === 'exponential') {
                        value = Math.pow(10, value);
                    }
                    
                    // Update input value if it was clamped
                    input.value = value;
                    
                    this.app.fluidSimulator.setParameter(control.name, value);
                });

                container.appendChild(label);
                container.appendChild(input);
                container.appendChild(rangeInfo);
                groupDiv.appendChild(container);
            });

            physicsControls.appendChild(groupDiv);
        });
    }

    toggleSimulation() {
        this.isPlaying = !this.isPlaying;
        const button = document.getElementById('play-pause');
        button.textContent = this.isPlaying ? 'Pause' : 'Play';
        
        // Update simulator and animation state
        this.app.fluidSimulator.setParameter('timeScale', this.isPlaying ? 1.0 : 0.0);
        this.app.toggleAnimation(this.isPlaying);
    }

    resetSimulation() {
        // Pause simulation during reset
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.toggleSimulation();
        }
        
        // Reset particles
        this.app.fluidSimulator.initializeParticles(
            this.app.fluidSimulator.parameters.particleCount
        );
        
        // Resume if it was playing
        if (wasPlaying) {
            this.toggleSimulation();
        }
    }

    loadScenario(seed) {
        // Pause simulation during load
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.toggleSimulation();
        }
        
        const scenario = this.app.scenarioManager.loadScenario(seed);
        if (scenario) {
            // Update simulator parameters in batches
            requestAnimationFrame(() => {
                Object.entries(scenario.parameters).forEach(([name, value]) => {
                    this.app.fluidSimulator.setParameter(name, value);
                    this.updateControlValue(name, value);
                });
                
                // Reset simulation with new parameters
                this.app.fluidSimulator.initializeParticles();
                
                // Resume if it was playing
                if (wasPlaying) {
                    this.toggleSimulation();
                }
            });
        } else {
            console.warn('Failed to load scenario. Using default parameters.');
            if (wasPlaying) {
                this.toggleSimulation();
            }
        }
    }

    updateControlValue(name, value) {
        const input = document.querySelector(`input[data-param="${name}"]`);
        if (input) {
            input.value = value;
        }
    }
}




