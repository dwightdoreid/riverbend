// Interactive mission props and pickups, created from mission data.
// Every prop has a `style` (its visual state) that events change and checkpoints restore.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, geo, mesh, glowMats } from '../engine/builders.js';
import { G } from './state.js';
import { addMover } from './world.js';
import { districtLit } from './blackout.js';
import { burst } from './combat.js';
import { runEvents } from './mission.js';

const emissive = (color, intensity = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .5 });

const PROP_TYPES = {
  terminal(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const styles = { amber: glowMats.amber(), teal: glowMats.teal() };
    box(root, x, .7, z, .65, 1.4, .5, 'dark');
    const screen = box(root, x, 1.5, z, .78, .55, .12, styles[def.style ?? 'amber']); screen.rotation.x = -.2;
    box(root, x, 1.16, z + .15, .8, .08, .5, 'edge'); cyl(root, x, .12, z, .65, .65, .18, 'edge', 12);
    return {
      root, pos: new THREE.Vector3(x, 1.45, z),
      setStyle(s) { screen.material = styles[s]; },
      update(t, i) { screen.material.emissiveIntensity = .6 + Math.sin(t * 3 + i) * .2; },
    };
  },

  extraction(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const ringMat = glowMats.teal(), r = def.radius ?? 2.65;
    const ring = mesh(root, geo('torus', r, .065, 6, 64), ringMat, x, .24, z); ring.rotation.x = Math.PI / 2;
    for (const dx of [-3.3, 3.3]) { box(root, x + dx, .8, z, .12, 1.4, .12, 'steel'); box(root, x + dx, 1.52, z, .3, .16, .3, ringMat); }
    return {
      root, pos: new THREE.Vector3(x, 1, z),
      setStyle() {},
      update(t, i, active) { ringMat.emissiveIntensity = active ? .8 + Math.sin(t * 4) * .2 : .3; },
    };
  },

  // A stranded lineman crouched in cover, headlamp blinking. Style 'gone' once rescued.
  survivor(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g); g.position.set(x, 0, z); g.rotation.y = def.facing ?? 0;
    const suit = new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: .8 });
    const lamp = emissive(0xfff3c4, 2);
    box(g, 0, .55, 0, .5, .6, .42, suit);                       // torso (crouched)
    box(g, 0, .2, -.22, .46, .32, .5, 'dark');                   // legs folded
    cyl(g, 0, 1.0, 0, .15, .16, .26, new THREE.MeshStandardMaterial({ color: 0xc9a27e }), 10); // head
    cyl(g, 0, 1.16, 0, .2, .2, .1, 'amber', 12);                 // hard hat
    box(g, 0, 1.08, -.16, .08, .06, .04, lamp);                  // headlamp
    for (const s of [-1, 1]) box(g, s * .1, .58, -.24, .1, .1, .1, 'white'); // reflective stripes
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    return {
      root, pos: new THREE.Vector3(x, .9, z),
      setStyle(s) { root.visible = s !== 'gone'; },
      update(t, i) { lamp.emissiveIntensity = (Math.sin(t * 5 + i * 2) > .6) ? 3 : .4; },
    };
  },

  // Breaker cabinet with a status lamp: style 'off' (red) or 'on' (green).
  panel(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const lamps = { off: emissive(0xe0503a, 1.2), on: emissive(0x5ce08a, 1.4) };
    const f = def.facing ?? 1; // door faces +z (1) or -z (-1)
    box(root, x, .95, z, 1.1, 1.9, .55, 'edge'); box(root, x, .95, z + f * .29, .95, 1.7, .04, 'dark');
    box(root, x - .2, 1.2, z + f * .32, .08, .32, .06, 'steel'); box(root, x + .2, 1.2, z + f * .32, .08, .32, .06, 'steel');
    const lamp = cyl(root, x, 1.75, z + f * .3, .06, .06, .08, lamps[def.style ?? 'off'], 10); lamp.rotation.x = Math.PI / 2;
    return {
      root, pos: new THREE.Vector3(x, 1.2, z),
      setStyle(s) { lamp.material = lamps[s]; },
      update() {},
    };
  },

  // Floodlight mast. Style 'on' lights the area (players inside become visible in the dark).
  floodlight(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const h = def.height ?? 7, aim = def.aim ?? [x, z];
    cyl(root, x, h / 2, z, .08, .12, h, 'steel', 8); box(root, x, .15, z, .8, .3, .8, 'concrete');
    const headOff = new THREE.MeshStandardMaterial({ color: 0x39444a }), headOn = emissive(0xfff0c8, 2.5);
    const head = box(root, x, h + .1, z, .9, .35, .35, headOff);
    rod(root, [x, h - .3, z], [x, h + .1, z], .05, 'dark', 6);
    const light = new THREE.SpotLight(0xffe7b8, 0, 40, .75, .55, 1.3);
    light.position.set(x, h + .2, z); light.target.position.set(aim[0], 0, aim[1]);
    root.add(light); root.add(light.target);
    const prop = {
      root, pos: new THREE.Vector3(x, 1, z), lightRadius: def.radius ?? 9, lightCenter: new THREE.Vector3(aim[0], 0, aim[1]), lit: false,
      setStyle(s) { prop.lit = s === 'on'; head.material = prop.lit ? headOn : headOff; light.intensity = prop.lit ? (def.intensity ?? 38) : 0; },
      update() {},
    };
    return prop;
  },

  // Mobile substation truck for escort missions. Its pose is driven by the escort system.
  truck(parent, def) {
    const root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g);
    const paint = new THREE.MeshStandardMaterial({ color: 0xe3dccb, roughness: .7 });
    const lamp = emissive(0xfff1c9, 2), beacon = emissive(0xf3a23a, 2.5);
    box(g, 0, 1.55, -2.5, 2.4, 2, 2, paint); box(g, 0, 1.95, -3.52, 2.1, .8, .05, 'glass');   // cab + windscreen
    box(g, 0, .9, .7, 2.5, .35, 5.6, 'edge');                                                  // flatbed
    box(g, 0, 2.05, .9, 2.1, 1.9, 3.4, 'tank'); box(g, 0, 3.05, .9, 2.2, .16, 3.5, 'tank2');   // transformer tank
    for (let z = -.4; z <= 2.2; z += .32) box(g, 1.15, 2, z, .12, 1.5, .08, 'tank2');           // radiator fins
    for (const x of [-.6, 0, .6]) { cyl(g, x, 3.45, .2, .1, .14, .7, 'ceramic', 8); cyl(g, x, 3.85, .2, .05, .05, .1, 'conductor', 6); }
    box(g, -1.0, 2.1, 2.9, .5, 1.6, .5, 'dark');                                               // control cabinet
    for (const z of [-2.5, .2, 2.4]) for (const x of [-1.2, 1.2]) { const w = cyl(g, x, .5, z, .5, .5, .4, 'dark', 12); w.rotation.z = Math.PI / 2; }
    for (const x of [-.8, .8]) box(g, x, 1.1, -3.52, .3, .2, .05, lamp);                       // headlights
    box(g, 0, 2.62, -2.5, .5, .14, .3, beacon);                                                // amber beacon
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const box3 = new THREE.Box3();
    const mover = addMover({ circles: [{ x: 0, z: 0, r: 1.45 }, { x: 0, z: 0, r: 1.45 }, { x: 0, z: 0, r: 1.45 }], box: box3 });
    const prop = {
      root, mover, pos: new THREE.Vector3(def.at[0], 1.6, def.at[1]), yaw: def.yaw ?? 0,
      setPose(x, z, yaw) {
        prop.pos.set(x, 1.6, z); prop.yaw = yaw; g.position.set(x, 0, z); g.rotation.y = yaw;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        [-2.3, 0, 2.3].forEach((o, i) => { mover.circles[i].x = x - fx * o; mover.circles[i].z = z - fz * o; });
        const ex = Math.abs(fx) * 3.6 + Math.abs(fz) * 1.25, ez = Math.abs(fz) * 3.6 + Math.abs(fx) * 1.25;
        box3.min.set(x - ex, 0, z - ez); box3.max.set(x + ex, 3.2, z + ez);
      },
      setStyle(s) { root.visible = s !== 'gone'; mover.enabled = s !== 'gone'; },
      update(t) { beacon.emissiveIntensity = Math.sin(t * 9) > 0 ? 3 : .3; },
    };
    prop.setPose(def.at[0], def.at[1], prop.yaw);
    return prop;
  },

  // Two-car commuter train (escort vehicle). Lit windows with passengers; pose driven by escort.
  train(parent, def) {
    const root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g);
    const body = new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: .6, metalness: .2 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x2f7a5a, roughness: .6 });
    const win = new THREE.MeshStandardMaterial({ color: 0xf2e6c4, emissive: 0xf2d79a, emissiveIntensity: 1.1 });
    const head = emissive(0xfff1c9, 2.2), dest = emissive(0xffb24a, 1.6);
    for (const cz of [-4.7, 4.7]) {
      box(g, 0, 1.95, cz, 2.9, 2.9, 9, body); box(g, 0, 3.5, cz, 2.6, .2, 8.8, 'edge');
      box(g, 0, 1.25, cz, 2.94, .25, 9.02, stripe);
      for (const s of [-1, 1]) {
        box(g, s * 1.46, 2.35, cz, .04, .9, 7.6, win);
        for (let k = -3; k <= 3; k += 1.5) box(g, s * 1.2, 2.2, cz + k, .4, .7, .4, 'dark');     // passengers
      }
      for (const bz of [-3, 3]) { box(g, 0, .45, cz + bz, 2.2, .5, 2.2, 'dark'); for (const s of [-1, 1]) { const wh = cyl(g, s * .75, .4, cz + bz, .38, .38, .2, 'steel', 10); wh.rotation.z = Math.PI / 2; } }
    }
    box(g, 0, 1.95, 0, 2.4, 2.4, .5, 'dark');                                                   // gangway
    box(g, 0, 2.9, -9.22, 2.3, .9, .05, 'glass'); box(g, 0, 3.4, -9.22, 1.6, .26, .05, dest);   // cab + destination
    for (const x of [-.9, .9]) box(g, x, 1.1, -9.23, .35, .2, .05, head);
    rod(g, [0, 3.6, -6], [0, 5.5, -4.5], .05, 'steel', 6); rod(g, [-.8, 5.5, -4.5], [.8, 5.5, -4.5], .05, 'steel', 6);   // pantograph
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const box3 = new THREE.Box3(), N = 12, halfL = 9.2;
    const mover = addMover({ circles: Array.from({ length: N }, () => ({ x: 0, z: 0, r: 1.55 })), box: box3 });
    const prop = {
      root, mover, pos: new THREE.Vector3(def.at[0], 1.8, def.at[1]), yaw: def.yaw ?? 0,
      setPose(x, z, yaw) {
        prop.pos.set(x, 1.8, z); prop.yaw = yaw; g.position.set(x, 0, z); g.rotation.y = yaw;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        mover.circles.forEach((c, i) => { const o = -halfL + 1 + i * (2 * halfL - 2) / (N - 1); c.x = x + fx * o; c.z = z + fz * o; });
        const ex = Math.abs(fx) * halfL + Math.abs(fz) * 1.5, ez = Math.abs(fz) * halfL + Math.abs(fx) * 1.5;
        box3.min.set(x - ex, 0, z - ez); box3.max.set(x + ex, 3.6, z + ez);
      },
      setStyle(s) { root.visible = s !== 'gone'; mover.enabled = s !== 'gone'; },
      update(t) { dest.emissiveIntensity = 1.3 + Math.sin(t * 2) * .3; },
    };
    prop.setPose(def.at[0], def.at[1], prop.yaw);
    return prop;
  },

  // Jersey barriers and wreckage blocking a road. Style 'gone' clears it.
  barricade(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g); g.position.set(x, 0, z); g.rotation.y = def.yaw ?? 0;
    const w = def.width ?? 9;
    for (let i = 0; i < Math.round(w / 2.1); i++) {
      const bx = -w / 2 + 1.05 + i * 2.1, b = box(g, bx, .45, (i % 2) * .5, 2, .9, .55, 'concrete'); b.rotation.y = (i % 3 - 1) * .12;
      box(g, bx, .75, (i % 2) * .5, 2.02, .14, .58, i % 2 ? 'orange' : 'white');
    }
    box(g, .8, .9, -1.2, 2.4, 1.2, 1.4, 'crate'); box(g, -2.4, .6, -1, 1.6, .9, 1.1, 'dark');
    const fx = Math.cos(def.yaw ?? 0), fz = -Math.sin(def.yaw ?? 0);
    const circles = []; for (let o = -w / 2; o <= w / 2; o += 1.4) circles.push({ x: x + fx * o, z: z + fz * o, r: .9 });
    const ex = Math.abs(fx) * w / 2 + .8, ez = Math.abs(fz) * w / 2 + .8;
    const mover = addMover({ circles, box: new THREE.Box3(new THREE.Vector3(x - ex, 0, z - ez), new THREE.Vector3(x + ex, 1.4, z + ez)) });
    return {
      root, mover, pos: new THREE.Vector3(x, 1, z),
      setStyle(s) { root.visible = s !== 'gone'; mover.enabled = s !== 'gone'; },
      update() {},
    };
  },

  // Heavy sliding door filling a gap in level walls. Style 'open' clears it.
  door(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g); g.position.set(x, 0, z); g.rotation.y = def.yaw ?? 0;
    const w = def.width ?? 4, h = def.height ?? 4;
    box(g, 0, h / 2, 0, w, h, .3, 'edge');
    for (let i = 0; i < 4; i++) box(g, 0, .5 + i * (h - 1) / 3, -.17, w * .96, .14, .04, i % 2 ? 'amber' : 'dark');
    const lamp = box(g, w / 2 + .3, h * .75, -.2, .16, .16, .06, emissive(0xe0503a, 1.4));
    const fx = Math.cos(def.yaw ?? 0), fz = -Math.sin(def.yaw ?? 0), circles = [];
    for (let o = -w / 2 + .5; o <= w / 2 - .4; o += .9) circles.push({ x: x + fx * o, z: z + fz * o, r: .55 });
    const ex = Math.abs(fx) * w / 2 + Math.abs(fz) * .3, ez = Math.abs(fz) * w / 2 + Math.abs(fx) * .3;
    const mover = addMover({ circles, box: new THREE.Box3(new THREE.Vector3(x - ex, 0, z - ez), new THREE.Vector3(x + ex, h, z + ez)) });
    const openMat = emissive(0x5ce08a, 1.4), shutMat = lamp.material;
    return {
      root, mover, pos: new THREE.Vector3(x, 1.4, z),
      setStyle(s) { const open = s === 'open'; g.visible = !open; mover.enabled = !open; lamp.material = open ? openMat : shutMat; },
      update() {},
    };
  },

  // A courier case left as a dead drop, with a blinking status LED. Style 'gone' once taken.
  drive(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const led = emissive(0x5ce08a, 2);
    box(root, x, (def.y ?? 0) + .14, z, .55, .28, .4, 'dark'); box(root, x, (def.y ?? 0) + .3, z, .2, .04, .06, 'steel');
    box(root, x + .2, (def.y ?? 0) + .2, z + .21, .06, .06, .02, led);
    return {
      root, pos: new THREE.Vector3(x, (def.y ?? 0) + .5, z),
      setStyle(s) { root.visible = s !== 'gone'; },
      update(t, i) { led.emissiveIntensity = Math.sin(t * 6 + i) > .3 ? 3 : .2; },
    };
  },

  // Street payphone.
  payphone(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g); g.position.set(x, 0, z); g.rotation.y = def.yaw ?? 0;
    box(g, 0, 1.1, 0, .9, 2.2, .5, 'blue'); box(g, 0, 2.3, 0, 1, .2, .6, 'white');
    box(g, 0, 1.35, -.27, .5, .7, .05, 'dark'); box(g, .2, 1.4, -.31, .1, .35, .06, 'steel');
    const screen = box(g, -.12, 1.55, -.3, .2, .12, .02, emissive(0x9fd6ff, 1.2));
    return {
      root, pos: new THREE.Vector3(x, 1.3, z),
      setStyle() {},
      update(t) { screen.material.emissiveIntensity = 1 + Math.sin(t * 3) * .4; },
    };
  },

  // Halvard cable junction: a cabinet with glowing feeder cables. Style 'cut' kills the glow.
  cable(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const glowOn = emissive(0x7fd4ff, 1.8), dead = new THREE.MeshStandardMaterial({ color: 0x23282b, roughness: .9 });
    box(root, x, 1.1, z, 1.4, 2.2, .8, 'edge'); box(root, x, 1.6, z - .41, 1.1, .5, .04, 'dark');
    const cables = [];
    for (const dx of [-.4, 0, .4]) cables.push(rod(root, [x + dx, 2.2, z], [x + dx, 4.4, z + .3], .09, glowOn, 6));
    const lamp = box(root, x + .45, 2, z - .42, .12, .12, .03, emissive(0x5ce08a, 1.6));
    return {
      root, pos: new THREE.Vector3(x, 1.3, z),
      setStyle(s) { const cut = s === 'cut'; for (const c of cables) c.material = cut ? dead : glowOn; lamp.material = cut ? dead : lamp.material; },
      update(t, i) { glowOn.emissiveIntensity = 1.4 + Math.sin(t * 7 + i) * .5; },
    };
  },

  // Station mimic board: a live one-line diagram of the mission's breakers and feeder.
  mimic(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g); g.position.set(x, 0, z); g.rotation.y = def.yaw ?? 0;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const ctx = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    for (const dx of [-1.7, 1.7]) box(g, dx, 1.1, 0, .14, 2.2, .14, 'steel');
    box(g, 0, 2.2, 0, 3.6, 2, .12, 'dark');
    box(g, 0, 2.2, -.07, 3.4, 1.7, .02, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .8 }));
    let sig = '';
    const draw = () => {
      const sw = G.mission?.switching; if (!sw) return;
      const ids = Object.keys(sw.breakers), closed = id => G.props[sw.breakers[id].panel]?.style === 'on';
      const next = ids.map(id => closed(id) ? 1 : 0).join('');
      if (next === sig) return; sig = next;
      ctx.fillStyle = '#0d1b21'; ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#e9efe4'; ctx.font = 'bold 22px sans-serif'; ctx.fillText(def.title ?? 'STATION MIMIC', 18, 32);
      ids.forEach((id, i) => {
        const bx = 30 + i * 120, on = closed(id);
        ctx.strokeStyle = '#7f98a3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + 30, 60); ctx.lineTo(bx + 30, 200); ctx.stroke();
        ctx.fillStyle = on ? '#e0503a' : '#3fb06a'; ctx.fillRect(bx + 10, 105, 40, 40);
        ctx.fillStyle = '#0d1b21'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(id, bx + 22, 133);
        ctx.fillStyle = on ? '#ff9a7a' : '#9fd6ae'; ctx.font = '15px sans-serif'; ctx.fillText(on ? 'CLOSED' : 'OPEN', bx + 4, 172);
        ctx.fillStyle = '#b8cac7'; ctx.fillText('→ ' + sw.breakers[id].feeds, bx + 4, 222);
      });
      const live = Object.entries(sw.goal).every(([id, want]) => closed(id) === want);
      ctx.fillStyle = live ? '#f3ba65' : '#7f98a3'; ctx.font = 'bold 18px sans-serif'; ctx.fillText((def.feeder ?? 'FEEDER') + (live ? ' · LIVE' : ' · DEAD'), 300, 32);
      tex.needsUpdate = true;
    };
    return { root, pos: new THREE.Vector3(x, 1.4, z), setStyle() {}, update() { draw(); } };
  },

  // Wind turbine: 30 m tower, nacelle and three 13 m blades. Style 'braked' (still, red) or
  // 'running' (spinning, green). Interact at the base cabinet.
  turbine(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const H = 30, yaw = def.yaw ?? 0;
    cyl(root, x, H / 2, z, 1.1, 1.7, H, 'white', 16);
    box(root, x, .5, z, 4.5, 1, 4.5, 'concrete');
    const top = new THREE.Group(); top.position.set(x, H, z); top.rotation.y = yaw; root.add(top);
    box(top, 0, .5, .8, 2.2, 2, 5, 'white');
    const hub = new THREE.Group(); hub.position.set(0, .5, -1.9); top.add(hub);
    cyl(hub, 0, 0, 0, .7, .9, 1.2, 'white', 12).rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.rotation.z = i * Math.PI * 2 / 3; hub.add(b); box(b, 0, 7, -.2, .9, 13, .25, 'white'); }
    const lampOff = emissive(0xe0503a, 1.6), lampOn = emissive(0x5ce08a, 1.8);
    const beacon = box(top, 0, 1.6, .8, .3, .2, .3, lampOff);
    box(root, x + 1.6, 1.1, z + 1.6, .8, 1.6, .6, 'edge');
    const cab = box(root, x + 1.6, 1.6, z + 1.92, .3, .25, .04, lampOff);
    box(root, x, 1.4, z + 1.62, 1.1, 2.2, .1, 'dark');                                   // door
    const mover = addMover({ circles: [{ x, z, r: 1.7 }], box: new THREE.Box3(new THREE.Vector3(x - 1.3, 0, z - 1.3), new THREE.Vector3(x + 1.3, H, z + 1.3)) });
    let spin = 0, last = 0;
    const prop = {
      root, mover, pos: new THREE.Vector3(x + 1.6, 1.2, z + 2.6),
      setStyle(s) { const on = s === 'running'; beacon.material = on ? lampOn : lampOff; cab.material = on ? lampOn : lampOff; },
      update(t) { const dt = Math.min(.1, Math.max(0, t - last)); last = t; spin += dt * (prop.style === 'running' ? 1.6 : .04); hub.rotation.z = spin; },
    };
    return prop;
  },

  // Railway points lever (switch stand). Style 'normal' or 'reverse' (lever thrown).
  lever(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    box(root, x, .45, z, .5, .9, .5, 'dark'); box(root, x, .95, z, .7, .12, .7, 'edge');
    const arm = new THREE.Group(); arm.position.set(x, 1, z); root.add(arm);
    rod(arm, [0, 0, 0], [0, 1.1, 0], .05, 'steel', 6); box(arm, 0, 1.15, 0, .16, .16, .16, 'red');
    const lamp = box(root, x + .3, .8, z, .12, .12, .12, emissive(0xffb24a, 1.6));
    const states = { normal: emissive(0xffb24a, 1.6), reverse: emissive(0x5ce08a, 1.8) };
    return {
      root, pos: new THREE.Vector3(x, 1, z),
      setStyle(s) { arm.rotation.z = s === 'reverse' ? -.7 : .7; lamp.material = states[s] ?? states.normal; },
      update() {},
    };
  },

  // Invisible point used as an objective target (reach / hold objectives).
  marker(parent, def) {
    const root = new THREE.Group(); parent.add(root);
    return { root, pos: new THREE.Vector3(def.at[0], 1, def.at[1]), setStyle() {}, update() {} };
  },

  // Diesel generator set. Styles: 'running' (green lamp, exhaust shimmer), 'tripped', 'wrecked'.
  generator(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g); g.position.set(x, 0, z); g.rotation.y = def.yaw ?? 0;
    const paint = new THREE.MeshStandardMaterial({ color: 0x3f6b5c, roughness: .6, metalness: .35 });
    const burnt = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: .95 });
    const lamps = { running: emissive(0x5ce08a, 1.6), tripped: emissive(0xf3b13a, 1.6), wrecked: emissive(0x401010, .2) };
    box(g, 0, .2, 0, 7.6, .4, 3, 'concrete');
    const body = box(g, 0, 1.6, 0, 7, 2.4, 2.6, paint);
    box(g, 0, 2.86, 0, 7.1, .12, 2.7, 'edge');
    for (let i = -3; i <= 3; i++) box(g, i * .9, 1.6, 1.31, .5, 1.9, .04, 'dark');               // louvres
    box(g, 3.2, 1.6, 0, .6, 2, 2.2, 'steel');                                                    // radiator end
    for (const sx of [-2.2, -1.4]) cyl(g, sx, 3.6, -.6, .14, .14, 1.5, 'dark', 8);                 // exhaust stacks
    const lamp = box(g, -3.2, 2.5, 1.33, .2, .2, .05, lamps.running);
    box(g, -2.4, 2.2, 1.33, 1, .5, .04, 'white');
    const fx = Math.cos(def.yaw ?? 0), fz = -Math.sin(def.yaw ?? 0);
    const circles = [-2.6, -.9, .9, 2.6].map(o => ({ x: x + fx * o, z: z + fz * o, r: 1.35 }));
    const ex = Math.abs(fx) * 3.6 + Math.abs(fz) * 1.4, ez = Math.abs(fz) * 3.6 + Math.abs(fx) * 1.4;
    const mover = addMover({ circles, box: new THREE.Box3(new THREE.Vector3(x - ex, 0, z - ez), new THREE.Vector3(x + ex, 2.9, z + ez)) });
    return {
      root, mover, pos: new THREE.Vector3(x, 1.6, z),
      setStyle(s) { lamp.material = lamps[s] ?? lamps.running; body.material = s === 'wrecked' ? burnt : paint; },
      update(t, i) { if (this.style === 'running') lamp.material.emissiveIntensity = 1.2 + Math.sin(t * 2 + i) * .4; },
    };
  },
};

