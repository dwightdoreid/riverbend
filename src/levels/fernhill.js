// Level: Fernhill General, the back lot. A generator compound against the hospital wall,
// an ambulance bay, a parking lot full of cover, and three fence gaps the machines attack from.
import { THREE } from '../engine/three.js';
import { geo, mesh, box, cyl, sign, noiseTex, rand, setSeed } from '../engine/builders.js';
import { block, addSolid } from '../game/world.js';
import { cover } from './kit.js';

export default {
  id: 'fernhill',
  name: 'Fernhill General',
  bounds: { x: 33, z: 29 },
  environment: { sky: '#0a121b', fog: [18, 95], shadowExtent: 60, shadowFar: 200 },
  menuCamera: { radius: 75, height: 48 },
  map: { min: [-36, -32], max: [36, 32], outline: [[-33, -29], [33, 29]], lines: [[-5, 29, 5, 29], [33, -4, 33, 4], [-33, 8, -33, 16]], lineWidth: 4 },
  build,
};

function solidBox(w, x, y, z, wd, h, d, m) {
  box(w, x, y, z, wd, h, d, m); block(x, z, wd, d); addSolid(x - wd / 2, 0, z - d / 2, x + wd / 2, y + h / 2, z + d / 2);
}

function car(w, x, z, yaw, color) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; w.add(g);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .5 });
  box(g, 0, .62, 0, 1.85, .7, 4.2, paint); box(g, 0, 1.2, .25, 1.65, .55, 2.1, paint);
  box(g, 0, 1.2, -.83, 1.55, .45, .05, 'glass'); box(g, 0, 1.2, 1.33, 1.55, .4, .05, 'glass');
  for (const [wx, wz] of [[-.92, -1.35], [.92, -1.35], [-.92, 1.35], [.92, 1.35]]) { const t = cyl(g, wx, .33, wz, .33, .33, .24, 'dark', 10); t.rotation.z = Math.PI / 2; }
  const side = Math.abs(Math.sin(yaw)) > .7;
  block(x, z, side ? 4.2 : 1.85, side ? 1.85 : 4.2);
  addSolid(x - (side ? 2.1 : .93), 0, z - (side ? .93 : 2.1), x + (side ? 2.1 : .93), 1.5, z + (side ? .93 : 2.1));
}

function ambulance(w, x, z, yaw) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; w.add(g);
  box(g, 0, 1.35, .5, 2.3, 2.2, 4.6, 'white'); box(g, 0, 1.05, -2.3, 2.2, 1.5, 1.6, 'white');
  box(g, 0, 1.6, .5, 2.32, .3, 4.62, 'red'); box(g, 0, 1.45, -3.11, 1.9, .6, .05, 'glass');
  box(g, 0, 2.55, -1.6, 1.2, .18, .3, new THREE.MeshStandardMaterial({ color: 0x4f8fe0, emissive: 0x2a66d0, emissiveIntensity: 1.4 }));
  for (const [wx, wz] of [[-1.05, -2], [1.05, -2], [-1.05, 1.9], [1.05, 1.9]]) { const t = cyl(g, wx, .4, wz, .4, .4, .28, 'dark', 10); t.rotation.z = Math.PI / 2; }
  block(x, z - .4, 2.3, 6.2); addSolid(x - 1.15, 0, z - 3.5, x + 1.15, 2.5, z + 2.7);
}

