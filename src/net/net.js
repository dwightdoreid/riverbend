// Co-op session: lobby/roster, host <-> client messages, snapshots and one-off events.
//
// Authority model (host-authoritative, client-owned movement):
//  - The host simulates enemies, damage, health, objectives, pickups and the mission script.
//  - Each client moves its own player and runs its own weapon (ammo, reload, recoil) for
//    instant feel. It streams its pose to the host and sends shots/grenades as requests;
//    the host spawns the real projectiles and decides what they hit.
//  - The host sends a snapshot 20x per second plus a reliable, ordered stream of events
//    (enemy spawns, radio, hit markers, explosions...).
import { THREE } from '../engine/three.js';
import { sound } from '../engine/audio.js';
import { G } from '../game/state.js';
import { createPlayer, resupplyPlayer, needsAmmo } from '../game/players.js';
import { addEnemy } from '../game/bots.js';
import { projectile, burst, explosionFx, alertNoise, makeSmoke, arcBolts, empFx } from '../game/combat.js';
import { spawnBomb } from '../game/weapons.js';
import { freePoint } from '../game/world.js';
import { poseEscort } from '../game/mission.js';
import { makeTurret, syncTurretVisuals } from '../game/turrets.js';
import { clientMortar, makeField } from '../game/bosses.js';
import { lightningStrike } from '../game/weather.js';
import { updateHUD } from '../ui/hud.js';
import { say, feed, radio, showHit, showDamage } from '../ui/hud.js';
import { openTransport, randomCode } from './transport.js';

export const net = {
  role: 'solo',        // solo | host | client
  code: null,
  myId: 0,
  roster: [],          // [{ id, name, active }]
  status: '',          // human-readable lobby status
  transport: null,
  hostConn: null,      // client: connection to host
  peers: new Map(),    // host: player id -> { conn, name, active }
  fxAll: [],           // host: events for everyone (with optional except id)
  fxTo: new Map(),     // host: player id -> events just for them
  sendTimer: 0,
  listeners: new Set(),
  hooks: {},           // set by flow.js: onStart, onBrief, onFinish, onLeave
};
G.net = net;

export const isHost = () => net.role === 'host';
export const isClient = () => net.role === 'client';
export const inCoop = () => net.role !== 'solo';
const changed = () => net.listeners.forEach(fn => fn());
export const onNetChange = fn => net.listeners.add(fn);
const r2 = v => Math.round(v * 100) / 100;

// ------------------------------------------------------------------ lobby

export async function hostGame(name, kind = 'peer') {
  await leave(true);
  net.status = 'Opening a room…'; changed();
  const t = await openTransport(kind), code = randomCode();
  await t.host(code, conn => onClientConnected(conn));
  Object.assign(net, { role: 'host', code, myId: 0, transport: t });
  G.local.id = 0; G.local.name = name;
  net.roster = [{ id: 0, name, active: true }];
  net.status = 'Room open. Share the code with your friends.'; changed();
  return code;
}

export async function joinGame(code, name, kind = 'peer') {
  await leave(true);
  net.status = 'Connecting…'; changed();
  const t = await openTransport(kind);
  let conn;
  try { conn = await t.join(code.toUpperCase().trim()); }
  catch (e) { t.destroy(); net.status = e.message; changed(); throw e; }
  Object.assign(net, { role: 'client', code: code.toUpperCase().trim(), transport: t, hostConn: conn });
  conn.onData(onHostMessage);
  conn.onClose(() => { if (net.role === 'client') { net.status = 'The host left the game.'; dropToSolo(); } });
  conn.send({ t: 'hello', name });
  net.status = 'Connected. Waiting for the host…'; changed();
}

export async function leave(silent = false) {
  if (net.role === 'host') for (const p of net.peers.values()) { p.conn.send({ t: 'bye' }); p.conn.close(); }
  if (net.role === 'client') { net.hostConn?.send({ t: 'bye' }); net.hostConn?.close(); }
  const was = net.role;
  net.transport?.destroy();
  Object.assign(net, { role: 'solo', code: null, transport: null, hostConn: null, roster: [], fxAll: [], myId: 0 });
  net.peers.clear(); net.fxTo.clear();
  if (was !== 'solo') { if (!silent) net.status = 'Left co-op.'; dropToSolo(); }
}

/** Back to a one-player game after leaving or losing the connection. */
function dropToSolo() {
  net.role = 'solo';
  G.players = G.players.filter(p => p.local);
  G.local.id = 0;
  net.hooks.onLeave?.();
  changed();
}

