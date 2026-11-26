// In-game HUD for the local player: toasts, kill feed, health/ammo, minimap, objective marker.
import { THREE } from '../engine/three.js';
import { $, coarse } from '../engine/dom.js';
import { camera } from '../engine/render.js';
import { G } from '../game/state.js';
import { world } from '../game/world.js';
import { WEAPONS } from '../game/weapons.js';
import { spreadOf } from '../game/players.js';
import { currentObjective, objectivePos } from '../game/mission.js';

const ui = { toastLeft: 0, hitLeft: 0, damageFlash: 0 };

export function say(text, time = 3) { $('toast').textContent = text; ui.toastLeft = time; $('toast').style.opacity = 1; }
export function feed(text) { G.messages.unshift({ text, t: 4 }); if (G.messages.length > 3) G.messages.pop(); }

export function showHit(kill) {
  ui.hitLeft = .15; $('hitmarker').classList.toggle('kill', kill);
}
export function showDamage(p, source) {
  ui.damageFlash = .7;
  if (source) { const d = source.clone().sub(p.pos), angle = Math.atan2(d.x, -d.z) + p.yaw; $('damageArrow').style.transform = 'rotate(' + angle + 'rad)'; }
  $('health').textContent = Math.ceil(p.health);
}
export function resetHUD() { ui.toastLeft = ui.hitLeft = ui.damageFlash = 0; }

function healthDisplay(p) {
  $('health').textContent = Math.ceil(p.health); $('healthFill').style.width = p.health + '%';
  $('healthFill').style.background = p.health < 30 ? '#f48c72' : '#b7d7bf';
  $('lowhealth').style.boxShadow = 'inset 0 0 95px ' + (p.health < 30 ? '#a33b2233' : '#a33b2200');
}

export function updateHUD() {
  const p = G.local; if (!p) return;
  const obj = currentObjective();
  if (obj) { $('objectiveTitle').textContent = obj.name; $('objectiveSub').textContent = obj.sub; }
  $('aimBtn').classList.toggle('primary', p.aiming); $('crouchBtn').classList.toggle('primary', p.crouched);
  healthDisplay(p);
  const w = WEAPONS[p.weapon], a = p.ammo[p.weapon];
  $('weaponName').textContent = w ? w.name : 'FRAG / GRENADE';
  $('ammoBig').innerHTML = w ? a.mag + ' <span>/ ' + a.reserve + '</span>' : p.grenades + ' <span>THROWABLES</span>';
  $('weaponInfo').textContent = (w ? w.mode : 'TIMED FUSE') + ' · GRENADES ' + p.grenades;
  document.querySelectorAll('[data-weapon]').forEach(b => b.classList.toggle('active', b.dataset.weapon === p.weapon));
}

export function updateInteractUI(p) {
  const c = p.interaction;
  $('interact').style.display = c ? 'block' : 'none';
  $('useBtn').style.display = c && coarse ? 'block' : 'none';
  if (!c) return;
  $('interactText').textContent = (coarse ? 'Hold INTERACT' : 'Hold E') + ' · ' + c.name;
  $('interactFill').style.width = Math.min(100, p.interactTime / c.time * 100) + '%';
}

const timeText = t => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
export { timeText };

export function updateUI(dt) {
  const p = G.local;
  ui.toastLeft = Math.max(0, ui.toastLeft - dt); $('toast').style.opacity = ui.toastLeft > 0 ? 1 : 0;
  ui.hitLeft = Math.max(0, ui.hitLeft - dt); $('hitmarker').style.opacity = ui.hitLeft > 0 ? 1 : 0;
  ui.damageFlash = Math.max(0, ui.damageFlash - dt * 1.5); $('damage').style.opacity = ui.damageFlash; $('damageArrow').style.opacity = ui.damageFlash > 0 ? 1 : 0;
  $('timer').textContent = timeText(G.elapsed);
  const yaw = (Math.round(-p.yaw * 180 / Math.PI) % 360 + 360) % 360, card = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(yaw / 45) % 8];
  $('compass').textContent = card + ' · ' + String(yaw).padStart(3, '0');
  const hot = G.enemies.filter(e => !e.dead && e.visible).length, search = G.enemies.some(e => !e.dead && e.memory > 0);
  $('threat').textContent = hot ? 'CONTACT ×' + hot : search ? 'SEARCHING' : 'QUIET'; $('threat').classList.toggle('hot', !!hot);
  $('reloadProgress').style.display = p.reloadLeft > 0 ? 'block' : 'none';
  if (p.reloadLeft > 0) $('reloadProgress').textContent = 'RELOADING ' + p.reloadLeft.toFixed(1) + 's';
  for (const m of G.messages) m.t -= dt;
  while (G.messages.length && G.messages.at(-1).t <= 0) G.messages.pop();
  $('feed').innerHTML = G.messages.map(x => '<div>' + x.text + '</div>').join('');
  healthDisplay(p);
  $('crosshair').style.setProperty('--gap', (5 + spreadOf(p) * 600) + 'px');
  $('crosshair').classList.toggle('aimed', p.aimBlend > .75);
  $('stance').textContent = p.sprinting ? 'SPRINTING' : p.crouched ? 'CROUCHED' : p.aiming ? 'AIMING' : 'STANDING';
  $('sprintFill').style.width = p.stamina + '%';
  updateInteractUI(p);
}

