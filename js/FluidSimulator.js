import * as THREE from 'three';

export class FluidSimulator {
    constructor() {
        this.particles = [];
        this.parameters = {
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
            scale: 1.0
        };

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
        const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
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

        // Distribute particles evenly on planet surface
        for (let i = 0; i < this.parameters.particleCount; i++) {
            // Generate random spherical coordinates
            const theta = Math.random() * 2 * Math.PI;  // Longitude (0 to 2π)
            const phi = Math.acos(2 * Math.random() - 1);  // Latitude (0 to π)
            
            // Calculate position slightly above planet surface
            const radius = this.parameters.planetRadius + this.parameters.fluidHeight;
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

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

            colors[i * 3] = 0.0;
            colors[i * 3 + 1] = 0.5;
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

    update() {
        const deltaTime = this.parameters.timeScale * 0.016;

        // Update moon position
        const currentAngle = Math.atan2(this.moon.position.z, this.moon.position.x);
        const newAngle = currentAngle + this.parameters.moonOrbitalSpeed * deltaTime;
        this.updateMoonPosition(newAngle);

        // Update particles
        const positions = this.particleSystem.geometry.attributes.position.array;

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // Calculate distances to both bodies
            const toPlanet = this.planet.position.clone().sub(particle.position);
            const toMoon = this.moon.position.clone().sub(particle.position);
            const distanceToPlanet = toPlanet.length();
            const distanceToMoon = toMoon.length();
            
            // Calculate gravitational forces with increased moon influence
            const planetForce = this.calculateGravitationalForce(particle.position, this.parameters.planetMass, this.planet.position, 1.0);
            const moonForce = this.calculateGravitationalForce(particle.position, this.parameters.moonMass, this.moon.position, 5.0);
            
            // Handle collisions with planet
            if (distanceToPlanet < this.parameters.planetRadius) {
                // Move particle back to planet surface
                const normal = toPlanet.normalize();
                particle.position.copy(this.planet.position.clone().sub(normal.multiplyScalar(this.parameters.planetRadius)));
                
                // Project velocity onto surface plane
                const normalVelocity = normal.multiplyScalar(particle.velocity.dot(normal));
                const tangentialVelocity = particle.velocity.clone().sub(normalVelocity);
                particle.velocity.copy(tangentialVelocity.multiplyScalar(0.8));
            }
            
            // Handle collisions with moon
            if (distanceToMoon < this.parameters.moonRadius) {
                // Move particle back to moon surface
                const normal = toMoon.normalize();
                particle.position.copy(this.moon.position.clone().sub(normal.multiplyScalar(this.parameters.moonRadius)));
                
                // Project velocity onto moon surface plane
                const normalVelocity = normal.multiplyScalar(particle.velocity.dot(normal));
                const tangentialVelocity = particle.velocity.clone().sub(normalVelocity);
                particle.velocity.copy(tangentialVelocity.multiplyScalar(0.8));
                
                // Add moon's orbital velocity to the particle
                const moonVelocity = new THREE.Vector3(
                    -Math.sin(currentAngle) * this.parameters.moonOrbitalSpeed,
                    0,
                    Math.cos(currentAngle) * this.parameters.moonOrbitalSpeed
                ).multiplyScalar(this.parameters.moonOrbitRadius);
                particle.velocity.add(moonVelocity);
            }
            
            // Calculate surface tension forces for both bodies
            let surfaceForce = new THREE.Vector3(0, 0, 0);
            
            // Planet surface tension (only if closer to planet than moon)
            if (distanceToPlanet < distanceToMoon) {
                const targetRadius = this.parameters.planetRadius + this.parameters.fluidHeight;
                const surfaceForceMagnitude = (distanceToPlanet - targetRadius) * 0.8;
                surfaceForce.add(toPlanet.normalize().multiplyScalar(surfaceForceMagnitude));
            }
            // Moon surface tension (only if closer to moon than planet)
            else {
                const targetRadius = this.parameters.moonRadius + (this.parameters.fluidHeight * 0.2); // Smaller fluid height for moon
                const surfaceForceMagnitude = (distanceToMoon - targetRadius) * 0.8;
                surfaceForce.add(toMoon.normalize().multiplyScalar(surfaceForceMagnitude));
            }
            
            // Combine all forces
            const totalForce = planetForce.clone()
                .add(moonForce)
                .add(surfaceForce);
            
            // Apply general damping
            particle.velocity.multiplyScalar(0.99);
            
            // Update velocity and position with smaller time step
            const scaledDeltaTime = deltaTime * 0.1;
            
            // Apply forces based on which body the particle is closer to
            if (distanceToPlanet < this.parameters.planetRadius + 0.1) {
                // Near planet surface
                const normal = toPlanet.normalize();
                const forceDotNormal = totalForce.dot(normal);
                const normalForce = normal.multiplyScalar(forceDotNormal);
                const tangentialForce = totalForce.clone().sub(normalForce);
                particle.velocity.add(tangentialForce.multiplyScalar(scaledDeltaTime));
                particle.velocity.add(normalForce.multiplyScalar(scaledDeltaTime * 0.1));
            } else if (distanceToMoon < this.parameters.moonRadius + 0.1) {
                // Near moon surface
                const normal = toMoon.normalize();
                const forceDotNormal = totalForce.dot(normal);
                const normalForce = normal.multiplyScalar(forceDotNormal);
                const tangentialForce = totalForce.clone().sub(normalForce);
                particle.velocity.add(tangentialForce.multiplyScalar(scaledDeltaTime));
                particle.velocity.add(normalForce.multiplyScalar(scaledDeltaTime * 0.1));
            } else {
                // In space
                particle.velocity.add(totalForce.multiplyScalar(scaledDeltaTime));
            }
            
            particle.position.add(particle.velocity.clone().multiplyScalar(scaledDeltaTime));

            // Update geometry
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
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
            if (['planetRadius'].includes(name)) {
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
}














