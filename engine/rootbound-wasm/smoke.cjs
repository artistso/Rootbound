// Node smoke test for the generated bindings. Run after wasm-bindgen emits
// ./pkg (see docs/ENGINE.md). Asserts the full placement pipeline end to end:
// placement validation, connectivity-driven module emergence, pressure, and
// threat-peak detection.
//
// Written as CommonJS on purpose: `--target nodejs` emits CommonJS, and a
// static `import` of it relies on cjs-module-lexer heuristics that don't
// recognize wasm-bindgen's export shape. require() always works.
const assert = require('node:assert/strict');
const { Engine } = require('./pkg/rootbound_wasm.js');

const engine = new Engine();
assert.equal(engine.world_size(), 512);
assert.equal(engine.tile_count(), 0);
assert.equal(engine.module_count(), 0);

// Placement validation rejects bad input.
assert.equal(engine.place_tile(-1, 0, 'stem', 0), false, 'out-of-bounds x rejected');
assert.equal(engine.place_tile(0, 512, 'stem', 0), false, 'out-of-bounds y rejected');
assert.equal(engine.place_tile(0, 0, 'nonsense', 0), false, 'unknown tile type rejected');

// 4-root line emerges as a taproot.
for (const x of [0, 1, 2, 3]) {
  assert.equal(engine.place_tile(x, 0, 'root', 0), true);
}
assert.equal(engine.place_tile(1, 0, 'root', 0), false, 'occupied cell rejected');
assert.equal(engine.tile_count(), 4);
assert.ok(engine.module_count() >= 1, 'a module emerged from the cluster');
assert.ok(engine.module_types_json().includes('taproot'), 'taproot classified');
assert.ok(engine.pressure_at(1, 0) > 0, 'pressure exists at a source');
assert.ok(engine.darkness_at(1, 0) > 0, 'darkening is visible at a source');
assert.ok(engine.darkness_at(1, 0) <= 1, 'darkening stays normalized');
assert.ok(engine.max_pressure() >= 20, 'cluster exceeds the threat threshold at its core');

// Threat peaks are detected and serialized.
const peaksJson = engine.threat_peaks_json();
assert.ok(engine.threat_peak_count() >= 1, 'at least one threat peak');
const peaks = JSON.parse(peaksJson);
assert.ok(Array.isArray(peaks) && peaks.length === engine.threat_peak_count());
assert.ok(peaks.every((p) => p.cells >= 1 && p.max > 0 && Number.isFinite(p.x) && Number.isFinite(p.y)));
console.log('threat peaks:', peaksJson);

// Reset restores a pristine world.
engine.reset();
assert.equal(engine.tile_count(), 0);
assert.equal(engine.module_count(), 0);
assert.equal(engine.max_pressure(), 0);

console.log('wasm smoke test passed');
