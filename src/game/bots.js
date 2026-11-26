// Enemy machines. Each enemy type is a model + tuning entry; the AI picks a target from all
// living players, so the same code drives solo and co-op.
import { THREE } from '../engine/three.js';
import { box, cyl, rod } from '../engine/builders.js';
import { G } from './state.js';
import { moveBlocked, los, freePoint } from './world.js';
import { eyeOf, isActive } from './players.js';
import { isHost, isClient, fxAll } from '../net/net.js';
import { projectile } from './combat.js';
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
  m.position.y = T.eyeY; m.renderOrder = 2;
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
    id: i, def, type: T, g, mat: bodyMat, rotors, cone, pos: home.clone(), home, patrol, dest: patrol.clone(),
    hp: T.hp * hpScale(), yaw: Math.PI * (i % 2), state: 'patrol', timer: 0, lastKnown: new THREE.Vector3(), memory: 0,
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
const hpScale = () => isClient() ? 1 : 1 + .4 * (G.players.length - 1);

export function spawnEnemies(defs) {
  G.enemies.length = 0;
  for (const def of defs) addEnemy(def);
}

function botMove(e, target, speed, dt) {
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
function navigate(e, target, speed, dt) {
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

function nearestPlayer(pos) {
  let best = null, bestD = Infinity;
  for (const p of G.players) if (isActive(p)) { const d = p.pos.distanceTo(pos); if (d < bestD) { best = p; bestD = d; } }
  return best;
}

/** Distance at which enemy e can see player p right now, or -1 if it can't. */
function canSee(e, from, p) {
  const to = eyeOf(p), dist = from.distanceTo(to), t = e.type.sight;
  const exposed = p.flashlight || litAt(p.pos);           // light makes you visible in the dark
  const scale = exposed ? 1 : (G.env.sightScale ?? 1);
  const reach = (p.crouched && !p.moving ? t.crouchStill : p.crouched ? t.crouch : t.stand) * scale;
  if (dist >= reach) return -1;
  const dir = to.clone().sub(from).normalize(), forward = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
  const aware = e.state === 'engage' || e.memory > 0 || (p.flashlight && G.env.dark) || dir.dot(forward) > t.fov;
  return aware && los(from, to) ? dist : -1;
}

const CONE_COLORS = { patrol: 0xf3a55a, investigate: 0xf3d35a, search: 0xf3d35a, engage: 0xff5a3a };

export function updateBots(dt) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const T = e.type;
    e.shot -= dt; e.memory = Math.max(0, e.memory - dt);
    e.mat.emissive.setHex(e.flash > 0 ? 0x9c532c : 0x000000);
    if (e.target && !isActive(e.target)) { e.target = null; e.visible = false; }
    const from = e.pos.clone().add(new THREE.Vector3(0, T.eyeY, 0));

    e.sense -= dt;
    if (e.sense <= 0) {
      e.sense = .21;
      // Keep the current target while it stays visible; otherwise pick the nearest visible player.
      let best = null, bestD = Infinity;
      for (const p of G.players) {
        if (!isActive(p)) continue;
        const d = canSee(e, from, p);
        const score = p === e.target ? -1 : d;
        if (d >= 0 && score < bestD) { best = p; bestD = score; }
      }
      e.visible = !!best;
      if (best) {
        if (e.state !== 'engage') { e.shot = Math.max(e.shot, .85); feed(T.name + ' acquired ' + (best.local ? 'your' : best.name + "'s") + ' position.'); }
        e.state = 'engage'; e.target = best; e.lastKnown.copy(best.pos); e.memory = 7; e.seenAt = G.elapsed;
      } else if (e.state === 'engage') { e.state = 'search'; e.memory = Math.max(3, e.memory); }
    }

    if (e.hunt && e.state !== 'engage') {
      const p = nearestPlayer(e.pos);
      if (p) { e.lastKnown.copy(p.pos); e.memory = Math.max(e.memory, 4); if (e.state === 'patrol') e.state = 'search'; }
    }

    const t = e.target;
    if (e.state === 'engage' && e.visible && t) {
      const eye = eyeOf(t), dist = from.distanceTo(eye);
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
        const m = T.muzzle, origin = e.pos.clone().add(new THREE.Vector3(m[0], m[1], m[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), e.yaw));
        const aim = eye.clone(); aim.y -= t.crouched ? .1 : .28;
        const inaccuracy = dist * T.gun.spread[0] + T.gun.spread[1];
        aim.x += (Math.random() - .5) * inaccuracy * 2; aim.y += (Math.random() - .5) * inaccuracy;
        projectile(origin, aim.sub(origin).normalize(), T.gun.speed, T.gun.damage, null);
        e.shot = T.gun.cooldown[0] + Math.random() * T.gun.cooldown[1];
        sfxAt(e.pos, T.gun.sound, .1, 100, .2);
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
