// Interactive mission props and pickups, created from mission data.
// Every prop has a `style` (its visual state) that events change and checkpoints restore.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, geo, mesh, glowMats, sign } from '../engine/builders.js';
import { G } from './state.js';
import { addMover, block, addSolid } from './world.js';
import { sound } from '../engine/audio.js';
import { showHit } from '../ui/hud.js';
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
      setStyle(s) { screen.material = styles[s] ?? styles.amber; },
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
      // A door never closes on someone standing in it: it waits until the doorway is clear.
      // def.lastExit: { room: [x0, z0, x1, z1], others: [door ids] }. When every other door out of
      // that room is closed, this one stays (or comes back) open while a player is still inside,
      // so nobody gets sealed in, not even by a checkpoint restore.
      setStyle(s) { if (s === 'open') apply(true); else if (!blocked() && !trapped()) apply(false); },
      update() {
        if (this.style === 'open') return;
        if (trapped()) { if (g.visible) apply(true); }
        else if (!g.visible && !blocked()) apply(false);
      },
    };
    function trapped() {
      const L = def.lastExit; if (!L) return false;
      const [x0, z0, x1, z1] = L.room;
      return (L.others ?? []).every(id => G.props?.[id]?.style !== 'open')
        && G.players.some(p => p.alive && p.pos.x >= x0 && p.pos.x <= x1 && p.pos.z >= z0 && p.pos.z <= z1);
    }
    function apply(open) { g.visible = !open; mover.enabled = !open; lamp.material = open ? openMat : shutMat; }
    function blocked() {
      const near = q => Math.hypot(q.pos.x - x, q.pos.z - z) < w / 2 + 1;
      return G.players.some(p => p.alive && near(p)) || G.enemies.some(e => !e.dead && near(e));
    }
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

  // Relay mast: lattice tower with a dish and a base cabinet. Styles 'idle', 'online'
  // (green beacon, dish turning), 'offline' (red, sparking).
  relay(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const H = 14;
    for (const dx of [-.7, .7]) for (const dz of [-.7, .7]) rod(root, [x + dx, 0, z + dz], [x + dx * .25, H, z + dz * .25], .07, 'steel', 5);
    for (let y = 2; y < H; y += 2.4) { const s = .7 - y / H * .52; rod(root, [x - s, y, z - s], [x + s, y, z + s], .035, 'steel', 4); rod(root, [x + s, y, z - s], [x - s, y, z + s], .035, 'steel', 4); }
    box(root, x, .3, z, 3.2, .6, 3.2, 'concrete');
    const head = new THREE.Group(); head.position.set(x, H - 1.2, z); root.add(head);
    const dish = cyl(head, 0, 0, -.6, 1.1, .3, .4, 'white', 16); dish.rotation.x = Math.PI / 2;
    rod(head, [0, 0, -.6], [0, 0, -1.4], .04, 'steel', 5);
    const lamps = { idle: emissive(0xf3b13a, 1.2), online: emissive(0x5ce08a, 2.2), offline: emissive(0xe0503a, 2) };
    const beacon = box(root, x, H + .25, z, .35, .35, .35, lamps.idle);
    box(root, x + 1.4, 1.2, z + 1.8, 1.4, 1.8, .7, 'edge');
    const screen = box(root, x + 1.4, 1.5, z + 2.16, .9, .5, .04, lamps.idle);
    const mover = addMover({ circles: [{ x, z, r: 1.4 }], box: new THREE.Box3(new THREE.Vector3(x - 1.1, 0, z - 1.1), new THREE.Vector3(x + 1.1, H, z + 1.1)) });
    let last = 0;
    const prop = {
      root, mover, pos: new THREE.Vector3(x + 1.4, 1.3, z + 2.4),
      setStyle(s) { beacon.material = lamps[s] ?? lamps.idle; screen.material = lamps[s] ?? lamps.idle; },
      update(t) {
        const dt = Math.min(.1, Math.max(0, t - last)); last = t;
        if (prop.style === 'online') head.rotation.y += dt * .6;
        if (prop.style === 'offline' && Math.random() < .08) burst(new THREE.Vector3(x, H - 1, z), 0xffd27a, 3, 2);
      },
    };
    return prop;
  },

  // Light column: a landmark visible across the map. Style 'on' or 'off'.
  beacon(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const color = def.color ?? 0x7fd0ff;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, .9, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.set(x, 30, z); root.add(beam);
    const flare = box(root, x, .25, z, .5, .5, .5, emissive(color, 3));
    return {
      root, pos: new THREE.Vector3(x, 1, z),
      setStyle(s) { root.visible = s !== 'off'; },
      update(t) { beam.material.opacity = .16 + Math.sin(t * 3) * .06; flare.material.emissiveIntensity = 2 + Math.sin(t * 6) * 1; },
    };
  },

  // Battery wagon. Style 'parked' or 'coupled'; once coupled it is shunted along to def.to and
  // joins the train (sliding at 3 m/s; restored checkpoints snap straight there).
  battery(parent, def) {
    const root = new THREE.Group(); parent.add(root);
    const g = new THREE.Group(); root.add(g);
    const paint = new THREE.MeshStandardMaterial({ color: 0x2f5a7a, roughness: .6 });
    box(g, 0, .9, 0, 11, .3, 2.6, 'edge');
    for (const x of [-3.3, 0, 3.3]) { box(g, x, 1.9, 0, 2.9, 1.7, 2.3, paint); box(g, x, 2.85, 0, 2.95, .1, 2.35, 'white'); }
    const leds = [];
    for (const x of [-3.3, 0, 3.3]) { const l = box(g, x, 2.2, 1.17, .5, .12, .03, emissive(0x5fb4ff, 1.4)); leds.push(l); }
    for (const dx of [-4, 4]) for (const s of [-1, 1]) { const w = cyl(g, dx, .42, s * .72, .4, .4, .2, 'dark', 10); w.rotation.x = Math.PI / 2; }
    box(g, 5.3, 1.2, 1.2, .5, .9, .5, 'amber');                                           // coupler cabinet
    const at = new THREE.Vector3(def.at[0], 0, def.at[1]), to = new THREE.Vector3(...(def.to ? [def.to[0], 0, def.to[1]] : [def.at[0], 0, def.at[1]]));
    const circles = [-4.5, -1.5, 1.5, 4.5].map(() => ({ x: 0, z: 0, r: 1.35 })), box3 = new THREE.Box3();
    const mover = addMover({ circles, box: box3 });
    const place = p => {
      g.position.copy(p); prop.pos.set(p.x, 1.2, p.z + 2.2);
      [-4.5, -1.5, 1.5, 4.5].forEach((o, i) => { circles[i].x = p.x + o; circles[i].z = p.z; });
      box3.min.set(p.x - 5.5, 0, p.z - 1.3); box3.max.set(p.x + 5.5, 3, p.z + 1.3);
    };
    let last = 0;
    const prop = {
      root, mover, pos: new THREE.Vector3(),
      setStyle(s) { if (s === 'coupled' && G.status !== 'playing') place(to); for (const l of leds) l.material.emissive.setHex(s === 'coupled' ? 0x5ce08a : 0x5fb4ff); },
      update(t) {
        const dt = Math.min(.6, Math.max(0, t - last)); last = t;      // generous cap: keeps pace at low frame rates
        if (prop.style !== 'coupled' || g.position.distanceTo(to) < .02) return;
        const step = to.clone().sub(g.position), d = step.length();
        place(g.position.clone().addScaledVector(step.normalize(), Math.min(d, 3 * dt)));
      },
    };
    place(at);
    return prop;
  },

  // Security camera on a wall bracket, sweeping +-sweep radians around def.yaw. Style 'on'/'off'.
  camera(parent, def) {
    const [x, z] = def.at, h = def.height ?? 3.3, root = new THREE.Group(); parent.add(root);
    rod(root, [x, h + .4, z], [x, h, z], .05, 'dark', 6);
    const head = new THREE.Group(); head.position.set(x, h, z); root.add(head);
    box(head, 0, 0, -.15, .26, .22, .5, 'white'); box(head, 0, 0, -.42, .2, .16, .06, 'dark');
    const led = box(head, .08, .08, -.36, .05, .05, .02, emissive(0xff2a2a, 2.4));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(13 * Math.tan(.5), 13, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: .05, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    cone.geometry.rotateX(Math.PI / 2); cone.geometry.translate(0, 0, -6.5); cone.rotation.x = -.18; head.add(cone);
    const prop = {
      root, pos: new THREE.Vector3(x, 1, z), eye: new THREE.Vector3(x, h, z), yaw: def.yaw ?? 0,
      setStyle(s) { const on = s === 'on'; cone.visible = on; led.material.emissiveIntensity = on ? 2.4 : 0; },
      update(t) {
        if (prop.style === 'on') prop.yaw = (def.yaw ?? 0) + Math.sin(t * (def.speed ?? .5) + (def.phase ?? 0)) * (def.sweep ?? .8);
        head.rotation.y = prop.yaw;
        if (G.stealth?.seenBy && prop.style === 'on') cone.material.opacity = .08 + Math.sin(t * 12) * .03; else cone.material.opacity = .05;
      },
    };
    return prop;
  },

  // Gas turbine unit (peaker plant): enclosure along z with the inlet filter house at the south end
  // and the exhaust stack at the north. Styles: 'cold', 'running', 'tripped'. pos = side control cab.
  gasTurbine(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const paint = new THREE.MeshStandardMaterial({ color: 0x8c9290, roughness: .7, metalness: .2 });
    box(root, x, .2, z, 7, .4, 20, 'concrete');
    box(root, x, 2.6, z - 1, 5, 4.4, 12, paint);                                 // enclosure
    for (let k = -6; k <= 4; k += 2) box(root, x + 2.52, 2.6, z + k, .04, 4, .08, 'edge');
    box(root, x, 5.2, z + 7, 6, 3.2, 3.6, paint); box(root, x, 3.4, z + 7, 3, 1.2, 3, 'dark');   // inlet filter house
    for (let k = -2.6; k <= 2.6; k += .65) box(root, x + k, 5.2, z + 8.82, .3, 2.8, .04, 'edge');
    const stack = cyl(root, x, 7.5, z - 8.5, 1.5, 1.7, 15, paint, 14);
    const lip = new THREE.MeshStandardMaterial({ color: 0x3a3634, emissive: 0xff7a2a, emissiveIntensity: 0 });
    cyl(root, x, 15.1, z - 8.5, 1.55, 1.55, .3, lip, 14);
    const fan = new THREE.Group(); fan.position.set(x, 3.4, z + 5.45); root.add(fan);
    for (let i = 0; i < 6; i++) { const b = box(fan, 0, .45, 0, .16, .9, .04, 'steel'); b.parent.remove(b); const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 3; arm.add(b); fan.add(arm); }
    const lamps = { cold: emissive(0x303a40, .1), running: emissive(0x5ce08a, 1.6), tripped: emissive(0xf3b13a, 1.6) };
    box(root, x + 3.2, 1.1, z - 3, .9, 2.2, 1.6, 'edge');                         // control cab
    const lamp = box(root, x + 3.66, 1.9, z - 3, .04, .2, .2, lamps.cold);
    const circles = [-6.5, -3.5, -.5, 2.5, 5.5].map(o => ({ x, z: z + o, r: 2.6 })).concat([{ x, z: z - 8.5, r: 1.8 }]);
    const mover = addMover({ circles, box: new THREE.Box3(new THREE.Vector3(x - 2.6, 0, z - 10.3), new THREE.Vector3(x + 2.6, 6.8, z + 8.9)) });
    let spin = 0, last = 0;
    const prop = {
      root, mover, pos: new THREE.Vector3(x + 3.9, 1.4, z - 3),
      setStyle(s) { lamp.material = lamps[s] ?? lamps.cold; },
      update(t) {
        const dt = Math.min(.5, Math.max(0, t - last)); last = t;
        spin = prop.style === 'running' ? Math.min(1, spin + dt * .08) : Math.max(0, spin - dt * .15);
        fan.rotation.z += spin * 30 * dt; lip.emissiveIntensity = spin * 2.2;
        if (prop.style === 'running') lamp.material.emissiveIntensity = 1.2 + Math.sin(t * 3) * .4;
      },
    };
    return prop;
  },

  // Steam vent: a floor grate that blasts scalding steam on a cycle (shared clock, so co-op
  // clients agree). Style 'active' or 'closed'. Damage is applied by heat.js on the host.
  vent(parent, def) {
    const [x, z] = def.at, r = def.r ?? 2.6, root = new THREE.Group(); parent.add(root);
    const glow = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, emissive: 0xff6a20, emissiveIntensity: .3 });
    box(root, x, .03, z, r * 1.5, .06, r * 1.5, glow).castShadow = false;
    for (let k = -r * .6; k <= r * .6; k += .35) box(root, x + k, .08, z, .08, .05, r * 1.5, 'dark').castShadow = false;
    const puffs = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(geo('sphere', 1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe9eef0, transparent: true, opacity: 0, depthWrite: false, roughness: 1 }));
      m.userData.o = [(Math.random() - .5) * r, Math.random(), (Math.random() - .5) * r, .7 + Math.random() * .6]; root.add(m); puffs.push(m);
    }
    let lastPhase = 'idle';
    const prop = {
      root, pos: new THREE.Vector3(x, 1, z), r, def,
      setStyle() {},
      phase: () => prop.style === 'closed' ? 'idle' : ventPhase(def, G.elapsed),
      update(t) {
        const ph = prop.phase();
        if (ph === 'blast' && lastPhase !== 'blast' && G.local && Math.hypot(G.local.pos.x - x, G.local.pos.z - z) < 30) sound('steam', Math.max(.15, 1 - Math.hypot(G.local.pos.x - x, G.local.pos.z - z) / 30));
        lastPhase = ph;
        const k = ph === 'blast' ? 1 : ph === 'warn' ? .18 : 0;
        glow.emissiveIntensity = prop.style === 'closed' ? .05 : ph === 'warn' ? 1.4 + Math.sin(t * 30) * .6 : ph === 'blast' ? 2 : .3;
        for (const m of puffs) {
          const [ox, oy, oz, s] = m.userData.o, rise = (t * 1.6 + oy * 4) % 4;
          m.position.set(x + ox * (1 + rise * .15), .4 + rise * (k > .5 ? 1 : .35), z + oz * (1 + rise * .15));
          m.scale.setScalar(s * (.5 + rise * .35) * (k > .5 ? 1 : .6));
          m.material.opacity = k * .5 * (1 - rise / 4.2);
        }
      },
    };
    return prop;
  },

  // Bypass valve: a big handwheel on a pipe stub. Style 'closed' or 'open' (the wheel turns).
  valve(parent, def) {
    const [x, z] = def.at, f = def.facing ?? 1, root = new THREE.Group(); parent.add(root);
    const paint = new THREE.MeshStandardMaterial({ color: 0xb8402c, roughness: .6, metalness: .3 });
    cyl(root, x, 1.2, z, .3, .3, 2.4, 'steel', 10);
    const stub = cyl(root, x, 1.25, z + f * .45, .18, .18, .9, 'steel', 10); stub.rotation.x = Math.PI / 2;
    const wheel = new THREE.Group(); wheel.position.set(x, 1.25, z + f * .95); root.add(wheel);
    const rim = mesh(wheel, geo('torus', .42, .05, 6, 18), paint, 0, 0, 0);
    for (let i = 0; i < 3; i++) { const sp = box(wheel, 0, 0, 0, .84, .05, .05, paint); sp.rotation.z = i * Math.PI / 3; }
    const lamps = { closed: emissive(0xe0503a, 1.4), open: emissive(0x5ce08a, 1.4) };
    const lamp = box(root, x, 2.55, z + f * .3, .16, .16, .16, lamps.closed);
    block(x, z, .7, .7); addSolid(x - .35, 0, z - .35, x + .35, 2.4, z + .35);
    let turn = 0;
    return {
      root, pos: new THREE.Vector3(x, 1.2, z + f * 1.2),
      setStyle(s) { lamp.material = lamps[s] ?? lamps.closed; },
      update(t) { const target = this.style === 'open' ? Math.PI * 4 : 0; turn += (target - turn) * .06; wheel.rotation.z = turn; void rim; },
    };
  },

  // LODESTAR mirror node: a glass column of rising data with spinning rings. Shot by players
  // (def.shootable): bullets and blasts wear down its hp. Styles 'copying' and 'wrecked'.
  mirrorNode(parent, def) {
    const [x, z] = def.at, root = new THREE.Group(); parent.add(root);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x2fa8d8, emissiveIntensity: .9, transparent: true, opacity: .55, roughness: .1 });
    const dead = new THREE.MeshStandardMaterial({ color: 0x2a2e30, roughness: .9 });
    box(root, x, .3, z, 3.4, .6, 3.4, 'edge'); box(root, x, 5.6, z, 3, .4, 3, 'edge');
    const col = cyl(root, x, 3, z, 1.05, 1.05, 4.8, glass, 18);
    const data = [];
    for (let i = 0; i < 6; i++) data.push(cyl(root, x, 1 + i * .8, z, .8, .8, .08, emissive(0xbff4ff, 2.2), 16));
    const rings = [];
    for (let i = 0; i < 3; i++) { const r = mesh(root, geo('torus', 1.6 + i * .15, .05, 6, 28), emissive(0x7fdcff, 1.6), x, 1.6 + i * 1.6, z); r.rotation.x = Math.PI / 2; rings.push(r); }
    const circles = [{ x, z, r: 1.7 }];
    const mover = addMover({ circles, box: new THREE.Box3(new THREE.Vector3(x - 1.5, 0, z - 1.5), new THREE.Vector3(x + 1.5, 5.8, z + 1.5)) });
    const light = new THREE.PointLight(0x7fdcff, 10, 16, 1.6); light.position.set(x, 3, z); root.add(light);
    const prop = {
      root, mover, pos: new THREE.Vector3(x, 2.6, z),
      setStyle(s) {
        const w = s === 'wrecked'; col.material = w ? dead : glass; light.intensity = w ? 0 : 10;
        for (const d of data) d.visible = !w; for (const r of rings) r.visible = !w;
      },
      update(t) {
        if (prop.style === 'wrecked') return;
        const hurt = prop.maxHp ? 1 - prop.hp / prop.maxHp : 0;
        data.forEach((d, i) => { d.position.y = .6 + ((t * 1.4 + i * .8) % 4.8); });
        rings.forEach((r, i) => { r.rotation.z = t * (1 + i * .6) * (i % 2 ? -1 : 1); r.rotation.y = Math.sin(t + i) * .2; });
        glass.emissiveIntensity = .9 + (hurt > .5 && Math.sin(t * 20) > 0 ? .8 : 0);
      },
    };
    return prop;
  },

  // Grid control point: a console pylon inside a floor ring. Players stand in it to capture it;
  // machines standing in it with no player present take it back (sync.js). Styles 'neutral',
  // 'held', 'lost'. prop.cap runs -1 (lost) .. 1 (held); the ring arc shows it.
  controlPoint(parent, def) {
    const [x, z] = def.at, r = def.r ?? 4.5, root = new THREE.Group(); parent.add(root);
    const cols = { neutral: 0xb8c0c4, held: 0x5ce08a, lost: 0xff5a3a };
    const ringMat = new THREE.MeshBasicMaterial({ color: cols.neutral, transparent: true, opacity: .55, side: THREE.DoubleSide, fog: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - .18, r, 48), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(x, .05, z); root.add(ring);
    const arcMat = new THREE.MeshBasicMaterial({ color: cols.held, transparent: true, opacity: .8, side: THREE.DoubleSide, fog: false });
    const arc = new THREE.Mesh(new THREE.RingGeometry(r - .5, r - .25, 48, 1, 0, Math.PI * 2), arcMat); arc.rotation.x = -Math.PI / 2; arc.position.set(x, .06, z); root.add(arc);
    box(root, x, .9, z, .9, 1.8, .9, 'edge'); box(root, x, 1.6, z + .46, .7, .5, .03, 'dark');
    const lampMat = new THREE.MeshStandardMaterial({ color: cols.neutral, emissive: cols.neutral, emissiveIntensity: 1.4 });
    box(root, x, 2.05, z, .5, .3, .5, lampMat);
    const tag = sign(root, x, 2.7, z, def.label ?? def.id, .9, .5); void tag;
    block(x, z, .9, .9); addSolid(x - .45, 0, z - .45, x + .45, 1.8, z + .45);
    const prop = {
      root, pos: new THREE.Vector3(x, 1, z), r, cap: 0, occupy: true, faction: def.faction ?? null,
      setStyle(s) {
        if (s === 'held' && prop.cap < 1) prop.cap = 1; if (s === 'lost' && prop.cap > -1) prop.cap = -1;
        const c = cols[s] ?? cols.neutral; ringMat.color.setHex(c); lampMat.color.setHex(c); lampMat.emissive.setHex(c);
      },
      update(t) {
        const k = prop.cap;
        arc.visible = Math.abs(k) > .01; arcMat.color.setHex(k > 0 ? cols.held : cols.lost);
        arc.geometry.dispose(); arc.geometry = new THREE.RingGeometry(r - .5, r - .25, 32, 1, Math.PI / 2, Math.PI * 2 * Math.min(1, Math.abs(k)) * (k > 0 ? -1 : 1));
        if (prop.contested) ringMat.opacity = .35 + Math.abs(Math.sin(t * 8)) * .5; else ringMat.opacity = .55;
      },
    };
    return prop;
  },

  // A superheated passage: hot haze and glowing floor whose strength is the fraction of
  // def.valves still closed. heat.js scalds players inside it on the host.
  heatZone(parent, def) {
    const [x0, z0, x1, z1] = def.rect, root = new THREE.Group(); parent.add(root);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    const halon = def.kind === 'halon';
    const floor = new THREE.MeshStandardMaterial({ color: halon ? 0x1a2a3a : 0x3a1a10, emissive: halon ? 0x9fd0ff : 0xff5a1a, emissiveIntensity: 1 });
    for (let z = z0 + 1.5; z < z1; z += 3) box(root, cx, .03, z, w * .7, .05, .5, floor).castShadow = false;
    const light = new THREE.PointLight(halon ? 0xff3a3a : 0xff6a2a, 0, Math.max(w, d) * .9, 1.4); light.position.set(cx, 3, cz); root.add(light);
    const prop = {
      root, pos: new THREE.Vector3(cx, 1, cz), rect: def.rect,
      setStyle() {},
      // With valves: the fraction still closed. Without (halon purge): on or off by style.
      heat: () => def.valves ? def.valves.filter(id => G.props[id]?.style !== 'open').length / def.valves.length : prop.style === 'on' ? 1 : 0,
      update(t) {
        const k = prop.heat();
        // Inside the heat the screen tints and shimmers (local player only).
        const me = G.local, inside = me && me.pos.x >= x0 && me.pos.x <= x1 && me.pos.z >= z0 && me.pos.z <= z1;
        const tint = document.getElementById('heatTint');
        if (tint && (inside || tint.dataset.zone === def.id)) { tint.dataset.zone = inside && k ? def.id : ''; tint.classList.toggle('halon', halon); tint.style.opacity = inside ? (k * (.45 + Math.sin(t * 7) * .08)).toFixed(3) : 0; }
        floor.emissiveIntensity = .15 + k * (halon ? .35 : 1.6); light.intensity = k * 14;
      },
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
    const lamps = { running: emissive(0x5ce08a, 1.6), tripped: emissive(0xf3b13a, 1.6), wrecked: emissive(0x401010, .2), cold: emissive(0x303a40, .1) };
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

const DEFAULT_STYLE = { terminal: 'amber', extraction: 'idle', survivor: 'present', panel: 'off', floodlight: 'off', truck: 'present', barricade: 'present', generator: 'running', door: 'closed', train: 'present', drive: 'present', payphone: 'idle', marker: 'idle', cable: 'live', mimic: 'idle', lever: 'normal', turbine: 'braked', relay: 'idle', beacon: 'on', battery: 'parked', camera: 'on', gasTurbine: 'cold', vent: 'active', valve: 'closed', heatZone: 'on', mirrorNode: 'copying', controlPoint: 'neutral' };

export function spawnProps(defs) {
  G.props = {};
  for (const def of defs) {
    const p = Object.assign(PROP_TYPES[def.type](G.dynRoot, def), { id: def.id, type: def.type, label: def.label, use: def.use ?? null, used: false });
    const setStyle = p.setStyle;
    p.setStyle = s => { p.style = s; setStyle(s); };
    p.setStyle(def.style ?? DEFAULT_STYLE[def.type]);
    G.props[def.id] = p;
    // Props with health (generators...) take damage from machine fire and can be repaired.
    if (def.hp) {
      p.maxHp = p.hp = def.hp * (1 + .3 * (G.players.length - 1));
      p.repairable = def.repairable ?? true;
      p.downStyle = def.downStyle ?? null; p.upStyle = def.upStyle ?? null;   // knocked out (rebootable) instead of destroyed
      p.shootable = !!def.shootable;   // LODESTAR's own hardware: players shoot it, machines don't
      p.mover.onHit = (dmg, hostile) => { if (!!hostile !== p.shootable) { damageProp(p, dmg); if (p.shootable && !hostile && G.players.length === 1) showHit(p.style === 'wrecked'); } };
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

/** Vent cycle: 'blast' for def.on seconds, a 'warn' hiss before it, 'idle' otherwise. */
export function ventPhase(def, t) {
  const period = def.period ?? 6, on = def.on ?? 2.6, u = ((t + (def.phase ?? 0)) % period + period) % period;
  return u < on ? 'blast' : u > period - (def.warn ?? 1.2) ? 'warn' : 'idle';
}

/** A prop is "down" when destroyed ('wrecked') or knocked out (its def.downStyle, e.g. 'offline'). */
export const isDown = p => p.style === 'wrecked' || (p.downStyle && p.style === p.downStyle);

export function damageProp(p, dmg) {
  if (!p.hp || isDown(p) || G.status !== 'playing') return;
  p.hp = Math.max(0, p.hp - dmg);
  if (p.hp > 0) return;
  p.setStyle(p.downStyle ?? 'wrecked');
  burst(p.pos.clone().setY(2.4), 0x55504a, 30, 5);
  const def = G.mission.props.find(d => d.id === p.id);
  runEvents(def.onDestroyed ?? [{ do: 'feed', text: (def.label ?? p.id) + (p.downStyle ? ' knocked ' + p.downStyle : ' destroyed') }]);
}

/** Bring a knocked-out prop back (to half health). */
export function rebootProp(p) {
  if (!p.downStyle || p.style !== p.downStyle) return;
  p.hp = p.maxHp * .5; p.setStyle(p.upStyle ?? 'online');
}

export function repairProp(p, fraction = .25) {
  if (!p.hp || p.style === 'wrecked') return;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * fraction);
}
