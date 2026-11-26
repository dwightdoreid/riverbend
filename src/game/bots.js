// Enemy machines. Each enemy type is a model + tuning entry; the AI picks a target from all
// living players, so the same code drives solo and co-op.
import { THREE } from '../engine/three.js';
import { box, cyl, rod } from '../engine/builders.js';
import { G } from './state.js';
import { moveBlocked, los, freePoint, castSolid } from './world.js';
import { eyeOf, isActive } from './players.js';
import { isHost, isClient, fxAll } from '../net/net.js';
import { projectile, hurt, smokeBlocks } from './combat.js';
import { litAt } from './props.js';
import { walkable, findPath } from './nav.js';
import { sfxAt } from './fx.js';
import { feed } from '../ui/hud.js';

const glowEye = (color, emissive) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: .9 });

export const ENEMY_TYPES = {
  sentry: {
    name: 'Sentry', hp: 90, color: 0x9a744f,
    hover: 0, bob: .075, eyeY: 1.72, muzzle: [.18, 1.35, 0], centerY: 1.2,
    hitParts: [{ y: 1.2, r: .61, head: false }, { y: 1.75, r: .31, head: true }],
    speed: { patrol: 1.2, search: 2.0, close: 1.8, retreat: 1.7, strafe: 1.1 },
    sight: { stand: 32, crouch: 24, crouchStill: 18, fov: .25 },
    range: { far: 20, near: 8 }, strafeSwap: 1.7,
    gun: { speed: 44, damage: 9, cooldown: [1.05, .75], spread: [.017, .18], sound: 'shot' },
    build(g, bodyMat) {
      box(g, 0, 1.2, 0, .76, .65, .5, bodyMat); box(g, 0, 1.73, 0, .52, .39, .42, 'dark');
      box(g, 0, 1.77, -.22, .3, .12, .035, glowEye(0xed9d56, 0xf47c38));
      for (const x of [-.55, .55]) { box(g, x, 1.35, 0, .29, .27, .6, 'edge'); const pod = cyl(g, x, 1.15, 0, .19, .19, .1, 'dark', 8); pod.rotation.x = Math.PI / 2; }
      rod(g, [.27, 1.19, -.2], [.27, 1.19, -.65], .065, 'dark', 8); cyl(g, 0, .81, 0, .22, .26, .25, 'edge');
      return [];
    },
  },
  // Heavy with a front shield: bullets from the front are stopped (the sensor above it takes
  // half damage). Flank it, or use grenades, which ignore the shield.
  bulwark: {
    name: 'Bulwark', hp: 340, color: 0x6d6a5e,
    hover: 0, bob: .02, eyeY: 2.3, muzzle: [.75, 1.5, -.5], centerY: 1.3,
    hitParts: [{ y: 1.3, r: .9, head: false }, { y: 2.35, r: .3, head: true }],
    speed: { patrol: .9, search: 1.3, close: 1.25, retreat: 1.0, strafe: .55 },
    sight: { stand: 30, crouch: 23, crouchStill: 17, fov: .2 },
    range: { far: 18, near: 6 }, strafeSwap: 2.6,
    gun: { speed: 52, damage: 13, cooldown: [1.5, .6], spread: [.012, .14], sound: 'shotgun' },
    armor(e, head, dir, explosive) {
      if (explosive || !dir) return 1;
      const fwd = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
      const front = dir.x * fwd.x + dir.z * fwd.z < -.35;     // bullet travelling against our facing
      return front ? (head ? .5 : 0) : 1;
    },
    build(g, bodyMat) {
      box(g, 0, 1.3, .1, 1.2, 1.3, .9, bodyMat); box(g, 0, .45, .1, 1.3, .5, 1.1, 'dark');
      for (const x of [-.5, .5]) box(g, x, .3, .1, .35, .6, 1.3, 'edge');                   // treads
      const shield = new THREE.MeshStandardMaterial({ color: 0x66717a, metalness: .25, roughness: .5 });   // low metalness: no env map, so metal would render black
      box(g, 0, 1.25, -.55, 1.7, 1.75, .12, shield);                                       // front shield
      box(g, 0, 1.95, -.62, 1.5, .1, .04, 'amber'); box(g, 0, .55, -.62, 1.5, .1, .04, 'amber');
      box(g, 0, 2.35, 0, .5, .32, .45, 'dark');
      box(g, 0, 2.38, -.23, .3, .1, .03, glowEye(0xffb24a, 0xff8a2a));
      rod(g, [.75, 1.5, .1], [.75, 1.5, -.75], .09, 'dark', 8); box(g, .75, 1.5, .1, .3, .3, .5, 'edge');
      return [];
    },
  },
  // High-flying, unarmed observer. When it sees a player it marks them for every machine within
  // 55 m and calls in Skimmers every 14 s until it loses sight or is shot down.
  spotter: {
    name: 'Spotter', hp: 60, color: 0x58636a,
    hover: 5.2, bob: .25, eyeY: 5.2, muzzle: [0, 5, 0], centerY: 5.2, coneTilt: -.42,
    hitParts: [{ y: 5.2, r: .62, head: false }, { y: 5.05, r: .25, head: true, z: -.5 }],
    speed: { patrol: 2, search: 3, close: 3, retreat: 3, strafe: 2.2 },
    sight: { stand: 42, crouch: 34, crouchStill: 26, fov: -.15 },
    range: { far: 99, near: 0 }, strafeSwap: 3,
    gun: { speed: 0, damage: 0, cooldown: [9, 0], spread: [0, 0], sound: 'radio' },
    build(g, bodyMat) {
      cyl(g, 0, 5.2, 0, .55, .45, .32, bodyMat, 16);
      cyl(g, 0, 5.42, 0, .22, .3, .16, 'dark', 12);
      const lens = cyl(g, 0, 5.05, -.48, .2, .24, .18, new THREE.MeshStandardMaterial({ color: 0x9fd6ff, emissive: 0x3f8fd0, emissiveIntensity: 1.4 }), 14);
      lens.rotation.x = Math.PI / 2;
      const beacon = box(g, 0, 5.55, .1, .14, .1, .14, glowEye(0xff3a3a, 0xff2020)); g.userData.beacon = beacon.material;
      rod(g, [0, 5.4, .25], [0, 6.1, .45], .02, 'steel', 5);
      const rotors = [];
      for (const s of [-1, 1]) { rod(g, [0, 5.25, 0], [s * .85, 5.3, 0], .05, 'edge', 6); rotors.push(box(g, s * .85, 5.4, 0, .9, .015, .09, 'steel')); }
      return rotors;
    },
    pose(e) {
      const b = e.g.userData.beacon;
      if (b) b.emissiveIntensity = e.spotting ? (Math.sin(G.elapsed * 14) > 0 ? 3 : .2) : (Math.sin(G.elapsed * 2) > .7 ? 2 : .3);
    },
    update(e, dt, from) {
      if (isClient()) return;
      const T = e.type;
      e.sense -= dt;
      if (e.sense <= 0) {
        e.sense = .25;
        let best = null, bd = Infinity;
        for (const p of G.players) { if (!isActive(p)) continue; const d = canSee(e, from, p); if (d >= 0 && d < bd) { best = p; bd = d; } }
        e.visible = !!best;
        if (best) {
          if (!e.spotting) { e.callTimer = 6; feed('Spotter has eyes on ' + (best.local ? 'you' : best.name)); }
          e.spotting = true; e.state = 'engage'; e.target = best; e.memory = 6; e.seenAt = G.elapsed; e.lastKnown.copy(best.pos);
          for (const o of G.enemies) {
            if (o === e || o.dead || o.pos.distanceTo(best.pos) > 55) continue;
            o.lastKnown.copy(best.pos); o.memory = Math.max(o.memory, 8);
            if (o.state === 'patrol') o.state = 'investigate';
          }
        } else { e.spotting = false; if (e.state === 'engage') e.state = 'search'; }
      }
      const t = e.target;
      if (e.spotting && t) {
        const d = flatDist(e.pos, t.pos);
        e.yaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z));
        if (d > 17) navigate(e, t.pos, T.speed.close, dt);
        else if (d < 10) botMove(e, e.pos.clone().sub(t.pos).normalize().multiplyScalar(4).add(e.pos), T.speed.retreat, dt);
        else { e.timer += dt; if (e.timer > T.strafeSwap) { e.dodge *= -1; e.timer = 0; } botMove(e, new THREE.Vector3(Math.cos(e.yaw) * e.dodge, 0, -Math.sin(e.yaw) * e.dodge).add(e.pos), T.speed.strafe, dt); }
        e.yaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z));
        e.beep = (e.beep ?? 0) - dt;
        if (e.beep <= 0) { e.beep = 1.1; sfxAt(e.pos, 'radio', .5, 60); }
        e.callTimer -= dt;
        if (e.callTimer <= 0) {
          e.callTimer = 14;
          const called = G.enemies.filter(o => !o.dead && o.def.called).length;
          const points = (G.mission.reinforcements ?? []).map(([x, z]) => ({ x, z, d: Math.hypot(x - t.pos.x, z - t.pos.z) })).filter(q => q.d > 25).sort((a, b) => a.d - b.d);
          if (called < 6 && points.length) {
            for (let i = 0; i < 2; i++) addEnemy({ type: 'skimmer', at: [points[0].x + i * 1.5, points[0].z], called: true }, t.pos.clone());
            feed('Spotter called in Skimmers');
          }
        }
      } else if (e.memory > 0) navigate(e, e.lastKnown, T.speed.search, dt);
      else {
        e.state = 'patrol';
        if (e.pos.distanceTo(e.dest) < .9) e.dest.copy(e.dest.distanceTo(e.home) < 1 ? e.patrol : e.home);
        navigate(e, e.dest, T.speed.patrol, dt);
      }
    },
  },
  // Fast melee crawler. Ceiling ambushers (def.ceiling) cling overhead until a player passes
  // within reach below, then drop. On the ground they rush the nearest player and lunge.
  lineman: {
    name: 'Lineman', hp: 75, color: 0x4a3f3a,
    hover: 0, bob: .02, eyeY: .7, muzzle: [0, .6, -.5], centerY: .55,
    hitParts: [{ y: .55, r: .62, head: false }, { y: .62, r: .24, head: true, z: -.55 }],
    speed: { patrol: 1.6, search: 3.4, close: 5.2, retreat: 3, strafe: 3 },
    sight: { stand: 22, crouch: 16, crouchStill: 11, fov: .05 },
    range: { far: 99, near: 0 }, strafeSwap: 1,
    gun: { speed: 0, damage: 0, cooldown: [1.1, .3], spread: [0, 0], sound: 'hit' },
    build(g, bodyMat) {
      box(g, 0, .55, 0, .7, .32, 1.1, bodyMat); box(g, 0, .62, -.6, .42, .26, .3, 'dark');
      for (const s of [-1, 1]) box(g, s * .1, .66, -.76, .07, .05, .02, glowEye(0xff3a2a, 0xff2010));
      for (const z of [-.35, 0, .35]) for (const s of [-1, 1]) {
        rod(g, [s * .3, .55, z], [s * .75, .8, z - .1], .04, 'edge', 5); rod(g, [s * .75, .8, z - .1], [s * .95, .02, z - .2], .035, 'dark', 5);
      }
      rod(g, [0, .7, .5], [0, 1.05, .95], .05, 'edge', 5); box(g, 0, 1.08, .98, .14, .08, .14, 'amber');   // tail with a cutting tip
      return [];
    },
    pose(e) { e.g.position.y = (e.elev ?? 0) + Math.sin(G.elapsed * 9 + e.id) * .02; e.g.rotation.z = e.elev > 1 ? Math.PI : 0; },
    update(e, dt, from) {
      if (isClient()) return;
      const T = e.type;
      e.elev ??= e.def.ceiling ? 4.05 : 0;
      if (e.dropping) { e.elev = Math.max(0, e.elev - dt * 14); if (e.elev === 0) e.dropping = false; return; }
      if (e.elev > 0) {                                  // clinging to the ceiling
        for (const p of G.players) if (isActive(p) && flatDist(p.pos, e.pos) < 5.5 && los(e.pos.clone().setY(3.6), eyeOf(p))) {
          e.dropping = true; e.target = p; e.state = 'engage'; e.visible = true; e.seenAt = G.elapsed;
          feed('Lineman dropping from the ceiling!'); sfxAt(e.pos, 'hurt', 1.2, 40);
          break;
        }
        return;
      }
      e.sense -= dt;
      if (e.sense <= 0) {
        e.sense = .2;
        let best = null, bd = Infinity;
        for (const p of G.players) { if (!isActive(p)) continue; const d = canSee(e, from, p); if (d >= 0 && d < bd) { best = p; bd = d; } }
        e.visible = !!best;
        if (best) { e.target = best; e.state = 'engage'; e.memory = 6; e.seenAt = G.elapsed; e.lastKnown.copy(best.pos); }
        else if (e.state === 'engage') { e.state = 'search'; e.memory = Math.max(e.memory, 4); }
      }
      const t = e.target && isActive(e.target) ? e.target : null;
      if (e.state === 'engage' && t) {
        const d = flatDist(e.pos, t.pos);
        e.yaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z));
        if (d > 1.3) navigate(e, t.pos, T.speed.close, dt);
        e.yaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z));
        if (d < 1.9 && e.shot <= 0 && G.elapsed > G.protectUntil + .5) {
          e.shot = T.gun.cooldown[0] + Math.random() * T.gun.cooldown[1];
          hurt(t, 18, e.pos.clone());
          sfxAt(e.pos, 'hit', .9, 30);
        }
      } else if (e.memory > 0) navigate(e, e.lastKnown, T.speed.search, dt);
      else {
        e.state = 'patrol';
        if (e.pos.distanceTo(e.dest) < .9) e.dest.copy(e.dest.distanceTo(e.home) < 1 ? e.patrol : e.home);
        navigate(e, e.dest, T.speed.patrol, dt);
      }
    },
  },
  // Halvard Energy security drone: a second hostile faction. Shoots players and LODESTAR's
  // machines alike, in accurate three-round bursts, and flanks.
  tallyman: {
    name: 'Tallyman', faction: 'halvard', hp: 120, color: 0xe3e6e8,
    hover: 1.1, bob: .06, eyeY: 2.35, muzzle: [.48, 1.95, -.45], centerY: 1.9,
    hitParts: [{ y: 1.9, r: .62, head: false }, { y: 2.45, r: .26, head: true, z: -.15 }],
    speed: { patrol: 1.8, search: 3, close: 3.2, retreat: 2.4, strafe: 2.7 },
    sight: { stand: 36, crouch: 28, crouchStill: 20, fov: .1 },
    range: { far: 22, near: 9 }, strafeSwap: 1.4,
    gun: { speed: 62, damage: 8, cooldown: [1.3, .5], spread: [.01, .12], sound: 'pistol', burst: 3 },
    build(g, bodyMat) {
      box(g, 0, 1.9, 0, .8, .9, .7, bodyMat); box(g, 0, 1.45, .05, .6, .25, .55, 'dark');
      box(g, 0, 1.9, .01, .82, .14, .72, new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: .5 }));   // Halvard blue band
      box(g, 0, 2.45, -.1, .42, .3, .42, bodyMat);
      box(g, 0, 2.47, -.32, .32, .08, .03, glowEye(0x9fd6ff, 0x4fb4ff));
      for (const s of [-1, 1]) { box(g, s * .5, 1.95, -.15, .16, .22, .7, 'dark'); rod(g, [s * .5, 1.95, -.5], [s * .5, 1.95, -.8], .04, 'steel', 6); }
      box(g, 0, 1.25, .2, .4, .1, .3, glowEye(0x9fd6ff, 0x4fb4ff));                        // thruster
      return [];
    },
  },
  // Fast, fragile flyer. Hunts in pairs, closes distance and circles instead of holding range.
  skimmer: {
    name: 'Skimmer', hp: 45, color: 0x6f8189,
    hover: 2.1, bob: .16, eyeY: 2.15, muzzle: [0, 1.95, -.3], centerY: 2.1,
    hitParts: [{ y: 2.1, r: .58, head: false }, { y: 2.12, r: .2, head: true, z: -.42 }],
    speed: { patrol: 2.4, search: 3.6, close: 4.4, retreat: 3.2, strafe: 3.4 },
    sight: { stand: 28, crouch: 21, crouchStill: 15, fov: .1 },
    range: { far: 13, near: 4.5 }, strafeSwap: 1.1,
    gun: { speed: 50, damage: 6, cooldown: [.55, .4], spread: [.02, .24], sound: 'pistol' },
    build(g, bodyMat) {
      cyl(g, 0, 2.1, 0, .46, .38, .22, bodyMat, 14);
      cyl(g, 0, 2.24, 0, .2, .26, .14, 'dark', 10);
      box(g, 0, 2.12, -.42, .2, .1, .08, glowEye(0xff8a63, 0xff5a3a));
      const rotors = [];
      for (const [x, z] of [[-.62, -.62], [.62, -.62], [-.62, .62], [.62, .62]]) {
        rod(g, [0, 2.1, 0], [x, 2.16, z], .04, 'edge', 6);
        cyl(g, x, 2.16, z, .08, .08, .1, 'dark', 8);
        const blade = box(g, x, 2.24, z, .55, .015, .07, 'steel'); rotors.push(blade);
      }
      rod(g, [0, 1.98, -.15], [0, 1.98, -.5], .035, 'dark', 6);
      return rotors;
    },
  },
};

