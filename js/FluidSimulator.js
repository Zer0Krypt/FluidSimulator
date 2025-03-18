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

        // Distribute particles on planet surface
        for (let i = 0; i < this.parameters.particleCount; i++) {
            // Generate random spherical coordinates within a limited range
            const theta = Math.random() * 2 * Math.PI;
            // Limit phi to create a band of particles around the planet's equator
            const phi = (Math.random() * 0.5 + 0.75) * Math.PI;
            
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
            
            // Calculate gravitational forces
            const planetForce = this.calculateGravitationalForce(particle.position, this.parameters.planetMass, this.planet.position);
            const moonForce = this.calculateGravitationalForce(particle.position, this.parameters.moonMass, this.moon.position);
            
            // Add surface tension force to keep particles near planet surface
            const toCenter = this.planet.position.clone().sub(particle.position);
            const distanceToCenter = toCenter.length();
            const targetRadius = this.parameters.planetRadius + this.parameters.fluidHeight;
            const surfaceForceMagnitude = (distanceToCenter - targetRadius) * 10.0;
            const surfaceForce = toCenter.normalize().multiplyScalar(surfaceForceMagnitude);
            
            // Combine all forces
            const totalForce = planetForce.clone()
                .add(moonForce)
                .add(surfaceForce);
            
            // Add damping to prevent excessive velocities
            particle.velocity.multiplyScalar(0.99);
            
            // Update velocity and position with smaller time step for stability
            const scaledDeltaTime = deltaTime * 0.1;
            particle.velocity.add(totalForce.multiplyScalar(scaledDeltaTime));
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
        const distance = direction.length();
        
        // Add a small offset to prevent division by zero and extreme forces at very close distances
        const minDistance = 1.0;
        const safeDist = Math.max(distance, minDistance);
        
        // Use a smaller scale factor for more stable simulation
        const scaledG = this.parameters.gravitationalConstant * 1e9;
        const forceMagnitude = scaledG * bodyMass / (safeDist * safeDist);
        
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
                this.initializeParticles();
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






