// Level: Port Calder freight yard. Seven east-west tracks, freight wagons and container stacks
// for cover, a gantry crane over the yard, and the signal box in the north-west corner. The
// middle of the yard is left open: it is where the Ironwalker fights.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

export const TRACKS = [-24, -16, -8, 0, 8, 16, 24];

export default {
  id: 'railyard',
  name: 'Port Calder Freight Yard',
  bounds: { x: 44, z: 36 },
  environment: { sky: '#d9a98a', fog: [60, 220], shadowExtent: 80, shadowFar: 240 },
  menuCamera: { radius: 95, height: 60 },
  map: { min: [-46, -38], max: [46, 38], outline: [[-44, -36], [44, 36]], lineWidth: 2, lines: TRACKS.map(z => [-44, z, 44, z]) },
  build,
};

function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }

function wagon(w, x, z, color) {
  const paint = new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .2 });
  solid(w, x, 1.9, z, 11, 2.8, 2.9, paint);
  box(w, x, 3.35, z, 11.1, .12, 3, 'edge');
  for (let k = -4.5; k <= 4.5; k += 1.5) box(w, x + k, 1.9, z + 1.47, .08, 2.4, .04, 'edge');
  for (const dx of [-3.8, 3.8]) for (const s of [-1, 1]) { const wh = cyl(w, x + dx, .42, z + s * .72, .4, .4, .2, 'dark', 10); wh.rotation.x = Math.PI / 2; }
}

function containers(w, x, z, rows, cols, levels) {
  const colors = [0x8a3b2c, 0x2f5a7a, 0x5b6b4d, 0xb8862f, 0x6d6a5e];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const n = 1 + Math.floor(rand() * levels), cx = x + c * 6.4, cz = z + r * 2.7;
    for (let l = 0; l < n; l++) box(w, cx, 1.3 + l * 2.6, cz, 6.1, 2.55, 2.45, new THREE.MeshStandardMaterial({ color: colors[Math.floor(rand() * colors.length)], roughness: .8 }));
    block(cx, cz, 6.1, 2.45); addSolid(cx - 3.05, 0, cz - 1.22, cx + 3.05, n * 2.6, cz + 1.22);
  }
}

function build(w) {
  setSeed(1010);
  const ballast = new THREE.MeshStandardMaterial({ color: 0x7d746a, map: noiseTex([128, 120, 110], 55, [40, 40]), roughness: 1 });
  const dirt = new THREE.MeshStandardMaterial({ color: 0x8c7b64, map: noiseTex([140, 124, 104], 35, [60, 60]), roughness: 1 });
  box(w, 0, -.42, 0, 600, .6, 600, dirt).castShadow = false;
  box(w, 0, -.03, 0, 92, .2, 76, ballast).castShadow = false;
  for (const z of TRACKS) {
    for (let x = -45; x <= 45; x += 1.2) box(w, x, .1, z, .22, .08, 2.6, 'trunk').castShadow = false;
    for (const s of [-.72, .72]) box(w, 0, .2, z + s, 92, .14, .1, 'steel').castShadow = false;
  }
  // Freight wagons (cover). The middle of the yard (x -10..10, z -12..4) stays open.
  const tint = [0x7d4a3a, 0x47606e, 0x8a8268, 0x5b6b4d, 0x6d2f2f];
  for (const [x, z] of [[-30, -24], [-16, -24], [22, -24], [35, -24], [-34, -16], [16, -16], [-24, 8], [28, 8], [-6, 16], [24, 16], [38, 24]]) wagon(w, x, z, tint[Math.floor(rand() * tint.length)]);
  containers(w, 22, -34, 1, 3, 3); containers(w, -40, 30, 2, 1, 2); containers(w, 30, 30, 2, 2, 2);
  // Gantry crane spanning the yard.
  for (const z of [-33, 33]) for (const x of [9, 15]) { box(w, x, 8, z, .8, 16, .8, 'amber'); block(x, z, .8, .8); addSolid(x - .4, 0, z - .4, x + .4, 16, z + .4); }
  for (const x of [9, 15]) box(w, x, 16.3, 0, .9, .9, 67, 'amber');
  box(w, 12, 15.4, -6, 7.5, 1.6, 3, 'dark'); rod(w, [12, 14.6, -6], [12, 6, -6], .05, 'steel', 5);
  // Signal box (north-west corner).
  solid(w, -38, 2, -30, 8, 4, 6, 'building');
  box(w, -38, 5.2, -30, 8.4, 2.4, 6.4, 'building'); box(w, -38, 5.3, -26.75, 7.6, 1.4, .1, 'glass'); box(w, -38, 6.6, -30, 9, .3, 7, 'roof');
  sign(w, -38, 3.7, -26.9, 'PORT CALDER FREIGHT · SIGNAL BOX', 6.5, .5);
  // Yard lights and buffer stops.
  for (const [x, z] of [[-20, -32], [30, -4], [-30, 0], [4, 30]]) {
    cyl(w, x, 6, z, .2, .28, 12, 'steel', 8); box(w, x, 12.2, z, 1.6, .4, .6, 'edge');
    block(x, z, .6, .6); addSolid(x - .3, 0, z - .3, x + .3, 12, z + .3);
    const l = new THREE.PointLight(0xffe2b0, 30, 40, 1.2); l.position.set(x, 11.6, z); w.add(l);
  }
  for (const z of TRACKS) { box(w, -44.5, .7, z, .8, 1.2, 2.4, 'red'); }
  // City beyond the fence.
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, d = 75 + rand() * 30, h = 12 + rand() * 30;
    box(w, Math.sin(a) * d, h / 2, Math.cos(a) * d, 14, h, 14, 'building');
  }
}
