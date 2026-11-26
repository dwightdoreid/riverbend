// Level: the Undercurrent tunnels beneath Port Calder. Cable tunnels on a 2 m grid: every rock
// cell bordering open floor becomes a wall, and a ceiling covers it all (so no sky, no sun).
// Branch rooms hold Halvard's cable junctions; one tunnel is flooded; the interconnector vault
// is in the north-east, and the exit shaft is in the far north-east corner.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

// Walkable areas [x0, z0, x1, z1].
const ROOMS = [
  [-38, 30, -28, 38],     // entry shaft (start)
  [-34, 26, 34, 31],      // south main tunnel
  [-34, -34, -29, 31],    // west tunnel
  [-3, -20, 2, 31],       // middle tunnel
  [29, -34, 34, 31],      // east tunnel
  [-34, -34, 34, -29],    // north tunnel
  [-34, -3, 2, 2],        // mid-west cross tunnel
  [2, -3, 29, 2],         // mid-east cross tunnel (flooded)
  [-29, 10, -26, 14], [-26, 7, -16, 17],      // branch room A (west)
  [2, 13, 8, 17], [8, 9, 18, 20],              // branch room B (middle)
  [-20, -29, -16, -26], [-21, -26, -10, -17],  // branch room C (north)
  [18, -8, 23, -3], [12, -27, 26, -8],         // interconnector vault (north-east), entered from the flood tunnel
  [26, -22, 29, -18],                          // vault east door gap (to the east tunnel; a door prop fills it)
  [29, -38, 34, -34],                          // exit shaft
];
export const WATER = [2, -3, 29, 2];
const H = 4.6, CELL = 2;

export default {
  id: 'tunnels',
  name: 'Undercurrent Tunnels',
  bounds: { x: 40, z: 40 },
  environment: { sky: '#06090b', fog: [6, 38], shadowExtent: 50, shadowFar: 120 },
  menuCamera: { radius: 48, height: 70 },
  map: { min: [-40, -40], max: [40, 40], outline: [[-40, -40], [40, 40]], rects: ROOMS },
  zones: [{ type: 'water', rect: WATER }],
  build,
};

const isOpen = (x, z) => ROOMS.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1);

