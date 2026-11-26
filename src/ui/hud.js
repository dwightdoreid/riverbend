// In-game HUD for the local player: toasts, kill feed, health/ammo, minimap, objective marker.
import { THREE } from '../engine/three.js';
import { $, coarse } from '../engine/dom.js';
import { camera } from '../engine/render.js';
import { G } from '../game/state.js';
import { world } from '../game/world.js';
import { WEAPONS } from '../game/weapons.js';
import { spreadOf } from '../game/players.js';
import { objectiveText, objectivePosFor, objectivePositions, currentObjective, inHoldZone } from '../game/mission.js';
import { sound } from '../engine/audio.js';
import { fxAll, isClient, inCoop } from '../net/net.js';

const ui = { toastLeft: 0, hitLeft: 0, damageFlash: 0, objKey: '' };

// Radio dialogue: lines queue up and play one at a time as subtitles.
const radioQueue = [];
let radioLeft = 0;
export function radio(who, text, time) {
  fxAll({ t: 'radio', who, text, time });
  radioQueue.push({ who, text, time: time ?? Math.min(9, 1.6 + text.split(' ').length * .33) });
}
export function clearRadio() { radioQueue.length = 0; radioLeft = 0; $('radio').classList.remove('on'); }
function updateRadio(dt) {
  radioLeft -= dt;
  if (radioLeft > 0) return;
  const line = radioQueue.shift();
  if (!line) { $('radio').classList.remove('on'); return; }
  $('radioWho').textContent = line.who; $('radioText').textContent = line.text;
  $('radio').classList.add('on'); radioLeft = line.time; sound('radio', .6);
}

export function say(text, time = 3) { $('toast').textContent = text; ui.toastLeft = time; $('toast').style.opacity = 1; }
export function feed(text) { G.messages.unshift({ text, t: 4 }); if (G.messages.length > 3) G.messages.pop(); fxAll({ t: 'feed', text }); }

/** kill: true (kill), false (hit) or 'blocked' (armour/shield absorbed it). */
export function showHit(kill) {
  ui.hitLeft = .15; $('hitmarker').classList.toggle('kill', kill === true); $('hitmarker').classList.toggle('blocked', kill === 'blocked');
}
export function showDamage(p, source) {
  ui.damageFlash = .7;
  if (source) { const d = source.clone().sub(p.pos), angle = Math.atan2(d.x, -d.z) + p.yaw; $('damageArrow').style.transform = 'rotate(' + angle + 'rad)'; }
  $('health').textContent = Math.ceil(p.health);
}
export function resetHUD() { ui.toastLeft = ui.hitLeft = ui.damageFlash = 0; ui.objKey = ''; ui.slotKey = ''; updateHUD(); }

function healthDisplay(p) {
  $('health').textContent = Math.ceil(p.health); $('healthFill').style.width = p.health + '%';
  $('healthFill').style.background = p.health < 30 ? '#f48c72' : '#b7d7bf';
  $('lowhealth').style.boxShadow = 'inset 0 0 95px ' + (p.health < 30 ? '#a33b2233' : '#a33b2200');
}

export function updateHUD() {
  const p = G.local; if (!p) return;
  setObjectiveText();
  $('aimBtn').classList.toggle('primary', p.aiming); $('crouchBtn').classList.toggle('primary', p.crouched); $('lightBtn').classList.toggle('primary', !!p.flashlight);
  healthDisplay(p);
  const w = WEAPONS[p.weapon], a = p.ammo[p.weapon];
  $('weaponName').textContent = w ? w.name : 'FRAG / GRENADE';
  $('ammoBig').innerHTML = w ? a.mag + ' <span>/ ' + a.reserve + '</span>' : p.grenades + ' <span>THROWABLES</span>';
  $('weaponInfo').textContent = (w ? w.mode : 'TIMED FUSE') + ' · GRENADES ' + p.grenades + (G.mission?.turrets ? ' · TURRETS ' + (p.turrets ?? 0) : '');
  $('turretBtn').style.display = G.mission?.turrets ? '' : 'none';
  const slots = [...p.loadout, 'grenade'], key = slots.join();
  if (ui.slotKey !== key) {
    ui.slotKey = key;
    $('weapons').innerHTML = slots.map((w, i) => '<button data-weapon="' + w + '">' + (i + 1) + ' ' + (w === 'grenade' ? 'FRAG' : WEAPONS[w].short.toUpperCase()) + '</button>').join('');
  }
  document.querySelectorAll('[data-weapon]').forEach(b => b.classList.toggle('active', b.dataset.weapon === p.weapon));
}

function setObjectiveText() {
  const t = objectiveText(); if (!t) return;
  const key = t.name + '|' + t.sub; if (key === ui.objKey) return;
  ui.objKey = key; $('objectiveTitle').textContent = t.name; $('objectiveSub').textContent = t.sub;
}

export function updateInteractUI(p) {
  const c = p.interaction;
  if (!c && inHoldZone(p)) {
    const o = currentObjective();
    $('interact').style.display = 'block'; $('useBtn').style.display = 'none';
    $('interactText').textContent = o.holdText ?? 'Holding position · stay in the zone';
    $('interactFill').style.width = Math.min(100, G.objState.hold / o.time * 100) + '%';
    return;
  }
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
  $('stance').textContent = p.downed ? 'DOWNED' : !p.alive ? 'OUT' : p.sprinting ? 'SPRINTING' : p.crouched ? 'CROUCHED' : p.aiming ? 'AIMING' : 'STANDING';
  $('sprintFill').style.width = p.stamina + '%';
  updateInteractUI(p);
  setObjectiveText();
  updateRadio(dt);
  $('flashState').textContent = p.flashlight ? 'LIGHT ON' : '';
  updateDownedUI(p);
  const boss = G.enemies.find(e => e.type.boss && !e.dead);
  $('bossBar').classList.toggle('on', !!boss);
  if (boss) {
    $('bossName').textContent = boss.type.name;
    $('bossFill').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
    $('bossBar').classList.toggle('exposed', !!boss.exposed);
  }
  if (G.frame % 10 === 0) updateTeam();
}

