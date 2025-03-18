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
        
        this.init();
    }

    init() {
        this.setupRenderer();
        this.setupCamera();
        this.setupControls();
        this.setupLights();
        this.animate();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth - 300, window.innerHeight);
        this.renderer.setClearColor(0x000000);
    }

    setupCamera() {
        this.camera.position.set(0, 5, 10);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 10);
        this.scene.add(ambientLight, directionalLight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.fluidSimulator.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = (window.innerWidth - 300) / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth - 300, window.innerHeight);
    }
}

const app = new SimulationApp();