// Visual effects (purely cosmetic, run on every machine at frame rate):
// sparks, dust and smoke puffs, fireballs with debris and scorch marks, smoking machine wrecks,
// camera shake, the muzzle-flash light and ejected shell casings. Pools keep allocation flat;
// counts scale with the Graphics setting (low .4, medium 1, high 1.4).
import { THREE } from '../engine/three.js';
import { scene } from '../engine/render.js';
import { G } from './state.js';

const Q = { low: .4, medium: 1, high: 1.4 };
const q = () => Q[G.quality ?? 'medium'] ?? 1;
const live = [];                      // { obj, life, total, kind, v, spin, ... }
const add = (obj, life, kind, extra = {}) => { G.dynRoot.add(obj); live.push({ obj, life, total: life, kind, ...extra }); return obj; };

const sparkGeo = new THREE.BoxGeometry(.02, .02, .22);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
const puffGeo = new THREE.SphereGeometry(1, 8, 6);
const debrisGeo = new THREE.BoxGeometry(.18, .12, .14);
const debrisMat = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: .9 });
const charMat = new THREE.MeshStandardMaterial({ color: 0x1e1d1c, roughness: .95, metalness: .2 });
const scorchMat = new THREE.MeshBasicMaterial({ color: 0x0c0a08, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const scorchGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);

/** Hot sparks flying off a hit (machines, metal). */
export function sparks(pos, count = 6, color = 0xffd28a, power = 4) {
  const n = Math.round(count * q());
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, color === 0xffd28a ? sparkMat : new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    m.position.copy(pos);
    const v = new THREE.Vector3((Math.random() - .5) * power, Math.random() * power * .8, (Math.random() - .5) * power);
    add(m, .18 + Math.random() * .25, 'spark', { v });
  }
}
/** A soft puff: dust off the ground, or smoke (rising, longer, darker). */
export function puff(pos, { color = 0xb9b2a4, size = .35, grow = 1.4, life = .6, rise = .4, opacity = .45, drift = .3 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false, roughness: 1 });
  const m = new THREE.Mesh(puffGeo, mat); m.position.copy(pos); m.scale.setScalar(size);
  return add(m, life, 'puff', { size, grow, rise, opacity, v: new THREE.Vector3((Math.random() - .5) * drift, rise, (Math.random() - .5) * drift) });
}
export const dust = (pos, n = 2) => { for (let i = 0; i < Math.max(1, Math.round(n * q())); i++) puff(pos.clone().add(new THREE.Vector3((Math.random() - .5) * .2, .05, (Math.random() - .5) * .2)), { size: .12, grow: 3, life: .5 + Math.random() * .3, rise: .5 }); };
export const smoke = (pos, n = 3, big = 1) => { for (let i = 0; i < Math.max(1, Math.round(n * q())); i++) puff(pos.clone().add(new THREE.Vector3((Math.random() - .5) * big, Math.random() * .4, (Math.random() - .5) * big)), { color: 0x4a4744, size: .4 * big, grow: 2.2, life: 2.4 + Math.random() * 1.6, rise: .9, opacity: .5, drift: .5 }); };

/** The fireball of an explosion: flash sphere, sparks, debris, smoke, a scorch mark and shake. */
export function blastFx(p, scale = 1) {
  const ball = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffa34a, blending: THREE.AdditiveBlending, transparent: true, opacity: .9, depthWrite: false }));
  ball.position.copy(p).setY(Math.max(.5, p.y)); add(ball, .32, 'ball', { size: 2.6 * scale });
  sparks(p.clone().setY(Math.max(.3, p.y)), 14 * scale, 0xffb45a, 9);
  for (let i = 0; i < Math.round(8 * q() * scale); i++) {
    const d = new THREE.Mesh(debrisGeo, debrisMat); d.position.copy(p).setY(Math.max(.3, p.y));
    add(d, 1.6 + Math.random(), 'debris', { v: new THREE.Vector3((Math.random() - .5) * 9, 3 + Math.random() * 6, (Math.random() - .5) * 9), spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, 0) });
  }
  smoke(p.clone().setY(Math.max(.4, p.y)), 5, 1.4 * scale);
  if (p.y < 1.2) { const s = new THREE.Mesh(scorchGeo, scorchMat.clone()); s.position.set(p.x, .03, p.z); s.scale.setScalar((1.4 + Math.random() * .6) * scale); add(s, 18, 'scorch'); }
  if (G.local) shake(Math.max(0, 1 - G.local.pos.distanceTo(p) / 22) * .9 * scale);
}

/** A destroyed machine: a charred copy of its model drops, tilts and smokes, then sinks away. */
export function wreck(e) {
  if (!e?.g || q() < .5 && live.filter(l => l.kind === 'wreck').length >= 3) return;
  const old = live.filter(l => l.kind === 'wreck'); if (old.length >= 8) old[0].life = Math.min(old[0].life, .5);
  const c = e.g.clone(true);
  c.traverse(o => { if (o.isMesh) { o.material = charMat; o.castShadow = false; } else if (o.isLight) o.visible = false; });
  for (const o of [...c.children]) if (o.material?.transparent) o.visible = false;   // sensor cones, beams
  c.visible = true; c.position.copy(e.g.position); c.rotation.copy(e.g.rotation);
  const fall = Math.max(0, (e.type.hover ?? 0) + (e.elev > 1 ? e.elev : 0));
  add(c, 9, 'wreck', { fall, y0: c.position.y, tilt: new THREE.Vector3((Math.random() - .5) * .9, 0, (Math.random() - .5) * .9), t: 0, puffIn: 0, center: e.type.centerY ?? 1 });
  sparks(e.pos.clone().setY((e.type.centerY ?? 1) + (e.elev > 1 ? e.elev - (e.type.centerY ?? 1) : 0)), 12, 0xffc070, 6);
}

