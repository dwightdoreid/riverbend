// Level: Harrow Point peaker plant, mothballed. Three gas turbine units in a row (unit 2, in the
// middle, is a mission prop; units 1 and 3 are dead), an overhead pipe rack across the site, the
// black-start diesel shed (south-west), fuel gas compressor skid (south-east), and the step-up
// transformer and switchyard to the north. Main gate on the south fence.
import { THREE } from '../engine/three.js';
import { box, cyl, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

export default {
  id: 'peaker',
  name: 'Harrow Point Peaker Plant',
  bounds: { x: 46, z: 36 },
  environment: { sky: '#c98a62', fog: [40, 170], shadowExtent: 70, shadowFar: 220 },
  menuCamera: { radius: 85, height: 55 },
  map: {
    min: [-48, -38], max: [48, 38], outline: [[-46, -36], [46, 36]], lineWidth: 2,
    lines: [[-42, 6, 42, 6], [-28.5, -22, -28.5, 0], [-23.5, -22, -23.5, 0], [2.5, -22, 2.5, 0], [-2.5, -22, -2.5, 0], [23.5, -22, 23.5, 0], [28.5, -22, 28.5, 0]],
  },
  build,
};

function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }
function post(w, x, z, h, m = 'steel', r = .25) { cyl(w, x, h / 2, z, r, r, h, m, 8); block(x, z, r * 2, r * 2); addSolid(x - r, 0, z - r, x + r, h, z + r); }
function tank(w, x, z, r, h, m) { cyl(w, x, h / 2, z, r, r, h, m, 20); cyl(w, x, h + .2, z, r * .97, r * .4, .4, m, 20); block(x, z, r * 1.8, r * 1.8); addSolid(x - r * .9, 0, z - r * .9, x + r * .9, h, z + r * .9); }

/** A dead turbine unit (same footprint as the gasTurbine prop). stripped: enclosure panels removed. */
function deadUnit(w, x, z, stripped, paint) {
  box(w, x, .2, z, 7, .4, 20, 'concrete');
  if (stripped) {
    for (const k of [-6, -1, 4]) solid(w, x, 1.4, z + k, 3.4, 2.4, 2.6, 'dark');   // exposed casing sections
    for (const [dx, dz] of [[-2.4, -6.8], [2.4, -6.8], [-2.4, 4.8], [2.4, 4.8]]) post(w, x + dx, z + dz, 4.6, 'edge', .15);
    box(w, x, 4.7, z - 1, 5, .2, 12, 'edge');
  } else {
    solid(w, x, 2.6, z - 1, 5, 4.4, 12, paint);
    for (let k = -6; k <= 4; k += 2) box(w, x + 2.52, 2.6, z + k, .04, 4, .08, 'edge');
  }
  solid(w, x, 5.2, z + 7, 6, 3.2, 3.6, paint); box(w, x, 1.8, z + 7, 3, 3.2, 3, 'dark'); block(x, z + 7, 3, 3);
  cyl(w, x, 7.5, z - 8.5, 1.5, 1.7, 15, paint, 14); block(x, z - 8.5, 3, 3); addSolid(x - 1.5, 0, z - 10, x + 1.5, 15, z - 7);
}