function makeCone(T) {
  const len = T.sight.stand * (G.env.sightScale ?? 1), r = len * .26;
  const cg = new THREE.ConeGeometry(r, len, 18, 1, true);
  cg.rotateX(Math.PI / 2); cg.translate(0, 0, -len / 2);
  const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xf3a55a, transparent: true, opacity: .045, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.y = T.eyeY; m.rotation.x = T.coneTilt ?? 0; m.renderOrder = 2;
  return m;
}

/** Adds one enemy from a mission def: { type, at: [x, z], patrol: [x, z] }. */
export function addEnemy(def, alertAt = null) {
  const T = ENEMY_TYPES[def.type], i = G.enemies.length;
  const g = new THREE.Group(); G.dynRoot.add(g);
  const bodyMat = new THREE.MeshStandardMaterial({ color: T.color, metalness: .55, roughness: .5 });
  const rotors = T.build(g, bodyMat);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const cone = G.env.dark ? makeCone(T) : null; if (cone) g.add(cone);
  const home = freePoint(...def.at), patrol = freePoint(...(def.patrol ?? def.at));
  const e = {
    id: i, def, type: T, isEnemy: true, faction: def.faction ?? T.faction ?? 'lodestar', g, mat: bodyMat, rotors, cone, pos: home.clone(), home, patrol, dest: patrol.clone(),
    hp: T.hp * hpScale(), maxHp: T.hp * hpScale(), yaw: Math.PI * (i % 2), state: 'patrol', timer: 0, lastKnown: new THREE.Vector3(), memory: 0,
    shot: 1 + i * .17, sense: i * .027, visible: false, seenAt: -99, flash: 0, dead: false, dodge: i % 2 ? 1 : -1, target: null,
  };
  // Wave enemies (spawned with an alert point) hunt: they always know roughly where players are.
  if (alertAt) { e.state = 'investigate'; e.memory = 12; e.lastKnown.copy(alertAt); e.hunt = true; }
  g.position.copy(e.pos);
  // Mid-mission spawns (waves) are announced to co-op clients so their enemy lists stay in step.
  if (isHost() && G.status === 'playing') fxAll({ t: 'enemy', def, alert: alertAt ? [alertAt.x, alertAt.z] : null });
  G.enemies.push(e);
  return e;
}

