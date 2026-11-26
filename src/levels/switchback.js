// Level: Switchback Pass, the winding road up to Fernhill. The engine has flat ground, so the
// "mountain" is a rock canyon: cliff walls, rock ridges between the road's switchbacks, pines,
// boulders and wrecks for cover, and the Fernhill hospital gate at the north end.
import { THREE } from '../engine/three.js';
import { geo, mesh, box, cyl, rod, wire, sign, noiseTex, rand, setSeed } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';

/** Road centreline, south (start) to north (Fernhill gate). Missions reuse it as a vehicle path. */
export const ROAD = [[0, 80], [0, 52], [-18, 40], [-20, 18], [0, 6], [18, -6], [20, -30], [2, -44], [-14, -56], [-8, -72], [0, -82]];

// Rock ridges between switchbacks: [cx, cz, width, depth, height].
const RIDGES = [[16, 30, 22, 7, 5], [-15, -12, 24, 7, 5.5], [17, -57, 22, 7, 5], [-20, 62, 22, 7, 4.5]];

export default {
  id: 'switchback',
  name: 'Switchback Pass',
  bounds: { x: 33, z: 82 },
  environment: { sky: '#d9a98a', fog: [70, 240], shadowExtent: 92, shadowFar: 260 },
  menuCamera: { radius: 125, height: 85 },
  map: {
    min: [-36, -86], max: [36, 86], outline: [[-33, -82], [33, 82]],
    lines: ROAD.slice(1).map((p, i) => [ROAD[i][0], ROAD[i][1], p[0], p[1]]), lineWidth: 6,
  },
  build,
};