/** Makes G.players match the roster's active entries (keeps the local player object). */
export function syncPlayersToRoster() {
  const active = net.roster.filter(r => r.active);
  const byId = new Map(G.players.map(p => [p.id, p]));
  G.players = active.map(r => {
    if (r.id === net.myId) { G.local.id = r.id; G.local.name = r.name; return G.local; }
    const p = byId.get(r.id) ?? createPlayer({ id: r.id, name: r.name });
    p.name = r.name; p.netPos ??= p.pos.clone();
    return p;
  });
}

// ------------------------------------------------------------------ host side

function onClientConnected(conn) {
  let id = null;
  conn.onData(m => {
    if (m.t === 'hello') {
      id = Math.max(0, ...net.roster.map(r => r.id)) + 1;
      if (net.roster.length >= 4) { conn.send({ t: 'full' }); conn.close(); return; }
      const name = String(m.name || 'Operator').slice(0, 16);
      const midMission = G.status !== 'briefing';
      net.peers.set(id, { conn, name, active: !midMission });
      net.roster.push({ id, name, active: !midMission });
      if (!midMission) syncPlayersToRoster();
      conn.send({ t: 'welcome', id, mi: G.missionIndex, midMission, roster: net.roster });
      broadcast({ t: 'roster', roster: net.roster });
      feed(name + (midMission ? ' joined · drops in at the next checkpoint' : ' joined'));
      changed();
      return;
    }
    if (id === null) return;
    const p = G.players.find(q => q.id === id);
    if (m.t === 'in' && p) applyRemoteInput(p, m);
    else if (m.t === 'shot' && p && p.alive && !p.downed) {
      alertNoise(p.pos, 35);
      projectile(new THREE.Vector3(...m.o), new THREE.Vector3(...m.d), m.s, m.dm, p, false, false, null, m.k ?? null);
    } else if (m.t === 'nade' && p && p.alive && !p.downed) {
      if (m.k !== 'smoke' && m.k !== 'emp') p.stats.grenades++;
      spawnBomb(new THREE.Vector3(...m.p), new THREE.Vector3(...m.v), p, m.k ?? 'frag');
      alertNoise(p.pos, 8);
    } else if (m.t === 'deploy' && p && p.alive && !p.downed && p.turrets > 0) {
      p.turrets--; makeTurret({ owner: p, x: m.x, z: m.z, yaw: m.y }); feed(p.name + ' deployed a turret');
    } else if (m.t === 'bye') conn.close();
  });
  conn.onClose(() => {
    if (id === null) return;
    const entry = net.peers.get(id);
    net.peers.delete(id);
    net.roster = net.roster.filter(r => r.id !== id);
    const p = G.players.find(q => q.id === id);
    if (p) { p.alive = false; G.players = G.players.filter(q => q !== p); }
    broadcast({ t: 'roster', roster: net.roster });
    feed((entry?.name ?? 'A player') + ' left');
    changed();
  });
}

function applyRemoteInput(p, m) {
  if (p.alive && !p.downed) { p.pos.set(m.x, 0, m.z); }
  p.yaw = m.y; p.pitch = m.pi; p.eye = m.e;
  p.crouched = !!(m.f & 1); p.aiming = !!(m.f & 2); p.flashlight = !!(m.f & 4); p.moving = m.f & 8 ? 1 : 0;
  p.sprinting = !!(m.f & 16); p.input.use = !!(m.f & 32); p.netNeedAmmo = !!(m.f & 64);
  p.weapon = m.w;
}

/** Host: per-frame upkeep for remote players (their own browsers move them). */
export function updateRemotePlayers() {
  for (const p of G.players) if (!p.local && p.alive && !p.downed && p.sprinting) alertNoise(p.pos, 12);
}

function broadcast(msg, except = null) {
  for (const [id, peer] of net.peers) if (id !== except) peer.conn.send(msg);
}

/** Host: queue an event for every client (optionally skipping one player). */
export function fxAll(ev, except = null) { if (isHost()) net.fxAll.push(except === null ? ev : { ...ev, _x: except }); }
/** Host: queue an event for one player's client. */
export function fxTo(id, ev) {
  if (!isHost() || !net.peers.has(id)) return;
  if (!net.fxTo.has(id)) net.fxTo.set(id, []);
  net.fxTo.get(id).push(ev);
}