/** Co-op scaling: machines get tougher with more players (counts scale in wave events). */
const hpScale = () => 1 + .4 * (G.players.length - 1);   // same on host and clients (same roster)

export function spawnEnemies(defs) {
  G.enemies.length = 0;
  for (const def of defs) addEnemy(def);
}

export function botMove(e, target, speed, dt) {
  const d = target.clone().sub(e.pos); d.y = 0;
  if (d.length() < .6) return;
  d.normalize();
  const step = speed * dt, r = .22, dx = d.x * step, dz = d.z * step;
  if (!moveBlocked(e.pos.x + dx, e.pos.z + dz, r)) { e.pos.x += dx; e.pos.z += dz; }
  else {
    const side = e.dodge, alternatives = [[-d.z * side, d.x * side], [d.z * side, -d.x * side], [d.x, 0], [0, d.z]];
    let moved = false;
    for (const [x, z] of alternatives) if (!moveBlocked(e.pos.x + x * step * 2, e.pos.z + z * step * 2, r)) { e.pos.x += x * step; e.pos.z += z * step; moved = true; break; }
    if (!moved) e.dodge *= -1;
  }
  e.yaw = Math.atan2(-d.x, -d.z);
}

/** Move toward target, routing around obstacles when the straight line is blocked. */
export function navigate(e, target, speed, dt) {
  e.navTimer = (e.navTimer ?? 0) - dt;
  if (e.navTimer <= 0 || !e.navGoal || e.navGoal.distanceTo(target) > 2) {
    e.navTimer = .6 + Math.random() * .3;
    e.navGoal = target.clone();
    e.route = walkable(e.pos, target) ? null : findPath(e.pos, target);
  }
  let goal = target;
  if (e.route?.length) {
    goal = e.route[0];
    if (Math.hypot(goal.x - e.pos.x, goal.z - e.pos.z) < .8) { e.route.shift(); goal = e.route[0] ?? target; }
  }
  botMove(e, goal, speed, dt);
}