const mc = $('map').getContext('2d'), MW = 296, MH = 272;
export function drawMap() {
  const p = G.local, map = G.level.map;
  const mx = x => (x - map.min[0]) / (map.max[0] - map.min[0]) * MW, mz = z => (z - map.min[1]) / (map.max[1] - map.min[1]) * MH;
  mc.clearRect(0, 0, MW, MH); mc.fillStyle = '#172d35'; mc.fillRect(0, 0, MW, MH);
  const [[ox0, oz0], [ox1, oz1]] = map.outline;
  mc.strokeStyle = '#607a7d'; mc.lineWidth = 1; mc.strokeRect(mx(ox0), mz(oz0), mx(ox1) - mx(ox0), mz(oz1) - mz(oz0));
  mc.fillStyle = '#435852';
  for (const b of world.solids) if ((b.max.x - b.min.x) > 2 && (b.max.z - b.min.z) > 1) mc.fillRect(mx(b.min.x), mz(b.min.z), mx(b.max.x) - mx(b.min.x), mz(b.max.z) - mz(b.min.z));
  mc.strokeStyle = '#6b8178';
  for (const [x0, z0, x1, z1] of map.lines ?? []) { mc.beginPath(); mc.moveTo(mx(x0), mz(z0)); mc.lineTo(mx(x1), mz(z1)); mc.stroke(); }
  const o = currentObjective();
  if (o) {
    const op = objectivePos(o); mc.fillStyle = '#f3ba65'; mc.save(); mc.translate(mx(op.x), mz(op.z)); mc.rotate(Math.PI / 4); mc.fillRect(-4, -4, 8, 8); mc.restore();
  }
  for (const e of G.enemies) if (!e.dead && (e.visible || G.elapsed - e.seenAt < 3)) {
    mc.fillStyle = '#f48c72'; mc.beginPath(); mc.arc(mx(e.pos.x), mz(e.pos.z), 3.5, 0, Math.PI * 2); mc.fill();
  }
  for (const q of G.players) {
    if (!q.alive) continue;
    mc.save(); mc.translate(mx(q.pos.x), mz(q.pos.z)); mc.rotate(-q.yaw);
    mc.fillStyle = q === p ? '#b6edd6' : '#8fc6f0';
    mc.beginPath(); mc.moveTo(0, -7); mc.lineTo(4, 5); mc.lineTo(-4, 5); mc.closePath(); mc.fill(); mc.restore();
  }
}

export function updateMarker() {
  const o = currentObjective(), p = G.local; if (!o) return;
  const op = objectivePos(o), pt = op.clone().add(new THREE.Vector3(0, 1, 0)), v = pt.clone().project(camera);
  const dir = pt.clone().sub(camera.position), front = dir.dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
  let x = (v.x * .5 + .5) * innerWidth, y = (-v.y * .5 + .5) * innerHeight;
  if (!front) { x = innerWidth / 2 + (dir.x * Math.cos(p.yaw) - dir.z * Math.sin(p.yaw) > 0 ? 1 : -1) * (innerWidth / 2 - 40); y = innerHeight * .45; }
  x = THREE.MathUtils.clamp(x, 28, innerWidth - 28); y = THREE.MathUtils.clamp(y, 135, innerHeight - 150);
  const m = $('objectiveMarker'); m.style.left = x + 'px'; m.style.top = y + 'px';
  m.querySelector('b').textContent = front ? '◇' : '›';
  m.querySelector('span').textContent = Math.round(Math.hypot(p.pos.x - op.x, p.pos.z - op.z)) + ' m';
}