/** Host: everyone in the lobby (including players waiting to drop in) plays the next run. */
export function activateRoster() {
  for (const p of net.peers.values()) p.active = true;
  for (const r of net.roster) r.active = true;
  syncPlayersToRoster();
  changed();
}
/** Host: tell clients to load the current mission and start (optionally from the checkpoint). */
export function sendStart(fresh) {
  broadcast({ t: 'start', mi: G.missionIndex, cp: fresh ? null : G.checkpoint, roster: net.roster, fresh });
}
export function broadcastBrief() { broadcast({ t: 'brief', mi: G.missionIndex, roster: net.roster }); }
export function broadcastFinish(won) { flush(); broadcast({ t: 'finish', won }); }

/** Host: players waiting to drop in join when a checkpoint is reached. */
export function onCheckpoint() {
  if (!isHost()) return;
  const waiting = [...net.peers.entries()].filter(([, p]) => !p.active);
  if (!waiting.length) return;
  const anchor = G.players.find(p => p.alive && !p.downed) ?? G.local;
  for (const [id, peer] of waiting) {
    peer.active = true; net.roster.find(r => r.id === id).active = true;
  }
  syncPlayersToRoster();
  for (const [id, peer] of waiting) {
    const p = G.players.find(q => q.id === id), spot = freePoint(anchor.pos.x + 1.5, anchor.pos.z + 1.5);
    p.pos.copy(spot); p.netPos = spot.clone(); p.alive = true; p.downed = false; p.health = 100;
    peer.conn.send({ t: 'start', mi: G.missionIndex, cp: G.checkpoint, roster: net.roster, fresh: false });
    peer.conn.send({ t: 'fx', l: [{ t: 'tp', x: spot.x, z: spot.z }] });
    feed(peer.name + ' dropped in');
  }
  broadcast({ t: 'roster', roster: net.roster });
  changed();
}

const STATE_CODE = { patrol: 0, investigate: 1, search: 2, engage: 3 };
const STATES = ['patrol', 'investigate', 'search', 'engage'];

function snapshot() {
  return {
    t: 'snap', e: r2(G.elapsed), o: G.objective, c: [...G.objState.collected], h: r2(G.objState.hold), ot: r2(G.objState.t),
    ps: Object.fromEntries(Object.values(G.props).map(p => [p.id, p.style])),
    pu: G.pickups.map(k => (k.used ? 1 : 0)).join(''),
    pl: G.players.map(p => {
      const reviver = G.players.find(q => q.interaction?.type === 'revive' && q.interaction.obj === p);
      return [p.id, r2(p.pos.x), r2(p.pos.z), r2(p.yaw), r2(p.pitch), r2(p.eye), Math.ceil(p.health),
        (p.alive ? 1 : 0) | (p.downed ? 2 : 0) | (p.crouched ? 4 : 0) | (p.flashlight ? 8 : 0) | (p.aiming ? 16 : 0) | (p.moving ? 32 : 0),
        p.weapon, r2(p.downed ? p.bleed : p.alive ? 0 : Math.max(0, p.respawnAt - G.elapsed)),
        p.stats.kills, p.stats.hits,
        p.interaction ? [p.interaction.name, r2(p.interactTime / p.interaction.time)] : 0,
        reviver ? r2(reviver.interactTime / reviver.interaction.time) : 0];
    }),
    en: G.enemies.map(e => [r2(e.pos.x), r2(e.pos.z), r2(e.yaw), Math.ceil(e.hp), (e.dead ? 1 : 0) | (e.visible ? 2 : 0) | (STATE_CODE[e.state] << 2) | (e.exposed ? 16 : 0), r2(e.elev ?? 0)]),
    bo: G.bombs.map(b => [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z)]),
    es: G.escort ? [r2(G.escort.s), Math.ceil(G.escort.hp), G.escort.status] : null,
    tu: G.turrets.filter(t => !t.dead).map(t => [t.id, r2(t.pos.x), r2(t.pos.z), r2(t.yaw), t.ammo]),
    ph: Object.fromEntries(Object.values(G.props).filter(p => p.maxHp).map(p => [p.id, [Math.ceil(p.hp), Math.ceil(p.maxHp)]])),
    tl: G.players.map(p => [p.id, p.turrets ?? 0]),
  };
}

function flush() {
  for (const [id, peer] of net.peers) {
    const list = net.fxAll.filter(ev => ev._x !== id).concat(net.fxTo.get(id) ?? []);
    if (list.length) peer.conn.send({ t: 'fx', l: list });
  }
  net.fxAll = []; net.fxTo.clear();
}

