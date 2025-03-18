import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FluidSimulator } from './FluidSimulator.js';
import { ScenarioManager } from './ScenarioManager.js';
import { UIController } from './UIController.js';

class SimulationApp {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('simulation-canvas'),
            antialias: true
        });
        
        this.fluidSimulator = new FluidSimulator();
        this.scenarioManager = new ScenarioManager();
        this.uiController = new UIController(this);
        
        // Add particle system to the scene
        this.scene.add(this.fluidSimulator.getParticleSystem());
        
        this.init();
    }

    init() {
        this.setupRenderer();
        this.setupCamera();
        this.setupControls();
        this.setupLights();
        
        // Add all objects to the scene
        const objects = this.fluidSimulator.getObjects();
        this.scene.add(objects.planet);
        this.scene.add(objects.moon);
        this.scene.add(objects.orbitLine);
        this.scene.add(objects.particles);
        
        this.animate();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth - 300, window.innerHeight);
        this.renderer.setClearColor(0x202020); // Change background color to dark gray
    }

    setupCamera() {
        this.camera.position.set(20, 15, 20);
        this.camera.lookAt(0, 0, 0);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 50;
        this.controls.maxPolarAngle = Math.PI / 2;
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 10);
        
        // Add a second light to better illuminate the dark side
        const secondaryLight = new THREE.DirectionalLight(0x404040, 0.5);
        secondaryLight.position.set(-10, -10, -10);
        
        this.scene.add(ambientLight, directionalLight, secondaryLight);
    }

    animate() {
        // Use RAF ID to potentially cancel animation
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Only update if simulation is actually running
        if (this.fluidSimulator.parameters.timeScale > 0) {
            this.fluidSimulator.update();
        }
        
        // Only update controls if they're being used
        if (this.controls.enabled && this.controls.isDragging) {
            this.controls.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = (window.innerWidth - 300) / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth - 300, window.innerHeight);
    }

    // Add method to pause/resume animation
    toggleAnimation(isPlaying) {
        if (!isPlaying && this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        } else if (isPlaying && !this.animationId) {
            this.animate();
        }
    }
}

const app = new SimulationApp();



