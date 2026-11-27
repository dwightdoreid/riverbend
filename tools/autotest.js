// In-browser smoke test. Loaded by src/main.js when the URL has ?autotest=1.
// Drives the real input paths (key and mouse events, menu buttons) and writes a JSON report
// into <pre id="autotest-result"> and document.title, for tools/smoke_test.py to read.
import { THREE } from '../src/engine/three.js';
import { G } from '../src/game/state.js';
import { hurt, projectile, damageEnemy, smokeBlocks } from '../src/game/combat.js';
import { litAt, damageProp } from '../src/game/props.js';
import { canvas, flashlight, camera } from '../src/engine/render.js';
import { updateBlackout, districtLit } from '../src/game/blackout.js';
import { liveAt } from '../src/game/switching.js';
import { makeField } from '../src/game/bosses.js';
import { addEnemy } from '../src/game/bots.js';
import { windVec, lightningStrike } from '../src/game/weather.js';
import { spawnBomb } from '../src/game/weapons.js';
import { moveBlocked } from '../src/game/world.js';
import { CAMPAIGN } from '../src/missions/index.js';

const log = [], errors = [];
window.autotestLog = log;
window.addEventListener('error', e => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => errors.push('rejection: ' + e.reason));

const frame = () => new Promise(r => requestAnimationFrame(r));
async function waitSim(seconds, onFrame) { const end = G.elapsed + seconds; let guard = 0; while (G.elapsed < end && G.status === 'playing' && guard++ < 8000) { await frame(); onFrame?.(); } }
async function frames(n) { for (let i = 0; i < n; i++) await frame(); }
const key = (type, k) => canvas.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
const tap = async k => { key('keydown', k); key('keyup', k); await frames(2); };
const mouse = (type, button) => canvas.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
const click = async id => { const el = document.getElementById(id); if (!el) throw new Error('missing button #' + id); el.click(); await frames(3); };
function check(name, ok, detail = '') { log.push({ name, ok: !!ok, detail: String(detail) }); }
const S = () => window.riverbendGame.state();
// ?only=mNN runs just that mission's checks (jumping straight to its briefing).
const ONLY = new URLSearchParams(location.search).get('only');
async function goNext(n) {
  // Full runs click Next; if the previous mission's checks ended on a failure screen, jump instead.
  if (ONLY || !document.getElementById('nextBtn')?.offsetParent) { const flow = await import('../src/game/flow.js'); flow.selectMission(n - 1); await frames(3); }
  else await click('nextBtn');
}
const godMode = () => { G.local.health = 1e6; };

async function holdE(seconds) { key('keydown', 'e'); await waitSim(seconds); key('keyup', 'e'); await frames(2); }
function teleport(x, z, yaw = 0) { G.local.pos.set(x, 0, z); G.local.yaw = yaw; }

async function mission01() {
  await frames(5);
  check('boots to briefing', S().status === 'briefing' && S().mission === 'm01', S().status);
  check('enemies spawned', S().enemies.length === 8, S().enemies.length);

  await click('startBtn');
  check('deploy -> playing', S().status === 'playing', S().status);
  godMode();
  await waitSim(.3);
  check('radio dialogue plays', document.getElementById('radio').classList.contains('on') && document.getElementById('radioWho').textContent.length > 0, document.getElementById('radioWho').textContent);

  const mag0 = S().mag;
  G.local.pitch = -0.2;
  mouse('mousedown', 0); await waitSim(.5); mouse('mouseup', 0); await frames(2);
  check('rifle fires on hold', S().stats.shots >= 3 && S().mag < mag0, 'shots=' + S().stats.shots + ' mag=' + S().mag);
  await tap('r'); await waitSim(2.4);
  check('reload refills magazine', S().mag === 30 && S().reserve < 120, 'mag=' + S().mag + ' reserve=' + S().reserve);
  await tap('2'); await waitSim(.4);
  check('switch to pistol', S().weapon === 'pistol', S().weapon);
  await tap('1'); await waitSim(.4);
  await tap('g');
  check('grenade thrown', S().bombs === 1 && S().grenades === 2, 'bombs=' + S().bombs);
  await waitSim(3);
  check('grenade detonates', S().bombs === 0, 'bombs=' + S().bombs);

  teleport(0, 30); const z0 = G.local.pos.z;
  key('keydown', 'w'); await waitSim(.5); key('keyup', 'w'); await frames(2);
  check('W moves forward', G.local.pos.z < z0 - 1, (z0 - G.local.pos.z).toFixed(2));

  teleport(-32, 9.6); await holdE(1.5);
  check('objective 1 completes', S().objective === 1, S().objective);
  teleport(7.7, 25.6); await holdE(2.2);
  check('objective 2 completes + checkpoint', S().objective === 2 && G.checkpoint?.name === 'Core secured', S().objective + ' ' + G.checkpoint?.name);

  // Die after the checkpoint, then retry from it.
  const deadBefore = S().enemies.filter(e => e.dead).length;
  G.local.health = 100; hurt(G.local, 500, G.local.pos.clone()); await frames(2);
  check('solo: first lethal hit uses the auto-stim', S().status === 'playing' && G.local.health === 50 && G.local.stims === 0, 'health=' + G.local.health);
  G.local.protectUntil = 0; hurt(G.local, 500, G.local.pos.clone()); await frames(2);
  check('death -> mission failed', S().status === 'lost', S().status);
  await click('retryBtn');
  check('retry resumes at checkpoint', S().status === 'playing' && S().objective === 2 && S().enemies.filter(e => e.dead).length === deadBefore, 'objective=' + S().objective);
  godMode();

  await tap('Escape');
  check('escape pauses', S().status === 'paused', S().status);
  await click('startBtn');
  check('resume', S().status === 'playing', S().status);

  teleport(0, 35); await holdE(1.9);
  check('extraction wins mission', S().status === 'won', S().status);
  check('scorecard shown', !document.getElementById('scorecard').classList.contains('hidden'));

  await click('replayBtn');
  check('replay resets', S().status === 'playing' && S().objective === 0 && S().mag === 30 && S().grenades === 3 && !G.checkpoint, JSON.stringify({ o: S().objective, m: S().mag }));
  G.elapsed = Math.max(G.elapsed, 3);
  hurt(G.local, 500, G.local.pos.clone()); G.local.protectUntil = 0; hurt(G.local, 500, G.local.pos.clone()); await frames(2);
  check('death without checkpoint offers restart', S().status === 'lost' && !document.getElementById('retryBtn') && !!document.getElementById('restartBtn'));
}

async function mission02() {
  // Win 01 quickly, then use the real "Next mission" button.
  await click('restartBtn'); godMode();
  teleport(-32, 9.6); await holdE(1.5); teleport(7.7, 25.6); await holdE(2.2); teleport(0, 35); await holdE(1.9);
  await click('missionsBtn');
  check('mission list shows 02 unlocked', !!document.querySelector('[data-mission="m02"]:not([disabled])'));
  await click('missionsBtn');
  await click('nextBtn');
  check('next mission -> 02 briefing', S().status === 'briefing' && S().mission === 'm02', S().mission);
  check('night environment', G.env.dark === true && G.env.sightScale < 1);
  check('skimmers + sensor cones', G.enemies.filter(e => e.type.name === 'Skimmer').length === 2 && G.enemies.every(e => e.cone), G.enemies.length);

  await click('startBtn'); godMode();
  check('m02 deploy', S().status === 'playing', S().status);
  await tap('f'); await frames(2);
  check('flashlight on', G.local.flashlight && flashlight.intensity > 0, flashlight.intensity);
  await tap('f'); await frames(2);
  check('flashlight off', !G.local.flashlight && flashlight.intensity === 0);

  // A bullet aimed at a Skimmer's body should hit it (per-type hit spheres at hover height).
  const sk = G.enemies.find(e => e.type.name === 'Skimmer');
  const center = sk.pos.clone().setY(2.1), origin = center.clone().add(new THREE.Vector3(4, 0, 0));
  const hp0 = sk.hp;
  projectile(origin, center.clone().sub(origin).normalize(), 240, 20, G.local);
  await frames(3);
  check('bullets hit skimmers', sk.hp < hp0 || sk.dead, hp0 + ' -> ' + sk.hp);

  teleport(-37, -18.6); await holdE(1.6);
  check('collect lineman 1', G.objState.collected.size === 1 && G.props.teo.style === 'gone', G.objState.collected.size);
  check('collect objective text shows count', document.getElementById('objectiveTitle').textContent.includes('(1/3)'), document.getElementById('objectiveTitle').textContent);
  teleport(37, -31.6); await holdE(1.6);
  teleport(31, 7.4); await holdE(1.6);
  check('all linemen -> objective 2 + checkpoint', S().objective === 1 && G.checkpoint?.name === 'Crew found', S().objective + ' ' + G.checkpoint?.name);

  teleport(-4, 29); await holdE(2.4);
  check('breaker -> floodlights on', S().objective === 2 && G.props.floodW.style === 'on' && litAt(new THREE.Vector3(0, 0, 31)), S().objective);
  check('hold wave spawned', G.enemies.length === 10, G.enemies.length);

  // The waves must actually reach and attack the gate (they spawn on the far side of the yard).
  G.simSteps = 10;
  const gate = G.props.gate.pos, closest = new Map(), dmg0 = G.local.stats.damage;
  const track = () => { for (const e of G.enemies.slice(8)) if (!e.dead) closest.set(e.id, Math.min(closest.get(e.id) ?? 1e9, Math.hypot(e.pos.x - gate.x, e.pos.z - gate.z))); };
  teleport(0, 32); await waitSim(26, track);
  check('hold progresses + waves 2 and 3 spawn', G.objState.hold > 20 && G.enemies.length === 15, 'hold=' + G.objState.hold.toFixed(1) + ' enemies=' + G.enemies.length);
  teleport(0, 32); await waitSim(18, track);
  check('hold completes -> mission won', S().status === 'won', S().status + ' hold=' + G.objState.hold.toFixed(1));
  const reached = [...closest.values()].filter(d => d < 22).length;
  check('wave machines reach the gate', reached >= 5, reached + '/7 got within 22 m · closest ' + [...closest.values()].map(d => d.toFixed(0)).join(','));
  check('gate defenders come under fire', G.local.stats.damage - dmg0 > 30, 'damage taken=' + Math.round(G.local.stats.damage - dmg0));
  G.simSteps = 6;
}

async function mission03() {
  await goNext(3);
  check('next mission -> 03 briefing', S().status === 'briefing' && S().mission === 'm03', S().mission);
  check('dusk environment + switchback level', G.level.id === 'switchback' && G.env.sky === '#d9a98a');
  await click('startBtn'); godMode();
  check('m03 deploy', S().status === 'playing', S().status);
  check('loadout buttons: rifle, shotgun, pistol, frag', document.querySelectorAll('#weapons [data-weapon]').length === 4, document.getElementById('weapons').textContent);

  // Shotgun: one shell, eight pellets.
  await tap('2'); await waitSim(.4);
  G.local.yaw = Math.PI; G.local.pitch = .5;   // aim up and away from the truck so no pellet hits within a frame
  const shots0 = S().stats.shots, proj0 = G.projectiles.length;
  mouse('mousedown', 0); await frames(1); mouse('mouseup', 0);
  check('shotgun fires 8 pellets per shell', S().weapon === 'shotgun' && S().stats.shots === shots0 + 1 && G.projectiles.length >= proj0 + 8, 'weapon=' + S().weapon + ' projectiles=' + (G.projectiles.length - proj0));

  // Escort rules.
  const E = G.escort, truck = G.props.truck;
  teleport(25, 70); await waitSim(.6);
  const s0 = E.s;
  check('truck waits when nobody is near', E.status === 'waiting' && E.s === s0, E.status);
  const behind = () => { const y = truck.yaw; teleport(truck.pos.x + Math.sin(y) * 6.5, truck.pos.z + Math.cos(y) * 6.5, y); };
  behind(); await waitSim(1.5, behind);
  check('truck rolls with an escort nearby', E.s > s0 + 1 && E.status === 'moving', E.s.toFixed(1) + ' ' + E.status);
  const e0 = G.enemies.find(e => !e.dead);
  e0.pos.set(truck.pos.x + 4, 0, truck.pos.z); e0.memory = 0; e0.state = 'patrol';
  await waitSim(.3, behind);
  check('truck stops for nearby machines', E.status === 'contact', E.status);
  damageEnemy(e0, 999, false, G.local);
  const hp0 = E.hp, o = truck.pos.clone().add(new THREE.Vector3(6, 0, 0));
  projectile(o, truck.pos.clone().sub(o).normalize(), 44, 9, null); await frames(3);
  check('hostile fire damages the truck', E.hp === hp0 - 9, hp0 + ' -> ' + E.hp);

  // Drive to the roadblock, clearing machines that get close (they would stop the truck).
  G.simSteps = 10;
  const escortFrame = () => { behind(); for (const e of G.enemies) if (!e.dead && Math.hypot(e.pos.x - truck.pos.x, e.pos.z - truck.pos.z) < 13) damageEnemy(e, 999, false, G.local); };
  await waitSim(40, () => { escortFrame(); if (G.objective >= 1) G.simSteps = 6; });
  check('escort reaches the roadblock', S().objective === 1, 'objective=' + S().objective + ' s=' + E.s.toFixed(1));
  check('ambush spawns at the roadblock', G.enemies.some(e => e.def.harass === 'truck'));
  teleport(-12.2, 15.6); await holdE(3.8);
  check('roadblock cleared + checkpoint', S().objective === 2 && G.props.roadblock.style === 'gone' && G.checkpoint?.name === 'Roadblock cleared', S().objective + ' ' + G.checkpoint?.name);

  G.simSteps = 10;
  await waitSim(120, escortFrame);
  check('escort triggers fired on the way', ['skimmers-low', 'ridge-sentries', 'halfway', 'last-stand', 'gate'].every(id => G.fired.has(id)), [...G.fired].join(','));
  check('truck reaches Fernhill -> mission won', S().status === 'won', S().status + ' s=' + E.s.toFixed(1) + '/' + E.cum.at(-1).toFixed(1) + ' armour=' + Math.round(E.hp / E.maxHp * 100) + '%');
  G.simSteps = 6;

  // A destroyed truck fails the mission.
  await click('replayBtn'); godMode();
  G.escort.hp = 5;
  const t2 = G.props.truck, o2 = t2.pos.clone().add(new THREE.Vector3(6, 0, 0));
  G.protectUntil = 0; projectile(o2, t2.pos.clone().sub(o2).normalize(), 44, 9, null);
  await waitSim(.5);
  check('destroyed truck fails the mission', S().status === 'lost', S().status);
}

