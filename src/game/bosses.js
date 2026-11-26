// Boss machines and their special attacks. Registered into ENEMY_TYPES so missions spawn them
// like any other enemy ({ type: 'warden', tag: 'warden', ... }).
//
// Spillway Warden: a heavily armoured dam-maintenance walker.
//  - Armour soaks most damage. Every few seconds its vents open and the glowing core on its
//    front is exposed: then bullets do full damage and core hits double.
//  - Cannon bursts at the nearest visible player; mortar shells lobbed at players, with a
//    warning ring on the ground before impact.
//  - At 60% and 30% health it calls in reinforcements and fights faster.
import { THREE } from '../engine/three.js';
import { box, cyl, rod, geo, mesh } from '../engine/builders.js';
import { G } from './state.js';
import { los } from './world.js';
import { eyeOf, isActive } from './players.js';
import { ENEMY_TYPES, addEnemy, botMove, shootAt, shellHooks } from './bots.js';
import { hurt, explosionFx, alertNoise, damageEnemy, arcBolts } from './combat.js';
import { sfxAt } from './fx.js';
import { feed, radio } from '../ui/hud.js';
import { fxAll, isClient } from '../net/net.js';

const r2 = v => Math.round(v * 100) / 100;

ENEMY_TYPES.warden = {
  name: 'Spillway Warden', boss: true, hp: 2600, color: 0x7b6a4c,
  hover: 0, bob: .03, eyeY: 3.4, muzzle: [1.6, 2.6, -1.4], centerY: 2.3,
  hitParts: [{ y: 2.3, r: 1.75, head: false }, { y: 2.45, r: .55, head: true, z: -1.85 }],
  speed: { patrol: .7, search: .7, close: .7, retreat: .7, strafe: .7 },
  sight: { stand: 60, crouch: 60, crouchStill: 60, fov: -1 },
  range: { far: 99, near: 0 }, strafeSwap: 4,
  gun: { speed: 58, damage: 8, cooldown: [.12, 0], spread: [.012, .2], sound: 'shot' },

  armor(e, head, dir, explosive) {
    if (explosive) return e.exposed ? .8 : .3;
    if (e.exposed) return head ? 2 : 1;
    return head ? .3 : .12;
  },

  build(g, bodyMat) {
    const plate = new THREE.MeshStandardMaterial({ color: 0x6a7278, metalness: .25, roughness: .5 });
    const core = new THREE.MeshStandardMaterial({ color: 0xff9a4a, emissive: 0xff6a1a, emissiveIntensity: .3 });
    box(g, 0, 2.3, 0, 3.1, 2.1, 2.7, bodyMat);                                    // hull
    box(g, 0, 3.55, .2, 2.2, .5, 1.8, plate);                                     // top deck
    for (const s of [-1, 1]) {
      box(g, s * 1.75, 2.3, -.1, .35, 1.9, 2.4, plate);                           // side armour
      box(g, s * 1.15, .75, .5, .55, 1.5, .6, 'dark'); box(g, s * 1.15, .75, -.9, .55, 1.5, .6, 'dark');   // legs
      box(g, s * 1.15, .1, -.2, .9, .2, 2.4, 'edge');                             // feet
      rod(g, [s * 1.6, 2.6, -.2], [s * 1.6, 2.6, -2.1], .17, 'dark', 10);          // arm cannons
    }
    for (const s of [-1, 1]) box(g, s * .85, 2.45, -1.36, .9, 1.4, .1, plate);    // vent doors either side of the core
    mesh(g, geo('sphere', .55, 14, 10), core, 0, 2.45, -1.6);                     // core (weak point)
    cyl(g, 0, 4.3, .9, .3, .38, 1.2, 'dark', 10).rotation.x = -.5;                // mortar tube
    box(g, 0, 3.9, -1.0, .9, .2, .2, new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb24a, emissiveIntensity: 1.2 }));
    g.userData.core = core;
    return [];
  },

  pose(e) {
    const core = e.g.userData.core;
    if (core) core.emissiveIntensity = e.exposed ? 3 + Math.sin(G.elapsed * 18) : .3;
  },

  update(e, dt, from) {
    if (isClient()) return;
    e.ventTimer = (e.ventTimer ?? 6) - dt;
    if (e.ventTimer <= 0) {
      e.exposed = !e.exposed;
      e.ventTimer = e.exposed ? 3.5 : (e.phase === 3 ? 6.5 : 8);
      if (e.exposed) feed('The Warden\'s vents are open. Hit the core!');
    }
    const frac = e.hp / e.maxHp;
    e.phase ??= 1;
    if (e.phase < 2 && frac < .6) {
      e.phase = 2;
      radio('Mara · Ops', 'It\'s calling for help. Skimmers inbound!');
      for (const at of [[-16, 30], [16, 30]]) addEnemy({ type: 'skimmer', at }, e.pos.clone());
    }
    if (e.phase < 3 && frac < .3) {
      e.phase = 3;
      radio('Mara · Ops', 'It\'s overheating. Its vents are cycling faster. Finish it!');
      for (const at of [[-20, 28], [20, 28]]) addEnemy({ type: 'skimmer', at }, e.pos.clone());
      addEnemy({ type: 'bulwark', at: [0, 32] }, e.pos.clone());
    }

    // Target: nearest active player in line of sight.
    let target = null, best = Infinity;
    for (const p of G.players) {
      if (!isActive(p)) continue;
      const d = p.pos.distanceTo(e.pos);
      if (d < best && los(from, eyeOf(p))) { target = p; best = d; }
    }
    e.visible = !!target; e.state = target ? 'engage' : 'search';
    if (target) { e.seenAt = G.elapsed; e.target = target; }

    // Pace between home and patrol points; always turn to face the target.
    if (e.pos.distanceTo(e.dest) < 1) e.dest.copy(e.dest.distanceTo(e.home) < 1 ? e.patrol : e.home);
    botMove(e, e.dest, e.type.speed.patrol, dt);
    const look = target ?? G.players.find(isActive);
    if (look) e.yaw = Math.atan2(-(look.pos.x - e.pos.x), -(look.pos.z - e.pos.z));

    // Cannon bursts.
    e.burstTimer = (e.burstTimer ?? 2) - dt;
    if (e.burstTimer <= 0 && target) { e.burstLeft = e.phase === 3 ? 7 : 5; e.burstTimer = e.phase === 3 ? 2.6 : 3.6; }
    if (e.burstLeft > 0 && target && e.shot <= 0 && G.elapsed > G.protectUntil + .5) {
      const aim = eyeOf(target); aim.y -= .3;
      shootAt(e, aim, best);
      e.shot = .12; e.burstLeft--;
    }

    // Mortar.
    e.mortarTimer = (e.mortarTimer ?? 4) - dt;
    if (e.mortarTimer <= 0) {
      e.mortarTimer = e.phase >= 2 ? 4.5 : 6;
      const victims = G.players.filter(isActive);
      if (victims.length) {
        const v = victims[Math.floor(Math.random() * victims.length)];
        launchShell(e.pos.clone().add(new THREE.Vector3(0, 4.6, 0)), v.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 2, 0, (Math.random() - .5) * 2)));
      }
    }
  },
};