export function nearestPlayer(pos) {
  let best = null, bestD = Infinity;
  for (const p of G.players) if (isActive(p)) { const d = p.pos.distanceTo(pos); if (d < bestD) { best = p; bestD = d; } }
  return best;
}

const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Targets are players or machines of another faction (Halvard's Tallymen vs LODESTAR's machines).
export const isTargetAlive = t => t.isEnemy ? !t.dead : isActive(t);
export const targetEye = t => t.isEnemy ? t.pos.clone().setY(t.type.centerY) : eyeOf(t);
function hostileMachines(e) { return G.enemies.filter(o => !o.dead && o !== e && o.faction !== e.faction); }

/** Line of fire to a point inside an object's own collision box (truck, generator, turret):
 *  hitting that object's box counts as a clear shot. */
export function canHit(from, to, mover) {
  const d = to.clone().sub(from), dist = d.length(), hit = castSolid(from, d.divideScalar(dist), dist - .1);
  return !hit || (mover && hit.mover === mover);
}

/** Nearest live turret this enemy can shoot at. */
function turretTarget(e, from) {
  let best = null, bestD = 20;
  for (const t of G.turrets) {
    if (t.dead || !t.mover) continue;
    const d = flatDist(e.pos, t.pos), aim = t.pos.clone().setY(.6);
    if (d < bestD && canHit(from, aim, t.mover)) { best = t; bestD = d; }
  }
  return best;
}

