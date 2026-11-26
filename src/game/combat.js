// Projectiles, grenades, damage and hit effects.
import { THREE } from '../engine/three.js';
import { geo } from '../engine/builders.js';
import { G } from './state.js';
import { world, castSolid, los, testRay, freePoint } from './world.js';
import { eyeOf, isActive } from './players.js';
import { sound } from '../engine/audio.js';
import { sfxFor, sfxAt, tell } from './fx.js';
import { feed, showHit, showDamage } from '../ui/hud.js';
import { isHost, fxAll, fxTo } from '../net/net.js';
import { finish } from './flow.js';

const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe6a5 }), hostileMat = new THREE.MeshBasicMaterial({ color: 0xfc7655 });
const fxGeo = geo('box', 1, 1, 1), fxMats = {};

const r2 = v => Math.round(v * 100) / 100;

/** owner: the player who fired, or null for hostile (enemy) fire.
 *  visual: a client-side copy that only draws (the host decides what real shots hit). */
export function projectile(origin, dir, speed, damage, owner = null, visual = false) {
  const hostile = !owner;
  if (!visual && isHost()) fxAll({ t: 'shot', o: origin.toArray().map(r2), d: dir.toArray().map(v => Math.round(v * 1e4) / 1e4), s: speed, h: hostile ? 1 : 0, by: owner ? owner.id : -1 }, owner && !owner.local ? owner.id : null);
  const m = new THREE.Mesh(geo('sphere', .035, 5, 4), hostile ? hostileMat : bulletMat);
  m.position.copy(origin); G.dynRoot.add(m);
  G.projectiles.push({ pos: origin.clone(), vel: dir.clone().multiplyScalar(speed), damage, hostile, owner, visual, life: 1.6, mesh: m });
}

export function alertNoise(pos, r) {
  for (const e of G.enemies) if (!e.dead && e.pos.distanceTo(pos) < r) {
    e.lastKnown.copy(pos); e.memory = Math.max(e.memory, 6);
    if (e.state === 'patrol') { e.state = 'investigate'; e.timer = .4; }
  }
}

export function damageEnemy(e, amount, head = false, attacker = null) {
  if (e.dead) return;
  e.hp -= amount; e.flash = .13; e.state = 'engage'; e.memory = 7; e.shot = Math.max(e.shot, .4);
  if (attacker) { e.lastKnown.copy(attacker.pos); e.target = attacker; }
  const kill = e.hp <= 0;
  if (attacker?.local) { showHit(kill); sound('hit', .6); }
  else if (attacker) fxTo(attacker.id, { t: 'hit', kill });
  if (kill) {
    e.dead = true; e.g.visible = false;
    if (attacker) attacker.stats.kills++;
    const at = e.pos.clone().add(new THREE.Vector3(0, e.type.centerY, 0));
    burst(at, 0xc3be9e, 14, 3); fxAll({ t: 'burst', p: at.toArray().map(r2), c: 0xc3be9e, n: 14, pw: 3 });
    feed(e.type.name + ' disabled' + (head ? ' · sensor hit' : ''));
  } else if (head) feed('Sensor hit');
}

export const BLEED_OUT = 30, RESPAWN_DELAY = 20, REVIVE_HEALTH = 40;

export function hurt(p, amount, source) {
  if (G.status !== 'playing' || !isActive(p) || G.elapsed < G.protectUntil || G.elapsed < p.protectUntil) return;
  p.health = Math.max(0, p.health - amount); p.stats.damage += amount;
  sfxFor(p, 'hurt');
  if (p.local) showDamage(p, source);
  else fxTo(p.id, { t: 'dmg', src: source ? [r2(source.x), r2(source.z)] : null });
  if (p.health > 0) return;
  if (G.players.length === 1) {
    // Solo: one automatic stim per checkpoint, then the mission fails.
    if (p.stims > 0) {
      p.stims--; p.health = 50; p.protectUntil = G.elapsed + 1.5;
      feed('Auto-stim injected'); tell(p, 'Stim used. Get to cover!', 3);
      return;
    }
    p.alive = false; finish(false); return;
  }
  // Co-op: go down; a teammate can revive you before you bleed out.
  p.downed = true; p.bleed = BLEED_OUT; p.health = 0;
  feed(p.name + ' is down');
  checkTeamWipe();
}

function checkTeamWipe() {
  if (!G.players.some(isActive)) finish(false);
}

export function revive(p, by) {
  p.downed = false; p.health = REVIVE_HEALTH; p.protectUntil = G.elapsed + 1.5;
  feed(by.name + ' revived ' + p.name);
  sfxFor(p, 'objective'); sfxFor(by, 'objective');
}