// Ironwalker: a construction walker LODESTAR has taken over.
//  - Its armour shrugs off almost everything. Destroy both glowing knee actuators to bring it
//    down: it kneels and its core is exposed for a few seconds.
//  - Then it repairs its knees (to 60%), stands back up and fights harder (phase 2, 3...).
//  - Rivet-gun bursts, thrown debris (warning rings) and a stomp against anyone too close.
//  - It also shoots at Halvard's Tallymen when they get in its way.
const KNEE = 420;
function kneeDown(e, id) {
  const side = id === 'kneeL' ? -1 : 1;
  const at = e.pos.clone().add(new THREE.Vector3(side * 1.7, 0, -.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), e.yaw)).setY(2.7);
  explosionFx(at); fxAll({ t: 'boom', p: [r2(at.x), r2(at.y), r2(at.z)] });
  feed((side < 0 ? 'Left' : 'Right') + ' knee actuator destroyed');
  if (Object.values(e.knees).every(h => h <= 0)) {
    e.kneeling = true; e.exposed = true; e.kneelTimer = e.phase >= 3 ? 7 : 9;
    radio('Mara · Ops', 'It\'s down! The core is open. Pour everything into it!');
  }
}

ENEMY_TYPES.ironwalker = {
  name: 'Ironwalker', boss: true, hp: 3200, color: 0xd9a23a, weakLabel: 'CORE EXPOSED',
  hover: 0, bob: .02, eyeY: 6.2, muzzle: [2.2, 5.4, -1.8], centerY: 5.2,
  hitParts: [
    { y: 5.4, r: 2.1, head: false },
    { y: 5.0, r: .75, head: true, z: -2.35 },
    { id: 'kneeL', y: 2.7, r: .85, x: -1.7, z: -.3 },
    { id: 'kneeR', y: 2.7, r: .85, x: 1.7, z: -.3 },
  ],
  speed: { patrol: .9, search: .9, close: .9, retreat: .9, strafe: .9 },
  sight: { stand: 70, crouch: 70, crouchStill: 70, fov: -1 },
  range: { far: 99, near: 0 }, strafeSwap: 4,
  gun: { speed: 60, damage: 9, cooldown: [.11, 0], spread: [.014, .2], sound: 'shot' },

  status: e => e.kneeling ? '' : ' · knees ' + Object.values(e.knees ?? { a: 1, b: 1 }).filter(h => h > 0).length + '/2',
  partAlive: (e, id) => (e.knees?.[id] ?? 1) > 0,
  onHit(e, amount, opts, head) {
    e.knees ??= { kneeL: KNEE, kneeR: KNEE };
    if (e.kneeling) return opts.explosive ? amount * .6 : amount * (head ? 2.2 : 1);
    if (opts.part && e.knees[opts.part] > 0) {
      e.knees[opts.part] -= amount;
      if (e.knees[opts.part] <= 0) kneeDown(e, opts.part);
      return 'absorbed';
    }
    if (opts.explosive) {
      for (const id of Object.keys(e.knees)) if (e.knees[id] > 0) { e.knees[id] -= amount * .35; if (e.knees[id] <= 0) kneeDown(e, id); }
      return 'absorbed';
    }
    return amount * .04;                                  // the armour plating
  },

  build(g, bodyMat) {
    const hazard = new THREE.MeshStandardMaterial({ color: 0x24282a, roughness: .7 });
    const kneeMat = () => new THREE.MeshStandardMaterial({ color: 0xffb24a, emissive: 0xff8a1a, emissiveIntensity: 1.6 });
    const core = new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xff9a3a, emissiveIntensity: .3 });
    g.userData.knees = {};
    for (const s of [-1, 1]) {
      rod(g, [s * 1.5, 4.4, .3], [s * 1.7, 2.7, -.3], .38, 'edge', 10);         // thigh
      rod(g, [s * 1.7, 2.7, -.3], [s * 1.6, .5, .5], .32, 'edge', 10);          // shin
      box(g, s * 1.6, .25, .2, 1.3, .5, 2.2, 'dark');                           // foot
      const k = kneeMat(); mesh(g, geo('sphere', .62, 12, 10), k, s * 1.7, 2.7, -.3); g.userData.knees[s < 0 ? 'kneeL' : 'kneeR'] = k;
    }
    box(g, 0, 5.4, 0, 4, 2.6, 3.6, bodyMat);
    for (let i = -1.6; i <= 1.6; i += .8) box(g, i, 4.15, -1.81, .4, .3, .04, hazard);   // hazard stripes
    box(g, 0, 5.4, -1.83, 2.2, 1.4, .1, 'glass');
    mesh(g, geo('sphere', .7, 14, 10), core, 0, 5.0, -2.0); g.userData.core = core;
    box(g, 0, 6.85, .4, 2.6, .3, 2.4, 'edge');
    rod(g, [0, 6.9, 1.2], [0, 11.5, -3.8], .3, bodyMat, 8);                     // crane boom
    rod(g, [0, 11.5, -3.8], [0, 8.4, -4.2], .05, 'steel', 5); box(g, 0, 8.2, -4.2, .8, .5, .5, 'dark');   // hook block
    rod(g, [2.2, 5.4, -.4], [2.2, 5.4, -2.2], .22, 'dark', 10); box(g, 2.2, 5.4, -.2, .7, .7, 1, 'edge');    // rivet gun
    for (const s of [-1, 1]) box(g, s * 1.2, 6.9, 1.6, .3, .3, .3, new THREE.MeshStandardMaterial({ color: 0xffb24a, emissive: 0xff8a1a, emissiveIntensity: 2 }));
    return [];
  },

  pose(e, dt) {
    e.drop = THREE.MathUtils.damp(e.drop ?? 0, e.exposed ? 2.2 : 0, 3, dt ?? .016);
    e.g.position.y -= e.drop;
    const k = e.g.userData.knees ?? {};
    for (const id of ['kneeL', 'kneeR']) if (k[id]) k[id].emissiveIntensity = (e.knees?.[id] ?? 1) > 0 ? 1.2 + Math.sin(G.elapsed * 5) * .5 : 0;
    if (e.g.userData.core) e.g.userData.core.emissiveIntensity = e.exposed ? 3 + Math.sin(G.elapsed * 14) : .3;
  },

  update(e, dt, from) {
    if (isClient()) return;
    e.knees ??= { kneeL: KNEE, kneeR: KNEE }; e.phase ??= 1;
    if (e.kneeling) {
      e.state = 'search';
      e.kneelTimer -= dt;
      if (e.kneelTimer <= 0) {
        e.kneeling = false; e.exposed = false; e.phase++;
        e.knees = { kneeL: KNEE * .6, kneeR: KNEE * .6 };
        radio('Mara · Ops', e.phase >= 3 ? 'It\'s back up, and it\'s furious. Same again: knees, then core.' : 'It\'s patched its knees and it\'s standing. Knees again!');
        for (const at of [[-20, -30], [20, -30]]) addEnemy({ type: 'lineman', at }, e.pos.clone());
        e.stompCd = 0;
      }
      return;
    }
    // Nearest visible target: players first-class, Tallymen too.
    let target = null, best = Infinity;
    for (const p of [...G.players.filter(isActive), ...G.enemies.filter(o => !o.dead && o.faction !== e.faction)]) {
      const eye = p.isEnemy ? p.pos.clone().setY(p.type.centerY) : eyeOf(p), d = p.pos.distanceTo(e.pos);
      if (d < best && los(from, eye)) { target = p; best = d; }
    }
    e.visible = !!target; e.state = target ? 'engage' : 'search';
    if (target) { e.target = target; e.seenAt = G.elapsed; }
    const chase = target ?? G.players.find(isActive);
    if (chase) {
      e.yaw = Math.atan2(-(chase.pos.x - e.pos.x), -(chase.pos.z - e.pos.z));
      if (best > 13) botMove(e, chase.pos, e.type.speed.close + .2 * (e.phase - 1), dt);
      e.yaw = Math.atan2(-(chase.pos.x - e.pos.x), -(chase.pos.z - e.pos.z));
    }
    // Rivet-gun bursts.
    e.burstTimer = (e.burstTimer ?? 2.5) - dt;
    if (e.burstTimer <= 0 && target) { e.burstLeft = e.phase >= 3 ? 9 : 6; e.burstTimer = e.phase >= 3 ? 2.6 : 3.4; }
    if (e.burstLeft > 0 && target && e.shot <= 0 && G.elapsed > G.protectUntil + .5) {
      const aim = target.isEnemy ? target.pos.clone().setY(target.type.centerY) : eyeOf(target).add(new THREE.Vector3(0, -.3, 0));
      shootAt(e, aim, best); e.shot = .11; e.burstLeft--;
    }
    // Thrown debris at players.
    e.mortarTimer = (e.mortarTimer ?? 4) - dt;
    if (e.mortarTimer <= 0) {
      e.mortarTimer = e.phase >= 2 ? 5 : 6.5;
      const victims = G.players.filter(isActive);
      if (victims.length) { const v = victims[Math.floor(Math.random() * victims.length)]; launchShell(e.pos.clone().add(new THREE.Vector3(0, 8, 0)), v.pos.clone()); }
    }
    // Stomp anyone underfoot.
    e.stompCd = (e.stompCd ?? 2) - dt;
    if (e.stompCd <= 0 && G.players.some(p => isActive(p) && p.pos.distanceTo(e.pos) < 6.5)) {
      e.stompCd = 3.2;
      const at = e.pos.clone().setY(.3); explosionFx(at); fxAll({ t: 'boom', p: [r2(at.x), .3, r2(at.z)] });
      for (const p of G.players) if (isActive(p)) { const d = p.pos.distanceTo(e.pos); if (d < 6.5) hurt(p, 12 + 26 * (1 - d / 6.5), at); }
      feed('Ironwalker stomps!');
    }
  },
};

