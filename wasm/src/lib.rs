use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SimulationEngine {
    simulator: FluidSimulator,
}

#[wasm_bindgen]
impl SimulationEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(config_js: JsValue) -> Result<SimulationEngine, JsValue> {
        let config: SimulationConfig = serde_wasm_bindgen::from_value(config_js)?;
        Ok(SimulationEngine {
            simulator: FluidSimulator::new(config),
        })
    }

    pub fn step(&mut self, dt: f32) {
        self.simulator.step(dt);
    }

    pub fn get_particle_positions(&self) -> Vec<f32> {
        // Convert particle positions to flat array for JavaScript
        self.simulator.particles
            .iter()
            .flat_map(|p| vec![p.position.x, p.position.y, p.position.z])
            .collect()
    }
}