// ------------------------------------------------------------------ client side

function onHostMessage(m) {
  if (m.t === 'welcome') {
    net.myId = m.id; G.local.id = m.id; net.roster = m.roster;
    net.status = m.midMission ? 'Mission in progress. You\'ll drop in at the next checkpoint.' : 'Connected. Waiting for the host to deploy…';
    net.hooks.onBrief?.(m.mi);
    changed();
  } else if (m.t === 'roster') {
    net.roster = m.roster;
    if (G.status !== 'briefing' && net.roster.find(r => r.id === net.myId)?.active) syncPlayersToRoster();
    changed();
  } else if (m.t === 'brief') { net.roster = m.roster; net.hooks.onBrief?.(m.mi); }
  else if (m.t === 'start') {
    net.roster = m.roster; syncPlayersToRoster();
    net.hooks.onStart?.(m.mi, m.cp, m.fresh);
  } else if (m.t === 'snap') applySnapshot(m);
  else if (m.t === 'fx') m.l.forEach(applyFx);
  else if (m.t === 'finish') net.hooks.onFinish?.(m.won);
  else if (m.t === 'full') { net.status = 'That game is full (4 players).'; changed(); }
  else if (m.t === 'bye') leave();
}

const lerpAngle = (a, b, t) => a + (((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * t;

function applySnapshot(s) {
  if (G.status === 'briefing' || !G.mission) return;
  G.elapsed = s.e;
  if (s.o !== G.objective) { G.objective = s.o; G.objStartRan = true; }
  G.objState.collected = new Set(s.c); G.objState.hold = s.h; G.objState.t = s.ot ?? 0;
  for (const [id, style] of Object.entries(s.ps)) if (G.props[id] && G.props[id].style !== style) G.props[id].setStyle(style);
  [...s.pu].forEach((u, i) => { const k = G.pickups[i]; if (k) { k.used = u === '1'; k.g.visible = !k.used; } });
  for (const row of s.pl) {
    const [id, x, z, yaw, pitch, eye, health, f, weapon, timer, kills, hits, inter, revive] = row;
    const p = G.players.find(q => q.id === id); if (!p) continue;
    p.health = health; p.alive = !!(f & 1); p.downed = !!(f & 2); p.netTimer = timer; p.reviveProgress = revive;
    p.stats.kills = kills; p.stats.hits = hits;
    if (p.local) {
      p.interaction = inter ? { type: 'net', name: inter[0], time: 1 } : null; p.interactTime = inter ? inter[1] : 0;
    } else {
      (p.netPos ??= new THREE.Vector3()).set(x, 0, z); p.netYaw = yaw; p.pitch = pitch; p.eye = eye;
      p.crouched = !!(f & 4); p.flashlight = !!(f & 8); p.aiming = !!(f & 16); p.moving = f & 32 ? 1 : 0; p.weapon = weapon;
    }
  }
  s.en.forEach(([x, z, yaw, hp, f, elev], i) => {
    const e = G.enemies[i]; if (!e) return;
    e.elev = elev;
    (e.netPos ??= new THREE.Vector3()).set(x, 0, z); e.netYaw = yaw; e.hp = hp;
    const dead = !!(f & 1);
    if (dead && !e.dead) e.g.visible = false;
    e.dead = dead; e.visible = !!(f & 2); e.state = STATES[(f >> 2) & 3]; e.exposed = !!(f & 16);
    if (e.visible) e.seenAt = G.elapsed;
  });
  syncBombVisuals(s.bo);
  if (s.es && G.escort) { [G.escort.s, G.escort.hp, G.escort.status] = s.es; poseEscort(); }
  syncTurretVisuals(s.tu ?? []);
  for (const [id, [hp, max]] of Object.entries(s.ph ?? {})) if (G.props[id]) { G.props[id].hp = hp; G.props[id].maxHp = max; }
  const mine = (s.tl ?? []).find(([id]) => id === G.local.id);
  if (mine && mine[1] !== G.local.turrets) { G.local.turrets = mine[1]; updateHUD(); }
}

function applyFx(ev) {
  switch (ev.t) {
    case 'enemy': addEnemy(ev.def, ev.alert ? new THREE.Vector3(ev.alert[0], 0, ev.alert[1]) : null); break;
    case 'shot': {
      const owner = ev.by >= 0 ? G.players.find(q => q.id === ev.by) ?? null : null;
      projectile(new THREE.Vector3(...ev.o), new THREE.Vector3(...ev.d), ev.s, 0, ev.h ? null : (owner ?? G.local), true, false, null, ev.k ?? null);
      if (G.local) sound('shot', Math.max(.02, (ev.h ? .1 : .2) - G.local.pos.distanceTo(new THREE.Vector3(ev.o[0], 0, ev.o[2])) * .001));
      break;
    }
    case 'boom': explosionFx(new THREE.Vector3(...ev.p)); break;
    case 'mortar': clientMortar(ev); break;
    case 'field': makeField(ev.p[0], ev.p[1]); break;
    case 'strike': lightningStrike(ev.p[0], ev.p[1], false); break;
    case 'arc': arcBolts(ev.pts.map(q => new THREE.Vector3(...q))); break;
    case 'smoke': makeSmoke(new THREE.Vector3(...ev.p)); break;
    case 'emp': empFx(new THREE.Vector3(...ev.p)); break;
    case 'burst': burst(new THREE.Vector3(...ev.p), ev.c, ev.n, ev.pw); break;
    case 'say': say(ev.text, ev.time); break;
    case 'feed': feed(ev.text); break;
    case 'radio': radio(ev.who, ev.text, ev.time); break;
    case 'snd': sound(ev.k, ev.l ?? 1); break;
    case 'hit': showHit(ev.kill); sound('hit', .6); break;
    case 'dmg': showDamage(G.local, ev.src ? new THREE.Vector3(ev.src[0], 0, ev.src[1]) : null); break;
    case 'resupply': resupplyPlayer(G.local); break;
    case 'tp': G.local.pos.set(ev.x, 0, ev.z); break;
  }
}

let bombMeshes = [];
const bombMat = new THREE.MeshStandardMaterial({ color: 0x47726b });
function syncBombVisuals(list) {
  while (bombMeshes.length < list.length) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.07, .085, .18, 9), bombMat); G.dynRoot.add(m); bombMeshes.push(m);
  }
  bombMeshes.forEach((m, i) => {
    if (m.parent !== G.dynRoot) G.dynRoot.add(m);
    m.visible = i < list.length; if (m.visible) m.position.set(...list[i]);
  });
}
export function resetNetVisuals() { bombMeshes = []; }