function distToRoad(x, z) {
  let best = Infinity;
  for (let i = 1; i < ROAD.length; i++) {
    const [ax, az] = ROAD[i - 1], [bx, bz] = ROAD[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
const inRidge = (x, z, pad = 0) => RIDGES.some(([cx, cz, w, d]) => Math.abs(x - cx) < w / 2 + pad && Math.abs(z - cz) < d / 2 + pad);

function rock(w, x, z, r, m = 'rock', y = null) {
  const o = mesh(w, geo('sphere', 1, 6, 4), m, x, y ?? r * .55, z);
  o.scale.set(r * (1 + rand() * .4), r * (.8 + rand() * .5), r * (1 + rand() * .4)); o.rotation.y = rand() * 6;
  return o;
}

function pine(w, x, z, h) {
  cyl(w, x, h * .2, z, .14, .22, h * .4, 'trunk', 6);
  const a = mesh(w, geo('cone', 1, 1, 7), rand() > .5 ? 'pine' : 'pine2', x, h * .5, z); a.scale.set(h * .28, h * .55, h * .28);
  const b = mesh(w, geo('cone', 1, 1, 7), 'pine', x, h * .78, z); b.scale.set(h * .19, h * .4, h * .19);
}

function wreck(w, x, z, yaw, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; w.add(g);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .3 });
  box(g, 0, .65, 0, 1.9, .75, 4.3, paint); box(g, 0, 1.25, .3, 1.7, .6, 2.1, paint); box(g, 0, 1.25, -.8, 1.6, .45, .05, 'glass');
  for (const [wx, wz] of [[-.95, -1.4], [.95, -1.4], [-.95, 1.4], [.95, 1.4]]) { const t = cyl(g, wx, .35, wz, .35, .35, .25, 'dark', 10); t.rotation.z = Math.PI / 2; }
  const big = Math.abs(Math.sin(yaw)) > .7;
  block(x, z, big ? 4.3 : 1.9, big ? 1.9 : 4.3);
  addSolid(x - (big ? 2.15 : .95), 0, z - (big ? .95 : 2.15), x + (big ? 2.15 : .95), 1.55, z + (big ? .95 : 2.15));
}

function build(w) {
  setSeed(907);
  const ground = new THREE.MeshStandardMaterial({ color: 0xb7a98c, map: noiseTex([128, 120, 96], 40, [40, 90]), roughness: 1 });
  const verge = new THREE.MeshStandardMaterial({ color: 0x9c907a, map: noiseTex([150, 142, 126], 55, [8, 8]), roughness: 1 });
  box(w, 0, -.42, 0, 700, .6, 700, ground).castShadow = false;

  // Road: segments plus round joints so corners stay filled.
  for (let i = 1; i < ROAD.length; i++) {
    const [ax, az] = ROAD[i - 1], [bx, bz] = ROAD[i], len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
    const sh = box(w, (ax + bx) / 2, .02, (az + bz) / 2, 10, .06, len, verge); sh.rotation.y = yaw; sh.castShadow = false;
    const r = box(w, (ax + bx) / 2, .08, (az + bz) / 2, 6.6, .06, len, 'asphalt'); r.rotation.y = yaw; r.castShadow = false;
    for (let t = 2; t < len - 1; t += 5) {
      const dash = box(w, ax + (bx - ax) * t / len, .115, az + (bz - az) * t / len, .12, .01, 2, 'white'); dash.rotation.y = yaw; dash.castShadow = false;
    }
  }
  for (const [x, z] of ROAD) {
    const j = cyl(w, x, .02, z, 5, 5, .06, verge, 20); j.castShadow = false;
    const k = cyl(w, x, .08, z, 3.3, 3.3, .06, 'asphalt', 20); k.castShadow = false;
  }

  // Canyon walls beyond the play area, and distant peaks.
  // Boulders at the foot of the walls, then wide-based crags behind (cones never overhang).
  for (const side of [-1, 1]) for (let z = -100; z <= 100; z += 6) {
    rock(w, side * (40 + rand() * 4), z + rand() * 3, 4.5 + rand() * 3, rand() > .5 ? 'rock' : 'rock2');
  }
  for (const side of [-1, 1]) for (let z = -104; z <= 104; z += 9) {
    const c = mesh(w, geo('cone', 1, 1, 7), rand() > .5 ? 'rock' : 'rock2', side * (52 + rand() * 8), -1, z + rand() * 4);
    const r = 11 + rand() * 6; c.scale.set(r, 22 + rand() * 16, r); c.rotation.y = rand() * 6;
  }
  for (let i = 0; i < 16; i++) {
    const m = mesh(w, geo('cone', 1, 1, 6), 'rock2', (i - 8) * 45 + rand() * 20, -6, -150 - rand() * 60);
    const mw = 40 + rand() * 30; m.scale.set(mw, 50 + rand() * 40, mw);
    // Snow cap: the top quarter of the peak (cone geometry is centred, so the tip is at y + h/2).
    const h = m.scale.y, hs = h * .25;
    const snow = mesh(w, geo('cone', 1, 1, 6), 'white', m.position.x, m.position.y + h / 2 - hs / 2 + .05, m.position.z);
    snow.scale.set(mw * .26, hs, mw * .26);
  }

  // Ridges between switchbacks (solid, with boulders for a natural outline).
  for (const [cx, cz, wd, d, h] of RIDGES) {
    box(w, cx, h / 2 - .2, cz, wd, h, d, 'rock2');
    for (let k = 0; k < wd / 2.4; k++) rock(w, cx - wd / 2 + 1.2 + k * 2.4, cz + (rand() - .5) * d * .6, 2.2 + rand() * 1.6, rand() > .5 ? 'rock' : 'rock2', h * (.6 + rand() * .4));
    block(cx, cz, wd, d); addSolid(cx - wd / 2, 0, cz - d / 2, cx + wd / 2, h + .8, cz + d / 2);
  }

  // Boulders for cover near (not on) the road.
  const placed = [];
  for (let n = 0, tries = 0; n < 46 && tries < 900; tries++) {
    const x = (rand() - .5) * 62, z = (rand() - .5) * 158, r = .8 + rand() * .8, dr = distToRoad(x, z);
    if (dr < 5.5 || dr > 16 || inRidge(x, z, 2) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.5)) continue;
    placed.push([x, z]); n++;
    rock(w, x, z, r, rand() > .5 ? 'rock' : 'rock2');
    block(x, z, r * 1.7, r * 1.7); addSolid(x - r * .85, 0, z - r * .85, x + r * .85, r * 1.5, z + r * .85);
  }

  // Pines: inside the pass with trunk collision, and dense outside it.
  for (let n = 0, tries = 0; n < 70 && tries < 1500; tries++) {
    const x = (rand() - .5) * 64, z = (rand() - .5) * 160;
    if (distToRoad(x, z) < 7 || inRidge(x, z, 2) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3)) continue;
    placed.push([x, z]); n++;
    pine(w, x, z, 7 + rand() * 6); block(x, z, .5, .5); addSolid(x - .25, 0, z - .25, x + .25, 6, z + .25);
  }
  for (let i = 0; i < 160; i++) {
    const side = rand() > .5 ? 1 : -1;
    pine(w, side * (36 + rand() * 30), (rand() - .5) * 240, 8 + rand() * 8);
  }

  // Wrecked cars abandoned on the shoulders (cover).
  wreck(w, 5.2, 62, .1, 0x7d4a3a); wreck(w, -12, 50, 2.1, 0x47606e); wreck(w, -25.5, 30, -.2, 0x8a8268);
  wreck(w, 8, -4, 1.0, 0x5b6b4d); wreck(w, 25.5, -20, .05, 0x7d4a3a); wreck(w, -3, -52, -.9, 0x47606e);

  // Power line along the road (the circuit the truck will restore).
  let prev = null;
  for (let i = 1; i < ROAD.length; i++) {
    const [ax, az] = ROAD[i - 1], [bx, bz] = ROAD[i], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let t = 0; t < len; t += 24) {
      const x = ax + (bx - ax) * t / len + nx * 5.5, z = az + (bz - az) * t / len + nz * 5.5;
      if (inRidge(x, z, 1)) continue;
      cyl(w, x, 4.5, z, .13, .18, 9, 'trunk', 7); box(w, x, 8.6, z, 2.4, .14, .14, 'trunk');
      block(x, z, .5, .5); addSolid(x - .2, 0, z - .2, x + .2, 9, z + .2);
      if (prev) for (const o of [-1, 0, 1]) wire(w, [prev[0] + o, 8.7, prev[1]], [x + o, 8.7, z], .5, .02);
      prev = [x, z];
    }
  }

  // Staging area at the south end.
  for (const [x, z] of [[-9, 77], [9, 78], [-11, 70]]) { box(w, x, .8, z, 2.4, 1.6, 2.2, 'crate'); block(x, z, 2.4, 2.2); addSolid(x - 1.2, 0, z - 1.1, x + 1.2, 1.8, z + 1.1); }
  sign(w, 7, 1.6, 74, 'RIDGE RD  ·  FERNHILL 4 km', 3.8, .7, '#2f5a3a', '#e9efe4');
  cyl(w, 7, .8, 74.1, .06, .06, 1.6, 'steel', 6);

  // Fernhill General: perimeter wall and gate at the north end (just past the play area).
  for (const side of [-1, 1]) {
    box(w, side * 19, 1.6, -84, 30, 3.2, .8, 'building'); box(w, side * 19, 3.3, -84, 30.4, .25, 1, 'roof');
    cyl(w, side * 4.2, 2, -84, .45, .45, 4, 'concrete', 10);
  }
  sign(w, 0, 4.4, -83.6, 'FERNHILL GENERAL', 6.4, .9, '#e9efe4', '#24414b');
  box(w, 0, 6, -100, 46, 12, 18, 'building'); box(w, 0, 12.2, -100, 47, .5, 19, 'roof');
  for (let x = -20; x <= 20; x += 4) for (const y of [3, 7, 10]) box(w, x, y, -90.95, 2, 1.4, .1, 'glass');
  box(w, 0, 13.2, -100, 6, 1.6, 6, 'red'); box(w, 0, 13.2, -96.9, 3.6, .9, .1, 'white'); box(w, 0, 13.2, -96.85, .9, 3.6 * .25, .1, 'white');
}