// ---------------------------------------------------------------- mortar shells and warning rings

const FLIGHT = 1.5, GRAVITY = 12, BLAST = 4.5;
const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: .55, depthWrite: false });
const shellMat = new THREE.MeshStandardMaterial({ color: 0x2b2f31, emissive: 0xff6a1a, emissiveIntensity: .8 });

/** A red warning ring on the ground that fills in over `life` seconds (mortars, lightning). */
export function warnRing(x, z, life) { marker(x, z, life); }
function marker(x, z, life) {
  const m = new THREE.Mesh(geo('torus', BLAST, .09, 6, 40), ringMat); m.rotation.x = Math.PI / 2; m.position.set(x, .2, z);
  const dot = new THREE.Mesh(geo('cyl', .5, .5, .05, 16), ringMat); dot.position.set(x, .18, z);
  G.dynRoot.add(m); G.dynRoot.add(dot);
  G.markers.push({ m, dot, life, total: life });
}

/** kind 'mortar' explodes; kind 'arc' (Arc lobbers) leaves a damaging electric field. */
export function launchShell(from, target, kind = 'mortar', src = null) {
  const flight = kind === 'arc' ? 1.2 : FLIGHT;
  const vel = target.clone().sub(from).divideScalar(flight); vel.y = (target.y - from.y) / flight + .5 * GRAVITY * flight;
  const mesh_ = new THREE.Mesh(geo('sphere', kind === 'arc' ? .3 : .22, 8, 6), kind === 'arc' ? arcShellMat : shellMat); mesh_.position.copy(from); G.dynRoot.add(mesh_);
  G.shells.push({ pos: from.clone(), vel, t: flight, mesh: mesh_, target: target.clone(), kind, src });
  marker(target.x, target.z, flight);
  fxAll({ t: 'mortar', p: [r2(target.x), r2(target.z)], life: flight });
  sfxAt(from, kind === 'arc' ? 'arc' : 'blast', .25, 90);
}
const arcShellMat = new THREE.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x3fa8ff, emissiveIntensity: 2.4 });
shellHooks.launch = launchShell;