const DEFAULT_STYLE = { terminal: 'amber', extraction: 'idle', survivor: 'present', panel: 'off', floodlight: 'off', truck: 'present', barricade: 'present', generator: 'running', door: 'closed', train: 'present', drive: 'present', payphone: 'idle', marker: 'idle', cable: 'live', mimic: 'idle', lever: 'normal', turbine: 'braked' };

export function spawnProps(defs) {
  G.props = {};
  for (const def of defs) {
    const p = Object.assign(PROP_TYPES[def.type](G.dynRoot, def), { id: def.id, type: def.type, label: def.label });
    const setStyle = p.setStyle;
    p.setStyle = s => { p.style = s; setStyle(s); };
    p.setStyle(def.style ?? DEFAULT_STYLE[def.type]);
    G.props[def.id] = p;
    // Props with health (generators...) take damage from machine fire and can be repaired.
    if (def.hp) {
      p.maxHp = p.hp = def.hp * (1 + .3 * (G.players.length - 1));
      p.repairable = def.repairable ?? true;
      p.mover.onHit = (dmg, hostile) => { if (hostile) damageProp(p, dmg); };
    }
  }
}

export function updateProps(activeIds) {
  Object.values(G.props).forEach((p, i) => p.update(G.elapsed, i, activeIds.includes(p.id)));
}

