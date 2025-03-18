import * as THREE from 'three';

export class FluidSimulator {
    constructor() {
        // Store default parameters
        this.defaultParameters = {
            // Planet parameters
            planetRadius: 5.0,
            planetMass: 1000.0,
            planetRotationSpeed: 0.0,
            planetRotationAngle: 0,
            
            // Moon parameters
            moonRadius: 1.0,
            moonMass: 100.0,
            moonOrbitRadius: 15.0,
            moonInitialAngle: 0,
            moonOrbitalSpeed: 0.5,
            moonRotationSpeed: 0.0,
            moonRotationAngle: 0,
            
            // Fluid parameters
            particleCount: 1000,
            particleSize: 0.1,
            fluidHeight: 0.5,    // Height of fluid above planet surface
            fluidSpread: 0.8,    // How much of planet surface is covered (0-1)
            
            // Physics parameters
            gravity: -9.81,
            viscosity: 1.0,
            density: 1000.0,
            gravitationalConstant: 6.67430e-11,
            timeScale: 1.0,
            scale: 1.0,
            
            // Surface tension parameters
            surfaceTensionStrength: 0.8,    // Strength of surface tension between particles
            surfaceTensionRadius: 1.0,      // Radius within which particles affect each other
            cohesionStrength: 0.5,          // Strength of particle cohesion
            tensionResistance: 0.3          // Resistance to stretching/separation
        };

        // Clone default parameters for current use
        this.parameters = { ...this.defaultParameters };

        this.planet = this.createPlanet();
        this.moon = this.createMoon();
        this.orbitLine = this.createOrbitLine();
        this.initializeParticles();

        this.frameCount = 0;
        this._tempVec1 = new THREE.Vector3();
        this._tempVec2 = new THREE.Vector3();
        this._tempVec3 = new THREE.Vector3();
        this._tempVec4 = new THREE.Vector3();

        // Add rotation axis
        this.rotationAxis = new THREE.Vector3(0, 1, 0);
    }

