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
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        this.particleSystem = new THREE.Points(geometry, material);
    }

    update() {
        // Convert deltaTime to real seconds
        const deltaTime = this.parameters.timeScale * 0.016;  // 16ms in seconds

        // Update moon position using real orbital mechanics
        const currentAngle = Math.atan2(this.moon.position.z, this.moon.position.x);
        const newAngle = currentAngle + this.parameters.moonOrbitalSpeed * deltaTime;
        this.updateMoonPosition(newAngle);

        const positions = this.particleSystem.geometry.attributes.position.array;

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            
            // Calculate distances (scaled)
            const toPlanet = this.planet.position.clone().sub(particle.position);
            const toMoon = this.moon.position.clone().sub(particle.position);
            const distanceToPlanet = toPlanet.length() / this.parameters.scale;
            const distanceToMoon = toMoon.length() / this.parameters.scale;
            
            // Calculate gravitational forces including tidal effects
            const planetForce = this.calculateGravitationalForce(particle.position, 
                this.parameters.planetMass, this.planet.position, 1.0);
            const moonForce = this.calculateGravitationalForce(particle.position, 
                this.parameters.moonMass, this.moon.position, 1.0);
            
            // Calculate Coriolis effect (due to Earth's rotation)
            const angularVelocity = 7.2722e-5;  // Earth's rotation rate (rad/s)
            const coriolisForce = new THREE.Vector3(
                2 * angularVelocity * particle.velocity.z,
                0,
                -2 * angularVelocity * particle.velocity.x
            ).multiplyScalar(this.parameters.scale);

            // Combine all forces
            const totalForce = planetForce.clone()
                .add(moonForce)
                .add(coriolisForce);

            // Update velocity and position using real physics
            particle.velocity.add(totalForce.multiplyScalar(deltaTime));
            
            // Apply viscous damping
            const dampingFactor = Math.exp(-this.parameters.viscosity * deltaTime / 
                this.parameters.density);
            particle.velocity.multiplyScalar(dampingFactor);
            
            // Update position
            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

            // Keep particles at surface level with minimal intervention
            if (distanceToPlanet < (this.parameters.planetRadius + this.parameters.fluidHeight) / 
                this.parameters.scale) {
                const normal = toPlanet.normalize();
                const targetRadius = (this.parameters.planetRadius + this.parameters.fluidHeight) / 
                    this.parameters.scale;
                particle.position.copy(this.planet.position.clone().add(
                    normal.multiplyScalar(targetRadius * this.parameters.scale)));
            }

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






















