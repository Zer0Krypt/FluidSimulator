import * as THREE from 'three';

export class FluidSimulator {
    constructor() {
        // Store default parameters
        this.defaultParameters = {
            // Planet parameters
            planetRadius: 5.0,
            planetMass: 1000.0,
            
            // Moon parameters
            moonRadius: 1.0,
            moonMass: 100.0,
            moonOrbitRadius: 15.0,
            moonInitialAngle: 0,
            moonOrbitalSpeed: 0.5,
            
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
    }

    createPlanet() {
        const geometry = new THREE.SphereGeometry(this.parameters.planetRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0x44aa44 });  // Changed to green
        return new THREE.Mesh(geometry, material);
    }

    createMoon() {
        const geometry = new THREE.SphereGeometry(this.parameters.moonRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0x800080 });  // Changed to purple (hex code)
        const moon = new THREE.Mesh(geometry, material);
        
        // Calculate initial position directly instead of using updateMoonPosition
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
        
        // First pass: Calculate particle neighborhoods and surface tension
        const neighborhoods = new Map(); // Store neighboring particles for each particle
        
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            neighborhoods.set(particle, []);
            
            // Find neighboring particles
            for (let j = 0; j < this.particles.length; j++) {
                if (i === j) continue;
                
                const neighbor = this.particles[j];
                const distance = particle.position.distanceTo(neighbor.position);
                
                if (distance < this.parameters.surfaceTensionRadius) {
                    neighborhoods.get(particle).push({
                        particle: neighbor,
                        distance: distance
                    });
                }
            }
        }
        
        // Second pass: Update particles with all forces including surface tension
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const neighbors = neighborhoods.get(particle);
            
            // Calculate base gravitational forces
            const toPlanet = this.planet.position.clone().sub(particle.position);
            const toMoon = this.moon.position.clone().sub(particle.position);
            const distanceToPlanet = toPlanet.length();
            const distanceToMoon = toMoon.length();
            
            const planetForce = this.calculateGravitationalForce(particle.position, this.parameters.planetMass, this.planet.position, 1.0);
            const moonForce = this.calculateGravitationalForce(particle.position, this.parameters.moonMass, this.moon.position, 5.0);
            
            // Calculate surface tension force
            const surfaceTensionForce = new THREE.Vector3(0, 0, 0);
            
            if (neighbors.length > 0) {
                // Calculate average position of neighbors
                const centerOfMass = new THREE.Vector3();
                neighbors.forEach(({particle: neighbor}) => {
                    centerOfMass.add(neighbor.position);
                });
                centerOfMass.divideScalar(neighbors.length);
                
                // Cohesion force towards center of mass
                const cohesionForce = centerOfMass.sub(particle.position)
                    .multiplyScalar(this.parameters.cohesionStrength);
                
                // Surface tension force
                neighbors.forEach(({particle: neighbor, distance}) => {
                    const direction = neighbor.position.clone().sub(particle.position);
                    const tensionFactor = 1 - (distance / this.parameters.surfaceTensionRadius);
                    
                    // Add tension force
                    const tensionForce = direction.normalize()
                        .multiplyScalar(tensionFactor * this.parameters.surfaceTensionStrength);
                    surfaceTensionForce.add(tensionForce);
                    
                    // Add resistance to stretching
                    if (distance > this.parameters.surfaceTensionRadius * 0.8) {
                        const resistanceForce = direction.multiplyScalar(
                            this.parameters.tensionResistance * (distance - this.parameters.surfaceTensionRadius * 0.8)
                        );
                        surfaceTensionForce.add(resistanceForce);
                    }
                });
                
                surfaceTensionForce.add(cohesionForce);
            }
            
            // Calculate moon's pull on the surface tension network
            let moonPullOnNetwork = new THREE.Vector3();
            if (neighbors.length > 0) {
                const moonForceStrength = moonForce.length();
                const normalizedMoonForce = moonForce.clone().normalize();
                
                // Scale the network pull based on moon's force and neighbor count
                const networkPullStrength = moonForceStrength * 
                    (neighbors.length / this.parameters.particleCount) * 
                    this.parameters.tensionResistance;
                
                moonPullOnNetwork = normalizedMoonForce.multiplyScalar(networkPullStrength);
            }
            
            // Combine all forces
            const totalForce = planetForce.clone()
                .add(moonForce)
                .add(surfaceTensionForce)
                .add(moonPullOnNetwork);
            
            // Update velocity and position with combined forces
            const scaledDeltaTime = deltaTime * 0.08;
            particle.velocity.add(totalForce.multiplyScalar(scaledDeltaTime));
            particle.velocity.multiplyScalar(0.995); // Damping
            particle.position.add(particle.velocity.clone().multiplyScalar(scaledDeltaTime));
            
            // Update geometry
            const positions = this.particleSystem.geometry.attributes.position.array;
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;
            
            // Handle moon collisions first (priority over planet)
            if (distanceToMoon < this.parameters.moonRadius) {
                const normal = toMoon.normalize();
                
                // Move particle to moon surface
                particle.position.copy(this.moon.position.clone().sub(normal.multiplyScalar(this.parameters.moonRadius)));
                
                // Add random tangential velocity for distribution around moon surface
                const randomTangent = this.getRandomTangentialVector(normal);
                const distributionSpeed = 0.05;  // Reduced speed for gentler spreading
                
                // Set velocity for spreading along moon surface
                particle.velocity.copy(randomTangent.multiplyScalar(distributionSpeed));
                
                // Add slight outward force to prevent clumping
                const surfaceRepulsion = normal.multiplyScalar(0.02);
                particle.velocity.add(surfaceRepulsion);
                
                // Apply strong damping to keep movement gentle
                particle.velocity.multiplyScalar(0.9);
            }
            // Handle planet surface interaction
            if (distanceToPlanet < this.parameters.planetRadius + this.parameters.fluidHeight) {
                const normal = toPlanet.normalize();
                
                // Simply keep particles at exact surface level
                const targetRadius = this.parameters.planetRadius + this.parameters.fluidHeight;
                particle.position.copy(this.planet.position.clone().add(normal.multiplyScalar(targetRadius)));
                
                // Add very gentle circular motion for ocean current
                const rotationAxis = new THREE.Vector3(0, 1, 0);
                const tangentDir = new THREE.Vector3().crossVectors(normal, rotationAxis).normalize();
                particle.velocity.copy(tangentDir.multiplyScalar(0.01));
            }
            
            // Calculate surface tension and distribution forces
            let surfaceForce = new THREE.Vector3(0, 0, 0);
            
            if (distanceToMoon < distanceToPlanet) {
                // Moon surface tension with distribution
                const targetRadius = this.parameters.moonRadius + (this.parameters.fluidHeight * 0.2);
                const surfaceForceMagnitude = (distanceToMoon - targetRadius) * 0.8;
                surfaceForce.add(toMoon.normalize().multiplyScalar(surfaceForceMagnitude));
            } else {
                // Planet surface tension - gentler for ocean-like behavior
                const targetRadius = this.parameters.planetRadius + this.parameters.fluidHeight;
                const surfaceForceMagnitude = (distanceToPlanet - targetRadius) * 0.3;
                surfaceForce.add(toPlanet.normalize().multiplyScalar(surfaceForceMagnitude));
            }
            
            // Combine forces
            const totalForce = planetForce.clone()
                .add(moonForce)
                .add(surfaceForce);
            
            // Update velocity and position with gentler physics
            const scaledDeltaTime = deltaTime * 0.08; // Reduced time scale for smoother motion
            particle.velocity.add(totalForce.multiplyScalar(scaledDeltaTime));
            particle.velocity.multiplyScalar(0.995); // Gentle damping
            particle.position.add(particle.velocity.clone().multiplyScalar(scaledDeltaTime));

            // Update geometry
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.color.needsUpdate = true;  // Make sure color updates are applied
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