function build(w) {
  setSeed(1616);
  const gravel = new THREE.MeshStandardMaterial({ color: 0x8a8378, map: noiseTex([138, 131, 120], 40, [50, 50]), roughness: 1 });
  const slab = new THREE.MeshStandardMaterial({ color: 0x9a978f, map: noiseTex([154, 151, 143], 18, [20, 20]), roughness: 1 });
  const paint = new THREE.MeshStandardMaterial({ color: 0x8c9290, roughness: .7, metalness: .2 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xc9b23a, roughness: .6, metalness: .3 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x7a4a32, roughness: .9 });
  box(w, 0, -.42, 0, 600, .6, 600, new THREE.MeshStandardMaterial({ color: 0x7c6a4f, map: noiseTex([124, 106, 79], 45, [60, 60]), roughness: 1 })).castShadow = false;
  box(w, 0, -.03, 0, 94, .2, 74, gravel).castShadow = false;
  box(w, 0, .02, 18, 30, .1, 8, slab).castShadow = false;                     // road from the gate
  box(w, 0, .02, 30, 8, .1, 14, slab).castShadow = false;

  // Fence and gate posts.
  for (const s of [-1, 1]) { box(w, s * 46, 1.2, 0, .1, 2.4, 72, 'steel'); }
  box(w, 0, 1.2, -36, 92, 2.4, .1, 'steel');
  for (const s of [-1, 1]) { box(w, s * 25.5, 1.2, 36, 41, 2.4, .1, 'steel'); post(w, s * 5, 36, 2.8, 'amber', .2); }

  // Turbine units 1 and 3 (dead). Unit 2 (x 0) is the mission prop.
  deadUnit(w, -26, -12, false, paint); deadUnit(w, 26, -12, true, paint);
  sign(w, -26, 5.2, -3.15, 'UNIT 1', 2.4, .5); sign(w, 26, 5.2, -3.15, 'UNIT 3', 2.4, .5);

  // Overhead pipe rack across the site (cover under it, a sightline breaker above).
  for (let x = -42; x <= 42; x += 7) for (const z of [5, 7]) post(w, x, z, 4.6, 'edge', .18);
  box(w, 0, 4.7, 6, 86, .2, 2.4, 'edge');
  for (const dz of [-.7, 0, .7]) { const c = cyl(w, 0, 5.1, 6 + dz, .22, .22, 86, dz ? pipeMat : rust, 10); c.rotation.z = Math.PI / 2; }

  // Black-start diesel shed (south-west): roof on posts; the diesel itself is a prop at (-30, 20).
  for (const [x, z] of [[-36.5, 16.2], [-23.5, 16.2], [-36.5, 23.8], [-23.5, 23.8]]) post(w, x, z, 4.4, 'edge', .2);
  box(w, -30, 4.5, 20, 14, .25, 8.6, 'roof'); box(w, -30, .02, 20, 13, .08, 8, slab).castShadow = false;
  sign(w, -30, 3.9, 24.2, 'BLACK START DIESEL', 4.4, .5);
  tank(w, -40, 26, 2, 3.2, rust);                                               // day tank
  // Auxiliary switchgear kiosk (the aux breaker panel is a prop on its south face).
  solid(w, -16, 1.5, 22, 4.6, 3, 2.6, 'building'); box(w, -16, 3.1, 22, 5, .2, 3, 'roof');

  // Fuel gas compressor skid (south-east): compressor is a prop at (28, 20); scrubber vessels beside it.
  box(w, 28, .02, 20, 14, .08, 8, slab).castShadow = false;
  for (const [x, z] of [[36, 17], [36, 22]]) tank(w, x, z, 1.1, 5.5, paint);
  for (const dz of [-.5, .5]) { const c = cyl(w, 33.5, .9, 19.5 + dz, .16, .16, 4, pipeMat, 8); c.rotation.z = Math.PI / 2; }
  sign(w, 28, 3.6, 24.2, 'FUEL GAS COMPRESSOR', 4.6, .5);
  // Gas supply line from the compressor to the units (low pipes: hop over or crouch behind).
  { const c = cyl(w, 14, .45, 14, .3, .3, 20, pipeMat, 10); c.rotation.z = Math.PI / 2; block(14, 14, 20, .6); addSolid(4, 0, 13.7, 24, .75, 14.3); }

  // Switchyard and step-up transformer (north); the generator breaker panel is a prop.
  solid(w, 0, 2, -28, 7, 4, 4.5, new THREE.MeshStandardMaterial({ color: 0x6d7a72, roughness: .7 }));
  for (let x = -2.4; x <= 2.4; x += 1.2) { cyl(w, x, 5.1, -28, .14, .2, 2.2, 'white', 8); }
  for (const x of [-14, -8, 8, 14]) { post(w, x, -30, 7, 'edge', .2); box(w, x, 7, -30, .3, .3, 4, 'edge'); }
  box(w, 0, 7.1, -30, 30, .12, .12, 'dark');

  // Control building (north-east) and a parts store (north-west).
  solid(w, 37, 2.5, -27, 14, 5, 9, 'building'); box(w, 37, 5.2, -27, 14.6, .4, 9.6, 'roof');
  box(w, 37, 3, -22.45, 10, 1.2, .1, 'glass'); sign(w, 37, 4.4, -22.4, 'HARROW POINT · CONTROL', 6, .5);
  solid(w, -38, 2, -28, 10, 4, 7, 'building'); box(w, -38, 4.15, -28, 10.4, .3, 7.4, 'roof');
  tank(w, -40, -8, 3.6, 7, paint);                                              // demin water tank

  // Scattered cover: spare parts crates and concrete barriers.
  for (const [x, z, r] of [[-12, 28, 0], [12, 28, 0], [-8, 10, 1], [8, 10, 1], [-14, -24, 0], [14, -24, 0], [-36, 10, 1], [38, 10, 1], [16, 26, 1], [-18, 12, 0]]) {
    if (r) solid(w, x, .55, z, 2.6, 1.1, .9, 'concrete'); else solid(w, x, .7, z, 1.6, 1.4, 1.4, 'crate');
  }
  for (let i = 0; i < 8; i++) { const x = (rand() - .5) * 80, z = (rand() - .5) * 64; if (Math.abs(z - 6) > 3 && Math.abs(x) > 6) box(w, x, .05, z, 1 + rand() * 2, .08, 1 + rand(), 'dark').castShadow = false; }

  // Yard lights.
  for (const [x, z] of [[-12, 0], [12, 0], [-20, 30], [20, 30]]) {
    post(w, x, z, 9, 'steel', .18); box(w, x, 9.1, z, 1.2, .3, .5, 'edge');
    const l = new THREE.PointLight(0xffe2b0, 22, 34, 1.3); l.position.set(x, 8.6, z); w.add(l);
  }
  // Hills beyond the fence.
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, d = 110 + rand() * 30, h = 10 + rand() * 18;
    box(w, Math.sin(a) * d, h / 2 - 2, Math.cos(a) * d, 40, h, 30, new THREE.MeshStandardMaterial({ color: 0x6f6650, roughness: 1 }));
  }
}