    createPlanet() {
        const geometry = new THREE.SphereGeometry(this.parameters.planetRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x44aa44,
            // Add some surface texture or pattern to make rotation visible
            bumpMap: this.createRotationTexture(),
            bumpScale: 0.1
        });
        return new THREE.Mesh(geometry, material);
    }

    createMoon() {
        const geometry = new THREE.SphereGeometry(this.parameters.moonRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x800080,
            // Add some surface texture or pattern to make rotation visible
            bumpMap: this.createRotationTexture(),
            bumpScale: 0.1
        });
        const moon = new THREE.Mesh(geometry, material);
        
        const angle = this.parameters.moonInitialAngle;
        const x = Math.cos(angle) * this.parameters.moonOrbitRadius;
        const z = Math.sin(angle) * this.parameters.moonOrbitRadius;
        moon.position.set(x, 0, z);
        
        return moon;
    }

    createOrbitLine() {
        const segments = 64;
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.5, transparent: true });
        
        // Create orbit preview points
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * this.parameters.moonOrbitRadius;
            const z = Math.sin(angle) * this.parameters.moonOrbitRadius;
            points.push(new THREE.Vector3(x, 0, z));
        }
        
        geometry.setFromPoints(points);
        return new THREE.Line(geometry, material);
    }

    updateMoonPosition(angle) {
        const x = Math.cos(angle) * this.parameters.moonOrbitRadius;
        const z = Math.sin(angle) * this.parameters.moonOrbitRadius;
        this.moon.position.set(x, 0, z);
    }

    createRotationTexture() {
        // Create a simple texture to make rotation visible
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Draw some patterns
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillRect(32, 32, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    initializeParticles() {
        this.particles = [];
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.parameters.particleCount * 3);
        const colors = new Float32Array(this.parameters.particleCount * 3);

        // Calculate the area of planet surface to cover based on fluidSpread
        const maxPhi = Math.PI * this.parameters.fluidSpread;
        const phiStart = (Math.PI - maxPhi) / 2; // Center the fluid coverage

        for (let i = 0; i < this.parameters.particleCount; i++) {
            // Generate evenly distributed spherical coordinates
            const theta = Math.random() * 2 * Math.PI;  // Longitude (0 to 2π)
            const phi = phiStart + (Math.random() * maxPhi);  // Latitude (controlled by fluidSpread)
            
            // Calculate position exactly at planet surface + fluidHeight
            const radius = this.parameters.planetRadius + this.parameters.fluidHeight;
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            // Create particle with zero initial velocity
            const particle = {
                position: new THREE.Vector3(x, y, z),
                velocity: new THREE.Vector3(0, 0, 0),
                density: 0,
                pressure: 0
            };
            this.particles.push(particle);

            // Set positions and colors
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Blue color for water particles
            colors[i * 3] = 0.0;     // R
            colors[i * 3 + 1] = 0.5; // G
            colors[i * 3 + 2] = 1.0; // B
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: this.parameters.particleSize,
            vertexColors: true,  // Make sure this is true
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        this.particleSystem = new THREE.Points(geometry, material);
    }

    update() {
        const deltaTime = this.parameters.timeScale * 0.016;

        // Update rotations
        this.parameters.planetRotationAngle += this.parameters.planetRotationSpeed * deltaTime;
        this.parameters.moonRotationAngle += this.parameters.moonRotationSpeed * deltaTime;

        // Apply rotations
        this.planet.rotation.y = this.parameters.planetRotationAngle;
        this.moon.rotation.y = this.parameters.moonRotationAngle;

        // Update moon orbital position
        if (this.frameCount % 3 === 0) {
            const currentAngle = Math.atan2(this.moon.position.z, this.moon.position.x);
            const newAngle = currentAngle + this.parameters.moonOrbitalSpeed * deltaTime * 3;
            this.updateMoonPosition(newAngle);
        }

        // Optimize neighborhood calculation using spatial partitioning
        const positions = this.particleSystem.geometry.attributes.position.array;
        const gridSize = this.parameters.surfaceTensionRadius;
        const spatialGrid = new Map();
        
        // First pass: Build spatial grid
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const gridX = Math.floor(particle.position.x / gridSize);
            const gridY = Math.floor(particle.position.y / gridSize);
            const gridZ = Math.floor(particle.position.z / gridSize);
            const gridKey = `${gridX},${gridY},${gridZ}`;
            
            if (!spatialGrid.has(gridKey)) {
                spatialGrid.set(gridKey, []);
            }
            spatialGrid.get(gridKey).push(i);
        }

        // Second pass: Update particles
        const scaledDeltaTime = deltaTime * 0.08;
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // Get nearby grid cells
            const gridX = Math.floor(particle.position.x / gridSize);
            const gridY = Math.floor(particle.position.y / gridSize);
            const gridZ = Math.floor(particle.position.z / gridSize);
            
            const neighbors = [];
            
            // Check only neighboring cells
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const key = `${gridX + dx},${gridY + dy},${gridZ + dz}`;
                        const cellParticles = spatialGrid.get(key) || [];
                        
                        for (const j of cellParticles) {
                            if (i === j) continue;
                            
                            const neighbor = this.particles[j];
                            const distance = particle.position.distanceTo(neighbor.position);
                            
                            if (distance < this.parameters.surfaceTensionRadius) {
                                neighbors.push({ particle: neighbor, distance });
                            }
                        }
                    }
                }
            }

            // Calculate forces (reuse vectors to reduce garbage collection)
            const toPlanet = this._tempVec1 || (this._tempVec1 = new THREE.Vector3());
            const toMoon = this._tempVec2 || (this._tempVec2 = new THREE.Vector3());
            
            toPlanet.copy(this.planet.position).sub(particle.position);
            toMoon.copy(this.moon.position).sub(particle.position);
            
            const distanceToPlanet = toPlanet.length();
            const distanceToMoon = toMoon.length();
            
            // Calculate gravitational forces
            const totalForce = this.calculateGravitationalForce(particle.position, this.parameters.planetMass, this.planet.position, 1.0);
            totalForce.add(this.calculateGravitationalForce(particle.position, this.parameters.moonMass, this.moon.position, 5.0));
            
            // Add surface tension and cohesion only if we have neighbors
            if (neighbors.length > 0) {
                const centerOfMass = this._tempVec3 || (this._tempVec3 = new THREE.Vector3());
                centerOfMass.set(0, 0, 0);
                
                for (const {particle: neighbor, distance} of neighbors) {
                    centerOfMass.add(neighbor.position);
                    
                    // Simplified tension forces
                    const direction = this._tempVec4 || (this._tempVec4 = new THREE.Vector3());
                    direction.copy(neighbor.position).sub(particle.position).normalize();
                    direction.multiplyScalar((1 - distance / this.parameters.surfaceTensionRadius) * 
                                          this.parameters.surfaceTensionStrength);
                    totalForce.add(direction);
                }
                
                // Add cohesion force
                centerOfMass.divideScalar(neighbors.length)
                           .sub(particle.position)
                           .multiplyScalar(this.parameters.cohesionStrength);
                totalForce.add(centerOfMass);
            }
            
            // Update physics
            particle.velocity.add(totalForce.multiplyScalar(scaledDeltaTime));
            particle.velocity.multiplyScalar(0.995); // Damping
            particle.position.add(particle.velocity.multiplyScalar(scaledDeltaTime));
            
            // Simple collision response
            if (distanceToMoon < this.parameters.moonRadius || 
                distanceToPlanet < this.parameters.planetRadius + this.parameters.fluidHeight) {
                particle.velocity.multiplyScalar(-0.5);
            }
            
            // Update particle position in geometry
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.frameCount = (this.frameCount || 0) + 1;
    }

    calculateGravitationalForce(particlePos, bodyMass, bodyPos, multiplier = 1.0) {
        const direction = bodyPos.clone().sub(particlePos);
        const distance = direction.length();
        
        // Adjusted minimum distance
        const minDistance = 0.5;
        const safeDist = Math.max(distance, minDistance);
        
        // Adjusted gravitational force scaling
        const scaledG = this.parameters.gravitationalConstant * 1e10;
        const forceMagnitude = (scaledG * bodyMass * multiplier) / (safeDist * safeDist);
        
        return direction.normalize().multiplyScalar(forceMagnitude);
    }

    setParameter(name, value) {
        if (name in this.parameters) {
            this.parameters[name] = value;
            
            // Update relevant components based on parameter changes
            if (['moonOrbitRadius', 'moonRadius'].includes(name)) {
                this.moon.geometry = new THREE.SphereGeometry(this.parameters.moonRadius, 32, 32);
                this.updateMoonPosition(Math.atan2(this.moon.position.z, this.moon.position.x));
                this.orbitLine.geometry.dispose();
                this.orbitLine.geometry = this.createOrbitLine().geometry;
            }
            else if (['planetRadius'].includes(name)) {
                this.planet.geometry = new THREE.SphereGeometry(this.parameters.planetRadius, 32, 32);
                
                // Instead of full reinitialization, adjust particle positions relative to new radius
                const radiusRatio = this.parameters.planetRadius / (this.parameters.planetRadius - value);
                const positions = this.particleSystem.geometry.attributes.position.array;
                
                for (let i = 0; i < this.particles.length; i++) {
                    const particle = this.particles[i];
                    
                    // Calculate new position maintaining relative height above surface
                    const direction = particle.position.clone().normalize();
                    const newRadius = this.parameters.planetRadius + this.parameters.fluidHeight;
                    particle.position.copy(direction.multiplyScalar(newRadius));
                    
                    // Update geometry
                    positions[i * 3] = particle.position.x;
                    positions[i * 3 + 1] = particle.position.y;
                    positions[i * 3 + 2] = particle.position.z;
                    
                    // Maintain current velocity direction but scale magnitude
                    if (particle.velocity) {
                        particle.velocity.multiplyScalar(0.5); // Dampen velocities during radius change
                    }
                }
                
                this.particleSystem.geometry.attributes.position.needsUpdate = true;
            }
            else if (name === 'particleCount') {
                // Clean up old particle system
                if (this.particleSystem) {
                    this.particleSystem.geometry.dispose();
                    this.particleSystem.material.dispose();
                }
                
                // Reinitialize particles with new count
                this.initializeParticles();
                
                // Make sure the scene gets updated with the new particle system
                // We need to emit an event or notify the main app to update the scene
                if (this.onParticleSystemUpdate) {
                    this.onParticleSystemUpdate(this.particleSystem);
                }
            }
            // Reset rotation angles when speeds are changed to zero
            else if (name === 'planetRotationSpeed' && value === 0) {
                this.parameters.planetRotationAngle = 0;
            }
            else if (name === 'moonRotationSpeed' && value === 0) {
                this.parameters.moonRotationAngle = 0;
            }
        }
    }

    getObjects() {
        return {
            planet: this.planet,
            moon: this.moon,
            orbitLine: this.orbitLine,
            particles: this.particleSystem
        };
    }

    getParticleSystem() {
        return this.particleSystem;
    }

    // Helper method to generate random tangential vectors for particle distribution
    getRandomTangentialVector(normal) {
        // Create a random vector
        const random = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        );
        
        // Make it perpendicular to the normal
        const tangent = random.clone()
            .sub(normal.multiplyScalar(random.dot(normal)))
            .normalize();
        
        return tangent;
    }

    resetToDefault() {
        // Reset moon position
        this.updateMoonPosition(this.defaultParameters.moonInitialAngle);
        
        // Reset all parameters to defaults
        Object.entries(this.defaultParameters).forEach(([key, value]) => {
            this.setParameter(key, value);
        });
        
        // Reset particle system to initial state
        if (this.particleSystem) {
            this.particleSystem.geometry.dispose();
            this.particleSystem.material.dispose();
        }
        
        // Reinitialize particles with default configuration
        this.initializeParticles();
        
        // Notify main app about the new particle system
        if (this.onParticleSystemUpdate) {
            this.onParticleSystemUpdate(this.particleSystem);
        }
    }
}