// ------------------------------------------------------------------ camera shake

let shakeAmt = 0;
export function shake(a) { shakeAmt = Math.min(1.2, Math.max(shakeAmt, a)); }
/** Small rotation offsets for the camera this frame. */
export function shakeOffset() {
  if (shakeAmt < .01) return null;
  const a = shakeAmt * .022;
  return { pitch: (Math.random() - .5) * a, yaw: (Math.random() - .5) * a, y: (Math.random() - .5) * a * 2 };
}

// ------------------------------------------------------------------ muzzle light and casings

let muzzleLight = null;
/** Created once at startup (a fixed light count avoids shader recompiles). */
export function setupVfx() {
  muzzleLight = new THREE.PointLight(0xffc27a, 0, 9, 2); scene.add(muzzleLight);
}
export function muzzleFlash(p) {
  if (!muzzleLight || !p?.local) return;
  const f = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  muzzleLight.position.set(p.pos.x + f.x * .8, p.eye - .05, p.pos.z + f.z * .8); muzzleLight.intensity = 7;
}
const casingGeo = new THREE.CylinderGeometry(.006, .006, .03, 6), brass = new THREE.MeshStandardMaterial({ color: 0xc8a046, metalness: .8, roughness: .35 });
const shellMat = new THREE.MeshStandardMaterial({ color: 0xb03a28, roughness: .5 });
/** A spent casing flicked out of the viewmodel's ejection port (view space). */
export function ejectCasing(rig, weapon, gun) {
  if (!rig || q() < .5 || ['arc', 'grenade', 'launcher', 'spistol'].includes(weapon)) return;
  const m = new THREE.Mesh(casingGeo, weapon === 'shotgun' ? shellMat : brass);
  if (weapon === 'shotgun') m.scale.set(2.2, 1.6, 2.2);
  m.position.set(.06, .05, -.12); if (gun) m.position.add(gun.position); rig.add(m);
  live.push({ obj: m, life: .55, total: .55, kind: 'casing', v: new THREE.Vector3(.9 + Math.random() * .5, 1.1 + Math.random() * .5, .25), spin: new THREE.Vector3(14, 3, 9) });
}

// ------------------------------------------------------------------ per frame

export function updateVfx(dt) {
  shakeAmt = Math.max(0, shakeAmt - dt * 2.4);
  if (muzzleLight && muzzleLight.intensity > 0) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 160);
  for (let i = live.length - 1; i >= 0; i--) {
    const l = live[i], o = l.obj, k = 1 - l.life / l.total;
    l.life -= dt;
    if (l.kind === 'spark') { l.v.y -= 14 * dt; o.position.addScaledVector(l.v, dt); o.lookAt(o.position.clone().add(l.v)); o.material.opacity = Math.max(0, l.life / l.total); }
    else if (l.kind === 'puff') { o.position.addScaledVector(l.v, dt); o.scale.setScalar(l.size * (1 + k * l.grow)); o.material.opacity = l.opacity * (1 - k); }
    else if (l.kind === 'ball') { o.scale.setScalar(.3 + k * l.size); o.material.opacity = .9 * (1 - k); }
    else if (l.kind === 'debris') {
      l.v.y -= 18 * dt; o.position.addScaledVector(l.v, dt); o.rotation.x += l.spin.x * dt; o.rotation.y += l.spin.y * dt;
      if (o.position.y < .06) { o.position.y = .06; l.v.multiplyScalar(.35); l.v.y = Math.abs(l.v.y) * .3; l.spin.multiplyScalar(.5); }
    } else if (l.kind === 'scorch') o.material.opacity = .55 * Math.min(1, l.life / 4);
    else if (l.kind === 'casing') { l.v.y -= 9 * dt; o.position.addScaledVector(l.v, dt); o.rotation.x += l.spin.x * dt; o.rotation.z += l.spin.z * dt; }
    else if (l.kind === 'wreck') {
      l.t += dt;
      const drop = Math.min(1, l.t / .5);
      o.position.y = l.y0 - l.fall * drop * drop - (l.life < 2 ? (2 - l.life) * .6 : 0);    // falls, then sinks away at the end
      o.rotation.x = l.tilt.x * drop; o.rotation.z = l.tilt.z * drop;
      if ((l.puffIn -= dt) <= 0 && l.life > 2) { l.puffIn = q() < .5 ? .9 : .35; puff(o.position.clone().setY(o.position.y + l.center * .8 + .3), { color: 0x3a3836, size: .3, grow: 2.6, life: 2.2, rise: 1.1, opacity: .45, drift: .4 }); }
    }
    if (l.life <= 0) {
      o.removeFromParent();
      if (l.kind === 'puff' || l.kind === 'ball' || l.kind === 'scorch' || (l.kind === 'spark' && o.material !== sparkMat)) o.material.dispose();
      live.splice(i, 1);
    }
  }
}
export const vfxCount = kind => kind ? live.filter(l => l.kind === kind).length : live.length;
export function clearVfx() { for (const l of live) l.obj.removeFromParent(); live.length = 0; shakeAmt = 0; }