/** Host: bleed-out timers and respawns for co-op. */
export function updateDowned(dt) {
  for (const p of G.players) {
    if (p.downed) {
      p.bleed -= dt;
      if (p.bleed <= 0) {
        p.downed = false; p.alive = false; p.respawnAt = G.elapsed + RESPAWN_DELAY;
        feed(p.name + ' bled out · back in ' + RESPAWN_DELAY + 's');
        checkTeamWipe();
        if (G.status !== 'playing') return;
      }
    } else if (!p.alive && G.players.length > 1 && G.elapsed >= p.respawnAt) {
      const mate = G.players.find(isActive);
      if (!mate) continue;
      const spot = freePoint(mate.pos.x + 1.2, mate.pos.z + 1.2);
      p.alive = true; p.health = 100; p.protectUntil = G.elapsed + 2.5; p.pos.copy(spot);
      if (p.local) p.eye = 1.72; else fxTo(p.id, { t: 'tp', x: spot.x, z: spot.z });
      feed(p.name + ' is back in');
    }
  }
}

export function burst(pos, color, count = 7, power = 1) {
  const k = String(color);
  if (!fxMats[k]) fxMats[k] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(fxGeo, fxMats[k]); m.scale.setScalar(.025 + Math.random() * .07); m.position.copy(pos); G.dynRoot.add(m);
    G.effects.push({ m, v: new THREE.Vector3((Math.random() - .5) * power, (Math.random() * .8 + .25) * power, (Math.random() - .5) * power), life: .25 + Math.random() * .45, total: .7 });
  }
}

function impact(p) {
  burst(p, 0xe3cb9b, 3, 1.4);
  if (G.decals.length > 28) { const old = G.decals.shift(); old.removeFromParent(); old.material.dispose(); }
  const m = new THREE.Mesh(geo('sphere', .045, 5, 4), new THREE.MeshBasicMaterial({ color: 0x3e4540 }));
  m.position.copy(p); G.dynRoot.add(m); G.decals.push(m);
}

const sphere = new THREE.Sphere(), tmp = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export function updateProjectiles(dt) {
  const cullX = world.bounds.x + 53, cullZ = world.bounds.z + 63.5;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i], delta = p.vel.clone().multiplyScalar(dt), distance = delta.length(), dir = delta.clone().normalize();
    const wall = castSolid(p.pos, dir, distance);
    let nearest = wall ? wall.distance : distance + .01, victim = null, head = false;
    testRay.set(p.pos, dir);
    if (!p.hostile) {
      for (const e of G.enemies) {
        if (e.dead) continue;
        for (const part of e.type.hitParts) {
          tmp.set(0, 0, part.z ?? 0).applyAxisAngle(UP, e.yaw).add(e.pos); tmp.y = part.y;
          sphere.set(tmp, part.r);
          const hit = testRay.intersectSphere(sphere, new THREE.Vector3());
          if (hit) { const d = hit.distanceTo(p.pos); if (d < nearest && d <= distance) { nearest = d; victim = e; head = part.head; } }
        }
      }
    } else {
      for (const pl of G.players) {
        if (!isActive(pl)) continue;
        sphere.set(tmp.set(pl.pos.x, pl.eye * .66, pl.pos.z), pl.crouched ? .53 : .67);
        const hit = testRay.intersectSphere(sphere, new THREE.Vector3());
        if (hit) { const d = hit.distanceTo(p.pos); if (d < nearest && d <= distance) { nearest = d; victim = pl; } }
      }
    }
    if (victim || wall) {
      const h = p.pos.clone().addScaledVector(dir, nearest);
      if (p.visual) { if (victim && !p.hostile) burst(h, 0xd7c599, 4, 1.3); else if (!victim) impact(wall.point); }
      else if (p.hostile && victim) hurt(victim, p.damage, p.pos);
      else if (victim) { p.owner.stats.hits++; damageEnemy(victim, p.damage * (head ? 1.55 : 1), head, p.owner); burst(h, 0xd7c599, 4, 1.3); }
      else { impact(wall.point); if (wall.mover?.onHit && !p.visual) wall.mover.onHit(p.damage, p.hostile); }
      p.mesh.removeFromParent(); G.projectiles.splice(i, 1); continue;
    }
    p.pos.add(delta); p.vel.y -= 1.5 * dt; p.mesh.position.copy(p.pos); p.life -= dt;
    if (p.life <= 0 || p.pos.y < .1 || Math.abs(p.pos.x) > cullX || Math.abs(p.pos.z) > cullZ) { p.mesh.removeFromParent(); G.projectiles.splice(i, 1); }
  }
}

