// Level: Riverbend 132/33 kV substation yard.
import { THREE } from '../engine/three.js';
import { geo, mesh, box, cyl, rod, wire, ins, footing, sign, noiseTex, rand, setSeed } from '../engine/builders.js';
import { world, block, addSolid } from '../game/world.js';
import { cover, crate } from './kit.js';

export default {
  id: 'riverbend',
  name: 'Riverbend Substation',
  bounds: { x: 42, z: 36.5 },
  environment: { sky: '#9cb5c4', fog: [120, 290], sun: { pos: [-48, 53, 30] }, shadowExtent: 83 },
  menuCamera: { radius: 102, height: 66 },
  map: { min: [-46, -40], max: [46, 40], outline: [[-44, -38], [44, 38]], lines: [[-35, -7, 35, -7], [-35, -4, 35, -4], [-35, -1, 35, -1]] },
  build,
};

function post(w, x, z, h = 2.4) {
  footing(w, x, z, 1.2, 1.2); box(w, x, h / 2 + .25, z, .19, h, .19, 'steel');
  rod(w, [x - .42, .3, z - .42], [x, h + .2, z], .045); rod(w, [x + .42, .3, z + .42], [x, h + .2, z], .045); block(x, z, .6, .6);
}
function latticeColumn(w, x, z, h) {
  const s = .48; footing(w, x, z, 1.5, 1.5);
  for (const dx of [-s, s]) for (const dz of [-s, s]) rod(w, [x + dx, .3, z + dz], [x + dx, h, z + dz], .065);
  for (let y = .4; y < h - 1; y += 1.7) {
    for (const dz of [-s, s]) { rod(w, [x - s, y, z + dz], [x + s, Math.min(y + 1.7, h), z + dz], .035); rod(w, [x + s, y, z + dz], [x - s, Math.min(y + 1.7, h), z + dz], .035); }
    for (const dx of [-s, s]) rod(w, [x + dx, y, z - s], [x + dx, Math.min(y + 1.7, h), z + s], .035);
  }
  block(x, z, 1, 1);
}
function gantry(w, cx, z, width = 15, h = 11) {
  for (const x of [cx - width / 2, cx + width / 2]) latticeColumn(w, x, z, h);
  for (const yy of [h, h + .65]) for (const zz of [z - .35, z + .35]) rod(w, [cx - width / 2, yy, zz], [cx + width / 2, yy, zz], .07);
  for (let x = cx - width / 2; x < cx + width / 2; x += 1.5) {
    rod(w, [x, h, z - .35], [Math.min(x + 1.5, cx + width / 2), h + .65, z + .35], .045);
    rod(w, [x, h + .65, z + .35], [Math.min(x + 1.5, cx + width / 2), h, z - .35], .045);
  }
}