async function mission04() {
  let card = { disabled: false };
  if (ONLY) await goNext(4);
  else { await click('missionsBtn'); card = document.querySelector('[data-mission="m04"]'); card?.click(); await frames(3); }
  check('mission 04 unlocked and selectable', !!card && !card.disabled && S().status === 'briefing' && S().mission === 'm04', S().mission);
  check('night yard with floodlights', G.level.id === 'fernhill' && G.env.dark && litAt(new THREE.Vector3(0, 0, -10)));
  await click('startBtn'); godMode();
  check('m04 deploy with 2 turrets', S().status === 'playing' && G.local.turrets === 2 && document.getElementById('weaponInfo').textContent.includes('TURRETS 2'), document.getElementById('weaponInfo').textContent);

  teleport(20, -18); await holdE(1.3);
  check('check in with Ade', S().objective === 1, S().objective);

  // Turret: deploy facing the south gate.
  teleport(0, -4, Math.PI); await tap('t'); await frames(2);
  check('turret deploys in front of the player', G.turrets.length === 1 && G.local.turrets === 1 && G.turrets[0].pos.z > -4, G.turrets.length + ' left=' + G.local.turrets);
  G.objState.hold = 24.8; await waitSim(.5);
  check('prep ends -> first phase starts with a wave', S().objective === 2 && G.enemies.length >= 3, 'objective=' + S().objective + ' enemies=' + G.enemies.length);
  check('survive objective shows timer and generator health', /left · Gen A 100%/.test(document.getElementById('objectiveSub').textContent), document.getElementById('objectiveSub').textContent);

  G.simSteps = 10;
  teleport(-20, -20);  // stay out of the turret's way
  await waitSim(16);
  check('turret engages machines', G.turrets[0].ammo < 150, 'ammo=' + G.turrets[0].ammo + ' kills=' + G.local.stats.kills);
  G.simSteps = 6;

  // Generator damage and repair.
  const gA = G.props.genA, hpA = gA.hp, o = gA.pos.clone().add(new THREE.Vector3(0, 0, 8));
  projectile(o, gA.pos.clone().sub(o).normalize(), 44, 9, null); await frames(3);
  check('machine fire damages generators', gA.hp === hpA - 9, hpA + ' -> ' + gA.hp);
  damageProp(gA, 500); const hpB = gA.hp;
  teleport(-11, -11.5); await holdE(2.9);
  check('repairing restores generator health', gA.hp > hpB, hpB + ' -> ' + gA.hp);

  G.objState.hold = 20.3; await waitSim(.3);
  check('timed waves fire during survive phases', G.fired.has('p1-west'), [...G.fired].join(','));
  G.objState.hold = 74.8; await waitSim(.5);
  check('phase 1 complete -> transfer switch trips', S().objective === 3 && G.props.switch.style === 'off', S().objective + ' ' + G.props.switch.style);
  teleport(20, -18); await holdE(3.3);
  check('switch reset -> checkpoint + bonus turret', S().objective === 4 && G.checkpoint?.name === 'Switch reset' && G.local.turrets === 2, S().objective + ' ' + G.checkpoint?.name + ' turrets=' + G.local.turrets);

  // Losing two generators fails the mission; retry restores them from the checkpoint.
  damageProp(G.props.genA, 1e6); damageProp(G.props.genC, 1e6);
  check('two generators lost', G.props.genA.style === 'wrecked' && G.props.genC.style === 'wrecked');
  await waitSim(2.5);
  check('blackout fails the mission', S().status === 'lost', S().status);
  await click('retryBtn'); godMode();
  check('retry restores generators and the deployed turret', S().objective === 4 && G.props.genA.style === 'running' && G.props.genA.hp > 0 && G.turrets.length === 1,
    'objective=' + S().objective + ' genA=' + G.props.genA.style + ' turrets=' + G.turrets.length);

  G.objState.hold = 89.8; await waitSim(.5);
  check('sync phase complete -> final push', S().objective === 5, S().objective);
  G.objState.hold = 59.8; await waitSim(3.5);
  check('final push survived -> mission won', S().status === 'won', S().status);
}

async function mission05() {
  await goNext(5);
  check('next mission -> 05 briefing', S().status === 'briefing' && S().mission === 'm05', S().mission);
  check('storm environment + Calder Dam level', G.level.id === 'calder' && G.env.sky === '#3c4750');
  await click('startBtn'); godMode();

  // Bulwark shield: bullets from the front are stopped, from behind they hurt, grenades ignore it.
  const bw = G.enemies.find(e => e.type.name === 'Bulwark');
  const fwd = new THREE.Vector3(-Math.sin(bw.yaw), 0, -Math.cos(bw.yaw));
  let hp = bw.hp; damageEnemy(bw, 31, false, G.local, { dir: fwd.clone().negate() });
  check('Bulwark shield stops frontal fire', bw.hp === hp && document.getElementById('hitmarker').classList.contains('blocked'), hp + ' -> ' + bw.hp);
  hp = bw.hp; damageEnemy(bw, 31, false, G.local, { dir: fwd.clone() });
  check('Bulwark takes damage from behind', bw.hp === hp - 31, hp + ' -> ' + bw.hp);
  hp = bw.hp; damageEnemy(bw, 40, false, G.local, { explosive: true });
  check('grenades ignore the shield', bw.hp === hp - 40, hp + ' -> ' + bw.hp);

  teleport(-33, -8); await holdE(3.3);
  check('door override opens the turbine hall', S().objective === 1 && G.props.hallWest.style === 'open' && !G.props.hallWest.mover.enabled, S().objective);
  teleport(25.5, -12.6); await holdE(3.8); await waitSim(1.5);   // the checkpoint follows a scripted radio pause
  check('logs pulled -> checkpoint + spillway door opens', S().objective === 2 && G.checkpoint?.name === 'Logs secured' && G.props.hallSouth.style === 'open', S().objective + ' ' + G.checkpoint?.name);

  for (const x of [-20, 0, 20]) { teleport(x, 26.4); await holdE(2.9); }
  check('three gates opened -> boss objective', S().objective === 3 && G.fired.has('gate-1') && G.fired.has('gate-2'), S().objective + ' ' + [...G.fired].join(','));
  let boss = G.enemies.find(e => e.def.tag === 'warden');
  await frames(3);
  check('Spillway Warden spawns with a health bar', !!boss && document.getElementById('bossBar').classList.contains('on'), boss?.hp);
  check('boss objective marker tracks the Warden', !!document.getElementById('objectiveMarker').querySelector('span').textContent);

  // Armour: almost nothing gets through until the vents open; core hits double while exposed.
  boss.exposed = false; hp = boss.hp; damageEnemy(boss, 100, false, G.local, { dir: new THREE.Vector3(0, 0, 1) });
  check('Warden armour soaks damage while closed', Math.abs((hp - boss.hp) - 12) < .01, (hp - boss.hp).toFixed(1));
  boss.exposed = true; hp = boss.hp; damageEnemy(boss, 100, true, G.local, { dir: new THREE.Vector3(0, 0, 1) });
  check('exposed core takes double damage', Math.abs((hp - boss.hp) - 200) < .01, (hp - boss.hp).toFixed(1));

  // A real bullet aimed at the exposed core hits the core sphere (it protrudes past the hull).
  G.simSteps = 0;
  const bf = new THREE.Vector3(-Math.sin(boss.yaw), 0, -Math.cos(boss.yaw));
  const core = boss.pos.clone().addScaledVector(bf, 1.85).setY(2.45), from = core.clone().addScaledVector(bf, 6);
  boss.exposed = true; hp = boss.hp;
  projectile(from, core.clone().sub(from).normalize(), 240, 31, G.local);
  G.simSteps = 1; await frames(3); G.simSteps = 6;
  check('bullet on the exposed core: headshot x armour bonus', Math.abs((hp - boss.hp) - 31 * 1.55 * 2) < .5, (hp - boss.hp).toFixed(1));

  let sawMortar = false;
  teleport(0, 8); G.simSteps = 6;
  await waitSim(6, () => { if (G.markers.length) sawMortar = true; });
  check('Warden lobs mortars with a warning ring', sawMortar);
  const n0 = G.enemies.length; boss.hp = boss.maxHp * .55; await waitSim(.4);
  check('phase 2 at 60%: reinforcements', boss.phase === 2 && G.enemies.length === n0 + 2, 'phase=' + boss.phase + ' +' + (G.enemies.length - n0));

  // Die, retry from the "Gates open" checkpoint: the Warden comes back at full health.
  G.local.health = 100; G.local.protectUntil = 0; hurt(G.local, 500, null); G.local.protectUntil = 0; hurt(G.local, 500, null);
  await frames(2);
  check('death during the boss fight', S().status === 'lost', S().status);
  await click('retryBtn'); godMode();
  boss = G.enemies.find(e => e.def.tag === 'warden' && !e.dead);
  check('retry respawns the Warden at full health', S().objective === 3 && !!boss && boss.hp === boss.maxHp, 'objective=' + S().objective + ' hp=' + boss?.hp);

  damageEnemy(boss, 1e6, false, G.local, { explosive: true });
  await waitSim(6);
  check('Warden destroyed -> Act I complete', S().status === 'won' && /Halvard/.test(document.getElementById('menuText').textContent), S().status);
}

async function mission06() {
  await goNext(6);
  check('next mission -> 06 briefing (Act II)', S().status === 'briefing' && S().mission === 'm06', S().mission);
  check('Port Calder level with three districts', G.level.id === 'portcalder' && G.level.districts.length === 3 && G.env.dark);
  await click('startBtn'); godMode();

  // DMR: zooms much further than the rifle when aiming.
  await tap('2'); await waitSim(.4);
  await tap('q'); await waitSim(.6);
  check('DMR-14 zooms when aiming', S().weapon === 'dmr' && camera.fov < 40, 'weapon=' + S().weapon + ' fov=' + camera.fov.toFixed(1));
  await tap('q');
  G.local.pitch = .5; const shots0 = S().stats.shots;
  mouse('mousedown', 0); await frames(2); mouse('mouseup', 0); await waitSim(.3);
  check('DMR fires one round per click', S().stats.shots === shots0 + 1 && S().mag === 9, 'mag=' + S().mag);

  // Rolling blackouts: districts follow the timetable; lights and the HUD readout follow.
  const litLights = () => { let n = 0; G.levelRoot.traverse(o => { if (o.isPointLight && o.intensity > 0) n++; }); return n; };
  G.elapsed = 5; updateBlackout();
  check('t=5s: Market lit, Harbour dark', districtLit(new THREE.Vector3(-30, 0, 0)) && !districtLit(new THREE.Vector3(30, 0, 0)), 'lights on=' + litLights());
  G.elapsed = 22; updateBlackout();
  check('t=22s: Market dark, Civic lit', !districtLit(new THREE.Vector3(-30, 0, 0)) && districtLit(new THREE.Vector3(0, 0, 0)) && litLights() === 4, 'lights on=' + litLights());
  teleport(0, 10); await frames(3);
  check('HUD shows the district state', /CIVIC · LIT \d+s/.test(document.getElementById('gridPill').textContent), document.getElementById('gridPill').textContent);

  // Spotter: sees the player in a lit district, marks them, calls in Skimmers after ~6 s.
  const sp = G.enemies.find(e => e.type.name === 'Spotter' && Math.abs(e.home.x) < 5);
  sp.pos.set(0, 0, -3); sp.yaw = Math.PI; sp.home.set(0, 0, -3); sp.patrol.set(0, 0, -6); sp.dest.copy(sp.patrol);
  G.elapsed = 20.5; teleport(0, 10, 0);
  const n0 = G.enemies.length;
  G.simSteps = 6; await waitSim(7.5, () => { if (G.local.pos.z !== 10) teleport(0, 10, 0); });
  check('Spotter spots the player', sp.spotting === true || sp.dead, 'state=' + sp.state);
  check('Spotter calls in reinforcements', G.enemies.filter(e => e.def.called).length === 2 && G.enemies.length === n0 + 2, '+' + (G.enemies.length - n0));
  check('spotted player is marked for nearby machines', G.enemies.some(e => e !== sp && !e.dead && e.memory > 0 && e.lastKnown.distanceTo(G.local.pos) < 3));

  for (const [x, z] of [[-20, -13.6], [3.2, 10.6], [15, 11.4]]) { teleport(x, z); await holdE(1.4); }
  check('three drives -> checkpoint', S().objective === 1 && G.checkpoint?.name === 'Drives recovered', S().objective + ' ' + G.checkpoint?.name);
  const n1 = G.enemies.length;
  teleport(-2.2, -38); await holdE(1.9);
  check('call Juno -> Halvard traces it (spawn)', S().objective === 2 && G.enemies.length === n1 + 3, S().objective + ' +' + (G.enemies.length - n1));
  teleport(40, -37); await waitSim(.5);
  check('reach the depot -> checkpoint', S().objective === 3 && G.checkpoint?.name === 'At the depot', S().objective);
  G.objState.hold = 29.7; teleport(40, -40); await waitSim(3);
  check('hold the depot -> mission won', S().status === 'won', S().status);
}