// ---------------------------------------------------------------- electric fields (Arc lobber impacts)

const FIELD_R = 3.2, FIELD_LIFE = 3.2, FIELD_DPS = 22;
const fieldMat = () => new THREE.MeshBasicMaterial({ color: 0x6fc4ff, transparent: true, opacity: .35, depthWrite: false });
/** A crackling disc on the ground that hurts players and other-faction machines (visual on clients). */
export function makeField(x, z, faction = 'lodestar') {
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(FIELD_R, FIELD_R, .05, 28), fieldMat()); disc.position.set(x, .14, z); G.dynRoot.add(disc);
  G.fields.push({ x, z, life: FIELD_LIFE, disc, faction, tick: 0 });
  arcBolts([new THREE.Vector3(x, .3, z), ...[0, 1, 2, 3].map(i => new THREE.Vector3(x + Math.cos(i * 1.6) * FIELD_R, .2, z + Math.sin(i * 1.6) * FIELD_R))]);
}
export function updateFields(dt) {
  for (let i = G.fields.length - 1; i >= 0; i--) {
    const f = G.fields[i]; f.life -= dt;
    f.disc.material.opacity = (.22 + Math.random() * .18) * Math.min(1, f.life);
    if (Math.random() < dt * 6) arcBolts([new THREE.Vector3(f.x, .2, f.z), new THREE.Vector3(f.x + (Math.random() - .5) * 2 * FIELD_R, .15, f.z + (Math.random() - .5) * 2 * FIELD_R)]);
    if (!isClient()) {
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = .25;
        for (const p of G.players) if (isActive(p) && Math.hypot(p.pos.x - f.x, p.pos.z - f.z) < FIELD_R) hurt(p, FIELD_DPS * .25, new THREE.Vector3(f.x, 0, f.z));
        for (const e of G.enemies) if (!e.dead && e.faction !== f.faction && Math.hypot(e.pos.x - f.x, e.pos.z - f.z) < FIELD_R) damageEnemy(e, FIELD_DPS * .25, false, null, { explosive: true });
      }
    }
    if (f.life <= 0) { f.disc.removeFromParent(); f.disc.material.dispose(); G.fields.splice(i, 1); }
  }
}

