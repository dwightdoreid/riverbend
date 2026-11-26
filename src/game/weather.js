// Weather: wind, lightning and rain. Missions opt in with
//   weather: { wind: { dir: radians, base: m/s, gust: m/s }, lightning: { every: [min, max], radius, damage }, rain: true }
// Wind strength is a deterministic function of mission time, so co-op clients agree on it with
// no extra network data. Lightning strikes are chosen by the host and broadcast.
import { THREE } from '../engine/three.js';
import { hemi } from '../engine/render.js';
import { G } from './state.js';
import { isActive } from './players.js';
import { hurt, damageEnemy, burst } from './combat.js';
import { warnRing } from './bosses.js';
import { sound } from '../engine/audio.js';
import { feed } from '../ui/hud.js';
import { fxAll, isClient } from '../net/net.js';

const cfg = () => G.mission?.weather;
const v = new THREE.Vector3();

/** Current wind as a ground-plane vector in m/s (zero when the mission has no wind). */
export function windVec() {
  const w = cfg()?.wind; if (!w) return v.set(0, 0, 0);
  const t = G.elapsed, gust = Math.max(0, Math.sin(t * .37) + .6 * Math.sin(t * 1.13 + 1.7));
  const s = w.base + w.gust * gust / 1.6, d = w.dir + Math.sin(t * .11) * .25;
  return v.set(Math.sin(d) * s, 0, Math.cos(d) * s);
}
export const windSpeed = () => windVec().length();

let rain = null, flashLeft = 0, baseHemi = null;

export function setupWeather() {
  rain = null; flashLeft = 0; baseHemi = null;
  G.strikes = []; G.nextStrike = (cfg()?.lightning?.every?.[0] ?? 8);
  if (cfg()?.rain) {
    const N = 1400, pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (Math.random() - .5) * 60, y = Math.random() * 26, z = (Math.random() - .5) * 60; pos.set([x, y, z, x, y - .7, z], i * 6); }
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: 0xa9b8c4, transparent: true, opacity: .35 }));
    rain.frustumCulled = false; G.dynRoot.add(rain);
  }
}

const BOLT_MAT = new THREE.MeshBasicMaterial({ color: 0xf2f6ff });

/** Visual (and on the host, damage) of a lightning strike at (x, z). */
export function lightningStrike(x, z, host = !isClient()) {
  const c = cfg()?.lightning ?? {}, r = c.radius ?? 4.5;
  // Jagged bolt: a few offset segments from the cloud base to the ground.
  let px = x + (Math.random() - .5) * 4, py = 42, pzz = z + (Math.random() - .5) * 4;
  for (let i = 0; i < 6; i++) {
    const ny = i === 5 ? 0 : py - 7 - Math.random() * 3, nx = i === 5 ? x : x + (Math.random() - .5) * 3, nz = i === 5 ? z : z + (Math.random() - .5) * 3;
    const a = new THREE.Vector3(px, py, pzz), b = new THREE.Vector3(nx, ny, nz), len = a.distanceTo(b);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(.18, len, .18), BOLT_MAT);
    seg.position.copy(a).add(b).multiplyScalar(.5); seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    G.dynRoot.add(seg); G.effects.push({ m: seg, v: new THREE.Vector3(), life: .22, total: .22, still: true });
    px = nx; py = ny; pzz = nz;
  }
  burst(new THREE.Vector3(x, .4, z), 0xcfe6ff, 30, 6);
  flash(1);
  if (G.local) sound('blast', Math.max(.25, 1 - G.local.pos.distanceTo(new THREE.Vector3(x, 0, z)) / 90));
  if (!host) return;
  fxAll({ t: 'strike', p: [x, z] });
  const at = new THREE.Vector3(x, 1, z);
  for (const p of G.players) if (isActive(p)) { const d = Math.hypot(p.pos.x - x, p.pos.z - z); if (d < r) hurt(p, (c.damage ?? 55) * (1 - d / r) + 12, at); }
  for (const e of G.enemies) if (!e.dead && Math.hypot(e.pos.x - x, e.pos.z - z) < r) damageEnemy(e, 140, false, null, { explosive: true });
}

/** Brief whole-scene flash (sky lightning). */
export function flash(strength = .6) {
  flashLeft = Math.max(flashLeft, .12 + strength * .1);
  const el = document.getElementById('flash'); if (el) { el.style.opacity = String(.25 * strength); }
}

export function updateWeather(dt) {
  const c = cfg();
  // Rain falls with the wind and follows the camera.
  if (rain && G.local) {
    const w = windVec(), arr = rain.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 6) {
      arr[i + 1] -= 22 * dt; arr[i] += w.x * dt * .6; arr[i + 2] += w.z * dt * .6;
      if (arr[i + 1] < 0) { arr[i] = (Math.random() - .5) * 60; arr[i + 1] = 24 + Math.random() * 4; arr[i + 2] = (Math.random() - .5) * 60; }
      arr[i + 3] = arr[i] - w.x * .05; arr[i + 4] = arr[i + 1] - .7; arr[i + 5] = arr[i + 2] - w.z * .05;
    }
    rain.geometry.attributes.position.needsUpdate = true;
    rain.position.set(G.local.pos.x, 0, G.local.pos.z);
  }
  // Ambient sky flashes (local, cosmetic).
  if (c?.lightning && Math.random() < dt * .08) flash(.35);
  baseHemi ??= hemi.intensity;
  if (flashLeft > 0) { flashLeft -= dt; hemi.intensity = baseHemi * (1 + flashLeft * 18); if (flashLeft <= 0) { hemi.intensity = baseHemi; const el = document.getElementById('flash'); if (el) el.style.opacity = '0'; } }
  // Lightning strikes (host decides; warning ring first).
  if (!c?.lightning || isClient() || G.status !== 'playing') return;
  G.nextStrike -= dt;
  for (let i = G.strikes.length - 1; i >= 0; i--) {
    const s = G.strikes[i]; s.t -= dt;
    if (s.t <= 0) { G.strikes.splice(i, 1); lightningStrike(s.x, s.z); }
  }
  if (G.nextStrike <= 0) {
    const [lo, hi] = c.lightning.every ?? [8, 13];
    G.nextStrike = lo + Math.random() * (hi - lo);
    const players = G.players.filter(isActive), tall = c.lightning.tall ?? [];
    let x, z;
    if (players.length && Math.random() < .6) { const p = players[Math.floor(Math.random() * players.length)]; x = p.pos.x + (Math.random() - .5) * 3; z = p.pos.z + (Math.random() - .5) * 3; }
    else if (tall.length) { [x, z] = tall[Math.floor(Math.random() * tall.length)]; x += (Math.random() - .5) * 6; z += (Math.random() - .5) * 6; }
    else return;
    warnRing(x, z, 1.4); fxAll({ t: 'mortar', p: [x, z], life: 1.4 });
    G.strikes.push({ x, z, t: 1.4 });
    if (Math.random() < .3) feed('Lightning!');
  }
}

export function resetWeatherLight() { if (baseHemi !== null) hemi.intensity = baseHemi; baseHemi = null; }
