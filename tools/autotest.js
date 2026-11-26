// In-browser smoke test. Loaded by src/main.js when the URL has ?autotest=1.
// Drives the real input paths (key and pointer events) and writes a JSON report into
// <pre id="autotest-result"> and document.title, for tools/smoke_test.py to read.
import { G } from '../src/game/state.js';
import { hurt } from '../src/game/combat.js';
import { canvas } from '../src/engine/render.js';

const log = [], errors = [];
window.autotestLog = log;
window.addEventListener('error', e => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => errors.push('rejection: ' + e.reason));

const frame = () => new Promise(r => requestAnimationFrame(r));
async function waitSim(seconds) { const end = G.elapsed + seconds; let guard = 0; while (G.elapsed < end && G.status === 'playing' && guard++ < 5000) await frame(); }
async function frames(n) { for (let i = 0; i < n; i++) await frame(); }
const key = (type, k) => canvas.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
const mouse = (type, button) => canvas.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
function check(name, ok, detail = '') { log.push({ name, ok: !!ok, detail }); }
const S = () => window.riverbendGame.state();

async function holdE(seconds) { key('keydown', 'e'); await waitSim(seconds); key('keyup', 'e'); await frames(2); }
function teleport(x, z, yaw = 0) { G.local.pos.set(x, 0, z); G.local.yaw = yaw; }

async function run() {
  G.simSteps = 6;
  document.getElementById('quality').value = 'low';
  document.getElementById('quality').dispatchEvent(new Event('change'));
  await frames(5);
  check('boots to briefing', S().status === 'briefing', S().status);
  check('enemies spawned', S().enemies.length === 8, S().enemies.length);

  document.getElementById('startBtn').click(); await frames(3);
  check('deploy -> playing', S().status === 'playing', S().status);
  G.local.health = 1e6; // keep stray sentry fire from ending the scripted run early

  // Shooting and reloading.
  const mag0 = S().mag;
  G.local.pitch = -0.2;
  mouse('mousedown', 0); await waitSim(.5); mouse('mouseup', 0);
  await frames(2);
  check('rifle fires on hold', S().stats.shots >= 3 && S().mag < mag0, 'shots=' + S().stats.shots + ' mag=' + S().mag);
  key('keydown', 'r'); key('keyup', 'r'); await waitSim(2.4);
  check('reload refills magazine', S().mag === 30 && S().reserve < 120, 'mag=' + S().mag + ' reserve=' + S().reserve);

  key('keydown', '2'); key('keyup', '2'); await waitSim(.4);
  check('switch to pistol', S().weapon === 'pistol', S().weapon);
  key('keydown', '1'); key('keyup', '1'); await waitSim(.4);

  key('keydown', 'g'); key('keyup', 'g'); await frames(2);
  check('grenade thrown', S().bombs === 1 && S().grenades === 2, 'bombs=' + S().bombs);
  await waitSim(3);
  check('grenade detonates', S().bombs === 0, 'bombs=' + S().bombs);

  // Movement.
  teleport(0, 30); const z0 = G.local.pos.z;
  key('keydown', 'w'); await waitSim(.5); key('keyup', 'w'); await frames(2);
  check('W moves forward', G.local.pos.z < z0 - 1, (z0 - G.local.pos.z).toFixed(2));

  // Objectives.
  teleport(-32, 9.6); await holdE(1.5);
  check('objective 1 completes', S().objective === 1, S().objective);
  teleport(7.7, 25.6); await holdE(2.2);
  check('objective 2 completes', S().objective === 2, S().objective);
  check('bots investigate after core', S().enemies.filter(e => !e.dead && e.state !== 'patrol').length > 0);
  teleport(0, 35); await holdE(1.9);
  check('extraction wins mission', S().status === 'won', S().status);
  check('scorecard shown', !document.getElementById('scorecard').classList.contains('hidden'));

  // Replay, then lose.
  document.getElementById('startBtn').click(); await frames(3);
  check('play again resets', S().status === 'playing' && S().objective === 0 && S().mag === 30 && S().grenades === 3, JSON.stringify({ o: S().objective, m: S().mag }));
  await waitSim(2.7);
  hurt(G.local, 500, G.local.pos.clone());
  await frames(2);
  check('death -> mission failed', S().status === 'lost', S().status);

  // Pause/resume.
  document.getElementById('startBtn').click(); await frames(3);
  key('keydown', 'Escape'); await frames(2);
  check('escape pauses', S().status === 'paused', S().status);
  document.getElementById('startBtn').click(); await frames(2);
  check('resume', S().status === 'playing', S().status);

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
