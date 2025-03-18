import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.js';

class Particle {
    constructor(position, mass = 1.0) {
        this.position = position.clone();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.mass = mass;
        this.density = 0;
        this.pressure = 0;
        this.neighbors = [];
    }
}

class FluidSimulation {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.particles = [];
        this.timeScale = 1;
        this.isPlaying = false;

        // SPH parameters
        this.smoothingLength = 1.0;
        this.targetDensity = 1000.0;
        this.pressureConstant = 50.0;
        this.viscosity = 0.018;
        this.gravity = new THREE.Vector3(0, -9.81, 0);
        this.boundaryDamping = -0.5;
        
        // Particle visualization
        this.particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        this.particleMaterial = new THREE.MeshPhongMaterial({ color: 0x00aaff });
        
        this.init();
        this.initLighting();
        this.createInitialParticles();
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
    }

    createInitialParticles(count = 100) {
        // Create a grid of particles
        const spacing = 0.3;
        const gridSize = Math.ceil(Math.cbrt(count));
        
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                for (let z = 0; z < gridSize; z++) {
                    if (this.particles.length >= count) break;
                    
                    const position = new THREE.Vector3(
                        x * spacing - (gridSize * spacing) / 2,
                        y * spacing,
                        z * spacing - (gridSize * spacing) / 2
                    );
                    
                    const particle = new Particle(position);
                    const mesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
                    mesh.position.copy(position);
                    
                    particle.mesh = mesh;
                    this.particles.push(particle);
                    this.scene.add(mesh);
                }
            }
        }
    }

    findNeighbors() {
        for (const particle of this.particles) {
            particle.neighbors = [];
            for (const other of this.particles) {
                if (particle === other) continue;
                
                const distance = particle.position.distanceTo(other.position);
                if (distance < this.smoothingLength) {
                    particle.neighbors.push(other);
                }
            }
        }
    }

    calculateDensityPressure() {
        for (const particle of this.particles) {
            particle.density = 0;
            
            // Self-density
            particle.density += this.kernelPoly6(0, this.smoothingLength);
            
            // Neighbor density contribution
            for (const neighbor of particle.neighbors) {
                const distance = particle.position.distanceTo(neighbor.position);
                particle.density += neighbor.mass * this.kernelPoly6(distance, this.smoothingLength);
            }
            
            // Calculate pressure using equation of state
            particle.pressure = this.pressureConstant * (particle.density - this.targetDensity);
        }
    }

    calculateForces() {
        const tempVec = new THREE.Vector3();
        
        for (const particle of this.particles) {
            particle.acceleration.set(0, 0, 0);
            
            // Pressure force
            const pressureForce = new THREE.Vector3();
            for (const neighbor of particle.neighbors) {
                const distance = particle.position.distanceTo(neighbor.position);
                if (distance === 0) continue;
                
                tempVec.copy(neighbor.position).sub(particle.position).normalize();
                const pressureGradient = this.kernelSpikyGradient(distance, this.smoothingLength);
                const sharedPressure = (particle.pressure + neighbor.pressure) / (2 * neighbor.density);
                
                pressureForce.add(tempVec.multiplyScalar(pressureGradient * sharedPressure * neighbor.mass));
            }
            
            // Viscosity force
            const viscosityForce = new THREE.Vector3();
            for (const neighbor of particle.neighbors) {
                const distance = particle.position.distanceTo(neighbor.position);
                if (distance === 0) continue;
                
                tempVec.copy(neighbor.velocity).sub(particle.velocity);
                const viscosityGradient = this.kernelViscosityLaplacian(distance, this.smoothingLength);
                
                viscosityForce.add(tempVec.multiplyScalar(viscosityGradient * neighbor.mass / neighbor.density));
            }
            viscosityForce.multiplyScalar(this.viscosity);
            
            // Apply forces
            particle.acceleration.add(pressureForce.divideScalar(particle.density));
            particle.acceleration.add(viscosityForce);
            particle.acceleration.add(this.gravity);
        }
    }

    updateParticles(deltaTime) {
        deltaTime *= this.timeScale;
        
        for (const particle of this.particles) {
            // Velocity Verlet integration
            particle.velocity.add(particle.acceleration.multiplyScalar(deltaTime));
            particle.position.add(particle.velocity.multiplyScalar(deltaTime));
            
            // Simple boundary conditions (box)
            this.enforceBoundary(particle);
            
            // Update visual representation
            particle.mesh.position.copy(particle.position);
        }
    }

    enforceBoundary(particle) {
        const bounds = 5;
        const velocity = particle.velocity;
        const position = particle.position;
        
        if (position.x > bounds) { position.x = bounds; velocity.x *= this.boundaryDamping; }
        if (position.x < -bounds) { position.x = -bounds; velocity.x *= this.boundaryDamping; }
        if (position.y > bounds) { position.y = bounds; velocity.y *= this.boundaryDamping; }
        if (position.y < -bounds) { position.y = -bounds; velocity.y *= this.boundaryDamping; }
        if (position.z > bounds) { position.z = bounds; velocity.z *= this.boundaryDamping; }
        if (position.z < -bounds) { position.z = -bounds; velocity.z *= this.boundaryDamping; }
    }

    // SPH Kernel functions
    kernelPoly6(distance, h) {
        if (distance >= h) return 0;
        const h2 = h * h;
        const h9 = h2 * h2 * h2 * h2 * h;
        return 315.0 / (64.0 * Math.PI * h9) * Math.pow(h2 - distance * distance, 3);
    }

    kernelSpikyGradient(distance, h) {
        if (distance >= h) return 0;
        const h5 = h * h * h * h * h;
        return -45.0 / (Math.PI * h5) * Math.pow(h - distance, 2);
    }

    kernelViscosityLaplacian(distance, h) {
        if (distance >= h) return 0;
        const h2 = h * h;
        return 45.0 / (Math.PI * h2 * h2 * h2) * (h - distance);
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        
        this.camera.position.z = 5;
        
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        
        this.setupControls();
        this.animate();
    }
    
    setupControls() {
        // Play/Pause controls
        document.getElementById('play').onclick = () => this.isPlaying = true;
        document.getElementById('pause').onclick = () => this.isPlaying = false;
        
        // Reset button
        document.getElementById('reset').onclick = () => {
            this.particles.forEach(particle => this.scene.remove(particle.mesh));
            this.particles = [];
            this.createInitialParticles(parseInt(document.getElementById('particleCount').value));
        };
        
        // Share button
        document.getElementById('share').onclick = () => {
            const seed = this.generateSimulationSeed();
            // Implement sharing functionality
        };

        // Setup all sliders
        this.setupSlider('timeScale', 'timeScaleValue', 'x', value => this.timeScale = parseFloat(value));
        this.setupSlider('particleCount', 'particleCountValue', '', value => {
            if (!this.isPlaying) {
                this.particles.forEach(particle => this.scene.remove(particle.mesh));
                this.particles = [];
                this.createInitialParticles(parseInt(value));
            }
        });
        this.setupSlider('smoothingLength', 'smoothingLengthValue', '', value => this.smoothingLength = parseFloat(value));
        this.setupSlider('targetDensity', 'targetDensityValue', '', value => this.targetDensity = parseFloat(value));
        this.setupSlider('pressureConstant', 'pressureConstantValue', '', value => this.pressureConstant = parseFloat(value));
        this.setupSlider('viscosity', 'viscosityValue', '', value => this.viscosity = parseFloat(value));
        this.setupSlider('gravity', 'gravityValue', '', value => this.gravity.y = parseFloat(value));
        this.setupSlider('boundaryDamping', 'boundaryDampingValue', '', value => this.boundaryDamping = parseFloat(value));
    }

    setupSlider(sliderId, valueId, suffix = '', callback) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);
        
        // Set initial value
        valueDisplay.textContent = slider.value + suffix;
        
        // Update on change
        slider.oninput = (e) => {
            const value = e.target.value;
            valueDisplay.textContent = value + suffix;
            callback(value);
        };
    }
    
    generateSimulationSeed() {
        return {
            timeScale: this.timeScale,
            particleCount: this.particles.length,
            smoothingLength: this.smoothingLength,
            targetDensity: this.targetDensity,
            pressureConstant: this.pressureConstant,
            viscosity: this.viscosity,
            gravity: this.gravity.y,
            boundaryDamping: this.boundaryDamping
        };
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.isPlaying) {
            this.updateSimulation();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updateSimulation() {
        const deltaTime = 1/60; // Fixed timestep
        
        this.findNeighbors();
        this.calculateDensityPressure();
        this.calculateForces();
        this.updateParticles(deltaTime);
    }
}

const simulation = new FluidSimulation();