/** Is this position inside the pool of any switched-on floodlight? */
export function litAt(pos) {
  if (districtLit(pos)) return true;
  for (const p of Object.values(G.props)) {
    if (p.lit && Math.hypot(pos.x - p.lightCenter.x, pos.z - p.lightCenter.z) < p.lightRadius) return true;
  }
  return false;
}

export function spawnPickups(defs) {
  G.pickups = defs.map(([x, z, type]) => {
    const g = new THREE.Group(); G.dynRoot.add(g);
    box(g, x, .5, z, 1, .85, .75, type === 'med' ? 'white' : 'crate');
    if (type === 'med') { box(g, x, .53, z + .39, .55, .16, .04, 'green'); box(g, x, .53, z + .41, .16, .55, .04, 'green'); }
    else for (const dx of [-.3, .3]) box(g, x + dx, .5, z + .39, .07, .7, .03, 'amber');
    return { g, pos: new THREE.Vector3(x, .8, z), type, used: false };
  });
}

export function damageProp(p, dmg) {
  if (!p.hp || p.style === 'wrecked' || G.status !== 'playing') return;
  p.hp = Math.max(0, p.hp - dmg);
  if (p.hp > 0) return;
  p.setStyle('wrecked');
  burst(p.pos.clone().setY(2.4), 0x55504a, 30, 5);
  const def = G.mission.props.find(d => d.id === p.id);
  runEvents(def.onDestroyed ?? [{ do: 'feed', text: (def.label ?? p.id) + ' destroyed' }]);
}

export function repairProp(p, fraction = .25) {
  if (!p.hp || p.style === 'wrecked') return;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * fraction);
}
