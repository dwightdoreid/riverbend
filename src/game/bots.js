// Enemy robots. Each enemy type is a model + tuning entry; the AI picks a target from all
// living players, so the same code drives solo and co-op.
import { THREE } from '../engine/three.js';
import { box, cyl, rod } from '../engine/builders.js';
import { G } from './state.js';
import { moveBlocked, los, freePoint } from './world.js';
import { eyeOf } from './players.js';
import { projectile } from './combat.js';
import { sfxAt } from './fx.js';
import { feed } from '../ui/hud.js';

export const ENEMY_TYPES = {
  sentry: {
    name: 'Sentry', hp: 90,
    speed: { patrol: 1.2, search: 2.0, close: 1.8, retreat: 1.7, strafe: 1.1 },
    sight: { stand: 32, crouch: 24, crouchStill: 18, fov: .25 },
    range: { far: 20, near: 8 },
    gun: { speed: 44, damage: 9, cooldown: [1.05, .75], spread: [.017, .18] },
    build(g, bodyMat) {
      box(g, 0, 1.2, 0, .76, .65, .5, bodyMat); box(g, 0, 1.73, 0, .52, .39, .42, 'dark');
      box(g, 0, 1.77, -.22, .3, .12, .035, new THREE.MeshStandardMaterial({ color: 0xed9d56, emissive: 0xf47c38, emissiveIntensity: .8 }));
      for (const x of [-.55, .55]) { box(g, x, 1.35, 0, .29, .27, .6, 'edge'); const pod = cyl(g, x, 1.15, 0, .19, .19, .1, 'dark', 8); pod.rotation.x = Math.PI / 2; }
      rod(g, [.27, 1.19, -.2], [.27, 1.19, -.65], .065, 'dark', 8); cyl(g, 0, .81, 0, .22, .26, .25, 'edge');
    },
    color: 0x9a744f,
  },
};

export function spawnEnemies(defs) {
  G.enemies.length = 0;
  defs.forEach((def, i) => {
    const type = ENEMY_TYPES[def.type];
    const g = new THREE.Group(); G.dynRoot.add(g);
    const bodyMat = new THREE.MeshStandardMaterial({ color: type.color, metalness: .55, roughness: .5 });
    type.build(g, bodyMat);
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const home = freePoint(...def.at), patrol = freePoint(...def.patrol);
    const e = {
      id: i, type, g, mat: bodyMat, pos: home.clone(), home, patrol, dest: patrol.clone(),
      hp: type.hp, yaw: Math.PI * (i % 2), state: 'patrol', timer: 0, lastKnown: new THREE.Vector3(), memory: 0,
      shot: 1 + i * .17, sense: i * .027, visible: false, seenAt: -99, flash: 0, dead: false, dodge: i % 2 ? 1 : -1, target: null,
    };
    g.position.copy(e.pos);
    G.enemies.push(e);
  });
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

/** Can enemy e see player p right now? */
function canSee(e, from, p) {
  const to = eyeOf(p), dist = from.distanceTo(to), t = e.type.sight;
  const dir = to.clone().sub(from).normalize(), forward = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw));
  const reach = p.crouched && !p.moving ? t.crouchStill : p.crouched ? t.crouch : t.stand;
  return dist < reach && (e.state === 'engage' || e.memory > 0 || dir.dot(forward) > t.fov) && los(from, to) ? dist : -1;
}

export function updateBots(dt) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const T = e.type;
    e.shot -= dt; e.memory = Math.max(0, e.memory - dt); e.flash = Math.max(0, e.flash - dt);
    e.mat.emissive.setHex(e.flash > 0 ? 0x9c532c : 0x000000);
    if (e.target && !e.target.alive) { e.target = null; e.visible = false; }
    const from = e.pos.clone().add(new THREE.Vector3(0, 1.72, 0));

    e.sense -= dt;
    if (e.sense <= 0) {
      e.sense = .21;
      // Keep the current target while it stays visible; otherwise pick the nearest visible player.
      let best = null, bestD = Infinity;
      for (const p of G.players) {
        if (!p.alive) continue;
        const d = canSee(e, from, p);
        if (d >= 0 && (p === e.target ? -1 : d) < bestD) { best = p; bestD = p === e.target ? -1 : d; }
      }
      e.visible = !!best;
      if (best) {
        if (e.state !== 'engage') { e.shot = Math.max(e.shot, .85); feed('Sentry acquired ' + (best.local ? 'your' : best.name + "'s") + ' position.'); }
        e.state = 'engage'; e.target = best; e.lastKnown.copy(best.pos); e.memory = 7; e.seenAt = G.elapsed;
      } else if (e.state === 'engage') { e.state = 'search'; e.memory = Math.max(3, e.memory); }
    }

    const t = e.target;
    if (e.state === 'engage' && e.visible && t) {
      const eye = eyeOf(t), dist = from.distanceTo(eye);
      const face = () => { e.yaw = Math.atan2(-(t.pos.x - e.pos.x), -(t.pos.z - e.pos.z)); };
      face();
      if (dist > T.range.far) botMove(e, t.pos, T.speed.close, dt);
      else if (dist < T.range.near) botMove(e, e.pos.clone().sub(t.pos).normalize().multiplyScalar(5).add(e.pos), T.speed.retreat, dt);
      else {
        e.timer += dt; if (e.timer > 1.7) { e.dodge *= -1; e.timer = 0; }
        botMove(e, new THREE.Vector3(Math.cos(e.yaw) * e.dodge, 0, -Math.sin(e.yaw) * e.dodge).add(e.pos), T.speed.strafe, dt);
      }
      face();
      if (e.shot <= 0 && G.elapsed > 3) {
        const origin = e.pos.clone().add(new THREE.Vector3(.18, 1.35, 0)), aim = eye.clone();
        aim.y -= t.crouched ? .1 : .28;
        const inaccuracy = dist * T.gun.spread[0] + T.gun.spread[1];
        aim.x += (Math.random() - .5) * inaccuracy * 2; aim.y += (Math.random() - .5) * inaccuracy;
        projectile(origin, aim.sub(origin).normalize(), T.gun.speed, T.gun.damage, null);
        e.shot = T.gun.cooldown[0] + Math.random() * T.gun.cooldown[1];
        sfxAt(e.pos, 'shot', .1, 100, .2);
      }
    } else if (e.memory > 0) {
      botMove(e, e.lastKnown, T.speed.search, dt);
      if (e.pos.distanceTo(e.lastKnown) < 1.5) e.yaw += dt * .75;
    } else {
      e.state = 'patrol';
      if (e.pos.distanceTo(e.dest) < .9) e.dest.copy(e.dest.distanceTo(e.home) < 1 ? e.patrol : e.home);
      botMove(e, e.dest, T.speed.patrol, dt);
    }
    e.g.position.copy(e.pos); e.g.position.y = Math.sin(G.elapsed * 2.7 + e.id) * .075; e.g.rotation.y = e.yaw;
  }
}