/** Host: fly shells and detonate them. */
export function updateShells(dt) {
  for (let i = G.shells.length - 1; i >= 0; i--) {
    const s = G.shells[i];
    s.t -= dt; s.vel.y -= GRAVITY * dt; s.pos.addScaledVector(s.vel, dt); s.mesh.position.copy(s.pos);
    if (s.t > 0) continue;
    s.mesh.removeFromParent(); G.shells.splice(i, 1);
    const p = s.target;
    if (s.kind === 'arc') { makeField(p.x, p.z, s.src?.faction); fxAll({ t: 'field', p: [r2(p.x), r2(p.z)] }); sfxAt(p, 'arc', 1, 50); continue; }
    explosionFx(p.clone().setY(.4)); fxAll({ t: 'boom', p: [r2(p.x), .4, r2(p.z)] });
    for (const pl of G.players) {
      if (!isActive(pl)) continue;
      const d = Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z);
      if (d < BLAST) hurt(pl, 55 * (1 - d / BLAST), p);
    }
    alertNoise(p, 30);
  }
}

/** Host and clients: fade warning rings. */
export function updateMarkers(dt) {
  for (let i = G.markers.length - 1; i >= 0; i--) {
    const k = G.markers[i]; k.life -= dt;
    const f = 1 - k.life / k.total;
    k.m.scale.setScalar(1 - f * .15); const r = .4 + f * 7.5; k.dot.scale.set(r, 1, r);
    if (k.life <= 0) { k.m.removeFromParent(); k.dot.removeFromParent(); G.markers.splice(i, 1); }
  }
}
export const clientMortar = ev => marker(ev.p[0], ev.p[1], ev.life);

export function clearBossFx() {
  for (const s of G.shells ?? []) s.mesh.removeFromParent();
  for (const k of G.markers ?? []) { k.m.removeFromParent(); k.dot.removeFromParent(); }
  for (const f of G.fields ?? []) { f.disc.removeFromParent(); f.disc.material.dispose(); }
  G.shells = []; G.markers = []; G.fields = [];
}