async function mission07() {
  await goNext(7);
  check('next mission -> 07 briefing', S().status === 'briefing' && S().mission === 'm07', S().mission);
  check('tunnel level, underground lighting', G.level.id === 'tunnels' && G.env.dark && G.env.sun.intensity === 0);
  await click('startBtn'); godMode(); await waitSim(.3);
  check('loadout: shotgun first, 2 smoke grenades', S().weapon === 'shotgun' && G.local.smokes === 2 && /SMOKE 2/.test(document.getElementById('weaponInfo').textContent), document.getElementById('weaponInfo').textContent);

  // A Lineman on the ceiling can be shot where it hangs.
  const hanging = G.enemies.find(e => e.def.ceiling && Math.hypot(e.home.x - 5, e.home.z - 15) < 2);
  const target = hanging.pos.clone().setY(hanging.elev - .55), from = new THREE.Vector3(hanging.pos.x - 2.5, 1.7, hanging.pos.z);
  let hp = hanging.hp; projectile(from, target.clone().sub(from).normalize(), 240, 20, G.local); await frames(3);
  check('bullets hit a Lineman on the ceiling', hanging.elev > 3 && hanging.hp < hp, 'elev=' + hanging.elev + ' hp ' + hp + '->' + hanging.hp);

  // Ceiling ambush: walk under one and it drops and attacks.
  const amb = G.enemies.find(e => e.def.ceiling && Math.hypot(e.home.x + 31, e.home.z - 8) < 2);
  const dmg0 = G.local.stats.damage;
  teleport(amb.pos.x, amb.pos.z + 2.5); await waitSim(2.5, () => teleport(amb.pos.x, amb.pos.z + 1.2));
  check('Lineman drops from the ceiling and attacks', amb.elev === 0 && G.local.stats.damage > dmg0, 'elev=' + amb.elev + ' dmg=' + (G.local.stats.damage - dmg0));
  damageEnemy(amb, 999, false, G.local);

  // Smoke: a cloud between two points blocks machines' line of sight.
  teleport(-31, 18, 0); G.local.pitch = 0; await tap('v'); await waitSim(2.6);
  const cloud = G.smokes[0];
  check('smoke grenade makes a cloud', G.smokes.length === 1 && G.local.smokes === 1, 'clouds=' + G.smokes.length);
  check('smoke blocks sight through it', !!cloud && smokeBlocks(cloud.pos.clone().add(new THREE.Vector3(0, 0, 8)), cloud.pos.clone().add(new THREE.Vector3(0, 0, -8))));

  // Water: wading is slow.
  teleport(16, -1, Math.PI / 2); const x0 = G.local.pos.x, t0 = G.elapsed;
  key('keydown', 'w'); await waitSim(.5); key('keyup', 'w');
  const rate = Math.abs(G.local.pos.x - x0) / (G.elapsed - t0);
  check('wading through the flood is slow', rate > 1.5 && rate < 2.8, rate.toFixed(2) + ' m/s (dry: 4.2)');

  const seen = [];
  for (const [x, z] of [[-21, 10.4], [13, 17], [-15.5, -23]]) { teleport(x, z); G.simSteps = 1; await frames(2); seen.push(G.local.interaction?.type ?? 'none'); G.simSteps = 6; await holdE(2.6); }
  check('three feeders cut -> checkpoint', S().objective === 1 && G.checkpoint?.name === 'Feeders cut' && G.props.cableA.style === 'cut', S().objective + ' ' + G.checkpoint?.name + ' [' + seen + '] ' + S().status + ' hp=' + Math.round(G.local.health));
  teleport(19.5, -19); await holdE(3.3); await waitSim(.5);
  check('interconnector tripped -> door opens + checkpoint', S().objective === 2 && G.props.vaultEast.style === 'open' && G.checkpoint?.name === 'Interconnector down', S().objective);
  check('escape timer shown', /⏱ 1:1\d/.test(document.getElementById('objectiveSub').textContent), document.getElementById('objectiveSub').textContent);

  G.objState.t = 74.6; await waitSim(2.5);
  check('timer runs out -> sealed in (fail)', S().status === 'lost', S().status);
  await click('retryBtn'); godMode();
  check('retry restarts the escape with a fresh timer', S().status === 'playing' && S().objective === 2 && G.objState.t < 3, 't=' + G.objState.t.toFixed(1));
  teleport(31.5, -36); await waitSim(3);
  check('reach exit shaft -> mission won', S().status === 'won', S().status);
}

async function mission08() {
  await goNext(8);
  check('next mission -> 08 briefing', S().status === 'briefing' && S().mission === 'm08', S().mission);
  await click('startBtn'); godMode();
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  check('initial state: west + north live, east + south dead', liveAt(V(-25, 0)) && liveAt(V(0, -12)) && !liveAt(V(25, 0)) && !liveAt(V(0, 12)));

  // Live sections hurt players (with a HUD warning) and fry machines.
  await waitSim(Math.max(0, G.protectUntil - G.elapsed) + .2);   // past spawn protection
  let dmg0 = G.local.stats.damage;
  teleport(-25, 0); await waitSim(.8);
  check('standing in a live section hurts', G.local.stats.damage > dmg0 && document.getElementById('liveWarn').classList.contains('on'), 'dmg=' + (G.local.stats.damage - dmg0).toFixed(0));
  const laneBot = G.enemies[0];
  laneBot.pos.set(-25, 0, 8); laneBot.home.copy(laneBot.pos); laneBot.patrol.set(-25, 0, 12); laneBot.dest.copy(laneBot.patrol); laneBot.memory = 0; laneBot.state = 'patrol';
  await waitSim(1.5);
  check('machines in live sections take damage', laneBot.hp < laneBot.maxHp || laneBot.dead, laneBot.hp.toFixed(0) + '/' + laneBot.maxHp);

  // Interlock: closing B while A is still closed = arc flash, B trips back open.
  teleport(12, -21.6); dmg0 = G.local.stats.damage; await holdE(1.6);
  check('unsafe close -> arc flash, breaker trips', G.props.panelB.style === 'off' && G.local.stats.damage - dmg0 >= 30 && G.messages.some(m => /FAULT/.test(m.text)), 'B=' + G.props.panelB.style + ' dmg=' + (G.local.stats.damage - dmg0).toFixed(0));

  // Safe order: open A, open C, close D, close B.
  teleport(-12, -21.6); await holdE(1.6);
  check('open A -> west lane dead', G.props.panelA.style === 'off' && !liveAt(V(-25, 0)) && G.fired.has('a-open'));
  check('objective shows breaker states', /A ○/.test(document.getElementById('objectiveSub').textContent) && /C ●/.test(document.getElementById('objectiveSub').textContent), document.getElementById('objectiveSub').textContent);
  teleport(-23, 22.4); await holdE(1.6);
  check('open C -> north strip dead', G.props.panelC.style === 'off' && !liveAt(V(0, -12)) && G.fired.has('c-open'));
  teleport(13, 24.4); await holdE(1.6);
  check('close D -> south strip live', G.props.panelD.style === 'on' && liveAt(V(0, 12)));
  teleport(12, -21.6); await holdE(1.6); await waitSim(.4);
  check('close B -> Feeder 7 routed + checkpoint', S().objective === 1 && G.checkpoint?.name === 'Feeder routed' && liveAt(V(25, 0)), S().objective + ' ' + G.checkpoint?.name);
  G.objState.hold = 39.7; teleport(-8, 2); await waitSim(3);
  check('hold while Feeder 7 syncs -> mission won', S().status === 'won', S().status);
}

async function mission09() {
  await goNext(9);
  check('next mission -> 09 briefing', S().status === 'briefing' && S().mission === 'm09', S().mission);
  check('elevated viaduct level', G.level.id === 'viaduct' && G.escort?.cfg.prop === 'train');
  await click('startBtn'); godMode();
  const train = G.props.train, E = G.escort;
  teleport(-7.2, train.pos.z); await waitSim(1);
  check('train stays put until section 1 is powered', E.s === 0, E.s);
  teleport(-8.6, 60.3); await holdE(2.1);
  check('section 1 powered', S().objective === 1 && G.props.cab1.style === 'on', S().objective);

  // Ride alongside, clearing machines that close in on the train.
  const ride = () => {
    teleport(-7.2, train.pos.z, 0);
    for (const e of G.enemies) if (!e.dead && Math.hypot(e.pos.x - train.pos.x, e.pos.z - train.pos.z) < 16) damageEnemy(e, 999, false, G.local);
  };
  G.simSteps = 10;
  await waitSim(40, () => { ride(); if (G.objective >= 2) G.simSteps = 6; });
  check('train reaches Market Street -> checkpoint', S().objective === 2 && G.checkpoint?.name === 'Market Street' && Math.abs(train.pos.z - 8) < .5, 'objective=' + S().objective + ' z=' + train.pos.z.toFixed(1));
  const n0 = G.enemies.length;
  teleport(-4, 8); G.objState.hold = 24.8; await waitSim(.6);
  check('boarding hold done -> section 2 cut, ambush', S().objective === 3 && G.props.cab2.style === 'off' && G.enemies.length > n0, S().objective);
  teleport(8.6, -11.8); await holdE(3.3);
  check('section 2 reset', S().objective === 4 && G.props.cab2.style === 'on', S().objective);
  G.simSteps = 10;
  await waitSim(60, ride);
  check('escort triggers fired on the way to the harbour', G.fired.has('below') && G.fired.has('harbour-gate'), [...G.fired].join(','));
  check('train reaches Harbour Terminus -> mission won', S().status === 'won', S().status + ' z=' + train.pos.z.toFixed(1) + ' armour=' + Math.round(E.hp / E.maxHp * 100) + '%');
  G.simSteps = 6;
}

async function mission10() {
  await goNext(10);
  check('next mission -> 10 briefing', S().status === 'briefing' && S().mission === 'm10', S().mission);
  check('freight yard level', G.level.id === 'railyard');
  await click('startBtn'); godMode();

  // Factions: a Tallyman and a LODESTAR sentry fight each other with no player involved.
  teleport(-40, 34);
  const tm = addEnemy({ type: 'tallyman', at: [0, -10] }), sn = addEnemy({ type: 'sentry', at: [0, 4] });
  tm.yaw = Math.PI; sn.yaw = 0; tm.memory = sn.memory = 0;
  await waitSim(Math.max(0, G.protectUntil + .6 - G.elapsed));
  // They must target each other, and the fight must draw blood (either side can win it).
  let tmOnSn = false, snOnTm = false;
  const watch = () => { if (tm.target === sn) tmOnSn = true; if (sn.target === tm) snOnTm = true; };
  const blood = () => tm.hp < tm.maxHp || tm.dead || sn.hp < sn.maxHp || sn.dead;
  for (let k = 0; k < 12 && !(tmOnSn && snOnTm && blood()); k++) await waitSim(1, watch);
  check('Tallymen and LODESTAR machines fight each other', tmOnSn && snOnTm && blood(), 'tallyman ' + tm.hp.toFixed(0) + '/' + tm.maxHp + ' sentry ' + sn.hp.toFixed(0) + '/' + sn.maxHp + ' targeting ' + tmOnSn + '/' + snOnTm);
  damageEnemy(tm, 999, false, G.local); damageEnemy(sn, 999, false, G.local);

  teleport(-30, 22.6); await holdE(1.7); teleport(-20, 14.1); await holdE(1.7);
  check('points thrown -> checkpoint + Ironwalker', S().objective === 1 && G.checkpoint?.name === 'Points set' && G.props.leverA.style === 'reverse', S().objective);
  const iw = G.enemies.find(e => e.def.tag === 'ironwalker');
  check('Ironwalker spawns with a boss bar', !!iw && iw.hp === iw.maxHp);

  let hp = iw.hp; damageEnemy(iw, 100, false, G.local, {});
  check('armour: body hits do 4%', Math.abs((hp - iw.hp) - 4) < .01, (hp - iw.hp).toFixed(2));

  // A real bullet at the left knee hits the knee (absorbed into its own health).
  G.simSteps = 0;
  const kneeAt = iw.pos.clone().add(new THREE.Vector3(-1.7, 0, -.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), iw.yaw)).setY(2.7);
  const from = kneeAt.clone().add(new THREE.Vector3(-Math.sin(iw.yaw), 0, -Math.cos(iw.yaw)).multiplyScalar(6));
  hp = iw.hp; projectile(from, kneeAt.clone().sub(from).normalize(), 240, 31, G.local);
  G.simSteps = 1; await frames(3); G.simSteps = 6;
  check('bullets hit the knee actuators', iw.knees.kneeL < 420 && iw.hp === hp, 'kneeL=' + iw.knees.kneeL.toFixed(0));

  damageEnemy(iw, 999, false, G.local, { part: 'kneeL' }); damageEnemy(iw, 999, false, G.local, { part: 'kneeR' });
  await frames(3);
  check('both knees down -> kneels, core exposed', iw.kneeling && iw.exposed && document.getElementById('bossBar').classList.contains('exposed') && document.getElementById('bossBar').dataset.weak === 'CORE EXPOSED');
  hp = iw.hp; damageEnemy(iw, 100, true, G.local, {});
  check('exposed core takes heavy damage', Math.abs((hp - iw.hp) - 220) < .01, (hp - iw.hp).toFixed(1));

  const n0 = G.enemies.length; iw.kneelTimer = .01; await waitSim(.4);
  check('stands back up: phase 2, knees patched, Linemen called', !iw.kneeling && iw.phase === 2 && iw.knees.kneeL > 0 && G.enemies.length === n0 + 2, 'phase=' + iw.phase);

  iw.hp = iw.maxHp * .65; await waitSim(.5);
  check('Tallymen enter at 70% boss health', G.fired.has('tallymen') && G.enemies.filter(e => e.def.tag === 'tallyman').length === 4);

  damageEnemy(iw, 999, false, G.local, { part: 'kneeL' }); damageEnemy(iw, 999, false, G.local, { part: 'kneeR' });
  damageEnemy(iw, 1e6, true, G.local, {}); await waitSim(.5);
  check('Ironwalker destroyed -> clear the Tallymen', S().objective === 2 && G.checkpoint?.name === 'Ironwalker down', S().objective);
  for (const e of G.enemies) if (e.def.tag === 'tallyman') damageEnemy(e, 1e6, false, G.local);
  await waitSim(6);
  check('Tallymen cleared -> Act II complete', S().status === 'won', S().status);
}

