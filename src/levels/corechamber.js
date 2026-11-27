// Level: LODESTAR's core chamber. A round hall 30 m across under a high dome, the core on its
// plinth in the middle (the boss itself), a ring of low barriers and tall pillars for cover from
// the arc sweep, our way in from the south and Halvard's breach corridor to the north.
import { THREE } from '../engine/three.js';
import { box, cyl, sign, noiseTex, setSeed } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

const R = 30, H = 12, CELL = 2;
const CORRIDORS = [[-4, 28, 4, 42], [-4, -42, 4, -28]];   // south (ours), north (Halvard's breach)

export default {
  id: 'corechamber',
  name: 'LODESTAR Core Chamber',
  bounds: { x: 32, z: 42 },
  environment: { sky: '#05080a', fog: [14, 80], shadowExtent: 60, shadowFar: 150 },
  menuCamera: { radius: 50, height: 45 },
  map: { min: [-34, -44], max: [34, 44], outline: [[-32, -44], [32, 44]], rects: [[-30, -30, 30, 30], ...CORRIDORS] },
  build,
};

const isOpen = (x, z) => Math.hypot(x, z) < R || CORRIDORS.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1);
function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }

function build(w) {
  setSeed(2020);
  const floor = new THREE.MeshStandardMaterial({ color: 0x6a747a, map: noiseTex([110, 118, 124], 12, [30, 40]), roughness: .7 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x9aa4a8, map: noiseTex([150, 160, 166], 16, [2, 2]), roughness: .8 });
  const trace = new THREE.MeshStandardMaterial({ color: 0x5fc4ff, emissive: 0x3fa8ff, emissiveIntensity: 1.3 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xffb24a, emissive: 0xff8a1a, emissiveIntensity: 1.2 });

  box(w, 0, -.2, 0, 80, .4, 100, floor).castShadow = false;
  box(w, 0, H + .3, 0, 80, .6, 100, wallMat).castShadow = false;
  for (let x = -34 + CELL / 2; x < 34; x += CELL) for (let z = -44 + CELL / 2; z < 44; z += CELL) {
    if (isOpen(x, z)) continue;
    let edge = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (isOpen(x + dx * CELL, z + dz * CELL)) { edge = true; break; }
    if (!edge) continue;
    box(w, x, H / 2, z, CELL, H, CELL, wallMat); block(x, z, CELL, CELL); addSolid(x - CELL / 2, 0, z - CELL / 2, x + CELL / 2, H, z + CELL / 2);
  }

  // Glowing circuit traces radiating from the core across the floor.
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, len = 20, m = box(w, Math.sin(a) * (5 + len / 2), .02, Math.cos(a) * (5 + len / 2), .12, .03, len, trace);
    m.rotation.y = a; m.castShadow = false;
  }
  for (const r of [9, 18]) for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, m = box(w, Math.sin(a) * r, .02, Math.cos(a) * r, .1, .03, r * Math.PI * 2 / 48 + .05, trace); m.rotation.y = a + Math.PI / 2; m.castShadow = false; }

  // The core plinth (the boss model sits on it) and the capacitor pylon bases: solid for players.
  block(0, 0, 7, 7); addSolid(-3.5, 0, -3.5, 3.5, 2, 3.5);
  for (const [x, z] of [[0, -7], [7, 0], [0, 7], [-7, 0]]) { block(x, z, 1.4, 1.4); addSolid(x - .7, 0, z - .7, x + .7, 2.8, z + .7); }

  // Ring of low barriers (crouch behind them under the sweep) and tall pillars (full cover).
  for (let k = 0; k < 8; k++) {
    const a = (k + .5) / 8 * Math.PI * 2, x = Math.sin(a) * 15, z = Math.cos(a) * 15;
    const b = box(w, x, .55, z, 4.5, 1.1, .8, 'concrete'); b.rotation.y = a + Math.PI / 2;
    block(x, z, 3.4, 3.4); addSolid(x - 1.6, 0, z - 1.6, x + 1.6, 1.1, z + 1.6);
  }
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + .26, x = Math.sin(a) * 23, z = Math.cos(a) * 23; solid(w, x, H / 2, z, 1.8, H, 1.8, 'edge'); box(w, x, 3, z, 1.9, .2, 1.9, amber); }

  // Our entrance (south) and Halvard's breach (north): blast frames, and the choice consoles' dais.
  for (const z of [28.4, -28.4]) { box(w, 0, 5.5, z, 7, 1, .6, 'edge'); for (const x of [-3.3, 3.3]) box(w, x, 2.5, z, .6, 5, .6, 'amber'); }
  sign(w, 0, 6.4, 28.1, 'CORE CHAMBER · LEVEL 0', 4.6, .5).rotation.y = Math.PI;
  box(w, 0, .1, 12, 14, .2, 3.5, 'edge').castShadow = false;
  sign(w, 0, 3.4, -30.2, 'MAINTENANCE ACCESS N', 4, .5);

  // Light: the core itself does most of it; a few blue floods around the walls.
  const coreLight = new THREE.PointLight(0x7fd0ff, 40, 45, 1.3); coreLight.position.set(0, 7, 0); w.add(coreLight);
  for (const [x, z] of [[-20, -20], [20, -20], [-20, 20], [20, 20]]) { const l = new THREE.PointLight(0xb0d8ff, 10, 26, 1.5); l.position.set(x, 9, z); w.add(l); }
}