/** Client: smooth remote players and enemies toward the latest snapshot. */
export function interpolate(dt) {
  const k = 1 - Math.exp(-14 * dt);
  for (const p of G.players) if (!p.local && p.netPos) { p.pos.lerp(p.netPos, k); p.yaw = lerpAngle(p.yaw, p.netYaw ?? p.yaw, k); }
  for (const e of G.enemies) if (e.netPos && !e.dead) { e.pos.lerp(e.netPos, k); e.yaw = lerpAngle(e.yaw, e.netYaw ?? e.yaw, k); }
}

// ------------------------------------------------------------------ per-frame network tick

export function netTick(dt) {
  if (net.role === 'solo') return;
  net.sendTimer -= dt;
  if (net.sendTimer > 0) return;
  if (isHost()) {
    net.sendTimer = .05;
    flush();
    if (G.status === 'playing') broadcast(snapshot());
  } else if (isClient() && G.status === 'playing') {
    net.sendTimer = .033;
    const p = G.local;
    net.hostConn.send({
      t: 'in', x: r2(p.pos.x), z: r2(p.pos.z), y: r2(p.yaw), pi: r2(p.pitch), e: r2(p.eye), w: p.weapon,
      f: (p.crouched ? 1 : 0) | (p.aiming ? 2 : 0) | (p.flashlight ? 4 : 0) | (p.moving ? 8 : 0) | (p.sprinting ? 16 : 0) | (p.input.use ? 32 : 0) | (needsAmmo(p) ? 64 : 0),
    });
  }
}

/** Client: ask the host to fire a shot / throw a grenade. */
export function sendShot(o, d, s, dm, k = null) { net.hostConn?.send({ t: 'shot', o: o.toArray().map(r2), d: d.toArray().map(v => Math.round(v * 1e4) / 1e4), s, dm, k }); }
export function sendGrenade(pos, vel, kind = 'frag') { net.hostConn?.send({ t: 'nade', p: pos.toArray().map(r2), v: vel.toArray().map(r2), k: kind }); }


/** Client: ask the host to place a turret. */
export function sendDeploy(x, z, y) { net.hostConn?.send({ t: 'deploy', x: r2(x), z: r2(z), y: r2(y) }); }
