// Level: LODESTAR's datacenter halls. A south atrium (entry from the core access hatch) and three
// server halls (west, north, east) with rows of racks, joined by blast doors that missions open
// and close (door props fill the gaps left in the walls below).
import { THREE } from '../engine/three.js';
import { box, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

const H = 5;
// Wall segments [x0, z0, x1, z1]; gaps are door openings.
const WALLS = [
  [-40, -32, 40, -32], [-40, 32, 40, 32], [-40, -32, -40, 32], [40, -32, 40, 32],
  [-12, -32, -12, -14], [-12, -10, -12, 18], [-12, 22, -12, 32],   // west hall | middle (doors at z -12 and z 20)
  [12, -32, 12, -14], [12, -10, 12, 18], [12, 22, 12, 32],         // middle | east hall (doors at z -12 and z 20)
  [-12, 8, -2, 8], [2, 8, 12, 8],                                   // north hall | atrium (door at x 0)
];
// Halls, for maps and the mission's purge zones.
export const HALLS = { west: [-40, -32, -12, 32], north: [-12, -32, 12, 8], east: [12, -32, 40, 32], atrium: [-12, 8, 12, 32] };

export default {
  id: 'datahalls',
  name: 'LODESTAR Datacenter Halls',
  bounds: { x: 40, z: 32 },
  environment: { sky: '#05080a', fog: [12, 60], shadowExtent: 50, shadowFar: 140 },
  menuCamera: { radius: 60, height: 70 },
  map: { min: [-42, -34], max: [42, 34], outline: [[-40, -32], [40, 32]], lineWidth: 2, lines: WALLS },
  build,
};

function wall(w, [x0, z0, x1, z1], m) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wd = Math.abs(x1 - x0) || .6, d = Math.abs(z1 - z0) || .6;
  box(w, cx, H / 2, cz, wd, H, d, m); block(cx, cz, wd, d); addSolid(cx - wd / 2, 0, cz - d / 2, cx + wd / 2, H, cz + d / 2);
}
/** A row of racks along z (x fixed) or along x, with LED strips on both faces. */
function racks(w, x, z, len, alongZ, leds) {
  const wd = alongZ ? 1.2 : len, d = alongZ ? len : 1.2;
  box(w, x, 1.2, z, wd, 2.4, d, 'dark'); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, 2.4, z + d / 2);
  box(w, x, 2.5, z, wd + .1, .1, d + .1, 'edge');
  for (let k = -len / 2 + .6; k < len / 2 - .3; k += 1.2) for (const s of [-1, 1]) {
    const lx = alongZ ? x + s * .61 : x + k, lz = alongZ ? z + k : z + s * .61;
    for (let y = .5; y < 2.2; y += .5) if (rand() < .7) box(w, lx, y, lz, alongZ ? .02 : .06, .03, alongZ ? .06 : .02, leds[Math.floor(rand() * leds.length)]);
  }
}

function build(w) {
  setSeed(1818);
  const floor = new THREE.MeshStandardMaterial({ color: 0xb8bec2, map: noiseTex([196, 202, 206], 10, [40, 32]), roughness: .7 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9ccc8, roughness: .85 });
  const tile = new THREE.MeshStandardMaterial({ color: 0x8a9398, roughness: .8 });
  const leds = [0x5ce08a, 0x5fb4ff, 0x5fb4ff, 0xffb24a].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6 }));
  const strip = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xcfe6ff, emissiveIntensity: 1.1 });

  box(w, 0, -.2, 0, 90, .4, 74, floor).castShadow = false;
  for (let x = -38; x <= 38; x += 4) box(w, x, .01, 0, .04, .02, 64, tile).castShadow = false;   // raised-floor tile seams
  box(w, 0, H + .3, 0, 90, .6, 74, wallMat).castShadow = false;
  for (const s of WALLS) wall(w, s, wallMat);

  // West hall: racks along z, node space left in the middle (x -26, z 0).
  for (const x of [-36, -32, -20, -16]) { racks(w, x, -20, 16, true, leds); racks(w, x, 20, 16, true, leds); }
  // North hall: racks along x either side of the node (0, -14).
  for (const z of [-28, -24, -4, 0]) { racks(w, -6, z, 7, false, leds); racks(w, 6, z, 7, false, leds); }
  // East hall: staggered short rows.
  for (const [x, z] of [[18, -24], [34, -24], [18, 24], [34, 24], [20, -8], [32, 8], [22, 10], [30, -10]]) racks(w, x, z, 6, true, leds);
  // Atrium: reception console, hatch frame (south) and a few crates.
  box(w, 0, .6, 26, 6, 1.2, 1.2, 'edge'); block(0, 26, 6, 1.2); addSolid(-3, 0, 25.4, 3, 1.2, 26.6);
  box(w, 0, 2.5, 31.7, 5, 5, .3, 'dark'); for (const x of [-2.6, 2.6]) box(w, x, 2.5, 31.5, .3, 5, .5, 'amber');
  for (const [x, z] of [[-8, 14], [8, 14], [-8, 28], [8, 28]]) { box(w, x, .6, z, 1.6, 1.2, 1.6, 'crate'); block(x, z, 1.6, 1.6); addSolid(x - .8, 0, z - .8, x + .8, 1.2, z + .8); }
  sign(w, 0, 4.2, 8.4, 'HALL N · CORE MIRRORS', 4.4, .5);
  sign(w, -11.6, 4.2, 26, 'HALL W', 2, .5).rotation.y = Math.PI / 2;
  sign(w, 11.6, 4.2, 26, 'HALL E', 2, .5).rotation.y = -Math.PI / 2;

  // Ceiling light strips and a handful of real lights (fixed count).
  for (let x = -36; x <= 36; x += 8) for (const z of [-24, -8, 8, 24]) box(w, x, H - .02, z, 3, .04, .3, strip);
  for (const [x, z] of [[-26, -16], [-26, 16], [0, -20], [26, -16], [26, 16], [0, 20]]) { const l = new THREE.PointLight(0xdff0ff, 8, 18, 1.6); l.position.set(x, H - .4, z); w.add(l); }
}
