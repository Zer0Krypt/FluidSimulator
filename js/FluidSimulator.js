import * as THREE from 'three';

export class FluidSimulator {
    constructor() {
        this.particles = [];
        this.parameters = {
            // Real physical values (for calculations)
            realPlanetRadius: 6.371e6,     // Earth radius in meters
            realPlanetMass: 5.972e24,      // Earth mass in kg
            realMoonRadius: 1.737e6,       // Moon radius in meters
            realMoonMass: 7.34767309e22,   // Moon mass in kg
            realMoonOrbitRadius: 3.844e8,  // Average Earth-Moon distance in meters
            
            // Visualization scale (for rendering)
            visualScale: 1e-5,             // Scale factor for visualization
            
            // Scaled values (for rendering)
            planetRadius: 10,              // Scaled radius for visualization
            moonRadius: 2.7,              // Scaled radius for visualization
            moonOrbitRadius: 50,          // Scaled orbit for visualization
            moonInitialAngle: 0,
            moonOrbitalSpeed: 2.662e-6,    // Radians per second (27.32 days period)
            
            // Fluid parameters
            particleCount: 1000,
            particleSize: 0.1,
            fluidHeight: 0.2,              // Scaled ocean depth for visualization
            fluidSpread: 0.8,              // 80% of Earth covered by water
            
            // Physics parameters (real values)
            gravity: -9.81,                // m/s²
            viscosity: 1.002e-3,           // Water viscosity at 20°C (Pa·s)
            density: 1000,                 // Water density kg/m³
            gravitationalConstant: 6.67430e-11,  // m³ kg⁻¹ s⁻²
            timeScale: 1.0
        };

        this.planet = this.createPlanet();
        this.moon = this.createMoon();
        this.orbitLine = this.createOrbitLine();
        this.initializeParticles();
    }

