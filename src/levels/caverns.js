// Level: the cooling caverns under LODESTAR's datacenter. Natural rock chambers fitted with
// chilled-water plant, on a 2 m grid like the tunnels but taller and rougher. From the intake
// shaft (south) into the intake cavern, then west and east vent tunnels down to the long heat
// exchanger hall, the hot gallery north of it, and the pump hall with the core access hatch.
import { THREE } from '../engine/three.js';
import { box, cyl, sign, noiseTex, setSeed, rand } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

// Walkable areas [x0, z0, x1, z1].
export const ROOMS = [
  [-6, 38, 6, 46],          // intake shaft (start)
  [-18, 20, 18, 38],        // intake cavern
  [-18, -4, -12, 20],       // west vent tunnel
  [12, -4, 18, 20],         // east vent tunnel
  [-30, -14, 30, -4],       // heat exchanger hall
  [-3, -34, 3, -14],        // hot gallery
  [-18, -48, 18, -34],      // pump hall
];
export const HOT_GALLERY = [-3, -34, 3, -14];
const H = 7, CELL = 2;

export default {
  id: 'caverns',
  name: 'LODESTAR Cooling Caverns',
  bounds: { x: 34, z: 50 },
  environment: { sky: '#05080a', fog: [7, 42], shadowExtent: 60, shadowFar: 140 },
  menuCamera: { radius: 55, height: 80 },
  map: { min: [-34, -50], max: [34, 50], outline: [[-34, -50], [34, 50]], rects: ROOMS },
  build,
};

const isOpen = (x, z) => ROOMS.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 && z >= z0 && z < z1);
function solid(w, x, y, z, wd, h, d, m) { box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2); }

