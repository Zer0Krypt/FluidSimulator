import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

export class FluidSimulator {
    constructor(renderer) {
        this.renderer = renderer;
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

        this.initComputeShaders();
        this.initParticleSystem();
    }

    initComputeShaders() {
        const WIDTH = Math.sqrt(this.parameters.particleCount);
        this.gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, this.renderer);

        // Create textures for position, velocity, and density
        this.positionVariable = this.gpuCompute.addVariable(
            'texturePosition',
            this.getPositionShader(),
            this.gpuCompute.createTexture()
        );

        this.velocityVariable = this.gpuCompute.addVariable(
            'textureVelocity',
            this.getVelocityShader(),
            this.gpuCompute.createTexture()
        );

        this.densityVariable = this.gpuCompute.addVariable(
            'textureDensity',
            this.getDensityShader(),
            this.gpuCompute.createTexture()
        );

        // Add dependencies
        this.gpuCompute.setVariableDependencies(this.positionVariable, [
            this.positionVariable,
            this.velocityVariable
        ]);
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [
            this.positionVariable,
            this.velocityVariable,
            this.densityVariable
        ]);
        this.gpuCompute.setVariableDependencies(this.densityVariable, [
            this.positionVariable
        ]);

        // Initialize compute renderer
        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error(error);
        }
    }

    getPositionShader() {
        return `
            uniform float deltaTime;
            uniform float scale;
            
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 pos = texture2D(texturePosition, uv);
                vec4 vel = texture2D(textureVelocity, uv);
                
                // Update position
                pos.xyz += vel.xyz * deltaTime;
                
                // Boundary conditions
                vec3 bounds = vec3(10.0) * scale;
                if (pos.x > bounds.x) { pos.x = bounds.x; vel.x *= -0.5; }
                if (pos.x < -bounds.x) { pos.x = -bounds.x; vel.x *= -0.5; }
                if (pos.y > bounds.y) { pos.y = bounds.y; vel.y *= -0.5; }
                if (pos.y < -bounds.y) { pos.y = -bounds.y; vel.y *= -0.5; }
                if (pos.z > bounds.z) { pos.z = bounds.z; vel.z *= -0.5; }
                if (pos.z < -bounds.z) { pos.z = -bounds.z; vel.z *= -0.5; }
                
                gl_FragColor = pos;
            }
        `;
    }

    getVelocityShader() {
        return `
            uniform float deltaTime;
            uniform float viscosity;
            uniform float gravity;
            uniform float gasConstant;
            uniform float restDensity;
            uniform float smoothingLength;
            
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 vel = texture2D(textureVelocity, uv);
                vec4 pos = texture2D(texturePosition, uv);
                float density = texture2D(textureDensity, uv).x;
                
                // Apply gravity
                vel.y += gravity * deltaTime;
                
                // Calculate pressure force
                float pressure = gasConstant * (density - restDensity);
                vec3 pressureForce = vec3(0.0);
                
                // SPH pressure and viscosity forces
                for(float y = 0.0; y < resolution.y; y++) {
                    for(float x = 0.0; x < resolution.x; x++) {
                        vec2 neighbor = vec2(x, y) / resolution.xy;
                        vec4 neighborPos = texture2D(texturePosition, neighbor);
                        vec4 neighborVel = texture2D(textureVelocity, neighbor);
                        float neighborDensity = texture2D(textureDensity, neighbor).x;
                        
                        vec3 diff = neighborPos.xyz - pos.xyz;
                        float dist = length(diff);
                        
                        if(dist < smoothingLength && dist > 0.0) {
                            // Pressure force
                            float neighborPressure = gasConstant * (neighborDensity - restDensity);
                            pressureForce += normalize(diff) * (pressure + neighborPressure) / (2.0 * neighborDensity);
                            
                            // Viscosity force
                            vel.xyz += viscosity * (neighborVel.xyz - vel.xyz) * deltaTime;
                        }
                    }
                }
                
                vel.xyz += pressureForce * deltaTime;
                
                gl_FragColor = vel;
            }
        `;
    }

    getDensityShader() {
        return `
            uniform float smoothingLength;
            
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 pos = texture2D(texturePosition, uv);
                float density = 0.0;
                
                // Calculate density using SPH
                for(float y = 0.0; y < resolution.y; y++) {
                    for(float x = 0.0; x < resolution.x; x++) {
                        vec2 neighbor = vec2(x, y) / resolution.xy;
                        vec4 neighborPos = texture2D(texturePosition, neighbor);
                        
                        vec3 diff = neighborPos.xyz - pos.xyz;
                        float dist = length(diff);
                        
                        if(dist < smoothingLength) {
                            density += smoothingLength - dist;
                        }
                    }
                }
                
                gl_FragColor = vec4(density, 0.0, 0.0, 1.0);
            }
        `;
    }

    initParticleSystem() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.parameters.particleCount * 3);
        const colors = new Float32Array(this.parameters.particleCount * 3);

        for (let i = 0; i < this.parameters.particleCount; i++) {
            positions[i * 3] = Math.random() * 2 - 1;
            positions[i * 3 + 1] = Math.random() * 2 - 1;
            positions[i * 3 + 2] = Math.random() * 2 - 1;

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

    update() {
        const deltaTime = this.parameters.timeScale * 0.016;

        // Update uniforms
        this.positionVariable.material.uniforms.deltaTime = { value: deltaTime };
        this.positionVariable.material.uniforms.scale = { value: this.parameters.scale };
        
        this.velocityVariable.material.uniforms.deltaTime = { value: deltaTime };
        this.velocityVariable.material.uniforms.viscosity = { value: this.parameters.viscosity };
        this.velocityVariable.material.uniforms.gravity = { value: this.parameters.gravity };
        this.velocityVariable.material.uniforms.gasConstant = { value: this.parameters.gasConstant };
        this.velocityVariable.material.uniforms.restDensity = { value: this.parameters.restDensity };
        this.velocityVariable.material.uniforms.smoothingLength = { value: this.parameters.smoothingLength };

        // Compute physics
        this.gpuCompute.compute();

        // Update particle positions
        const positions = this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    setParameter(name, value) {
        if (name in this.parameters) {
            this.parameters[name] = value;
            this.updateScale();
        }
    }

    updateScale() {
        // Update particle size based on scale
        this.particleSystem.material.size = this.parameters.particleSize * this.parameters.scale;
    }

    getParticleSystem() {
        return this.particleSystem;
    }
}