function build(w) {
  setSeed(2024);
  const lot = new THREE.MeshStandardMaterial({ color: 0x5b6062, map: noiseTex([92, 96, 98], 22, [30, 26]), roughness: .95 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x55664f, map: noiseTex([80, 98, 76], 30, [50, 50]), roughness: 1 });
  box(w, 0, -.42, 0, 600, .6, 600, grass).castShadow = false;
  box(w, 0, -.01, 0, 70, .2, 62, lot).castShadow = false;

  // Parking bay lines.
  for (const z of [6, 16]) for (let x = -24; x <= 24; x += 3) { const l = box(w, x, .1, z, .1, .01, 5, 'white'); l.castShadow = false; }

  // Hospital rear wall (north), with lit windows and loading doors.
  const lit = new THREE.MeshStandardMaterial({ color: 0xf2dfb0, emissive: 0xf2cf8a, emissiveIntensity: .9 });
  box(w, 0, 9, -40, 90, 18, 16, 'building'); box(w, 0, 18.2, -40, 91, .5, 17, 'roof');
  for (let x = -40; x <= 40; x += 4) for (const y of [4, 8, 12, 15.5]) box(w, x, y, -31.95, 2, 1.5, .1, (x * 7 + y * 3) % 5 === 0 ? 'glass' : lit);
  for (const x of [-26, -6, 6]) box(w, x, 2, -31.9, 4.2, 4, .2, 'dark');
  sign(w, 0, 6.2, -31.85, 'FERNHILL GENERAL  ·  SERVICE YARD', 9, .8, '#24414b', '#e9efe4');
  block(0, -40, 90, 16);

  // Generator compound pad, fuel tanks and switchgear house.
  box(w, 0, .06, -15, 38, .12, 13, 'concrete').castShadow = false;
  for (const x of [-21, -16]) {
    const tank = cyl(w, x, 1.4, -23.5, 1.3, 1.3, 4.6, 'tank2', 16); tank.rotation.x = Math.PI / 2;
    box(w, x, .35, -23.5, 2, .7, 3.8, 'concrete');
  }
  block(-18.5, -23.5, 8, 5); addSolid(-22.5, 0, -26, -14.5, 2.8, -21);
  sign(w, -18.5, 3.2, -21, 'DIESEL · NO NAKED FLAMES', 4.4, .5, '#e6b34e', '#1d2c33');
  solidBox(w, 20, 1.6, -23.5, 7, 3.2, 5, 'building');
  box(w, 20, 3.3, -23.5, 7.4, .25, 5.4, 'roof'); box(w, 20, 1.2, -20.95, 1.2, 2.2, .1, 'dark');
  sign(w, 20, 2.75, -20.9, 'SWITCHGEAR', 3, .45);

  // Low concrete barriers in front of the compound (gap in the middle).
  for (const [x, z] of [[-13, -5.5], [-5, -5.5], [5, -5.5], [13, -5.5]]) cover(w, x, z, 5, 1.1, 1.2);
  for (const [x, z] of [[-27, 3], [27, 3]]) cover(w, x, z, 4, 1.1, 1.2);

  // Ambulance bay (west) under a canopy.
  for (const [x, z] of [[-30, -14], [-22, -14], [-30, 0], [-22, 0]]) { cyl(w, x, 2.4, z, .14, .14, 4.8, 'steel', 8); block(x, z, .4, .4); addSolid(x - .15, 0, z - .15, x + .15, 4.8, z + .15); }
  box(w, -26, 4.9, -7, 10, .3, 16, 'roof');
  ambulance(w, -28, -9, .05); ambulance(w, -23.5, -2.5, -.1);

  // Parking lot.
  const colors = [0x7d4a3a, 0x47606e, 0x8a8268, 0x5b6b4d, 0x2f3a44, 0xb8b2a4, 0x6d2f2f];
  let ci = 0;
  for (const z of [6, 16]) for (let x = -22.5; x <= 22.5; x += 3) {
    if (Math.abs(x) < 3 || rand() < .45) continue;          // keep a driving lane and gaps
    car(w, x, z + (rand() - .5) * .6, (rand() - .5) * .12 + (rand() > .5 ? 0 : Math.PI), colors[ci++ % colors.length]);
  }
  // Light poles (decorative; the mission's floodlights do the lighting).
  for (const [x, z] of [[-16, 11], [16, 11], [0, 22]]) {
    cyl(w, x, 4, z, .12, .16, 8, 'steel', 8); box(w, x, 8.1, z, 1.6, .18, .4, 'edge');
    block(x, z, .5, .5); addSolid(x - .2, 0, z - .2, x + .2, 8, z + .2);
  }

  // Perimeter fence with three gaps (south, east, west) and trees beyond it.
  const fence = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 3);
    for (let i = 0; i <= n; i++) cyl(w, ax + (bx - ax) * i / n, 1.1, az + (bz - az) * i / n, .05, .05, 2.2, 'steel', 6);
    const panel = box(w, (ax + bx) / 2, 1.1, (az + bz) / 2, .03, 2, len, new THREE.MeshStandardMaterial({ color: 0x9aa6a8, transparent: true, opacity: .35, metalness: .6 }));
    panel.rotation.y = Math.atan2(bx - ax, bz - az); panel.castShadow = false;
  };
  fence(-34, 30, -5, 30); fence(5, 30, 34, 30); fence(34, 30, 34, 4); fence(34, -4, 34, -32);
  fence(-34, 30, -34, 16); fence(-34, 8, -34, -32);
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, d = 46 + rand() * 50, x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (z < -30) continue;
    const h = 6 + rand() * 6; cyl(w, x, h * .3, z, .2, .3, h * .6, 'trunk', 6);
    const t = mesh(w, geo('cone', 1, 1, 7), rand() > .5 ? 'pine' : 'pine2', x, h * .75, z); t.scale.set(h * .3, h * .7, h * .3);
  }
  // Planters along the hospital wall (cover near the compound).
  for (const x of [-28, -10, 10, 28]) solidBox(w, x, .5, -28.5, 3, 1, 1.4, 'concrete');
}
