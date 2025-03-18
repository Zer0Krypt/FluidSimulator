export class UIController {
    constructor(app) {
        this.app = app;
        this.isPlaying = false;
        this.setupEventListeners();
        this.createControls();
    }

    setupEventListeners() {
        document.getElementById('play-pause').addEventListener('click', () => this.toggleSimulation());
        document.getElementById('reset').addEventListener('click', () => this.resetSimulation());
        document.getElementById('seed').addEventListener('change', (e) => this.loadScenario(e.target.value));
    }

    createControls() {
        const physicsControls = document.getElementById('physics-controls');
        
        const controlGroups = {
            basic: [
                { name: 'scale', min: 0.001, max: 1000000, step: 0.001, default: 1.0, type: 'exponential' },
                { name: 'timeScale', min: 0.01, max: 10, step: 0.01, default: 1.0 },
                { name: 'particleCount', min: 100, max: 1000000, step: 100, default: 1000 }
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
                
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = control.min;
                slider.max = control.max;
                slider.step = control.step;
                slider.value = control.default;
                slider.className = 'slider-control';
                
                const valueDisplay = document.createElement('span');
                valueDisplay.textContent = control.default;
                
                slider.addEventListener('input', (e) => {
                    let value = parseFloat(e.target.value);
                    if (control.type === 'exponential') {
                        value = Math.pow(10, value);
                    }
                    this.app.fluidSimulator.setParameter(control.name, value);
                    valueDisplay.textContent = value.toFixed(4);
                });

                container.appendChild(label);
                container.appendChild(slider);
                container.appendChild(valueDisplay);
                groupDiv.appendChild(container);
            });

            physicsControls.appendChild(groupDiv);
        });
    }

    toggleSimulation() {
        this.isPlaying = !this.isPlaying;
        const button = document.getElementById('play-pause');
        button.textContent = this.isPlaying ? 'Pause' : 'Play';
        this.app.fluidSimulator.setParameter('timeScale', this.isPlaying ? 1.0 : 0.0);
    }

    resetSimulation() {
        this.app.fluidSimulator.initializeParticles(this.app.fluidSimulator.parameters.particleCount);
    }

    loadScenario(seed) {
        const scenario = this.app.scenarioManager.loadScenario(seed);
        if (scenario) {
            // Update simulator parameters
            Object.entries(scenario.parameters).forEach(([name, value]) => {
                this.app.fluidSimulator.setParameter(name, value);
                this.updateControlValue(name, value);
            });
            
            // Reset simulation with new parameters
            this.app.fluidSimulator.initializeParticles();
        } else {
            console.warn('Failed to load scenario. Using default parameters.');
        }
    }

    updateControlValue(name, value) {
        const slider = document.querySelector(`input[type="range"][data-param="${name}"]`);
        if (slider) {
            slider.value = value;
            slider.nextElementSibling.textContent = value.toFixed(4);
        }
    }
}

