// Level: the grid control floor above LODESTAR's datacenter. One big operations hall under a
// ceiling: the wall-sized grid display on the north wall, tiered operator desk rows in front of
// it, glass-walled side rooms (west: island dispatch, east: protection relays), and corridors
// in from the north-west and north-east. Control points are mission props.
import { THREE } from '../engine/three.js';
import { box, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

const H = 6;
const WALLS = [
  [-36, -28, -8, -28], [8, -28, 36, -28],                 // north wall (display between x -8..8 is part of it)
  [-36, 28, -3, 28], [3, 28, 36, 28],                     // south (entry gap x -3..3)
  [-36, -28, -36, -20], [-36, -16, -36, 28],              // west (corridor gap z -20..-16)
  [36, -28, 36, -20], [36, -16, 36, 28],                  // east (corridor gap z -20..-16)
];
const GLASS = [
  [-36, -8, -20, -8], [-20, -8, -20, -2], [-20, 4, -20, 10], [-36, 10, -20, 10],   // west room (doorway z -2..4)
  [20, -8, 36, -8], [20, -8, 20, -2], [20, 4, 20, 10], [20, 10, 36, 10],           // east room
];

export default {
  id: 'control',
  name: 'Grid Control Floor',
  bounds: { x: 36, z: 28 },
  environment: { sky: '#05080a', fog: [16, 80], shadowExtent: 50, shadowFar: 140 },
  menuCamera: { radius: 55, height: 60 },
  map: { min: [-38, -30], max: [38, 30], outline: [[-36, -28], [36, 28]], lineWidth: 2, lines: [...WALLS, [-8, -28, 8, -28], ...GLASS] },
  build,
};

function wall(w, [x0, z0, x1, z1], m, h = H) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wd = Math.abs(x1 - x0) || .5, d = Math.abs(z1 - z0) || .5;
  box(w, cx, h / 2, cz, wd, h, d, m); block(cx, cz, wd, d); addSolid(cx - wd / 2, 0, cz - d / 2, cx + wd / 2, h, cz + d / 2);
}
function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }

function build(w) {
  setSeed(1919);
  const floor = new THREE.MeshStandardMaterial({ color: 0x5e6a70, map: noiseTex([96, 108, 114], 10, [30, 24]), roughness: .8 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc4c8c6, roughness: .85 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd6ff, transparent: true, opacity: .25, roughness: .1, metalness: .1, depthWrite: false });
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b1a22, emissive: 0x16425a, emissiveIntensity: 1.2 });
  const line = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5 });
  const lines = [line(0x5ce08a), line(0xffb24a), line(0x5fb4ff), line(0xff5a3a)];
  const monitor = new THREE.MeshStandardMaterial({ color: 0x9fd6ff, emissive: 0x3f6f90, emissiveIntensity: .9 });

  box(w, 0, -.2, 0, 90, .4, 70, floor).castShadow = false;
  box(w, 0, H + .3, 0, 90, .6, 70, wallMat).castShadow = false;
  for (const s of WALLS) wall(w, s, wallMat);
  wall(w, [-8, -28, 8, -28], wallMat);
  for (const s of GLASS) { wall(w, s, glass, 3); }
  for (const s of GLASS) { const [x0, z0, x1, z1] = s; box(w, (x0 + x1) / 2, 3.05, (z0 + z1) / 2, Math.abs(x1 - x0) || .12, .1, Math.abs(z1 - z0) || .12, 'edge'); }

  // The grid display: a wall of screen with the valley's network drawn in coloured lines.
  box(w, 0, 3.4, -27.6, 30, 5, .2, screen);
  for (let i = 0; i < 26; i++) {
    const m = lines[Math.floor(rand() * lines.length)], horiz = rand() < .55;
    const len = 2 + rand() * 7, x = (rand() - .5) * 26, y = 1.4 + rand() * 4;
    box(w, x, y, -27.48, horiz ? len : .06, horiz ? .06 : Math.min(len, 3), .02, m);
  }
  for (let i = 0; i < 14; i++) box(w, (rand() - .5) * 26, 1.4 + rand() * 4, -27.46, .22, .22, .02, lines[Math.floor(rand() * 2)]);
  sign(w, 0, 5.6, -27.4, 'NORTHERN VALLEY GRID · LIVE', 7, .55);

  // Operator desk rows facing the display (cover), with monitors.
  for (const [z, half] of [[-16, 10], [-8, 12], [0, 14]]) for (const side of [-1, 1]) {
    const cx = side * (half / 2 + 2.5), wd = half;
    solid(w, cx, .5, z, wd, 1, 1.2, 'trunk');
    for (let k = -wd / 2 + 1; k < wd / 2; k += 1.6) box(w, cx + k, 1.35, z - .25, 1.1, .65, .06, monitor);
  }
  // Supervisor's dais (south, centre) and the master console where the tie-line breaker lives.
  box(w, 0, .15, 12, 14, .3, 7, 'edge').castShadow = false;
  solid(w, -4, .55, 10, 4, 1.1, 1.2, 'trunk'); solid(w, 4, .55, 10, 4, 1.1, 1.2, 'trunk');
  // Side rooms: relay racks (east), dispatch boards (west).
  for (const z of [-4, 6]) solid(w, 32, 1.2, z, 1.2, 2.4, 4, 'dark');
  for (const z of [-4, 6]) solid(w, -32, .5, z, 3, 1, 1.4, 'trunk');
  // Columns.
  for (const [x, z] of [[-14, 20], [14, 20], [-26, -20], [26, -20]]) solid(w, x, H / 2, z, 1.2, H, 1.2, 'concrete');
  // South lobby crates.
  for (const [x, z] of [[-10, 24], [10, 24], [-24, 22], [24, 22]]) solid(w, x, .6, z, 1.8, 1.2, 1.4, 'crate');

  for (let x = -32; x <= 32; x += 8) for (const z of [-20, -4, 12]) box(w, x, H - .02, z, 3, .04, .3, new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xcfe6ff, emissiveIntensity: .9 }));
  for (const [x, z] of [[0, -10], [-24, 0], [24, 0], [0, 16]]) { const l = new THREE.PointLight(0xe0ecff, 24, 34, 1.4); l.position.set(x, H - .5, z); w.add(l); }
}