async function mission11() {
  await goNext(11);
  check('next mission -> 11 briefing (Act III)', S().status === 'briefing' && S().mission === 'm11', S().mission);
  await click('startBtn'); godMode(); await waitSim(.3);
  check('storm: wind, rain, wind readout', windVec().length() > 3 && document.getElementById('windPill').classList.contains('on') && S().weapon === 'arc', 'wind=' + windVec().length().toFixed(1));

  // Wind pushes a grenade dropped from height.
  const w0 = windVec().clone().normalize(), drop = new THREE.Vector3(-40, 12, 40);
  spawnBomb(drop.clone(), new THREE.Vector3(0, 0, 0), G.local, 'smoke');
  const bomb = G.bombs.at(-1); await waitSim(.6);
  const drift = bomb.pos.clone().sub(drop).setY(0);
  check('wind pushes grenades downwind', drift.length() > .3 && drift.normalize().dot(w0) > .8, drift.length().toFixed(2) + ' m');

  // Arc carbine: stun + chain through a group of machines.
  teleport(-40, 34, 0); G.simSteps = 0;
  const grp = [addEnemy({ type: 'sentry', at: [-40, 20] }), addEnemy({ type: 'sentry', at: [-37, 19] }), addEnemy({ type: 'sentry', at: [-43, 18] })];
  for (const e of grp) { e.yaw = 0; e.pos.set(e.def.at[0], 0, e.def.at[1]); }
  const tgt = grp[0].pos.clone().setY(1.2), o = new THREE.Vector3(-40, 1.7, 30);
  projectile(o, tgt.clone().sub(o).normalize(), 150, 24, G.local, false, false, null, 'arc');
  G.simSteps = 1; await frames(6); G.simSteps = 6;
  check('arc bolt stuns its target', grp[0].hp < grp[0].maxHp && grp[0].stunned > 0, 'hp=' + grp[0].hp.toFixed(0) + ' stun=' + (grp[0].stunned ?? 0).toFixed(2));
  check('arc chains to two nearby machines', grp.slice(1).every(e => e.hp < e.maxHp && e.stunned > 0), grp.map(e => e.hp.toFixed(0)).join(','));
  const at0 = grp[0].pos.clone(); await waitSim(.6);
  check('stunned machines freeze', grp[0].pos.distanceTo(at0) < .05, grp[0].pos.distanceTo(at0).toFixed(3));
  for (const e of grp) damageEnemy(e, 999, false, G.local);

  // Lightning.
  await waitSim(Math.max(0, G.protectUntil + .3 - G.elapsed));
  const s0 = addEnemy({ type: 'sentry', at: [20, 40] }), dmg0 = G.local.stats.damage;
  lightningStrike(s0.pos.x, s0.pos.z); lightningStrike(G.local.pos.x, G.local.pos.z);
  check('lightning hurts machines and players', (s0.hp < s0.maxHp || s0.dead) && G.local.stats.damage > dmg0, 'sentry ' + s0.hp.toFixed(0) + ' dmg ' + (G.local.stats.damage - dmg0).toFixed(0));
  G.nextStrike = 0; await waitSim(.3);
  check('scheduled strike shows a warning ring first', G.strikes.length === 1 && G.markers.length > 0);
  await waitSim(1.8);
  check('then the strike lands', G.strikes.length === 0);

  for (const [x, z] of [[-30 + 1.6, -30 + 4.6], [32 + 1.6, -28 + 4.6], [-4 + 1.6, 36 + 4.6]]) { teleport(x, z); await holdE(2.7); }
  check('three lead turbines released -> whole string spins + checkpoint', S().objective === 1 && G.props.tA.style === 'running' && G.props.tT4.style === 'running' && G.checkpoint?.name === 'Turbines spinning', JSON.stringify({ o: S().objective, c: [...G.objState.collected], st: S().status, pos: G.local.pos.toArray().map(v => v.toFixed(1)), it: G.local.interaction?.name, ov: G.overlay }));
  const n0 = G.enemies.length;
  teleport(1.2, .3); await holdE(2.3);
  check('collector closed -> Tallymen inbound', S().objective === 2 && G.enemies.length >= n0 + 3, S().objective);
  G.objState.hold = 15.1; await waitSim(.3); G.objState.hold = 30.1; await waitSim(.3);
  check('timed waves: LODESTAR push + Tallyman flank', G.fired.has('lodestar-push') && G.fired.has('tally-flank'));
  G.objState.hold = 44.8; await waitSim(3);
  check('collector held -> mission won', S().status === 'won', S().status);
}

/** Every mission: spawn points are clear in the data, and the player can walk away from the start. */
async function spawnSafety() {
  const flow = await import('../src/game/flow.js');
  for (let i = 0; i < CAMPAIGN.length; i++) {
    const m = CAMPAIGN[i];
    flow.selectMission(i); await frames(2);
    const bad = m.spawns.filter(([x, z]) => moveBlocked(x, z));
    check(m.id + ': spawn points are clear', bad.length === 0, bad.map(q => q.slice(0, 2).join(',')).join(' | '));
    await click('startBtn'); godMode();
    let moved = 0;
    for (const k of ['w', 's', 'a', 'd']) {
      const p0 = G.local.pos.clone();
      key('keydown', k); await waitSim(.35); key('keyup', k); await frames(1);
      moved = Math.max(moved, G.local.pos.distanceTo(p0));
      if (moved > .5) break;
    }
    check(m.id + ': player can walk away from the start', moved > .5, moved.toFixed(2) + ' m');
  }
  try { localStorage.removeItem('riverbend.progress.v1'); } catch { /* ignore */ }
  flow.selectMission(0); await frames(3);
}

async function mission12() {
  await goNext(12);
  check('mission 12 briefing, relay ridge', S().status === 'briefing' && S().mission === 'm12' && G.level.id === 'ridge', S().mission);
  await click('startBtn'); godMode();
  check('two turrets: one relay always depends on you', G.local.turrets === 2);
  const R = ['relayW', 'relayC', 'relayE'].map(id => G.props[id]);
  for (const r of R) { teleport(r.pos.x, r.pos.z + 2); await holdE(2.1); }
  check('relays powered -> uplink + checkpoint', S().objective === 1 && R.every(r => r.style === 'online') && G.checkpoint?.name === 'Relays online', S().objective);

  // Uplink speed scales with the number of relays online.
  const rate = async () => { const h0 = G.objState.hold, t0 = G.elapsed; await waitSim(1.5); return (G.objState.hold - h0) / (G.elapsed - t0); };
  const full = await rate();
  check('all three online: full-speed uplink', Math.abs(full - 1) < .05, full.toFixed(2));
  damageProp(R[0], 1e6); await frames(2);
  check('a relay is knocked offline (not destroyed)', R[0].style === 'offline' && /West relay ○/.test(document.getElementById('objectiveSub').textContent), R[0].style + ' · ' + document.getElementById('objectiveSub').textContent);
  const two = await rate();
  check('two online: two-thirds speed', Math.abs(two - 2 / 3) < .05, two.toFixed(2));
  teleport(R[0].pos.x, R[0].pos.z + 1.5); await holdE(3.3);
  check('hold E reboots an offline relay at half health', R[0].style === 'online' && Math.abs(R[0].hp - R[0].maxHp * .5) < 1, R[0].style + ' ' + R[0].hp.toFixed(0));
  damageProp(R[1], 300); const hp1 = R[1].hp;
  teleport(R[1].pos.x, R[1].pos.z + 1.5); await holdE(2.8);
  check('damaged relays can be patched', R[1].hp > hp1, hp1.toFixed(0) + ' -> ' + R[1].hp.toFixed(0));

  const n0 = G.enemies.length; G.objState.hold = 15.1; await waitSim(.4);
  check('Tallymen join at 15 s of uplink', G.fired.has('tallymen') && G.enemies.filter(e => e.type.name === 'Tallyman').length >= 3 && G.enemies.length >= n0 + 3);
  G.objState.hold = 89.8; await waitSim(3);
  check('uplink complete -> mission won', S().status === 'won', S().status);
}

async function mission13() {
  await goNext(13);
  check('mission 13 briefing: relay ridge at night', S().status === 'briefing' && S().mission === 'm13' && G.env.dark, S().mission);
  await click('startBtn'); godMode(); await frames(3);
  const shown = id => getComputedStyle(document.getElementById(id)).display !== 'none';
  check('EMP: minimap and objective marker offline, compass scrambled', document.body.classList.contains('emp') && !shown('minimap') && !shown('objectiveMarker') && !/^[NSEW]/.test(document.getElementById('compass').textContent), document.getElementById('compass').textContent);
  check('kit beacons are lit', ['beamA', 'beamB', 'beamC'].every(id => G.props[id].style === 'on'));
  await waitSim(Math.max(0, G.protectUntil + .3 - G.elapsed));

  // Arc lobber: it lobs at the player, and the field it leaves hurts.
  const lb = G.enemies.find(e => e.type.name === 'Arc lobber');
  lb.pos.set(-30, 0, -18); lb.yaw = Math.PI; lb.state = 'engage'; lb.memory = 7; lb.shot = 0; teleport(-30, -2, Math.PI);   // facing the player, alerted
  const dmg0 = G.local.stats.damage; let sawField = false;
  for (let k = 0; k < 12 && !sawField; k++) await waitSim(.5, () => { if (G.fields.length) sawField = true; teleport(-30, -2, Math.PI); });
  await waitSim(1.2);
  check('Arc lobber leaves an electric field where you stood', sawField && G.local.stats.damage > dmg0, 'fields=' + G.fields.length + ' dmg=' + (G.local.stats.damage - dmg0).toFixed(0));
  damageEnemy(lb, 999, false, G.local);

  // Fields hurt the other faction, not their own.
  teleport(40, 20);
  const own = addEnemy({ type: 'sentry', at: [-50, 20] }), other = addEnemy({ type: 'tallyman', at: [-48, 20] });
  own.pos.set(-50, 0, 20); other.pos.set(-49, 0, 20); own.stunned = other.stunned = 3;
  makeField(-49.5, 20, 'lodestar'); await waitSim(.8);
  check('fields spare their own faction', own.hp === own.maxHp && other.hp < other.maxHp, 'sentry ' + own.hp.toFixed(0) + ' tallyman ' + other.hp.toFixed(0));
  damageEnemy(own, 999, false, G.local); damageEnemy(other, 999, false, G.local);

  // EMP grenade stuns every machine around the blast.
  const grp = [addEnemy({ type: 'sentry', at: [30, -10] }), addEnemy({ type: 'skimmer', at: [33, -10] }), addEnemy({ type: 'tallyman', at: [30, -13] })];
  grp.forEach((e, i) => e.pos.set([30, 33, 30][i], 0, [-10, -10, -13][i]));
  const emps0 = G.local.emps; spawnBomb(new THREE.Vector3(31, .5, -11), new THREE.Vector3(), G.local, 'emp'); await waitSim(1.9);
  check('EMP grenade stuns machines of both factions', grp.every(e => e.stunned > 2), grp.map(e => (e.stunned ?? 0).toFixed(1)).join(','));
  check('player has 2 EMP grenades', emps0 === 2 && /EMP 2/.test(document.getElementById('weaponInfo').textContent));
  for (const e of grp) damageEnemy(e, 999, false, G.local);

  for (const id of ['kitA', 'kitB', 'kitC']) { const k = G.props[id]; teleport(k.pos.x, k.pos.z + 1.5); await holdE(1.6); }
  check('kit recovered -> beams off, dome beam on, checkpoint', S().objective === 1 && G.props.beamA.style === 'off' && G.props.beamDome.style === 'on' && G.checkpoint?.name === 'Kit recovered', S().objective);
  teleport(20, 1.2); await holdE(2.8); await waitSim(.3);
  check('transmitter keyed -> LZ beam on', S().objective === 2 && G.props.beamLZ.style === 'on', S().objective);
  G.objState.hold = 39.8; teleport(-20, 2); await waitSim(3);
  check('LZ held -> mission won', S().status === 'won', S().status);
  document.body.classList.remove('emp');
}

