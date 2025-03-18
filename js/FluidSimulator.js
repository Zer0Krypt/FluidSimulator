import * as THREE from 'three';

export class FluidSimulator {
    constructor() {
        this.particles = [];
        this.parameters = {
            gravity: -9.81,
            particleCount: 1000,
            particleSize: 0.1,
            viscosity: 1.0,
            density: 1000.0, // kg/m³
            pressure: 1.0,
            surfaceTension: 0.072, // N/m
            timeScale: 1.0,
            smoothingLength: 0.1,
            boundaryDamping: 0.5,
            gasConstant: 2000,
            restDensity: 1000.0,
            scale: 1.0, // 1.0 = meters
        };

        this.initializeParticles();
    }

    initParticleSystem() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.parameters.particleCount * 3);
        const colors = new Float32Array(this.parameters.particleCount * 3);

        // Initialize particles with positions and velocities
        for (let i = 0; i < this.parameters.particleCount; i++) {
            const particle = {
                position: new THREE.Vector3(
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1
                ),
                velocity: new THREE.Vector3(0, 0, 0),
                density: 0,
                pressure: 0
            };
            this.particles.push(particle);

            // Set initial positions in geometry
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;

            // Set particle colors
            colors[i * 3] = 0.5;
            colors[i * 3 + 1] = 0.7;
            colors[i * 3 + 2] = 1.0;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: this.parameters.particleSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        this.particleSystem = new THREE.Points(geometry, material);
    }

    calculateDensity(particle, neighbors) {
        let density = 0;
        const h = this.parameters.smoothingLength;

        for (const neighbor of neighbors) {
            const dist = particle.position.distanceTo(neighbor.position);
            if (dist < h) {
                // Simple polynomial kernel
                density += Math.pow(h * h - dist * dist, 3);
            }
        }

        return density;
    }

    findNeighbors(particle) {
        return this.particles.filter(other => {
            if (other === particle) return false;
            return particle.position.distanceTo(other.position) < this.parameters.smoothingLength;
        });
    }

    update() {
        const deltaTime = this.parameters.timeScale * 0.016;
        const positions = this.particleSystem.geometry.attributes.position.array;

        // Update particle physics
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const neighbors = this.findNeighbors(particle);

            // Calculate density
            particle.density = this.calculateDensity(particle, neighbors);
            particle.pressure = this.parameters.gasConstant * (particle.density - this.parameters.restDensity);

            // Apply forces
            const force = new THREE.Vector3(0, this.parameters.gravity, 0);

            // Apply pressure and viscosity forces
            for (const neighbor of neighbors) {
                const diff = neighbor.position.clone().sub(particle.position);
                const dist = diff.length();
                if (dist > 0) {
                    // Pressure force
                    const pressureForce = diff.normalize().multiplyScalar(
                        (particle.pressure + neighbor.pressure) / (2 * neighbor.density)
                    );
                    force.add(pressureForce);

                    // Viscosity force
                    const viscosityForce = neighbor.velocity.clone()
                        .sub(particle.velocity)
                        .multiplyScalar(this.parameters.viscosity / neighbor.density);
                    force.add(viscosityForce);
                }
            }

            // Update velocity and position
            particle.velocity.add(force.multiplyScalar(deltaTime));
            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

            // Boundary conditions
            const bounds = 10 * this.parameters.scale;
            ['x', 'y', 'z'].forEach(axis => {
                if (Math.abs(particle.position[axis]) > bounds) {
                    particle.position[axis] = Math.sign(particle.position[axis]) * bounds;
                    particle.velocity[axis] *= -this.parameters.boundaryDamping;
                }
            });

            // Update geometry
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    setParameter(name, value) {
        if (name in this.parameters) {
            this.parameters[name] = value;
            this.updateScale();
        }
    }

    updateScale() {
        if (this.particleSystem) {
            this.particleSystem.material.size = this.parameters.particleSize * this.parameters.scale;
        }
    }

    getParticleSystem() {
        return this.particleSystem;
    }

    initializeParticles(count = null) {
        if (count !== null) {
            this.parameters.particleCount = count;
        }
        
        // Clear existing particles
        this.particles = [];
        
        // Create new geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.parameters.particleCount * 3);
        const colors = new Float32Array(this.parameters.particleCount * 3);

        // Initialize particles in a more visible arrangement (cube formation)
        const size = Math.ceil(Math.pow(this.parameters.particleCount, 1/3));
        const spacing = 0.2;
        let index = 0;

        for (let x = 0; x < size && index < this.parameters.particleCount; x++) {
            for (let y = 0; y < size && index < this.parameters.particleCount; y++) {
                for (let z = 0; z < size && index < this.parameters.particleCount; z++) {
                    const particle = {
                        position: new THREE.Vector3(
                            (x - size/2) * spacing,
                            (y - size/2) * spacing + 5, // Lift particles up
                            (z - size/2) * spacing
                        ),
                        velocity: new THREE.Vector3(0, 0, 0),
                        density: 0,
                        pressure: 0
                    };
                    this.particles.push(particle);

                    // Set initial positions in geometry
                    positions[index * 3] = particle.position.x;
                    positions[index * 3 + 1] = particle.position.y;
                    positions[index * 3 + 2] = particle.position.z;

                    // Set particle colors (blue with slight variation)
                    colors[index * 3] = 0.3 + Math.random() * 0.2;     // R
                    colors[index * 3 + 1] = 0.5 + Math.random() * 0.2; // G
                    colors[index * 3 + 2] = 0.8 + Math.random() * 0.2; // B

                    index++;
                }
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Update or create new particle system
        if (this.particleSystem) {
            this.particleSystem.geometry.dispose();
            this.particleSystem.geometry = geometry;
        } else {
            const material = new THREE.PointsMaterial({
                size: this.parameters.particleSize,
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                sizeAttenuation: true
            });
            this.particleSystem = new THREE.Points(geometry, material);
        }

        this.updateScale();
    }
}




