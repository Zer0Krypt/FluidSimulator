import * as THREE from 'three';

export class FluidSimulator {
    constructor() {
        // Add color definitions
        this.particleBaseColor = new THREE.Color(0x0080FF);  // Blue water
        this.planetColor = new THREE.Color(0x44aa44);        // Green planet
        this.moonColor = new THREE.Color(0x800080);          // Purple moon

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
        const geometry = new THREE.BufferGeometry();
        this.particles = [];

        // Create positions and colors arrays
        const positions = new Float32Array(this.parameters.particleCount * 3);
        const colorArray = new Float32Array(this.parameters.particleCount * 3);

        // Initialize particles around the planet
        for (let i = 0; i < this.parameters.particleCount; i++) {
            // Create particle with random position on planet surface
            const particle = {
                position: new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ).normalize().multiplyScalar(this.parameters.planetRadius + this.parameters.fluidHeight),
                velocity: new THREE.Vector3(0, 0, 0)
            };
            
            this.particles.push(particle);

            // Set initial positions
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;

            // Set initial colors to base water color
            colorArray[i * 3] = this.particleBaseColor.r;
            colorArray[i * 3 + 1] = this.particleBaseColor.g;
            colorArray[i * 3 + 2] = this.particleBaseColor.b;
        }

        // Set attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

        // Create material with vertex colors enabled
        const material = new THREE.PointsMaterial({
            size: this.parameters.particleSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });

        // Create particle system
        this.particleSystem = new THREE.Points(geometry, material);
    }

    update() {
        const deltaTime = this.parameters.timeScale * 0.016;
        const scaledDeltaTime = deltaTime * 0.08;

        // Get geometry attributes
        const positions = this.particleSystem.geometry.attributes.position.array;
        const colors = this.particleSystem.geometry.attributes.color;

        // Update rotations
        this.parameters.planetRotationAngle += this.parameters.planetRotationSpeed * deltaTime;
        this.parameters.moonRotationAngle += this.parameters.moonRotationSpeed * deltaTime;

        // Apply rotations
        this.planet.rotation.y = this.parameters.planetRotationAngle;
        this.moon.rotation.y = this.parameters.moonRotationAngle;

        // Reuse vectors to avoid garbage collection
        const toPlanet = new THREE.Vector3();
        const toMoon = new THREE.Vector3();
        const tempForce = new THREE.Vector3();

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            tempForce.set(0, 0, 0);
            
            // Calculate vectors to planet and moon
            toPlanet.copy(this.planet.position).sub(particle.position);
            toMoon.copy(this.moon.position).sub(particle.position);
            
            const distanceFromPlanetCenter = toPlanet.length();
            const distanceFromMoon = toMoon.length();

            // Calculate gravitational forces
            const planetForce = this.calculateGravitationalForce(particle.position, this.parameters.planetMass, this.planet.position, 1.0);
            const moonForce = this.calculateGravitationalForce(particle.position, this.parameters.moonMass, this.moon.position, 5.0);
            
            const planetForceMagnitude = planetForce.length();
            const moonForceMagnitude = moonForce.length();

            // Calculate influence factors
            const maxDistance = this.parameters.moonOrbitRadius * 2;
            const planetInfluence = Math.min(1.0, (1.0 - distanceFromPlanetCenter / maxDistance) * (planetForceMagnitude * 0.1));
            const moonInfluence = Math.min(1.0, (1.0 - distanceFromMoon / maxDistance) * (moonForceMagnitude * 0.1));
            
            // Normalize influences
            const totalInfluence = planetInfluence + moonInfluence;
            const normalizedPlanetInfluence = totalInfluence > 0 ? planetInfluence / totalInfluence : 0;
            const normalizedMoonInfluence = totalInfluence > 0 ? moonInfluence / totalInfluence : 0;

            // Calculate final color
            const finalColor = new THREE.Color();
            finalColor.copy(this.particleBaseColor); // Start with water color

            if (totalInfluence > 0) {
                // Mix with planet color
                finalColor.lerp(this.planetColor, planetInfluence * normalizedPlanetInfluence);
                // Mix with moon color
                finalColor.lerp(this.moonColor, moonInfluence * normalizedMoonInfluence);
            }

            // Update color in buffer
            colors.setXYZ(i, finalColor.r, finalColor.g, finalColor.b);

            // Add forces together for physics update
            tempForce.copy(planetForce).add(moonForce);

            // Apply surface tension and other forces
            // ... (keep existing surface tension and cohesion code here)

            // Update physics
            particle.velocity.add(tempForce.multiplyScalar(scaledDeltaTime));
            particle.velocity.multiplyScalar(0.995); // Damping
            particle.position.add(particle.velocity.clone().multiplyScalar(scaledDeltaTime));
            
            // Simple collision response
            if (distanceFromMoon < this.parameters.moonRadius || 
                distanceFromPlanetCenter < this.parameters.planetRadius + this.parameters.fluidHeight) {
                particle.velocity.multiplyScalar(-0.5);
            }

            // Update particle position in geometry
            positions[i * 3] = particle.position.x;
            positions[i * 3 + 1] = particle.position.y;
            positions[i * 3 + 2] = particle.position.z;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.color.needsUpdate = true;
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