export function updateBombs(dt) {
  for (let i = G.bombs.length - 1; i >= 0; i--) {
    const b = G.bombs[i];
    b.fuse -= dt; b.vel.y -= 12 * dt;
    const delta = b.vel.clone().multiplyScalar(dt), len = delta.length(), hit = len > 0 ? castSolid(b.pos, delta.clone().normalize(), len + .085) : null;
    if (hit) {
      const normal = new THREE.Vector3(0, 1, 0);
      if (hit.box) {
        const q = hit.point, bb = hit.box;
        const faces = [
          { d: Math.abs(q.x - bb.min.x), n: [-1, 0, 0] }, { d: Math.abs(q.x - bb.max.x), n: [1, 0, 0] },
          { d: Math.abs(q.y - bb.min.y), n: [0, -1, 0] }, { d: Math.abs(q.y - bb.max.y), n: [0, 1, 0] },
          { d: Math.abs(q.z - bb.min.z), n: [0, 0, -1] }, { d: Math.abs(q.z - bb.max.z), n: [0, 0, 1] },
        ];
        faces.sort((a, c) => a.d - c.d); normal.set(...faces[0].n);
      }
      b.pos.copy(hit.point).addScaledVector(normal, .095); b.vel.reflect(normal).multiplyScalar(.46);
      if (normal.y > .5) { b.vel.x *= .76; b.vel.z *= .76; if (Math.abs(b.vel.y) < .5) b.vel.y = 0; }
    } else b.pos.add(delta);
    b.pos.x = THREE.MathUtils.clamp(b.pos.x, -(world.bounds.x + 1), world.bounds.x + 1);
    b.pos.z = THREE.MathUtils.clamp(b.pos.z, -(world.bounds.z + .5), world.bounds.z + .5);
    b.g.position.copy(b.pos); b.g.rotation.x += b.spin * dt; b.g.rotation.z += dt * 2;
    if (b.fuse <= 0) { explode(b); G.bombs.splice(i, 1); }
  }
}

/** The visible and audible part of an explosion (also used by co-op clients). */
export function explosionFx(p) {
  burst(p, 0xffc076, 36, 8);
  const light = new THREE.PointLight(0xffb75a, 10, 15, 2); light.position.copy(p); G.dynRoot.add(light); G.effects.push({ light, life: .14, total: .14 });
  const ring = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb95a, transparent: true, opacity: .3, wireframe: true }));
  ring.position.copy(p); G.dynRoot.add(ring); G.effects.push({ ring, life: .32, total: .32 });
  sfxAt(p, 'blast', 1, 85, .15);
}

function explode(b) {
  const p = b.pos.clone(), radius = 8, lift = p.clone().add(new THREE.Vector3(0, .18, 0));
  explosionFx(p); fxAll({ t: 'boom', p: p.toArray().map(r2) });
  for (const e of G.enemies) {
    if (e.dead) continue;
    const target = e.pos.clone().add(new THREE.Vector3(0, e.type.centerY, 0)), d = target.distanceTo(p);
    if (d < radius && los(lift, target)) damageEnemy(e, 150 * (1 - d / radius), false, b.owner);
  }
  for (const pl of G.players) {
    if (!isActive(pl)) continue;
    const eye = eyeOf(pl), d = eye.distanceTo(p);
    if (d < radius && los(lift, eye)) hurt(pl, 115 * (1 - d / radius), p);
  }
  alertNoise(p, 55);
  b.g.removeFromParent();
}

export function updateEffects(dt) {
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const e = G.effects[i]; e.life -= dt;
    if (e.m) { e.v.y -= 5 * dt; e.m.position.addScaledVector(e.v, dt); e.m.rotation.x += dt * 6; }
    if (e.light) e.light.intensity = 10 * Math.max(0, e.life / e.total);
    if (e.ring) { e.ring.scale.setScalar(1 + (1 - e.life / e.total) * 7); e.ring.material.opacity = Math.max(0, e.life / e.total) * .28; }
    if (e.life <= 0) { (e.m || e.light || e.ring).removeFromParent(); if (e.ring) e.ring.material.dispose(); G.effects.splice(i, 1); }
  }
}

export function clearCombat() {
  for (const p of G.projectiles) p.mesh.removeFromParent();
  for (const b of G.bombs) b.g.removeFromParent();
  for (const e of G.effects) { (e.m || e.light || e.ring).removeFromParent(); if (e.ring) e.ring.material.dispose(); }
  for (const d of G.decals) { d.removeFromParent(); d.material.dispose(); }
  G.projectiles.length = G.bombs.length = G.effects.length = G.decals.length = 0;
}