function harassTarget(e) {
  const prop = e.def.harass && G.props[e.def.harass];
  return prop && prop.root.visible ? prop : null;
}

export function shootAt(e, aim, dist) {
  const T = e.type, m = T.muzzle;
  const origin = e.pos.clone().add(new THREE.Vector3(m[0], m[1], m[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), e.yaw));
  const inaccuracy = dist * T.gun.spread[0] + T.gun.spread[1];
  aim.x += (Math.random() - .5) * inaccuracy * 2; aim.y += (Math.random() - .5) * inaccuracy;
  projectile(origin, aim.sub(origin).normalize(), T.gun.speed, T.gun.damage, null, false, false, e);
  e.shot = T.gun.cooldown[0] + Math.random() * T.gun.cooldown[1];
  if (T.gun.burst) {                                       // short bursts (Tallymen)
    e.gunBurst = (e.gunBurst ?? T.gun.burst) - 1;
    if (e.gunBurst > 0) e.shot = .12; else e.gunBurst = T.gun.burst;
  }
  sfxAt(e.pos, T.gun.sound, .1, 100, .2);
}

/** Distance at which enemy e can see player p right now, or -1 if it can't. */
function canSee(e, from, p) {
  const to = targetEye(p), dist = from.distanceTo(to), t = e.type.sight;
  if (p.isEnemy) {                                        // a machine of the other faction
    const aware = e.state === 'engage' || e.memory > 0 || (to.clone().sub(from).normalize().dot(new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw))) > t.fov);
    return dist < t.stand && aware && los(from, to) && !smokeBlocks(from, to) ? dist : -1;
  }
  const exposed = p.flashlight || litAt(p.pos);           // light makes you visible in the dark
  const scale = exposed ? 1 : (G.env.sightScale ?? 1);
  const reach = (p.crouched && !p.moving ? t.crouchStill : p.crouched ? t.crouch : t.stand) * scale;
  if (dist >= reach) return -1;
  const dir = to.clone().sub(from).normalize(), forward = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
  const aware = e.state === 'engage' || e.memory > 0 || (p.flashlight && G.env.dark) || dir.dot(forward) > t.fov;
  return aware && los(from, to) && !smokeBlocks(from, to) ? dist : -1;
}