function build(w) {
  setSeed(7070);
  // Light base colours: with no sun underground, darker albedos render nearly black.
  const floor = new THREE.MeshStandardMaterial({ color: 0x9a9d98, map: noiseTex([170, 172, 166], 26, [40, 40]), roughness: .95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb4aea2, map: noiseTex([190, 184, 172], 30, [2, 2]), roughness: 1 });
  const strip = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xcfe6ff, emissiveIntensity: 1.6 });
  const water = new THREE.MeshStandardMaterial({ color: 0x1f4650, roughness: .1, metalness: .3, transparent: true, opacity: .85 });

  box(w, 0, -.2, 0, 90, .4, 90, floor).castShadow = false;
  box(w, 0, H + .3, 0, 90, .6, 90, wallMat).castShadow = false;           // ceiling over everything

  // Walls: rock cells that touch open floor.
  for (let x = -40 + CELL / 2; x < 40; x += CELL) for (let z = -40 + CELL / 2; z < 40; z += CELL) {
    if (isOpen(x, z)) continue;
    let edge = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (isOpen(x + dx * CELL, z + dz * CELL)) { edge = true; break; }
    if (!edge) continue;
    box(w, x, H / 2, z, CELL, H, CELL, wallMat);
    block(x, z, CELL, CELL); addSolid(x - CELL / 2, 0, z - CELL / 2, x + CELL / 2, H, z + CELL / 2);
  }

  // Ceiling strip lights every 6 m in long tunnels, and cable trays along them.
  for (const [x0, z0, x1, z1] of ROOMS) {
    const long = x1 - x0 > z1 - z0;
    if (long) for (let x = x0 + 3; x < x1 - 1; x += 6) box(w, x, H - .05, (z0 + z1) / 2, 1.4, .08, .2, strip);
    else for (let z = z0 + 3; z < z1 - 1; z += 6) box(w, (x0 + x1) / 2, H - .05, z, .2, .08, 1.4, strip);
    if (Math.max(x1 - x0, z1 - z0) > 12) {
      if (long) for (const y of [3.1, 3.5]) rod(w, [x0 + .5, y, z0 + .35], [x1 - .5, y, z0 + .35], .07, y > 3.3 ? 'amber' : 'dark', 6);
      else for (const y of [3.1, 3.5]) rod(w, [x0 + .35, y, z0 + .5], [x0 + .35, y, z1 - .5], .07, y > 3.3 ? 'amber' : 'dark', 6);
    }
  }

  // A few real lights at junctions (fixed count for the level).
  for (const [x, z] of [[-31, 28], [0, 28], [31, 28], [-31, 0], [0, 0], [31, -31], [-31, -31], [20, -18]]) {
    const l = new THREE.PointLight(0xd8ecff, 22, 16, 1.6); l.position.set(x, H - .4, z); w.add(l);
  }

  // Flooded tunnel: water surface, a drip of rubble, warning sign.
  const [wx0, wz0, wx1, wz1] = WATER;
  box(w, (wx0 + wx1) / 2, .38, (wz0 + wz1) / 2, wx1 - wx0, .06, wz1 - wz0, water).castShadow = false;
  sign(w, 3.2, 2.4, 2.05, 'FLOODED · WADE SLOWLY', 3.4, .45, '#e6b34e', '#1d2c33');

  // Clutter for cover: cable drums, crates, a maintenance cart.
  const drum = (x, z) => { const d = cyl(w, x, .7, z, .7, .7, 1.4, 'trunk', 14); d.rotation.x = Math.PI / 2; block(x, z, 1.4, 1.4); addSolid(x - .7, 0, z - .7, x + .7, 1.4, z + .7); };
  for (const [x, z] of [[-31, 18], [-31, -14], [-1, 20], [0, -12], [31, 12], [31, -4], [-20, 28.5], [18, 28.5], [-12, -31.5], [12, -31.5]]) drum(x, z);
  const crate = (x, z, wd, d, h) => { box(w, x, h / 2, z, wd, h, d, 'crate'); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, h, z + d / 2); };
  crate(-22, 14.5, 2.4, 1.6, 1.3); crate(14, 18, 2.2, 1.6, 1.2); crate(-13, -19, 2.4, 1.4, 1.3);
  crate(16, -12, 2.6, 1.8, 1.6); crate(23, -12, 2.6, 1.8, 1.6); crate(-34.5 + 2, 34, 2, 2, 1.4);

  // Interconnector vault: Halvard's undeclared cross-border link.
  for (const x of [15, 19.5, 24]) {
    box(w, x, 1.6, -24, 3, 3.2, 2.4, 'tank'); box(w, x, 3.3, -24, 3.1, .2, 2.5, 'tank2');
    for (const dx of [-.8, 0, .8]) cyl(w, x + dx, 3.75, -24, .1, .14, .7, 'ceramic', 8);
    block(x, -24, 3, 2.4); addSolid(x - 1.5, 0, -25.2, x + 1.5, 3.2, -22.8);
  }
  sign(w, 19.5, 3.9, -26.9, 'HALVARD  ·  CALDER–NORTH INTERCONNECTOR', 8, .55, '#1d3a4a', '#e9efe4');
  for (let i = 0; i < 6; i++) rod(w, [13 + i * 2.2, 4.2, -26.5], [13 + i * 2.2, 4.2, -9], .1, i % 2 ? 'dark' : 'amber', 6);

  // Entry ladder and exit shaft.
  for (const [x, z] of [[-37.2, 37], [33.2, -37]]) { for (let y = .4; y < H; y += .45) box(w, x, y, z, .5, .05, .05, 'steel'); rod(w, [x - .25, 0, z], [x - .25, H, z], .03, 'steel', 5); rod(w, [x + .25, 0, z], [x + .25, H, z], .03, 'steel', 5); }
  sign(w, 31.5, 3.3, -38.9, 'EXIT SHAFT 4', 2.6, .45, '#2f5a3a', '#e9efe4');
  for (let i = 0; i < 30; i++) { const x = -38 + rand() * 76, z = -38 + rand() * 76; if (isOpen(x, z)) box(w, x, .03, z, .5 + rand(), .04, .5 + rand(), 'edge').castShadow = false; }
}