async function mission14() {
  await goNext(14);
  check('mission 14: snowbound yard', S().status === 'briefing' && S().mission === 'm14' && G.level.id === 'railyardSnow' && G.env.sky === '#c9d6e0', S().mission);
  await click('startBtn'); godMode(); await frames(3);

  // Hauler armour: front and sides barely scratched; the rear radiator takes heavy damage.
  const h = G.enemies.find(e => e.type.name === 'Hauler'), fwd = new THREE.Vector3(-Math.sin(h.yaw), 0, -Math.cos(h.yaw));
  let hp = h.hp; damageEnemy(h, 100, false, G.local, { dir: fwd.clone().negate() });
  check('Hauler front armour: 15%', Math.abs((hp - h.hp) - 15) < .01, (hp - h.hp).toFixed(1));
  hp = h.hp; damageEnemy(h, 100, false, G.local, { dir: fwd.clone() });
  check('Hauler rear radiator: 160%', Math.abs((hp - h.hp) - 160) < .01, (hp - h.hp).toFixed(1));
  G.simSteps = 0;
  const back = h.pos.clone().addScaledVector(fwd, -9).setY(1.4), aim = h.pos.clone().setY(1.3);
  hp = h.hp; projectile(back, aim.clone().sub(back).normalize(), 240, 31, G.local);
  G.simSteps = 1; await frames(4); G.simSteps = 6;
  check('a bullet from behind hits the radiator for full damage', Math.abs((hp - h.hp) - 31 * 1.6) < .5, (hp - h.hp).toFixed(1));

  const bats = ['batA', 'batB', 'batC'].map(id => G.props[id]);
  const start = bats[0].pos.clone();
  teleport(bats[0].pos.x, bats[0].pos.z + 1.5); await holdE(2.7);
  await waitSim(1.5);
  check('a coupled wagon is shunted toward the train', bats[0].style === 'coupled' && bats[0].pos.distanceTo(start) > 2, bats[0].pos.distanceTo(start).toFixed(1) + ' m');
  for (const b of bats.slice(1)) { teleport(b.pos.x, b.pos.z + 1.5); await holdE(2.7); }
  check('all three coupled -> checkpoint', S().objective === 1 && G.checkpoint?.name === 'Batteries coupled', S().objective);
  G.simSteps = 10; await waitSim(14); G.simSteps = 6;
  const at = id => { const d = G.mission.props.find(q => q.id === id).to; return Math.hypot(G.props[id].pos.x - d[0], G.props[id].pos.z - 2.2 - d[1]); };
  check('wagons reach their slots behind the loco', ['batA', 'batB', 'batC'].every(id => at(id) < .1), ['batA', 'batB', 'batC'].map(id => at(id).toFixed(2)).join(','));

  // Retry from the checkpoint: the wagons are already in place.
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; hurt(G.local, 500, null); G.local.protectUntil = 0; hurt(G.local, 500, null); await frames(2);
  check('death after coupling', S().status === 'lost', S().status);
  await click('retryBtn'); godMode(); await frames(3);
  check('retry: wagons already coupled behind the loco', S().objective === 1 && ['batA', 'batB', 'batC'].every(id => at(id) < .1), ['batA', 'batB', 'batC'].map(id => at(id).toFixed(2)).join(','));

  teleport(-38, 28.6); await holdE(2.3);
  check('locomotive started -> hold', S().objective === 2 && G.checkpoint?.name === 'Loco started', S().objective);
  G.objState.hold = 15.1; await waitSim(.3);
  check('Tallymen wave during the hold', G.fired.has('tally-wave'));
  G.objState.hold = 44.8; await waitSim(3);
  check('train rolls -> mission won', S().status === 'won', S().status);
}

async function mission15() {
  await goNext(15);
  check('mission 15: Halvard office at night', S().status === 'briefing' && S().mission === 'm15' && G.level.id === 'office', S().mission);
  await click('startBtn'); godMode(); await frames(3);
  check('stealth readout: UNDETECTED', document.getElementById('stealthPill').textContent === 'UNDETECTED' && S().weapon === 'spistol');

  // A camera sees you: the meter fills; step out of view and it drains.
  await waitSim(Math.max(0, G.protectUntil + 1.2 - G.elapsed), () => teleport(-37, 10));   // detection grace at mission start
  const cl = G.props.camLobby;
  G.simSteps = 1;   // fine steps so the meter doesn't overshoot into an alarm
  teleport(0, 14, 0); await waitSim(.5, () => { cl.yaw = 0; teleport(0, 14, 0); });
  const m1 = G.stealth.meter; teleport(-37, 10); G.simSteps = 6;
  check('a camera fills the detection meter', m1 > .3 && !G.stealth.alarm && /DETECTED/.test(document.getElementById('stealthPill').textContent), m1.toFixed(2));
  teleport(-37, 10); await waitSim(1.2);
  check('out of view, detection drains', G.stealth.meter < m1, G.stealth.meter.toFixed(2));

  // Silent takedown from behind an unaware guard.
  G.stealth.meter = 0;
  const gd = G.enemies.find(e => e.def.guard && Math.abs(e.home.x + 24) < 1 && e.home.z < -5);   // executive suite: no cameras
  gd.state = 'patrol'; gd.memory = 0; gd.yaw = 0; gd.home.copy(gd.pos); gd.patrol.copy(gd.pos); gd.dest.copy(gd.pos);   // standing still, facing north
  const gf = new THREE.Vector3(-Math.sin(gd.yaw), 0, -Math.cos(gd.yaw));
  const behind = () => teleport(gd.pos.x - gf.x * 1.3, gd.pos.z - gf.z * 1.3, gd.yaw);
  behind(); G.simSteps = 1; await frames(2);
  const offered = G.local.interaction?.type === 'takedown';
  key('keydown', 'e'); await waitSim(.6, () => { gd.yaw = 0; behind(); }); key('keyup', 'e'); G.simSteps = 6;
  check('silent takedown from behind', offered && gd.dead && !G.stealth.alarm, 'offered=' + offered + ' dead=' + gd.dead);

  // Suppressed pistol barely carries; the rifle wakes the building.
  const listener = G.enemies.find(e => !e.dead && e.def.guard && e.home.x > 10 && e.home.z < -5);   // server room guard
  teleport(listener.pos.x + 10, listener.pos.z, -Math.PI / 2); listener.memory = 0; listener.state = 'patrol'; G.local.pitch = .9;
  await tap('1'); await waitSim(.3); mouse('mousedown', 0); await frames(1); mouse('mouseup', 0); await frames(2);
  const quiet = listener.memory === 0;
  await tap('2'); await waitSim(.4); mouse('mousedown', 0); await frames(2); mouse('mouseup', 0); await frames(2);
  check('suppressed shots stay quiet; rifle fire alerts guards', quiet && listener.memory > 0, 'quiet=' + quiet + ' mem=' + listener.memory.toFixed(1));
  // The rifle shot woke every guard in earshot (as it would in play); settle them before carrying on.
  for (const e of G.enemies) if (!e.dead) { e.memory = 0; e.state = 'patrol'; e.target = null; e.visible = false; }
  G.stealth.meter = 0;

  teleport(15, 13.2); await holdE(2.7);
  check('security terminal loops every camera', ['camCorW', 'camCorE', 'camLobby', 'camServer', 'camOffices'].every(id => G.props[id].style === 'off') && G.props.secTerm.used);

  teleport(-32.5, 9); await holdE(2.7);
  check('side door bypassed', S().objective === 1 && G.props.sideDoor.style === 'open', S().objective);
  damageEnemy(listener, 1e6, false, G.local);   // deal with the server-room guard first, as a player would
  const n0 = G.enemies.length;
  check('still undetected before the copy', !G.stealth.alarm, G.stealth.meter.toFixed(2));
  teleport(24, -12.1); await holdE(6.3); await waitSim(.5);
  check('copying the logs trips the alarm + checkpoint', S().objective === 2 && G.stealth.alarm && G.checkpoint?.name === 'Logs copied' && G.enemies.length >= n0 + 3, 'alarm=' + G.stealth.alarm);
  check('escape timer shown', /⏱/.test(document.getElementById('objectiveSub').textContent));
  const n1 = G.enemies.length; G.stealth.waveT = .05; await waitSim(.4);
  check('alarm keeps sending Tallymen', G.enemies.length === n1 + 2, '+' + (G.enemies.length - n1));
  teleport(-36, 9); await waitSim(3);
  check('out to the yard -> Act III complete', S().status === 'won' && /overload LODESTAR/.test(document.getElementById('menuText').textContent), S().status);

  // Replay: linger in a camera's view and it raises the alarm by itself.
  await click(document.getElementById('replayBtn') ? 'replayBtn' : 'restartBtn'); godMode(); await frames(3);
  const c2 = G.props.camLobby;
  await waitSim(Math.max(0, G.protectUntil + 1.2 - G.elapsed), () => teleport(-37, 10));
  await waitSim(2, () => { c2.yaw = 0; teleport(0, 14, 0); });
  check('staying on camera raises the alarm', G.stealth.alarm && document.getElementById('stealthPill').textContent === 'ALARM');
}

function aimAt(target) {
  const eye = G.local.pos.clone().setY(G.local.crouched ? 1.05 : 1.62), d = target.clone().sub(eye);
  G.local.yaw = Math.atan2(-d.x, -d.z); G.local.pitch = Math.asin(d.y / d.length()); G.local.kick = 0;
}

async function mission16() {
  await goNext(16);
  check('mission 16: peaker plant at dusk', S().status === 'briefing' && S().mission === 'm16' && G.level.id === 'peaker', S().mission);
  await click('startBtn'); godMode(); await frames(3);
  check('LR-40 launcher in hand', S().weapon === 'launcher' && G.local.ammo.launcher.mag === 4, S().weapon);

  // A round fired from close range is a dud; one that has flown 4 m bursts on impact.
  for (const e of G.enemies) e.g.visible = true;
  teleport(0, 31, 0); G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0;
  G.local.pitch = -1.25; mouse('mousedown', 0); await frames(1); mouse('mouseup', 0);
  await waitSim(.8);
  check('a round that hits inside 4 m is a dud (no blast)', G.local.health === 100 && G.local.ammo.launcher.mag === 3, G.local.health);
  godMode();
  const h = G.enemies.find(e => e.type.name === 'Hauler');
  h.state = 'patrol'; h.patrol.copy(h.pos); h.home.copy(h.pos); h.dest.copy(h.pos);
  const fwd = new THREE.Vector3(-Math.sin(h.yaw), 0, -Math.cos(h.yaw));
  teleport(h.pos.x + fwd.x * 14, h.pos.z + fwd.z * 14); aimAt(h.pos.clone().setY(1.3));
  const hp0 = h.hp; G.simSteps = 1; await waitSim(.6); mouse('mousedown', 0); await frames(1); mouse('mouseup', 0);
  await waitSim(1, () => aimAt(h.pos.clone().setY(1.3))); G.simSteps = 6;
  check('an HE round wrecks a Hauler head-on (no armour vs HE)', hp0 - h.hp > 140, (hp0 - h.hp).toFixed(0));
  damageEnemy(h, 1e6, false, G.local);

  const D = G.props.diesel, C = G.props.compressor, U = G.props.unit2;
  check('plant starts cold', [D, C, U].every(q => q.style === 'cold'));
  teleport(-30, 22.4, Math.PI); await holdE(3.3);
  check('diesel cranked -> speed gauge', S().objective === 1 && D.style === 'running' && /Diesel speed/.test(document.getElementById('objectiveSub').textContent), S().objective);
  await waitSim(1); const g1 = G.objState.hold;
  check('gauge climbs while the diesel runs', g1 > .5, g1.toFixed(2));
  damageProp(D, 1e6); const g2 = G.objState.hold; await waitSim(1);
  check('a tripped diesel stalls the sequence', D.style === 'tripped' && Math.abs(G.objState.hold - g2) < .01, D.style);
  teleport(-30, 22.4, Math.PI); G.simSteps = 1; await frames(2);
  const reboot = G.local.interaction?.type === 'reboot'; G.simSteps = 6;
  await holdE(3.3);
  check('hold E restarts it', reboot && D.style === 'running', 'offered=' + reboot);
  G.objState.hold = 24.9; await waitSim(.5);
  check('diesel at speed -> checkpoint', S().objective === 2 && G.checkpoint?.name === 'Diesel at speed' && !G.fired.has('gas-lobber'), S().objective);

  teleport(-16, 25.4, 0); await holdE(1.8);
  teleport(28, 22.4, Math.PI); await holdE(2.8);
  check('aux breaker + compressor -> fuel gas pressure', S().objective === 4 && G.props.auxBkr.style === 'on' && C.style === 'running', S().objective);
  damageProp(C, 1e6); let a = G.objState.hold; await waitSim(2); const half = G.objState.hold - a;
  C.setStyle('running'); C.hp = C.maxHp; a = G.objState.hold; await waitSim(2); const full = G.objState.hold - a;
  check('pressure builds at half rate with one machine down', Math.abs(half / full - .5) < .12, (half / full).toFixed(2));
  G.objState.hold = 18.1; await waitSim(.3);
  check('lobber wave during the pressure build', G.fired.has('gas-lobber'));
  for (const e of G.enemies) if (!e.dead) damageEnemy(e, 1e6, false, G.local);   // raiders could trip a machine just as we jump
  for (const id of ['diesel', 'compressor']) { G.props[id].setStyle('running'); G.props[id].hp = G.props[id].maxHp; }
  G.objState.hold = 39.9; await waitSim(.5);
  check('fuel gas up -> checkpoint', S().objective === 5 && G.checkpoint?.name === 'Fuel gas up', S().objective);

  // Death and retry: the plant comes back as it was at the checkpoint.
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; hurt(G.local, 500, null); G.local.protectUntil = 0; hurt(G.local, 500, null); await frames(2);
  await click('retryBtn'); godMode(); await frames(3);
  check('retry: diesel and compressor still running', S().objective === 5 && G.props.diesel.style === 'running' && G.props.compressor.style === 'running' && G.props.unit2.style === 'cold', S().objective);

  teleport(4.6, -15, -Math.PI / 2); await holdE(3.3);
  check('Unit 2 ignited -> turbine speed', S().objective === 6 && G.props.unit2.style === 'running', S().objective);
  G.objState.hold = 22.1; await waitSim(.3);
  G.objState.hold = 36.1; await waitSim(.3);
  check('Hauler and Bulwark waves on Unit 2', G.fired.has('unit-hauler') && G.fired.has('unit-last'));
  G.objState.hold = 49.9; await waitSim(.5);
  teleport(6, -22.4, Math.PI); await holdE(2.3); await waitSim(3);
  check('generator breaker closed -> mission won', S().status === 'won', S().status);
}