function build(w) {
  setSeed(31);
  const grass = new THREE.MeshStandardMaterial({ color: 0xb2b99a, map: noiseTex([113, 132, 96], 35), roughness: 1 });
  const gravel = new THREE.MeshStandardMaterial({ map: noiseTex([168, 167, 151], 65), roughness: 1 });

  // Ground, roads, perimeter curbs.
  box(w, 0, -.42, 0, 650, .6, 650, grass).castShadow = false; box(w, 0, -.02, 0, 90, .28, 78, gravel).castShadow = false;
  box(w, 0, .14, 0, 6, .07, 74, 'road').castShadow = false; box(w, 0, .16, 31, 78, .07, 5, 'road').castShadow = false;
  for (let z = -32; z < 31; z += 6) box(w, 0, .205, z, .1, .014, 2, 'white').castShadow = false;
  for (const x of [-44.6, 44.6]) box(w, x, .25, 0, .25, .35, 78, 'concrete');
  for (const z of [-38.6, 38.6]) box(w, 0, .25, z, 90, .35, .25, 'concrete');

  // Perimeter fence.
  for (const z of [-38, 38]) {
    for (let x = -44; x <= 44; x += 4) { if (z === 38 && Math.abs(x) < 5) continue; cyl(w, x, 1.25, z, .045, .045, 2.5, 'steel', 6); }
    for (let y = .65; y < 2.6; y += .6) {
      if (z === 38) { rod(w, [-44, y, z], [-4, y, z], .018); rod(w, [4, y, z], [44, y, z], .018); } else rod(w, [-44, y, z], [44, y, z], .018);
    }
    for (let x = -44; x < 44; x += 1) {
      if (z === 38 && Math.abs(x) < 4) continue;
      rod(w, [x, .3, z], [x + 1, 2.4, z], .009, 'steel', 4); rod(w, [x, 2.4, z], [x + 1, .3, z], .009, 'steel', 4);
    }
  }
  for (const x of [-44, 44]) {
    for (let z = -38; z <= 38; z += 4) cyl(w, x, 1.25, z, .045, .045, 2.5, 'steel', 6);
    for (let y = .65; y < 2.6; y += .6) rod(w, [x, y, -38], [x, y, 38], .018);
    for (let z = -38; z < 38; z += 1) { rod(w, [x, .3, z], [x, 2.4, z + 1], .009, 'steel', 4); rod(w, [x, 2.4, z], [x, .3, z + 1], .009, 'steel', 4); }
  }
  for (const x of [-4, 4]) cyl(w, x, 1.4, 38, .1, .1, 2.8, 'dark');
  sign(w, -8, 1.8, 38.06, '132 kV  /  HV', 3.2, .8, '#e6b34e', '#1d2c33');

  // Lightning masts.
  for (const [x, z] of [[-39, -30], [39, -30], [-39, 25], [39, 25]]) {
    footing(w, x, z, 2, 2); cyl(w, x, 9.7, z, .09, .28, 19, 'steel'); block(x, z, 1, 1);
    rod(w, [x - 1, 14, z], [x + 1, 14, z], .065); for (const s of [-1, 1]) box(w, x + s, 13.9, z, .48, .16, .42, 'white');
  }

  // 132 kV busbars.
  for (const [i, z] of [-7, -4, -1].entries()) {
    rod(w, [-36, 7, z], [36, 7, z], .105, 'conductor', 12);
    for (const x of [-35, -6, 6, 35]) { post(w, x, z, 3.9); ins(w, x, 4.15, z, 2.7, .29, 'silicone'); }
    cyl(w, -34, 7, z, .14, .14, .32, ['red', 'amber', 'blue'][i]);
  }

  // Incoming line bays: gantry, CVTs, arresters, disconnectors, CTs, breakers.
  for (const [idx, cx] of [-20, 20].entries()) {
    const n = idx + 1;
    gantry(w, cx, -32, 15, 11);
    for (let p = 0; p < 3; p++) {
      const x = cx + (p - 1) * 4;
      ins(w, x, 8.7, -32, 2, .25); wire(w, [x, 10.8, -75], [x, 10.8, -32], 1.7, .055); wire(w, [x, 8.65, -32], [x, 5.2, -25], .25, .045);
    }
    for (let p = 0; p < 3; p++) {
      const x = cx + (p - 1) * 4;
      footing(w, x, -26); box(w, x, .55, -26, .85, .8, .75, 'dark'); ins(w, x, 1, -26, 4.05, .33); wire(w, [x, 5.1, -26], [x, 5.2, -25], 0, .035);
      box(w, x + .5, .65, -26, .25, .35, .3, 'steel'); footing(w, x + 1.35, -29, 1, 1); ins(w, x + 1.35, .3, -29, 3.6, .22, 'silicone');
      wire(w, [x + 1.35, 4, -29], [x, 6.93, -29], .08, .03); rod(w, [x + 1.35, .3, -29], [x + 1.5, .1, -28.2], .028, 'earth');
      block(x, -26, .9, .9); block(x + 1.35, -29, .5, .5);
    }
    for (let p = 0; p < 3; p++) {
      const x = cx + (p - 1) * 4;
      post(w, x, -21, 2.4); box(w, x, 2.7, -21, .34, .22, 3.1, 'steel'); ins(w, x, 2.8, -22.2, 2.15, .25); ins(w, x, 2.8, -19.8, 2.15, .25);
      rod(w, [x, 5, -22.2], [x, 5, -19.8], .075, 'conductor'); wire(w, [x, 5.2, -25], [x, 5, -22.2], .12); box(w, x, 5, -20, .2, .16, .25, 'dark');
      rod(w, [cx - 4, 1, -21], [cx + 4, 1, -21], .035);
      post(w, x, -16.5, 1.4); ins(w, x, 1.65, -16.5, 2.75, .29); cyl(w, x, 4.65, -16.5, .46, .46, .5, 'steel'); wire(w, [x, 5, -19.8], [x, 4.9, -16.5], .1);
      footing(w, x, -12, 1.8, 2.1); box(w, x, 1.25, -12, .22, 2.3, .25, 'steel'); ins(w, x, 2.5, -12, 1.4, .27, 'silicone'); ins(w, x, 3.9, -12, 1.55, .36, 'silicone');
      wire(w, [x, 4.9, -16.5], [x, 5.5, -12.7], .1); rod(w, [x, 5.5, -12.7], [x, 5.5, -11.3], .06, 'conductor'); wire(w, [x, 5.5, -11.3], [x, 7, -7 + p * 3], .15);
      block(x, -12, 1, 1);
    }
    box(w, cx - 6, 1, -21, .75, 1.2, .65, 'dark'); box(w, cx, 1, -12, 2, 1.6, .85, 'dark'); sign(w, cx, 1.05, -11.55, 'CB-' + n, 1.5, .42);
  }

  // Transformer bays and the two 60 MVA transformers.
  for (const [idx, cx] of [-20, 20].entries()) {
    const n = idx + 1;
    for (let p = 0; p < 3; p++) {
      const x = cx + (p - 1) * 4;
      post(w, x, 4, 2.4); box(w, x, 2.7, 4, .35, .22, 2.8, 'steel'); ins(w, x, 2.8, 3, 2.15, .25); ins(w, x, 2.8, 5, 2.15, .25);
      rod(w, [x, 5, 3], [x, 5, 5], .075, 'conductor'); wire(w, [x, 7, -7 + p * 3], [x, 5, 3], .12); rod(w, [cx - 4, .9, 4], [cx + 4, .9, 4], .035);
      footing(w, x, 10); box(w, x, 1.3, 10, .25, 2.4, .25, 'steel'); ins(w, x, 2.5, 10, 1.4, .27, 'silicone'); ins(w, x, 3.9, 10, 1.55, .36, 'silicone');
      rod(w, [x, 5.5, 9.3], [x, 5.5, 10.7], .06, 'conductor'); wire(w, [x, 5, 5], [x, 5.5, 9.3], .12); block(x, 10, .9, .9);
      post(w, x, 14.5, 1.4); ins(w, x, 1.65, 14.5, 2.75, .29); cyl(w, x, 4.65, 14.5, .46, .46, .5, 'steel');
      wire(w, [x, 5.5, 10.7], [x, 4.9, 14.5], .12); wire(w, [x, 4.9, 14.5], [cx + (p - 1) * 1.7, 5.9, 21.5], .2);
      const ax = cx + (p - 1) * 3.4; footing(w, ax, 18, 1, 1); ins(w, ax, .3, 18, 3.5, .22, 'silicone');
      wire(w, [ax, 3.9, 18], [cx + (p - 1) * 2.85, 5.2, 18], .05, .03); rod(w, [ax, .3, 18], [ax + .4, .12, 18.6], .03, 'earth'); block(ax, 18, .6, .6);
    }
    box(w, cx + 6, .95, 4, .8, 1.3, .6, 'dark'); box(w, cx, 1.1, 10, 2.1, 1.7, .9, 'dark'); sign(w, cx, 1.2, 10.48, 'T-CB ' + n, 1.6, .4);

    box(w, cx, .22, 23, 12, .35, 10, 'concrete');
    for (const xx of [cx - 5.8, cx + 5.8]) box(w, xx, .53, 23, .25, .5, 10, 'concrete');
    for (const zz of [18.2, 27.8]) box(w, cx, .53, zz, 11.7, .5, .25, 'concrete');
    box(w, cx, .43, 23, 11, .09, 9, gravel); for (const xx of [cx - 1.7, cx + 1.7]) box(w, xx, .64, 23, .15, .18, 7, 'dark');
    box(w, cx, 2.33, 23, 6.2, 3.25, 4.3, 'tank'); box(w, cx, 4.02, 23, 6.5, .25, 4.6, 'tank2'); box(w, cx, .85, 23, 6.5, .28, 4.6, 'edge');
    for (const side of [-1, 1]) {
      for (let z = 21.35; z <= 24.8; z += .28) box(w, cx + side * 4, 2.45, z, 1.45, 2.7, .09, 'tank2');
      for (const yy of [1.2, 3.7]) rod(w, [cx + side * 2.9, yy, 21.3], [cx + side * 4, yy, 21.3], .13, 'tank');
      for (const zz of [22, 24]) {
        const fan = cyl(w, cx + side * 4.78, 2.2, zz, .58, .58, .18, 'edge', 16); fan.rotation.z = Math.PI / 2;
        const hub = cyl(w, cx + side * 4.9, 2.2, zz, .17, .17, .2, 'steel'); hub.rotation.z = Math.PI / 2;
        for (let b = 0; b < 4; b++) { const ang = b * Math.PI / 2; rod(w, [cx + side * 5.02, 2.2, zz], [cx + side * 5.02, 2.2 + Math.sin(ang) * .43, zz + Math.cos(ang) * .43], .045, 'steel'); }
      }
    }
    for (let p = 0; p < 3; p++) {
      const x = cx + (p - 1) * 1.7;
      ins(w, x, 4.18, 21.5, 1.65, .3); cyl(w, x, 5.94, 21.5, .1, .1, .18, 'conductor'); ins(w, x, 4.18, 24.4, .9, .21);
      wire(w, [x, 5.2, 24.4], [x, 2.5, 26.2], .07, .045); cyl(w, x, 1.5, 26.2, .12, .12, 2, 'dark'); rod(w, [x, .5, 26.2], [x, .2, 27.3], .08, 'dark');
    }
    for (const x of [cx - 2, cx + 2]) box(w, x, 4.7, 23.5, .12, 1.2, .12, 'steel');
    const cons = cyl(w, cx, 5.4, 23.5, .62, .62, 5, 'tank', 16); cons.rotation.z = Math.PI / 2;
    rod(w, [cx + 2.2, 5.1, 23.5], [cx + 2.2, 4.18, 22.7], .08, 'tank'); box(w, cx + 2.2, 4.7, 23, .3, .25, .4, 'dark');
    cyl(w, cx - 2.9, 4.25, 24, .14, .14, .6, 'amber'); box(w, cx + 3.3, 2.75, 24.7, .8, 2.2, 1.1, 'tank2'); box(w, cx - 1.3, 2.8, 25.2, 1.2, 1.3, .35, 'dark');
    sign(w, cx + 1.1, 2.9, 25.19, 'T' + n + '  60 MVA', 2.2, .55); rod(w, [cx - 3, .9, 25], [cx - 4, .2, 26.8], .03, 'earth'); block(cx, 23, 10.5, 7.4);
    // Cable trench toward the switchgear building.
    box(w, cx, .23, 28.5, 1.2, .15, 2.2, 'concrete'); box(w, cx / 2, .24, 29.35, Math.abs(cx) + 1, .17, .7, 'concrete');
    for (let x = Math.min(cx, 0); x <= Math.max(cx, 0); x += 1) box(w, x, .335, 29.35, .04, .015, .7, 'edge');
  }

  // Control building, station service transformer, cable trenches.
  box(w, 0, .3, 22, 11.5, .5, 9); box(w, 0, 2.3, 22, 10.8, 3.8, 8, 'building'); box(w, 0, 4.3, 22, 11.6, .35, 8.8, 'roof'); box(w, 0, 4.8, 22, 1.2, .6, 1.2, 'dark');
  for (const x of [-3.7, -1.8, 1.8, 3.7]) { box(w, x, 2.65, 26.03, 1.25, 1.05, .06, 'edge'); box(w, x, 2.65, 26.08, 1.1, .9, .03, 'glass'); }
  box(w, 0, 1.65, 26.08, 1.2, 2.4, .12, 'dark'); box(w, .35, 1.6, 26.17, .05, .15, .08, 'amber'); sign(w, 0, 3.55, 26.12, 'CONTROL  /  33 kV', 5.2, .5);
  for (let z = 20; z <= 24; z += 1) box(w, 5.45, 2, z, .08, 1.2, .7, 'edge');
  block(0, 22, 11.4, 8.6);
  box(w, -10, .4, 32.8, 3, .5, 3); box(w, -10, 1.5, 32.8, 2, 1.8, 1.5, 'tank'); for (const x of [-10.6, -10, -9.4]) ins(w, x, 2.5, 32.8, .65, .14);
  for (let x = -10.9; x <= -9.1; x += .2) box(w, x, 1.5, 33.7, .07, 1.5, .3, 'tank2');
  box(w, -8.7, 1.4, 32.8, .6, 1.2, .7, 'dark'); block(-10, 32.8, 3, 3);
  for (const x of [-11, 11]) { box(w, x, .21, -4, .9, .16, 63); for (let z = -35; z < 27; z += 1.2) box(w, x, .3, z, .9, .015, .035, 'edge'); }

  // Surrounding landscape.
  for (let i = 0; i < 85; i++) {
    const angle = rand() * Math.PI * 2, dist = 78 + rand() * 130, x = Math.sin(angle) * dist, z = Math.cos(angle) * dist;
    if (Math.abs(x) < 12 && z > 0) continue;
    const h = 4 + rand() * 5; cyl(w, x, h * .35, z, .2, .3, h * .7, 'trunk', 6);
    const tree = mesh(w, geo('cone', 1, 1, 7), i % 2 ? 'leaf' : 'leaf2', x, h * .8, z); tree.scale.set(h * .42, h * .8, h * .42);
  }
  for (let i = 0; i < 12; i++) {
    const mountain = mesh(w, geo('cone', 1, 1, 6), grass, (i - 6) * 50, -3, -200 - rand() * 35);
    const mw = 40 + rand() * 30; mountain.scale.set(mw, 23 + rand() * 22, mw * 1.1);
  }

  // Derive solid volumes from the equipment footprints (tuned to the shapes above).
  for (const b of world.collisions) {
    let wd = b.w - .8, d = b.d - .8, h = 4.5;
    if (wd > 8 && d > 6) { if (b.x === 0 && b.z === 22) { wd = 10.8; d = 8; h = 4.5; } else { wd = 10.3; d = 6.8; h = 4.2; } }
    else if (wd <= 1.1 && d <= 1.1) { wd = d = .34; h = 4.8; }
    else h = 2.8;
    addSolid(b.x - wd / 2, 0, b.z - d / 2, b.x + wd / 2, h, b.z + d / 2);
  }

  // Combat cover and supply crates.
  for (const a of [[-12, 30, 5], [12, 31, 5], [-9, 11, 4], [9, 9, 4], [-30, 18, 4], [30, 17, 4], [-29, -9, 4], [28, -14, 4], [0, -25, 5], [0, -10, 4]]) cover(w, ...a);
  crate(w, -35, 8, 3, 1.5); crate(w, 35, -3, 3, 2.5); crate(w, -5, -29, 3.5, 2.1); crate(w, 8, 33, 3.5, 1.6);
}