function build(w) {
  setSeed(1717);
  // Light albedos: with no sun underground, darker colours render nearly black.
  const floor = new THREE.MeshStandardMaterial({ color: 0x8f918a, map: noiseTex([160, 160, 152], 34, [40, 40]), roughness: .95 });
  const rock = new THREE.MeshStandardMaterial({ color: 0xa69c8c, map: noiseTex([178, 168, 152], 36, [2, 2]), roughness: 1 });
  const pipe = new THREE.MeshStandardMaterial({ color: 0x4f86a8, roughness: .5, metalness: .4 });
  const hot = new THREE.MeshStandardMaterial({ color: 0xa8583a, roughness: .6, metalness: .3 });
  const strip = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0x9fd0ff, emissiveIntensity: 1.2 });

  box(w, 0, -.2, 0, 80, .4, 110, floor).castShadow = false;
  box(w, 0, H + .4, 0, 80, .8, 110, rock).castShadow = false;               // rock roof over everything

  // Rock walls: cells bordering open floor, with uneven heights and bulges so it reads as a cave.
  for (let x = -34 + CELL / 2; x < 34; x += CELL) for (let z = -50 + CELL / 2; z < 50; z += CELL) {
    if (isOpen(x, z)) continue;
    let edge = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (isOpen(x + dx * CELL, z + dz * CELL)) { edge = true; break; }
    if (!edge) continue;
    box(w, x, H / 2, z, CELL, H, CELL, rock);
    const b = box(w, x + (rand() - .5) * .5, 1 + rand() * 4, z + (rand() - .5) * .5, CELL * (.9 + rand() * .5), 1.5 + rand() * 2.5, CELL * (.9 + rand() * .5), rock);
    b.rotation.y = rand() * .6;
    block(x, z, CELL, CELL); addSolid(x - CELL / 2, 0, z - CELL / 2, x + CELL / 2, H, z + CELL / 2);
  }

  // Intake shaft: a cage lift and its guide rails behind the start.
  box(w, 0, 3.5, 45.6, 6, 7, .3, 'steel'); for (const x of [-2.5, 2.5]) box(w, x, 3.5, 45.2, .2, 7, .2, 'amber');
  sign(w, 0, 4.6, 45.3, 'INTAKE SHAFT 2 · LEVEL -4', 4.4, .5);

  // Intake cavern: chilled-water headers along the walls, pump skids and rock falls for cover.
  for (const z of [21.2, 36.8]) { const c = cyl(w, 0, 5.4, z, .45, .45, 34, pipe, 12); c.rotation.z = Math.PI / 2; }
  for (const x of [-17, 17]) { const c = cyl(w, x, 5.9, 29, .35, .35, 16, pipe, 10); c.rotation.x = Math.PI / 2; }
  for (const [x, z] of [[-9, 31], [9, 31]]) { solid(w, x, .8, z, 4, 1.6, 2.2, 'edge'); cyl(w, x - 1, 2, z, .5, .5, .9, pipe, 10); }
  for (const [x, z, s] of [[-12, 25, 1.6], [4, 26, 1.2], [13, 34, 1.4], [-3, 33, 1]]) solid(w, x, s / 2, z, s * 1.8, s, s * 1.4, rock);
  solid(w, 0, .6, 23.5, 6, 1.2, 1, 'concrete');

  // Vent tunnels: hot pipes along one wall (the vents themselves are mission props).
  for (const x of [-17.4, 17.4]) { const c = cyl(w, x, 2.4, 8, .3, .3, 24, hot, 10); c.rotation.x = Math.PI / 2; }

  // Heat exchanger hall: plate exchangers as cover, an overhead header, coolant tanks at the ends.
  for (const x of [-20, -12, 12, 20]) { solid(w, x, 1.6, -9, 2.4, 3.2, 4.4, hot); for (let k = -1.8; k <= 1.8; k += .45) box(w, x, 1.6, -9 + k, 2.5, 3, .06, 'edge'); }
  for (const x of [-5, 5]) solid(w, x, .55, -6, 2.6, 1.1, .9, 'concrete');
  { const c = cyl(w, 0, 6, -12.8, .5, .5, 58, hot, 12); c.rotation.z = Math.PI / 2; }
  for (const x of [-27, 27]) { cyl(w, x, 2.5, -6.4, 1.8, 1.8, 5, pipe, 16); block(x, -6.4, 3.4, 3.4); addSolid(x - 1.7, 0, -8.1, x + 1.7, 5, -4.7); }
  sign(w, 0, 4.4, -4.3, 'HX HALL · CORE LOOP 3', 4.6, .5);

  // Hot gallery: bare rock and a scorched pipe overhead (the heat itself is a mission prop).
  { const c = cyl(w, 0, 5.6, -24, .35, .35, 20, hot, 10); c.rotation.x = Math.PI / 2; }

  // Pump hall: four big circulation pumps, a control desk and the core access hatch frame (north).
  for (const [x, z] of [[-11, -41], [-4, -38], [4, -38], [11, -41]]) {
    solid(w, x, 1.2, z, 3, 2.4, 3, pipe); cyl(w, x, 3, z, .9, .9, 1.2, 'steel', 14); box(w, x, 2.5, z + 1.52, .9, .5, .05, strip);
  }
  solid(w, 0, .5, -44, 5, 1, 1.2, 'edge');
  box(w, 0, 3, -47.7, 5, 6, .3, 'dark'); for (const x of [-2.6, 2.6]) box(w, x, 3, -47.5, .3, 6, .5, 'amber');
  sign(w, 0, 6.2, -47.4, 'CORE ACCESS · AUTHORISED ONLY', 5, .5);

  // Sparse cold work lights (flashlight territory between them).
  for (const [x, z, k] of [[0, 30, 7], [-15, -9, 4], [15, -9, 4], [0, -42, 6]]) { const l = new THREE.PointLight(0x9fd0ff, k, 18, 1.8); l.position.set(x, 5.8, z); w.add(l); box(w, x, 6.6, z, .8, .1, .3, strip); }
}