async function mission17() {
  await goNext(17);
  check('mission 17: cooling caverns, underground', S().status === 'briefing' && S().mission === 'm17' && G.level.id === 'caverns' && G.env.dark, S().mission);
  await click('startBtn'); godMode(); await frames(3);
  for (const e of G.enemies) { e.dead = true; e.g.visible = false; }   // quiet caverns for the mechanics checks

  // Steam vents: a shared cycle; blasting vents scald players and cook machines.
  const v = G.props.ventW1, waitPhase = async ph => { for (let i = 0; i < 400 && v.phase() !== ph; i++) await frames(1); };
  await waitPhase('idle'); await waitPhase('blast');
  teleport(-15, 12); G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0;
  await waitSim(1);
  const scald = 100 - G.local.health;
  check('a blasting vent scalds the player', scald > 20 && v.phase() === 'blast', scald.toFixed(0) + ' dmg');
  teleport(-15, 16); G.local.health = 100; await waitSim(1);
  check('next to the vent: no damage', G.local.health === 100, G.local.health);
  godMode();
  const cooked = addEnemy({ type: 'sentry', at: [-15, 3] }), v2 = G.props.ventW2;
  cooked.home.copy(cooked.pos); cooked.patrol.copy(cooked.pos); cooked.dest.copy(cooked.pos);
  for (let i = 0; i < 400 && v2.phase() !== 'blast'; i++) await frames(1);
  const c0 = cooked.hp; await waitSim(1, () => { cooked.pos.set(-15, 0, 3); });
  check('machines caught in the steam get cooked', cooked.hp < c0, (c0 - cooked.hp).toFixed(0));
  damageEnemy(cooked, 1e6, false, G.local);

  // The hot gallery: scalds in proportion to the valves still closed.
  const heatAt = async () => { teleport(0, -24); G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; await waitSim(1); const d = 100 - G.local.health; godMode(); return d; };
  const full = await heatAt();
  G.props.valveW.setStyle('open'); const half = await heatAt();
  check('hot gallery scalds; one valve open halves it', full > 25 && Math.abs(half / full - .5) < .15, full.toFixed(0) + ' / ' + half.toFixed(0));
  check('heat tint while inside', +document.getElementById('heatTint').style.opacity > .1, document.getElementById('heatTint').style.opacity);
  G.props.valveW.setStyle('closed');

  // Repair drones restore a damaged machine; drop the drone and the repairs stop.
  const big = addEnemy({ type: 'hauler', at: [0, -10] }), doc = addEnemy({ type: 'mender', at: [-2, -6] });   // open floor: clear line for the beam
  for (const e of [big, doc]) { e.home.copy(e.pos); e.patrol.copy(e.pos); e.dest.copy(e.pos); }
  teleport(-30, -9); big.hp = big.maxHp * .4; const h0 = big.hp;
  await waitSim(4.5);
  check('a Repair drone repairs a damaged Hauler', big.hp > h0 + 60 && doc.healing === big, (big.hp - h0).toFixed(0) + ' hp');
  check('heal beam drawn', doc.g.userData.beam.visible);
  damageEnemy(doc, 1e6, false, G.local); const h1 = big.hp; await waitSim(1.5);
  check('no drone, no repairs', big.hp === h1, (big.hp - h1).toFixed(1));
  damageEnemy(big, 1e6, false, G.local);

  teleport(-28.6, -10.3, Math.PI); await holdE(2.8);
  teleport(28.6, -10.3, Math.PI); await holdE(2.8);
  check('both valves open -> gallery cooled + checkpoint', S().objective === 1 && G.checkpoint?.name === 'Gallery cooled' && G.props.gallery.heat() === 0, S().objective);
  for (const e of G.enemies) if (!e.dead) damageEnemy(e, 1e6, false, G.local);   // the valve waves would shoot us
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; teleport(0, -24); await waitSim(1);
  check('cooled gallery is safe', G.local.health === 100, G.local.health);
  godMode();
  teleport(0, -35); await waitSim(.6);
  const guardian = G.enemies.find(e => !e.dead && e.def.tag === 'guardian');
  check('pump hall: guardian and its drones + checkpoint', S().objective === 2 && !!guardian && G.enemies.filter(e => !e.dead && e.type.name === 'Repair drone').length >= 2 && G.checkpoint?.name === 'Pump hall', S().objective);

  // Retry from the pump hall: valves still open, guardian back at full strength.
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; hurt(G.local, 500, null); G.local.protectUntil = 0; hurt(G.local, 500, null); await frames(2);
  await click('retryBtn'); godMode(); await frames(3);
  const g2 = G.enemies.find(e => !e.dead && e.def.tag === 'guardian');
  check('retry: valves open, guardian waiting', S().objective === 2 && G.props.valveW.style === 'open' && G.props.valveE.style === 'open' && !!g2, S().objective);
  damageEnemy(g2, g2.maxHp * .55, false, G.local, { explosive: 'he' }); await waitSim(.4);
  check('guardian at half -> more drones', G.fired.has('guard-wave'));
  for (const e of G.enemies) if (!e.dead && e.def.tag === 'guardian') damageEnemy(e, 1e6, false, G.local);
  await waitSim(.5);
  check('guardian destroyed -> hatch', S().objective === 3, S().objective);
  teleport(3.6, -45.4, Math.PI); await holdE(3.3); await waitSim(3);
  check('hatch open -> mission won', S().status === 'won', S().status);
}

async function mission18() {
  await goNext(18);
  check('mission 18: datacenter halls', S().status === 'briefing' && S().mission === 'm18' && G.level.id === 'datahalls', S().mission);
  await click('startBtn'); godMode(); await frames(3);
  for (const e of G.enemies) { e.dead = true; e.g.visible = false; }
  const P = G.props, shut = id => P[id].mover.enabled;
  check('only the west hall door is open', !shut('dW') && shut('dN') && shut('dE') && shut('dWN') && shut('dNE'));
  check('copy timer running', /⏱ 4:/.test(document.getElementById('objectiveSub').textContent), document.getElementById('objectiveSub').textContent);

  // Mirror nodes are hardware: player rounds and blasts hurt them, machine fire doesn't.
  const W = P.nodeW, from = new THREE.Vector3(-26, 1.6, 8);
  let hp = W.hp; projectile(from, W.pos.clone().sub(from).normalize(), 240, 31, G.local); await frames(4);
  check('player rounds damage a mirror node', W.hp < hp, (hp - W.hp).toFixed(0));
  hp = W.hp; projectile(from, W.pos.clone().sub(from).normalize(), 240, 31, null); await frames(4);
  check('machine fire does not', W.hp === hp, (hp - W.hp).toFixed(0));
  hp = W.hp; spawnBomb(new THREE.Vector3(-26, 1.6, 8), new THREE.Vector3(0, 0, -30), G.local, 'he'); await waitSim(.6);   // 6.5 m: armed
  check('an HE round takes a big bite', hp - W.hp > 120, (hp - W.hp).toFixed(0));

  // Destroy it while standing in the west doorway: the door waits for you before sealing.
  teleport(-12, 20); damageProp(W, 1e6); await waitSim(.4);
  check('west node down -> doors reroute (north open)', !shut('dWN') && !shut('dN') && G.checkpoint?.name === 'West mirror down' && G.objState.collected.size === 1);
  check('door will not close on you', !shut('dW'));
  teleport(-20, 20); await waitSim(.4);
  check('...and seals once you step through', shut('dW'));
  await waitSim(10.5);
  check('west hall purged with halon', P.purgeW.heat() === 1);
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; await waitSim(1);
  check('halon hurts; tint goes blue', G.local.health < 100 && document.getElementById('heatTint').classList.contains('halon'), G.local.health.toFixed(0));
  godMode();

  // Retry from the checkpoint: doors as rerouted, the west node still down.
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; hurt(G.local, 500, null); G.local.protectUntil = 0; hurt(G.local, 500, null); await frames(2);
  await click('retryBtn'); godMode(); await frames(3);
  check('retry: west node down, rerouted doors kept', G.props.nodeW.style === 'wrecked' && !G.props.dN.mover.enabled && G.props.dW.mover.enabled && G.objState.collected.size === 1);
  // Reported bug: being in hall W when the north node falls (or retrying there) sealed you in.
  for (const e of G.enemies) if (!e.dead) damageEnemy(e, 1e6, false, G.local);
  const N = G.props.nodeN, n0 = G.enemies.length;
  teleport(-26, -16);   // in hall W, shooting the north node through the doorway
  damageProp(N, 1e6); await waitSim(.5);
  check('north node falls while you\'re in hall W: you are not sealed in', G.props.dW.mover.enabled && !G.props.dWN.mover.enabled, 'dWN shut=' + G.props.dWN.mover.enabled);
  // Retry from that checkpoint while still in hall W: the exit opens again.
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; G.local.stims = 0; hurt(G.local, 500, null); G.local.protectUntil = 0; hurt(G.local, 500, null); await frames(2);
  await click('retryBtn'); godMode(); await frames(4);
  check('retry from "North mirror down" in hall W: exit open', G.checkpoint?.name === 'North mirror down' && G.local.pos.x < -12 && !G.props.dWN.mover.enabled, G.local.pos.x.toFixed(1) + ' shut=' + G.props.dWN.mover.enabled);
  teleport(0, -20); await waitSim(.6);
  check('...and it seals once everyone is out', G.props.dWN.mover.enabled);
  for (const e of G.enemies) if (!e.dead) damageEnemy(e, 1e6, false, G.local);
  const N2 = G.props.nodeN;
  check('north node down -> Linemen came at half', G.fired.has('n-half') && N2.style === 'wrecked');
  teleport(0, 20); await waitSim(.5);
  check('north node down -> east opens, north seals', !G.props.dE.mover.enabled && !G.props.dNE.mover.enabled && G.props.dWN.mover.enabled && G.props.dN.mover.enabled, S().objective);
  teleport(26, 10); damageProp(G.props.nodeE, 1e6); await waitSim(.5);
  check('all three down -> back to the atrium', S().objective === 1 && G.checkpoint?.name === 'Mirrors destroyed', S().objective);
  teleport(0, 20); await waitSim(3);
  check('atrium reached -> mission won', S().status === 'won', S().status);

  // Replay and let the copy finish: mission fails.
  await click(document.getElementById('replayBtn') ? 'replayBtn' : 'restartBtn'); godMode(); await frames(3);
  G.objState.t = 299.7; await waitSim(3);
  check('copy completes -> mission failed', S().status === 'lost', S().status);
}