function updateDownedUI(p) {
  const el = $('downed');
  const timer = isClient() ? p.netTimer ?? 0 : p.downed ? p.bleed : p.respawnAt - G.elapsed;
  if (p.downed) {
    const rescue = isClient() ? p.reviveProgress : G.players.find(q => q.interaction?.type === 'revive' && q.interaction.obj === p)?.interactTime / 3;
    el.innerHTML = '<b>DOWNED</b> · bleeding out in ' + Math.ceil(timer) + 's<span>' + (rescue > 0 ? 'Being revived… ' + Math.round(rescue * 100) + '%' : 'A teammate can revive you: hold E next to you') + '</span>';
    el.classList.add('on');
  } else if (!p.alive && inCoop()) {
    el.innerHTML = '<b>OUT</b> · back in ' + Math.max(0, Math.ceil(timer)) + 's<span>You\'ll rejoin next to a teammate</span>';
    el.classList.add('on');
  } else el.classList.remove('on');
}

function updateTeam() {
  const el = $('team');
  const mates = inCoop() ? G.players.filter(q => !q.local).length : 0;
  $('feed').style.top = mates ? (118 + mates * 31 + 8) + 'px' : '';
  if (!mates) { el.innerHTML = ''; return; }
  el.innerHTML = G.players.filter(q => !q.local).map(q => {
    const state = q.downed ? 'DOWN' : !q.alive ? 'OUT' : Math.ceil(q.health);
    const pct = q.alive && !q.downed ? Math.min(100, q.health) : 0;
    return '<div class="mate' + (q.downed ? ' down' : '') + '"><span>' + q.name.replace(/[<&]/g, '') + '</span><i style="width:' + pct + '%"></i><b>' + state + '</b></div>';
  }).join('');
}

const mc = $('map').getContext('2d'), MW = 296, MH = 272;
export function drawMap() {
  const p = G.local, map = G.level.map;
  // Keep the map's proportions. Small levels fit entirely; big ones scroll with the player.
  const W = map.max[0] - map.min[0], H = map.max[1] - map.min[1], fit = Math.min(MW / W, MH / H), sc = Math.max(fit, 2.4);
  const follow = (lo, hi, span, v) => span * sc <= (lo === map.min[0] ? MW : MH) ? (lo + hi) / 2 : THREE.MathUtils.clamp(v, lo + (lo === map.min[0] ? MW : MH) / 2 / sc, hi - (lo === map.min[0] ? MW : MH) / 2 / sc);
  const cx = follow(map.min[0], map.max[0], W, p.pos.x), cz = follow(map.min[1], map.max[1], H, p.pos.z);
  const mx = x => MW / 2 + (x - cx) * sc, mz = z => MH / 2 + (z - cz) * sc;
  mc.clearRect(0, 0, MW, MH); mc.fillStyle = '#172d35'; mc.fillRect(0, 0, MW, MH);
  const [[ox0, oz0], [ox1, oz1]] = map.outline;
  mc.strokeStyle = '#607a7d'; mc.lineWidth = 1; mc.strokeRect(mx(ox0), mz(oz0), mx(ox1) - mx(ox0), mz(oz1) - mz(oz0));
  mc.fillStyle = '#435852';
  for (const b of world.solids) if ((b.max.x - b.min.x) > 2 && (b.max.z - b.min.z) > 1) mc.fillRect(mx(b.min.x), mz(b.min.z), mx(b.max.x) - mx(b.min.x), mz(b.max.z) - mz(b.min.z));
  mc.strokeStyle = '#6b8178'; mc.lineWidth = map.lineWidth ?? 1;
  for (const [x0, z0, x1, z1] of map.lines ?? []) { mc.beginPath(); mc.moveTo(mx(x0), mz(z0)); mc.lineTo(mx(x1), mz(z1)); mc.stroke(); }
  for (const op of objectivePositions()) {
    mc.fillStyle = '#f3ba65'; mc.save(); mc.translate(mx(op.x), mz(op.z)); mc.rotate(Math.PI / 4); mc.fillRect(-4, -4, 8, 8); mc.restore();
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
  const p = G.local, op = objectivePosFor(p), m = $('objectiveMarker');
  m.style.display = op ? '' : 'none'; if (!op) return;
  const pt = op.clone().add(new THREE.Vector3(0, 1, 0)), v = pt.clone().project(camera);
  const dir = pt.clone().sub(camera.position), front = dir.dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
  let x = (v.x * .5 + .5) * innerWidth, y = (-v.y * .5 + .5) * innerHeight;
  if (!front) { x = innerWidth / 2 + (dir.x * Math.cos(p.yaw) - dir.z * Math.sin(p.yaw) > 0 ? 1 : -1) * (innerWidth / 2 - 40); y = innerHeight * .45; }
  x = THREE.MathUtils.clamp(x, 28, innerWidth - 28); y = THREE.MathUtils.clamp(y, 135, innerHeight - 150);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.querySelector('b').textContent = front ? '◇' : '›';
  m.querySelector('span').textContent = Math.round(Math.hypot(p.pos.x - op.x, p.pos.z - op.z)) + ' m';
}