const CONE_COLORS = { patrol: 0xf3a55a, investigate: 0xf3d35a, search: 0xf3d35a, engage: 0xff5a3a };

export function updateBots(dt) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const T = e.type;
    e.shot -= dt; e.memory = Math.max(0, e.memory - dt);
    e.mat.emissive.setHex(e.flash > 0 ? 0x9c532c : 0x000000);
    if (e.target && !isTargetAlive(e.target)) { e.target = null; e.visible = false; }
    // Stunned by the arc carbine: frozen, flickering blue.
    if (e.stunned > 0) { e.stunned -= dt; e.mat.emissive.setHex(Math.random() < .5 ? 0x2f6fd0 : 0x000000); e.shot = Math.max(e.shot, .3); poseEnemy(e, dt); continue; }
    const from = e.pos.clone().add(new THREE.Vector3(0, T.eyeY, 0));
    if (T.update) { T.update(e, dt, from); poseEnemy(e, dt); continue; }   // bosses run their own logic

    e.sense -= dt;
    if (e.sense <= 0) {
      e.sense = .21;
      // Keep the current target while it stays visible; otherwise pick the nearest visible player.
      let best = null, bestD = Infinity;
      for (const p of [...G.players.filter(isActive), ...hostileMachines(e)]) {
        const d = canSee(e, from, p);
        const score = p === e.target ? -1 : d;
        if (d >= 0 && score < bestD) { best = p; bestD = score; }
      }
      e.visible = !!best;
      if (best) {
        if (e.state !== 'engage') { e.shot = Math.max(e.shot, .85); if (!best.isEnemy) feed(T.name + ' acquired ' + (best.local ? 'your' : best.name + "'s") + ' position.'); }
        e.state = 'engage'; e.target = best; e.lastKnown.copy(best.pos); e.memory = 7; e.seenAt = G.elapsed;
      } else if (e.state === 'engage') { e.state = 'search'; e.memory = Math.max(3, e.memory); }
    }

    if (e.hunt && e.state !== 'engage') {
      const p = nearestPlayer(e.pos);
      if (p) { e.lastKnown.copy(p.pos); e.memory = Math.max(e.memory, 4); if (e.state === 'patrol') e.state = 'search'; }
    }

    const t = e.target;
    if (e.state === 'engage' && e.visible && t) {
      const eye = targetEye(t), dist = from.distanceTo(eye);
      const face = () => { e.yaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z)); };
      face();
      if (dist > T.range.far) navigate(e, t.pos, T.speed.close, dt);
      else if (dist < T.range.near) botMove(e, e.pos.clone().sub(t.pos).normalize().multiplyScalar(5).add(e.pos), T.speed.retreat, dt);
      else {
        e.timer += dt; if (e.timer > T.strafeSwap) { e.dodge *= -1; e.timer = 0; }
        botMove(e, new THREE.Vector3(Math.cos(e.yaw) * e.dodge, 0, -Math.sin(e.yaw) * e.dodge).add(e.pos), T.speed.strafe, dt);
      }
      face();
      if (e.shot <= 0 && G.elapsed > G.protectUntil + .5) {
        const aim = eye.clone(); aim.y -= t.crouched ? .1 : .28;
        shootAt(e, aim, dist);
      }
    } else if (!isClient() && turretTarget(e, from)) {
      // Machines fight back against turrets that are shooting at them.
      const t = turretTarget(e, from), dist = flatDist(e.pos, t.pos);
      e.yaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z));
      e.timer += dt; if (e.timer > T.strafeSwap) { e.dodge *= -1; e.timer = 0; }
      if (dist > 10) navigate(e, t.pos, T.speed.close, dt);
      else botMove(e, new THREE.Vector3(Math.cos(e.yaw) * e.dodge, 0, -Math.sin(e.yaw) * e.dodge).add(e.pos), T.speed.strafe, dt);
      e.yaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z));
      if (e.shot <= 0 && G.elapsed > G.protectUntil + .5) shootAt(e, t.pos.clone().setY(.6), dist);
    } else if (harassTarget(e)) {
      // Escort raiders go for the vehicle when no player is in sight.
      const prop = harassTarget(e), dist = flatDist(e.pos, prop.pos);
      if (dist > 13) navigate(e, prop.pos, T.speed.close, dt);
      else { e.timer += dt; if (e.timer > T.strafeSwap) { e.dodge *= -1; e.timer = 0; } botMove(e, new THREE.Vector3(Math.cos(e.yaw) * e.dodge, 0, -Math.sin(e.yaw) * e.dodge).add(e.pos), T.speed.strafe * .6, dt); }
      if (dist < 26) {
        e.yaw = Math.atan2(-(prop.pos.x - e.pos.x), -(prop.pos.z - e.pos.z));
        if (e.shot <= 0 && G.elapsed > G.protectUntil + .5 && canHit(from, prop.pos, prop.mover)) shootAt(e, prop.pos.clone(), dist);
      }
    } else if (e.memory > 0) {
      navigate(e, e.lastKnown, T.speed.search, dt);
      if (e.pos.distanceTo(e.lastKnown) < 1.5) e.yaw += dt * .75;
    } else {
      e.state = 'patrol';
      if (e.pos.distanceTo(e.dest) < .9) e.dest.copy(e.dest.distanceTo(e.home) < 1 ? e.patrol : e.home);
      navigate(e, e.dest, T.speed.patrol, dt);
    }
    poseEnemy(e, dt);
  }
}

/** Moves the model to the enemy's state: hover bob, rotors, sensor cone colour. */
export function poseEnemy(e, dt) {
  e.flash = Math.max(0, e.flash - dt);
  e.g.position.copy(e.pos); e.g.position.y = Math.sin(G.elapsed * 2.7 + e.id) * e.type.bob; e.g.rotation.y = e.yaw;
  for (const r of e.rotors) r.rotation.y += dt * 38;
  if (e.cone) e.cone.material.color.setHex(CONE_COLORS[e.state] ?? CONE_COLORS.patrol);
  e.type.pose?.(e, dt);
}

/** Serializable enemy state for checkpoints (and later, network sync). */
export function snapshotEnemies() {
  return G.enemies.map(e => ({ def: e.def, pos: [e.pos.x, e.pos.z], hp: e.hp, dead: e.dead }));
}
export function restoreEnemies(list) {
  for (const e of G.enemies) e.g.removeFromParent();
  G.enemies.length = 0;
  for (const s of list) {
    const e = addEnemy(s.def);
    e.pos.set(s.pos[0], 0, s.pos[1]); e.hp = s.hp; e.dead = s.dead; e.g.visible = !s.dead; e.g.position.copy(e.pos);
  }
}