async function mission19() {
  await goNext(19);
  check('mission 19: grid control floor', S().status === 'briefing' && S().mission === 'm19' && G.level.id === 'control', S().mission);
  await click('startBtn'); godMode(); await frames(3);
  for (const e of G.enemies) { e.dead = true; e.g.visible = false; }
  const P = G.props, meter = document.getElementById('freqMeter');
  check('meter hidden until syncing', !meter.classList.contains('on'));

  // Capture by standing in the ring; machines alone in it take it back; both = contested.
  teleport(-28, 3); await waitSim(5.5);
  check('standing in a ring captures it', P.cpW.style === 'held', P.cpW.style + ' ' + P.cpW.cap.toFixed(2));
  const squatter = addEnemy({ type: 'sentry', at: [-28, -1] }); squatter.home.copy(squatter.pos); squatter.patrol.copy(squatter.pos); squatter.dest.copy(squatter.pos);
  G.env.sightScale = .001; const c0 = P.cpW.cap; await waitSim(1, () => teleport(-28, 3));
  check('player + machine inside: contested, no change', P.cpW.contested && Math.abs(P.cpW.cap - c0) < .01);
  teleport(-12, 20); await waitSim(6.5, () => squatter.pos.set(-28, 0, -1));
  check('a machine alone in it: held -> neutral', P.cpW.style === 'neutral', P.cpW.style + ' ' + P.cpW.cap.toFixed(2));
  await waitSim(6.5, () => squatter.pos.set(-28, 0, -1));
  check('...then lost', P.cpW.style === 'lost', P.cpW.style);
  damageEnemy(squatter, 1e6, false, G.local); G.env.sightScale = 1;
  teleport(-28, 3); await waitSim(10.5);
  teleport(0, -1); await waitSim(5.5);
  teleport(28, 3); await waitSim(5.5);
  check('all three held -> sync + checkpoint', S().objective === 1 && G.checkpoint?.name === 'Floor secured', S().objective);
  await frames(2); for (const e of G.enemies) if (!e.dead) damageEnemy(e, 1e6, false, G.local);   // the sync wave would take points while we test
  await waitSim(2);
  check('frequency meter shows 50 Hz in sync', meter.classList.contains('on') && /50\.0\d Hz/.test(document.getElementById('freqHz').textContent) && G.objState.hold > 1.5, document.getElementById('freqHz').textContent + ' ' + G.objState.hold.toFixed(1));

  // A lost point: frequency sags, progress stops.
  P.cpE.setStyle('lost'); let h0 = G.objState.hold; await waitSim(4);
  check('one point lost: frequency sags, sync stalls', G.grid.f < 49.85 && G.objState.hold - h0 < .3 && meter.classList.contains('out'), G.grid.f.toFixed(2));
  teleport(28, 3); await waitSim(10.5); teleport(0, 16); await waitSim(6.5);
  check('retaken: back in band', P.cpE.style === 'held' && G.grid.inBand, G.grid.f.toFixed(2) + ' ' + ['cpW', 'cpC', 'cpE'].map(k => P[k].style + ':' + P[k].cap.toFixed(2)).join(' ') + ' alive=' + G.enemies.filter(e => !e.dead).map(e => e.type.name + '@' + e.pos.x.toFixed(0) + ',' + e.pos.z.toFixed(0)).join(';'));

  // Load step: an island joins and the frequency dips, then recovers.
  G.fired.delete('step1'); G.objState.hold = 11.9; await waitSim(.2);
  check('island joins -> frequency dip', G.fired.has('step1') && G.grid.f < 49.8, G.grid.f.toFixed(2));
  await waitSim(4);
  check('...and the governors pull it back', G.grid.inBand, G.grid.f.toFixed(2));

  // Raiders walk into the points rather than shooting from afar.
  for (const e of G.enemies) if (!e.dead) damageEnemy(e, 1e6, false, G.local);
  G.env.sightScale = .001; teleport(0, 24);
  const r = addEnemy({ type: 'sentry', at: [8, -12], harass: ['cpW', 'cpC', 'cpE'] });
  await waitSim(6);
  check('a raider walks into the nearest point and contests it', Math.hypot(r.pos.x - P.cpC.pos.x, r.pos.z - P.cpC.pos.z) < P.cpC.r && P.cpC.cap < 1, Math.hypot(r.pos.x - P.cpC.pos.x, r.pos.z - P.cpC.pos.z).toFixed(1) + ' m, cap ' + P.cpC.cap.toFixed(2));
  damageEnemy(r, 1e6, false, G.local); G.env.sightScale = 1;
  for (const p of ['cpW', 'cpC', 'cpE']) P[p].setStyle('held');
  for (const id of ['halvard', 'step2', 'half', 'heavy', 'step3']) G.fired.add(id);   // skip the remaining waves for this jump
  G.grid.f = 50; G.objState.hold = 79.9; await waitSim(.5);
  check('synchronised -> tie-line breaker', S().objective === 2 && G.checkpoint?.name === 'Islands synchronised' && !meter.classList.contains('on'), S().objective);
  teleport(0, 14, Math.PI); await holdE(2.8); await waitSim(3);
  check('tie-line closed -> mission won', S().status === 'won', S().status);

  // Replay and lose two points during sync: under-frequency collapse.
  await click(document.getElementById('replayBtn') ? 'replayBtn' : 'restartBtn'); godMode(); await frames(3);
  for (const e of G.enemies) { e.dead = true; e.g.visible = false; }
  for (const p of ['cpW', 'cpC', 'cpE']) G.props[p].setStyle('held');
  await waitSim(.5); teleport(0, 24);
  G.props.cpW.setStyle('lost'); G.props.cpE.setStyle('lost');
  G.simSteps = 10; await waitSim(35); G.simSteps = 6;
  check('two points lost -> grid collapses (mission failed)', S().status === 'lost' && G.grid.collapsed, S().status + ' ' + G.grid.f.toFixed(2));
}

async function mission20() {
  await goNext(20);
  check('mission 20: core chamber', S().status === 'briefing' && S().mission === 'm20' && G.level.id === 'corechamber', S().mission);
  await click('startBtn'); godMode(); await frames(3);
  for (const e of G.enemies) if (!e.type.boss) { e.dead = true; e.g.visible = false; }
  const core = G.enemies.find(e => e.def.tag === 'core'), bar = () => document.getElementById('bossName').textContent;
  check('boss bar: LODESTAR Core, capacitors 4/4', /LODESTAR Core · capacitors 4\/4/.test(bar()), bar());

  // Shield: core hits are blocked; capacitor hits count.
  const from = new THREE.Vector3(0, 6, 20);
  let hp = core.hp; projectile(from, new THREE.Vector3(0, 6, 0).sub(from).normalize(), 240, 31, G.local); await frames(4);
  check('shielded core shrugs off rounds', core.hp === hp, (hp - core.hp).toFixed(0));
  const capS = new THREE.Vector3(0, 3.2, 7), f2 = new THREE.Vector3(0, 3.2, 16);
  projectile(f2, capS.clone().sub(f2).normalize(), 240, 31, G.local); await frames(4);
  check('capacitor takes the hit', core.caps.capS < 320 && core.hp === hp, core.caps.capS + ' dead=' + core.dead + ' exp=' + core.exposed + ' n=' + G.enemies.filter(e => e.def.tag === 'core').length + ' same=' + (core === G.enemies.find(e => e.def.tag === 'core' && !e.dead)));
  for (const id of ['capN', 'capE', 'capS']) damageEnemy(core, 400, false, G.local, { part: id });
  await frames(2); check('three capacitors down: shield holds', !core.exposed && /capacitors 1\/4/.test(bar()), bar());
  damageEnemy(core, 400, false, G.local, { part: 'capW' }); await frames(2);
  check('all four down: core exposed', core.exposed && document.getElementById('bossBar').classList.contains('exposed'));
  hp = core.hp; projectile(from, new THREE.Vector3(0, 6, 0).sub(from).normalize(), 240, 31, G.local); await frames(4);
  check('exposed core takes full damage', Math.abs(hp - core.hp - 31) < .5, (hp - core.hp).toFixed(1));
  core.exposeTimer = .1; await waitSim(.4);
  check('shield recharges, stronger', !core.exposed && core.phase === 2 && core.caps.capN > 320, core.caps.capN);

  // The arc sweep: standing in it hurts, crouching under it doesn't.
  const { coreBeam, clearBossFx } = await import('../src/game/bosses.js');
  for (let i = 0; i < 3000 && coreBeam(G.elapsed).phase !== 'warn'; i++) await frames(1);   // the start of a fresh sweep
  for (let i = 0; i < 3000 && coreBeam(G.elapsed).phase !== 'fire'; i++) await frames(1);
  const inBeam = () => { const a = coreBeam(G.elapsed).angle; G.local.pos.set(-Math.sin(a) * 13, 0, -Math.cos(a) * 13); };
  core.mortarTimer = 99; core.stompCd = 99; clearBossFx();   // only the beam for this check
  for (const e of G.enemies) if (!e.dead && !e.type.boss) damageEnemy(e, 1e6, false, G.local);   // the recharge called Skimmers
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; G.local.crouched = false;
  G.simSteps = 1; await waitSim(.8, inBeam);
  const burned = 100 - G.local.health;
  G.local.health = 100; G.local.crouched = true;
  await waitSim(.8, () => { inBeam(); G.local.crouched = true; });
  G.simSteps = 6;
  check('the sweep burns standing players; crouching ducks it', burned > 10 && G.local.health === 100 && coreBeam(G.elapsed).phase === 'fire', burned.toFixed(0) + ' vs ' + (100 - G.local.health).toFixed(0));
  G.local.crouched = false; godMode(); teleport(0, 30);

  // Halvard's override team: alone on the port it gets overridden; a player standing there stops it.
  const port = G.props.port;
  damageEnemy(core, core.hp - core.maxHp * .84, false, G.local, { explosive: true });   // straight through: core exposed? use hp directly
  core.hp = core.maxHp * .84; await waitSim(.3);
  check('core at 85%: Halvard breach', G.fired.has('breach1') && G.enemies.some(e => !e.dead && e.faction === 'halvard'));
  for (const e of G.enemies) if (!e.dead && e.faction === 'halvard') damageEnemy(e, 1e6, false, G.local);
  for (const e of G.enemies) if (!e.dead && !e.type.boss) damageEnemy(e, 1e6, false, G.local);
  const tm = addEnemy({ type: 'tallyman', at: [0, -12] }); tm.hp = tm.maxHp = 1e9; tm.home.copy(tm.pos);   // LODESTAR's Skimmers would hunt it tm.patrol.copy(tm.pos); tm.dest.copy(tm.pos);
  G.env.sightScale = .001; await waitSim(4, () => tm.pos.set(0, 0, -12));
  check('Tallyman on the port: being overridden', port.cap < .5 && /OVERRIDDEN/.test(document.getElementById('objectiveSub').textContent), port.cap.toFixed(2));
  teleport(1.5, -12); const c1 = port.cap; await waitSim(1, () => tm.pos.set(0, 0, -12));
  check('player on the port: contested, override stalls', port.contested && Math.abs(port.cap - c1) < .02);
  teleport(0, 30); await waitSim(12, () => tm.pos.set(0, 0, -12));
  check('port lost -> Halvard overloads the core (fail)', S().status === 'lost', S().status + ' ' + port.style + ' cap=' + port.cap.toFixed(2) + ' tm dead=' + tm.dead + ' hp=' + Math.round(tm.hp) + ' at ' + tm.pos.x.toFixed(1) + ',' + tm.pos.z.toFixed(1));
  G.env.sightScale = 1;

  // Retry and finish it: core down, Halvard retreats, choose.
  await click(document.getElementById('retryBtn') ? 'retryBtn' : 'restartBtn'); godMode(); await frames(3);
  const core2 = G.enemies.find(e => e.def.tag === 'core' && !e.dead);
  damageEnemy(core2, 1e6, false, G.local, { part: 'capN' }); for (const id of ['capE', 'capS', 'capW']) damageEnemy(core2, 1e6, false, G.local, { part: id });
  damageEnemy(core2, 1e7, false, G.local); await waitSim(.6);
  check('core destroyed -> the choice; everything stands down', S().objective === 1 && G.enemies.every(e => e.dead) && G.checkpoint?.name === 'Core offline', S().objective);
  check('override can no longer fail the mission', !G.fired.has('overload'));
  teleport(4, 14.6, Math.PI); await holdE(3.3); await waitSim(3.5);
  check('restore -> campaign complete (restore ending)', S().status === 'won' && /NEW TERMS/.test(document.getElementById('menuTitle').innerHTML) && !document.getElementById('nextBtn'), document.getElementById('menuEyebrow').textContent);
  await click('replayBtn'); godMode(); await frames(3);
  const core3 = G.enemies.find(e => e.def.tag === 'core'); for (const id of ['capN', 'capE', 'capS', 'capW']) damageEnemy(core3, 1e6, false, G.local, { part: id });
  damageEnemy(core3, 1e7, false, G.local); await waitSim(.6);
  teleport(-4, 14.6, Math.PI); await holdE(3.3); await waitSim(3.5);
  check('shut down -> the other ending', S().status === 'won' && /LIGHTS/.test(document.getElementById('menuTitle').innerHTML), document.getElementById('menuEyebrow').textContent);
}

