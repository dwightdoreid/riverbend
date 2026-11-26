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

const DEFAULT_STYLE = { terminal: 'amber', extraction: 'idle', survivor: 'present', panel: 'off', floodlight: 'off', truck: 'present', barricade: 'present', generator: 'running', door: 'closed', drive: 'present', payphone: 'idle', marker: 'idle', cable: 'live' };

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
