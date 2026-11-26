// In-browser smoke test. Loaded by src/main.js when the URL has ?autotest=1.
// Drives the real input paths (key and mouse events, menu buttons) and writes a JSON report
// into <pre id="autotest-result"> and document.title, for tools/smoke_test.py to read.
import { THREE } from '../src/engine/three.js';
import { G } from '../src/game/state.js';
import { hurt, projectile, damageEnemy } from '../src/game/combat.js';
import { litAt, damageProp } from '../src/game/props.js';
import { canvas, flashlight } from '../src/engine/render.js';

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
  await click('nextBtn');
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
  await click('missionsBtn');                                   // opens the mission list
  const card = document.querySelector('[data-mission="m04"]');
  card?.click(); await frames(3);
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
  await click('nextBtn');
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

async function run() {
  G.simSteps = 6;
  try { localStorage.removeItem('riverbend.progress.v1'); } catch { /* ignore */ }
  document.getElementById('quality').value = 'low';
  document.getElementById('quality').dispatchEvent(new Event('change'));
  await mission01();
  await mission02();
  await mission03();
  await mission04();
  await mission05();

  // Leave the game running for the CDP real-mouse check in smoke_test.py.
  await click(document.getElementById('replayBtn') ? 'replayBtn' : 'restartBtn'); godMode();

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
