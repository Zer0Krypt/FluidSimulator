export class UIController {
    constructor(app) {
        this.app = app;
        this.isPlaying = false;  // Start paused
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
            planet: [
                { 
                    name: 'planetRadius', 
                    min: 1, 
                    max: 10, 
                    step: 0.1, 
                    default: 5.0, 
                    label: 'Planet Radius',
                    tooltip: 'Size of the planet. Larger values create a bigger planet, smaller values create a more compact planet.'
                },
                { 
                    name: 'planetMass', 
                    min: 100, 
                    max: 10000, 
                    step: 100, 
                    default: 1000.0, 
                    label: 'Planet Mass',
                    tooltip: 'Mass of the planet. Higher values create stronger gravitational pull, lower values allow particles to float more freely.'
                }
            ],
            moon: [
                { 
                    name: 'moonRadius', 
                    min: 0.1, 
                    max: 5, 
                    step: 0.1, 
                    default: 1.0, 
                    label: 'Moon Radius',
                    tooltip: 'Size of the moon. Larger values create a bigger moon, smaller values create a more compact moon.'
                },
                { 
                    name: 'moonMass', 
                    min: 10, 
                    max: 1000, 
                    step: 10, 
                    default: 100.0, 
                    label: 'Moon Mass',
                    tooltip: 'Mass of the moon. Higher values create stronger tidal forces, lower values reduce the moon\'s influence on fluid particles.'
                },
                { 
                    name: 'moonOrbitRadius', 
                    min: 8, 
                    max: 30, 
                    step: 0.5, 
                    default: 15.0, 
                    label: 'Orbit Radius',
                    tooltip: 'Distance between moon and planet. Larger values place the moon further away (weaker influence), smaller values bring it closer (stronger influence).'
                },
                { 
                    name: 'moonOrbitalSpeed', 
                    min: 0.1, 
                    max: 2.0, 
                    step: 0.1, 
                    default: 0.5, 
                    label: 'Orbital Speed',
                    tooltip: 'Speed of moon\'s orbit. Higher values make the moon orbit faster, lower values create slower orbits.'
                }
            ],
            fluid: [
                { 
                    name: 'particleCount', 
                    min: 100, 
                    max: 10000, 
                    step: 100, 
                    default: 1000, 
                    label: 'Particle Count',
                    tooltip: 'Number of fluid particles. More particles create smoother fluid simulation but may impact performance.'
                },
                { 
                    name: 'fluidHeight', 
                    min: 0.1, 
                    max: 2.0, 
                    step: 0.1, 
                    default: 0.5, 
                    label: 'Fluid Height',
                    tooltip: 'Height of fluid above planet surface. Larger values create deeper oceans, smaller values create shallower seas.'
                },
                { 
                    name: 'fluidSpread', 
                    min: 0.1, 
                    max: 1.0, 
                    step: 0.1, 
                    default: 0.8, 
                    label: 'Fluid Coverage',
                    tooltip: 'How much of planet surface is covered by fluid. Higher values cover more surface area, lower values concentrate fluid more.'
                },
                { 
                    name: 'viscosity', 
                    min: 0.1, 
                    max: 10.0, 
                    step: 0.1, 
                    default: 1.0, 
                    label: 'Fluid Viscosity',
                    tooltip: 'Thickness of the fluid. Higher values make fluid more honey-like, lower values make it more water-like.'
                }
            ],
            simulation: [
                { 
                    name: 'timeScale', 
                    min: 0.1, 
                    max: 10.0, 
                    step: 0.1, 
                    default: 1.0, 
                    label: 'Time Scale',
                    tooltip: 'Speed of simulation. Higher values make simulation run faster, lower values slow it down.'
                },
                { 
                    name: 'gravitationalConstant', 
                    min: 1e-12, 
                    max: 1e-10, 
                    step: 1e-12, 
                    default: 6.67430e-11, 
                    label: 'G Constant',
                    tooltip: 'Strength of gravitational forces. Higher values create stronger gravity effects, lower values weaken gravitational influence.'
                }
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
                label.textContent = control.label;
                label.title = control.tooltip; // Add tooltip to label
                
                const input = document.createElement('input');
                input.type = 'number';
                input.min = control.min;
                input.max = control.max;
                input.step = control.step;
                input.value = control.default;
                input.className = 'number-input';
                input.setAttribute('data-param', control.name);
                input.title = control.tooltip; // Add tooltip to input
                
                // Add min/max display
                const rangeInfo = document.createElement('span');
                rangeInfo.className = 'range-info';
                rangeInfo.textContent = `(${control.min} - ${control.max})`;
                rangeInfo.title = control.tooltip; // Add tooltip to range info

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
        
        // Reset all controls to their default values
        Object.entries(this.app.fluidSimulator.parameters).forEach(([name, value]) => {
            const control = document.querySelector(`input[data-param="${name}"]`);
            if (control && control.dataset.default) {
                const defaultValue = parseFloat(control.dataset.default);
                this.app.fluidSimulator.setParameter(name, defaultValue);
                this.updateControlValue(name, defaultValue);
            }
        });
        
        // Reset particles to initial state
        this.app.fluidSimulator.resetToDefault();
        
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