    createPlanet() {
        const geometry = new THREE.SphereGeometry(this.parameters.planetRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0x44aa44 });
        return new THREE.Mesh(geometry, material);
    }

    createMoon() {
        const geometry = new THREE.SphereGeometry(this.parameters.moonRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
        const moon = new THREE.Mesh(geometry, material);
        
        // Set initial position using visualization scale
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

        // Ensure parameters are valid
        if (!Number.isFinite(this.parameters.planetRadius) || 
            !Number.isFinite(this.parameters.fluidHeight)) {
            console.error('Invalid parameters:', this.parameters);
            return;
        }

        const radius = this.parameters.planetRadius + this.parameters.fluidHeight;
        
        for (let i = 0; i < this.parameters.particleCount; i++) {
            // Use simpler distribution method initially
            const u = Math.random() * 2 - 1; // Range: -1 to 1
            const theta = Math.random() * Math.PI * 2; // Range: 0 to 2π
            
            // Calculate position
            const x = radius * Math.sqrt(1 - u * u) * Math.cos(theta);
            const y = radius * Math.sqrt(1 - u * u) * Math.sin(theta);
            const z = radius * u;

            // Validate coordinates
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                console.error('Invalid coordinates generated:', { x, y, z, u, theta, radius });
                continue;
            }

            // Set positions
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Create particle
            const particle = {
                position: new THREE.Vector3(x, y, z),
                velocity: new THREE.Vector3(0, 0, 0),
                density: 0,
                pressure: 0
            };
            this.particles.push(particle);

            // Set colors
            colors[i * 3] = 0.0;     // R
            colors[i * 3 + 1] = 0.5; // G
            colors[i * 3 + 2] = 1.0; // B
        }

        // Validate final arrays
        for (let i = 0; i < positions.length; i++) {
            if (!Number.isFinite(positions[i])) {
                console.error('Invalid position value at index', i, positions[i]);
                positions[i] = 0;
            }
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
        
        // Final validation
        if (!this.particleSystem.geometry.attributes.position) {
            console.error('Position attribute missing after creation');
        }
    }

    update() {
        const deltaTime = this.parameters.timeScale * 0.016;

        // Update moon position
        const currentAngle = Math.atan2(this.moon.position.z, this.moon.position.x);
        const newAngle = currentAngle + this.parameters.moonOrbitalSpeed * deltaTime;
        this.updateMoonPosition(newAngle);

        // Update particles
        const positions = this.particleSystem.geometry.attributes.position.array;

        // Calculate moon's velocity for particle distribution
        const moonVelocity = new THREE.Vector3(
            -Math.sin(currentAngle) * this.parameters.moonOrbitalSpeed,
            0,
            Math.cos(currentAngle) * this.parameters.moonOrbitalSpeed
        ).multiplyScalar(this.parameters.moonOrbitRadius);

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // Calculate distances to both bodies
            const toPlanet = this.planet.position.clone().sub(particle.position);
            const toMoon = this.moon.position.clone().sub(particle.position);
            const distanceToPlanet = toPlanet.length();
            const distanceToMoon = toMoon.length();
            
            // Calculate gravitational forces
            const planetForce = this.calculateGravitationalForce(particle.position, this.parameters.planetMass, this.planet.position, 1.0);
            const moonForce = this.calculateGravitationalForce(particle.position, this.parameters.moonMass, this.moon.position, 5.0);
            
            // Handle moon collisions first (priority over planet)
            if (distanceToMoon < this.parameters.moonRadius) {
                const normal = toMoon.normalize();
                
                // Move particle to moon surface
                particle.position.copy(this.moon.position.clone().sub(normal.multiplyScalar(this.parameters.moonRadius)));
                
                // Add tangential component of moon's orbital velocity
                const normalVel = normal.clone().multiplyScalar(moonVelocity.dot(normal));
                const tangentialVel = moonVelocity.clone().sub(normalVel);
                
                // Add random tangential velocity for distribution
                const randomTangent = this.getRandomTangentialVector(normal);
                const distributionSpeed = 0.1;
                
                // Combine velocities
                particle.velocity.copy(tangentialVel)
                    .add(randomTangent.multiplyScalar(distributionSpeed));
                
                // Add slight outward force to prevent clumping
                const surfaceRepulsion = normal.multiplyScalar(0.05);
                particle.velocity.add(surfaceRepulsion);
                
                // Apply friction to prevent excessive speeds
                particle.velocity.multiplyScalar(0.95);
            }
            // Handle planet surface interaction
            else if (distanceToPlanet < this.parameters.planetRadius + this.parameters.fluidHeight) {
                const normal = toPlanet.normalize();
                
                // Keep particles at surface level
                const targetRadius = this.parameters.planetRadius + this.parameters.fluidHeight;
                particle.position.copy(this.planet.position.clone().add(normal.multiplyScalar(targetRadius)));
                
                // Project velocity along surface
                const normalVelocity = normal.multiplyScalar(particle.velocity.dot(normal));
                const tangentialVelocity = particle.velocity.clone().sub(normalVelocity);
                
                // Maintain only tangential velocity component with high damping
                particle.velocity.copy(tangentialVelocity.multiplyScalar(0.98));
                
                // Add a small circular motion component to simulate ocean currents
                const rotationAxis = new THREE.Vector3(0, 1, 0);
                const tangentDir = new THREE.Vector3().crossVectors(normal, rotationAxis).normalize();
                particle.velocity.add(tangentDir.multiplyScalar(0.02));
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
    }

    calculateGravitationalForce(particlePos, bodyMass, bodyPos) {
        const direction = bodyPos.clone().sub(particlePos);
        // Convert visualization distance to real distance
        const realDistance = direction.length() / this.parameters.visualScale;
        
        // Calculate force using real values
        const forceMagnitude = (this.parameters.gravitationalConstant * bodyMass) / 
            (realDistance * realDistance);
        
        // Add tidal force component
        const tidalForceMagnitude = (2 * this.parameters.gravitationalConstant * bodyMass * 
            this.parameters.fluidHeight) / (realDistance * realDistance * realDistance);
        
        // Scale force back for visualization
        return direction.normalize().multiplyScalar((forceMagnitude + tidalForceMagnitude) * 
            this.parameters.visualScale);
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
}

