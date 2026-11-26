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
import { ENEMY_TYPES, addEnemy, botMove, shootAt } from './bots.js';
import { hurt, explosionFx, alertNoise } from './combat.js';
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

// ---------------------------------------------------------------- mortar shells and warning rings

const FLIGHT = 1.5, GRAVITY = 12, BLAST = 4.5;
const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: .55, depthWrite: false });
const shellMat = new THREE.MeshStandardMaterial({ color: 0x2b2f31, emissive: 0xff6a1a, emissiveIntensity: .8 });

function marker(x, z, life) {
  const m = new THREE.Mesh(geo('torus', BLAST, .09, 6, 40), ringMat); m.rotation.x = Math.PI / 2; m.position.set(x, .2, z);
  const dot = new THREE.Mesh(geo('cyl', .5, .5, .05, 16), ringMat); dot.position.set(x, .18, z);
  G.dynRoot.add(m); G.dynRoot.add(dot);
  G.markers.push({ m, dot, life, total: life });
}

function launchShell(from, target) {
  const vel = target.clone().sub(from).divideScalar(FLIGHT); vel.y = (target.y - from.y) / FLIGHT + .5 * GRAVITY * FLIGHT;
  const mesh_ = new THREE.Mesh(geo('sphere', .22, 8, 6), shellMat); mesh_.position.copy(from); G.dynRoot.add(mesh_);
  G.shells.push({ pos: from.clone(), vel, t: FLIGHT, mesh: mesh_, target: target.clone() });
  marker(target.x, target.z, FLIGHT);
  fxAll({ t: 'mortar', p: [r2(target.x), r2(target.z)], life: FLIGHT });
  sfxAt(from, 'blast', .25, 90);
}

/** Host: fly shells and detonate them. */
export function updateShells(dt) {
  for (let i = G.shells.length - 1; i >= 0; i--) {
    const s = G.shells[i];
    s.t -= dt; s.vel.y -= GRAVITY * dt; s.pos.addScaledVector(s.vel, dt); s.mesh.position.copy(s.pos);
    if (s.t > 0) continue;
    s.mesh.removeFromParent(); G.shells.splice(i, 1);
    const p = s.target;
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
  G.shells = []; G.markers = [];
}