async function phase4a() {
  const D = await import('../src/game/difficulty.js'), M = await import('../src/game/medals.js'), P = await import('../src/game/progress.js');
  const flow = await import('../src/game/flow.js');
  flow.selectMission(0); await frames(3);
  const pick = k => document.querySelector('[data-difficulty="' + k + '"]');
  check('difficulty defaults to Operator', G.difficulty === 'operator' && pick('operator')?.classList.contains('on'));
  pick('lineman').click(); await frames(2);
  check('pick Lineman (saved, note shown)', G.difficulty === 'lineman' && pick('lineman').classList.contains('on') && localStorage.getItem('riverbend.difficulty') === 'lineman' && /No stims/.test(document.getElementById('briefing').textContent));
  await click('startBtn'); await frames(3);
  const s = G.enemies.find(e => e.type.name === 'Sentry');
  check('Lineman: tougher machines, no stims', Math.abs(s.maxHp - s.type.hp * 1.25) < .01 && G.local.stims === 0, s.maxHp + ' stims=' + G.local.stims);
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; hurt(G.local, 10, null);
  check('Lineman: damage taken x1.4', Math.abs(G.local.health - 86) < .01, G.local.health);
  D.setDifficulty('recruit'); flow.selectMission(0); await frames(3); await click('startBtn'); await frames(3);
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; hurt(G.local, 10, null);
  check('Recruit: damage x0.6, two stims', Math.abs(G.local.health - 94) < .01 && G.local.stims === 2, G.local.health + ' stims=' + G.local.stims);

  // Medal rules.
  const set = (st, t, d) => { Object.assign(G.local.stats, st); G.elapsed = t; G.difficulty = d; };
  set({ shots: 40, hits: 24, damage: 60 }, 200, 'lineman');
  check('all four medals', M.earnedMedals().join() === 'swift,marksman,untouched,hardened', M.earnedMedals().join());
  set({ shots: 10, hits: 10, damage: 150 }, 900, 'operator');
  check('slow, too few shots, hurt: no medals', M.earnedMedals().length === 0, M.earnedMedals().join());
  check('recordWin returns only new medals', P.recordWin(0, 'mtest', 100, ['swift']).join() === 'swift' && P.recordWin(0, 'mtest', 90, ['swift', 'marksman']).join() === 'marksman' && P.medalsFor('mtest').length === 2);

  // A real win shows the medal row on the scorecard and pips on the mission list.
  D.setDifficulty('operator'); flow.selectMission(0); await frames(3); await click('startBtn'); await frames(3);
  Object.assign(G.local.stats, { shots: 30, hits: 20, damage: 0 }); G.elapsed = 100;
  const before = P.medalsFor('m01').filter(x => ['swift', 'marksman', 'untouched'].includes(x)).length;   // a full run already won m01
  flow.finish(true); await frames(3);
  const card = document.getElementById('scorecard');
  check('scorecard shows medals; new ones flagged', card.querySelectorAll('.medal').length === 4 && card.querySelectorAll('.medal.got').length === 3 && card.querySelectorAll('.medal.new').length === 3 - before, card.querySelectorAll('.medal.got').length + ' new ' + card.querySelectorAll('.medal.new').length + ' had ' + before);
  await click('missionsBtn'); await frames(2);
  check('mission list shows medal pips', /◆◆◆◇/.test(document.querySelector('[data-mission="m01"] .pips')?.textContent), document.querySelector('[data-mission="m01"] .pips')?.textContent);

  // Checkpoints keep stats, so medals can't be farmed by dying after a checkpoint.
  flow.selectMission(0); await frames(3); await click('startBtn'); await frames(3);
  G.local.stats.damage = 77; G.local.stats.shots = 9;
  const mm = await import('../src/game/mission.js'); mm.runEvents([{ do: 'checkpoint', name: 'test' }]);
  G.local.health = 100; G.local.protectUntil = 0; G.protectUntil = 0; G.local.stims = 0; hurt(G.local, 500, null); G.local.protectUntil = 0; hurt(G.local, 500, null); await frames(2);
  await click('retryBtn'); await frames(3);
  check('retry from a checkpoint keeps stats', G.local.stats.shots === 9 && G.local.stats.damage >= 77, JSON.stringify(G.local.stats));
  D.setDifficulty('operator');
}

async function phase4b() {
  const T = await import('../src/game/soundtrack.js'), A = await import('../src/engine/audio.js'), flow = await import('../src/game/flow.js');
  const st = () => T.soundtrackState();
  flow.selectMission(0); await frames(3); await click('startBtn'); godMode(); await frames(3);
  check('audio running; soundtrack on in the day mood', A.audioCtx()?.audio.state === 'running' && st().on && st().mood === 'day', A.audioCtx()?.audio.state + ' ' + st().mood);
  for (const e of G.enemies) { e.dead = true; e.g.visible = false; }
  await waitSim(6);
  check('quiet: calm layers only (pad and soft bass)', st().intensity === 0 && st().layers.pad === 1 && st().layers.drums === 0 && st().layers.arp === 0, JSON.stringify(st().layers));
  const n0 = st().notes; await new Promise(r => setTimeout(r, 3500));   // the sequencer runs on the audio clock (real time)
  check('the sequencer keeps playing', st().notes > n0, st().notes - n0);
  const e = addEnemy({ type: 'sentry', at: [G.local.pos.x + 10, G.local.pos.z] }); e.state = 'engage'; e.visible = true;
  await waitSim(.3, () => { e.state = 'engage'; e.visible = true; });
  check('a machine engaging nearby: combat layers in', st().intensity === 2 && st().layers.drums === 1 && st().layers.arp > .5, JSON.stringify(st().layers));
  damageEnemy(e, 1e6, false, G.local); G.simSteps = 10; await waitSim(14); G.simSteps = 6;
  check('...and they fade back once it is quiet', st().intensity === 0, st().intensity);
  const w = addEnemy({ type: 'warden', at: [G.local.pos.x + 20, G.local.pos.z] }); await waitSim(.4);
  check('a boss nearby: boss layers (lead line)', st().intensity === 3 && st().layers.lead > 0, JSON.stringify(st().layers));
  damageEnemy(w, 1e7, false, G.local, { explosive: true }); w.dead = true;
  const n1 = st().notes; (await import('../src/game/mission.js')).runEvents([{ do: 'checkpoint', name: 'audio test' }]);
  check('checkpoint stinger plays', st().notes >= n1 + 4, st().notes - n1);
  // Footsteps follow the local player.
  const s0 = st().steps, x0 = G.local.pos.x; let k = 0;
  G.simSteps = 1; await waitSim(3, () => { G.local.pos.x = x0 + Math.sin(k++ * .08) * 2.5; }); G.simSteps = 6;   // pace back and forth in the open, one sim step per frame
  check('footsteps while moving', st().steps > s0 + 2, st().steps - s0);
  // Environment: underground tunnels have reverb, drips and no wind; the core chamber hums.
  flow.selectMission(6); await frames(3); await click('startBtn'); godMode(); await waitSim(2);
  check('mission 07: underground mood, no wind, big reverb', st().mood === 'underground' && st().beds.wind < .05 && A.reverbTarget() > .3, st().mood + ' ' + st().beds.wind + ' ' + A.reverbTarget());
  flow.selectMission(10); await frames(3); await click('startBtn'); godMode(); await waitSim(2);
  check('mission 11: storm mood, wind and rain beds', st().mood === 'storm' && st().beds.wind > .2 && st().beds.rain > .2, JSON.stringify(st().beds));
  flow.selectMission(19); await frames(3); await click('startBtn'); godMode(); await waitSim(2);
  check('mission 20: grid hum in the core chamber', st().beds.hum > .04, st().beds.hum);
  // Volume settings persist.
  const mv = document.getElementById('musicVolume'); mv.value = .2; mv.dispatchEvent(new Event('input'));
  check('music volume saved', JSON.parse(localStorage.getItem('riverbend.audio')).music === .2 && Math.abs(A.audioCtx().bus.music.gain.value - .2) < .01);
  mv.value = .4; mv.dispatchEvent(new Event('input'));
  flow.finish(true); await frames(3);
  check('scorecard: drums out, pad stays', st().layers.drums === 0 && st().layers.pad > 0, JSON.stringify(st().layers));
}

async function phase4c() {
  const V = await import('../src/game/vfx.js'), C = await import('../src/game/combat.js'), flow = await import('../src/game/flow.js'), W = await import('../src/game/weapons.js');
  const qsel = document.getElementById('quality'); qsel.value = 'medium'; qsel.dispatchEvent(new Event('change'));   // the runner uses Low for speed
  flow.selectMission(0); await frames(3); await click('startBtn'); godMode(); await frames(3);
  for (const e of G.enemies) { e.dead = true; e.g.visible = false; }
  check('mission start clears old effects', V.vfxCount() < 5, V.vfxCount());
  // Tracers: elongated and pointing along the flight path.
  const dir = new THREE.Vector3(1, 0, 0); C.projectile(G.local.pos.clone().setY(1.5), dir, 240, 0, G.local, true);
  const tr = G.projectiles[G.projectiles.length - 1].mesh, ax = new THREE.Vector3(0, 0, 1).applyQuaternion(tr.quaternion);
  check('bullets render as tracers along their path', tr.scale.z > 1.5 && ax.dot(dir) > .99, tr.scale.z.toFixed(2));
  // Firing: muzzle light and a casing.
  const mag0 = G.local.ammo.rifle.mag; G.local.pitch = -.2; mouse('mousedown', 0); await frames(2); mouse('mouseup', 0);
  check('firing: muzzle light and an ejected casing', V.vfxCount('casing') >= 1, 'casings ' + V.vfxCount('casing') + ' fired=' + (mag0 - G.local.ammo.rifle.mag) + ' w=' + G.local.weapon + ' q=' + G.quality);
  // Impacts: dust off the ground.
  const before = V.vfxCount('puff'); C.projectile(G.local.pos.clone().setY(1.5), new THREE.Vector3(.3, -1, 0).normalize(), 240, 0, G.local, true); await frames(4);
  check('a round into the ground kicks up dust', V.vfxCount('puff') > before, V.vfxCount('puff') - before);
  // Explosions: fireball, debris, scorch, smoke, camera shake.
  const p = G.local.pos.clone().add(new THREE.Vector3(6, .2, 0));
  C.explosionFx(p);
  check('explosion: fireball, debris, scorch and smoke', V.vfxCount('ball') === 1 && V.vfxCount('debris') >= 4 && V.vfxCount('scorch') >= 1 && V.vfxCount('puff') >= 3, ['ball', 'debris', 'scorch', 'puff'].map(k => V.vfxCount(k)).join('/') + ' q=' + G.quality + ' sel=' + document.getElementById('quality').value);
  check('a nearby blast shakes the camera', !!V.shakeOffset());
  // Kills leave a smoking wreck that later sinks away.
  const e = addEnemy({ type: 'sentry', at: [G.local.pos.x + 8, G.local.pos.z] }), w0 = V.vfxCount('wreck');
  damageEnemy(e, 1e6, false, G.local);
  check('a destroyed machine leaves a charred wreck', V.vfxCount('wreck') === w0 + 1);
  for (let i = 0; i < 45; i++) V.updateVfx(.5);
  check('wrecks and effects clear themselves', V.vfxCount('wreck') === 0 && V.vfxCount('scorch') === 0, V.vfxCount());
  // Low graphics: fewer particles, no casings.
  const q = document.getElementById('quality'); q.value = 'low'; q.dispatchEvent(new Event('change'));
  V.sparks(G.local.pos.clone(), 10); const lowSparks = V.vfxCount('spark');
  mouse('mousedown', 0); await frames(1); mouse('mouseup', 0);
  check('low graphics: a fraction of the particles, no casings', lowSparks <= 5 && V.vfxCount('casing') === 0, lowSparks + ' sparks');
  q.value = 'low'; q.dispatchEvent(new Event('change'));   // back to the runner's setting
}

async function run() {
  G.simSteps = 6;
  try { localStorage.removeItem('riverbend.progress.v1'); } catch { /* ignore */ }
  document.getElementById('quality').value = 'low';
  document.getElementById('quality').dispatchEvent(new Event('change'));
  if (ONLY === 'spawns') { await spawnSafety(); }
  else if (ONLY) {
    const fns = { m03: mission03, m04: mission04, m05: mission05, m06: mission06, m07: mission07, m08: mission08, m09: mission09, m10: mission10, m11: mission11, m12: mission12, m13: mission13, m14: mission14, m15: mission15, m16: mission16, m17: mission17, m18: mission18, m19: mission19, m20: mission20, p4a: phase4a, p4b: phase4b, p4c: phase4c };
    await fns[ONLY]();
  }
  if (ONLY) {
    check('no runtime errors', errors.length === 0, errors.join(' | '));
    const report = { passed: log.every(l => l.ok), log, errors, drawCalls: S().drawCalls };
    const pre = document.createElement('pre'); pre.id = 'autotest-result'; pre.textContent = JSON.stringify(report); document.body.append(pre);
    document.title = report.passed ? 'AUTOTEST PASS' : 'AUTOTEST FAIL';
    return;
  }
  await spawnSafety();
  await mission01();
  await mission02();
  await mission03();
  await mission04();
  await mission05();
  await mission06();
  await mission07();
  await mission08();
  await mission09();
  await mission10();
  await mission11();
  await mission12();
  await mission13();
  await mission14();
  await mission15();
  await mission16();
  await mission17();
  await mission18();
  await mission19();
  await mission20();
  await phase4a();
  await phase4b();
  await phase4c();

  // Leave the game running for the CDP real-mouse check in smoke_test.py.
  if (S().status !== 'playing') await click(document.getElementById('replayBtn') ? 'replayBtn' : 'restartBtn');
  godMode();

  check('no runtime errors', errors.length === 0, errors.join(' | '));
  const report = { passed: log.every(l => l.ok), log, errors, drawCalls: S().drawCalls };
  const pre = document.createElement('pre'); pre.id = 'autotest-result'; pre.textContent = JSON.stringify(report); document.body.append(pre);
  document.title = report.passed ? 'AUTOTEST PASS' : 'AUTOTEST FAIL';
}
run().catch(e => {
  const pre = document.createElement('pre'); pre.id = 'autotest-result';
  pre.textContent = JSON.stringify({ passed: false, crash: String(e.stack || e), log, errors }); document.body.append(pre);
  document.title = 'AUTOTEST FAIL';
});
