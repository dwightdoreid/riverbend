// Entry point: wires modules together and runs the frame loop.
import { $ } from './engine/dom.js';
import { renderer, camera, canvas, setQuality, resize, renderFrame, flashlight, FLASHLIGHT_INTENSITY } from './engine/render.js';
import { setVolume } from './engine/audio.js';
import { G } from './game/state.js';
import { createPlayer, updatePlayer } from './game/players.js';
import { WEAPONS } from './game/weapons.js';
import { updateBots, poseEnemy } from './game/bots.js';
import { updateProjectiles, updateBombs, updateEffects, updateDowned, updateSmokes } from './game/combat.js';
import { updateInteract, updateObjective, updateScripts, checkTriggers, objectiveTargets } from './game/mission.js';
import { updateProps } from './game/props.js';
import { pause, selectMission } from './game/flow.js';
import { updateCamera, updateViewModel } from './game/viewmodel.js';
import { updateUI, drawMap, updateMarker } from './ui/hud.js';
import { setupCoopPanel } from './ui/menu.js';
import { updateAvatars } from './game/avatars.js';
import { updateTurrets } from './game/turrets.js';
import { updateShells, updateMarkers, updateFields } from './game/bosses.js';
import { updateBlackout } from './game/blackout.js';
import { updateSwitching } from './game/switching.js';
import { updateWeather } from './game/weather.js';
import { updateStealth } from './game/stealth.js';
import { isClient, netTick, interpolate, updateRemotePlayers } from './net/net.js';
import { setupInput, sampleInput, settings } from './input.js';

fetch('vendor/LICENSE-three.txt').then(r => r.text()).then(t => { $('license').textContent = t; }).catch(() => {});

// One local player; co-op adds remote players to G.players (see src/net/net.js).
G.local = createPlayer({ id: 0, name: 'You', local: true });
G.players.push(G.local);

selectMission(0);

// Menu and settings (menu action buttons are rendered by ui/menu.js).
$('pauseBtn').onclick = pause;
$('controlsBtn').onclick = () => { $('menuControls').style.display = $('menuControls').style.display === 'block' ? 'none' : 'block'; };
$('sensitivity').oninput = e => { settings.sensitivity = +e.target.value; };
$('volume').oninput = e => setVolume(+e.target.value);
$('quality').onchange = e => setQuality(e.target.value);
setQuality('medium');
setupInput();
setupCoopPanel();
window.addEventListener('resize', resize);
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault(); pause();
  $('loadText').textContent = 'Graphics context interrupted. Reload the page or lower Graphics in settings.';
  $('loading').classList.remove('hidden');
});

/** One authoritative simulation step (solo or co-op host). */
function step(dt) {
  G.elapsed += dt;
  sampleInput();
  for (const p of G.players) if (p.local) updatePlayer(p, dt);   // remote players move themselves
  updateRemotePlayers();
  updateDowned(dt);
  updateBots(dt);
  updateTurrets(dt);
  updateBlackout();
  updateSmokes(dt);
  updateSwitching(dt);
  updateWeather(dt);
  updateStealth(dt);
  updateShells(dt);
  updateMarkers(dt);
  updateFields(dt);
  updateProjectiles(dt);
  updateBombs(dt);
  updateEffects(dt);
  for (const p of G.players) updateInteract(p, dt);
  updateObjective(dt);
  updateScripts(dt);
  checkTriggers();
}

/** Co-op client step: move ourselves, draw everything else from the host's snapshots. */
function clientStep(dt) {
  G.elapsed += dt;
  sampleInput();
  updatePlayer(G.local, dt);
  interpolate(dt);
  for (const e of G.enemies) if (!e.dead) poseEnemy(e, dt);
  updateProjectiles(dt);
  updateEffects(dt);
  updateMarkers(dt);
  updateFields(dt);
  updateBlackout();
  updateSmokes(dt);
  updateSwitching(dt);
  updateWeather(dt);
}

let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (G.status === 'playing') {
    for (let i = 0; i < G.simSteps && G.status === 'playing'; i++) (isClient() ? clientStep : step)(dt);
    if (G.status === 'playing') {
      updateCamera(G.local); updateViewModel(G.local); updateUI(dt);
      if (G.frame % 3 === 0) { drawMap(); updateMarker(); }
      updateProps(objectiveTargets());
      flashlight.intensity = G.local.flashlight ? FLASHLIGHT_INTENSITY : 0;
    }
  } else if (G.status === 'briefing') {
    flashlight.intensity = 0;
    const mc = G.level.menuCamera;
    G.menuOrbit += dt * .025;
    camera.position.set(Math.sin(.7 + G.menuOrbit) * mc.radius, mc.height, Math.cos(.7 + G.menuOrbit) * mc.radius);
    camera.lookAt(0, 1, 0);
  }
  netTick(dt);
  updateAvatars();
  renderFrame(G.status === 'playing' || G.status === 'paused');
  G.frame++;
}

resize();
$('loading').classList.add('hidden');
window.gameReady = true;
requestAnimationFrame(tick);

if (new URLSearchParams(location.search).has('autotest')) import('../tools/autotest.js');

// Debug/test hook (used by tools/smoke_test.py).
window.riverbendGame = {
  G,
  state: () => {
    const p = G.local;
    return {
      status: G.status, mission: G.mission.id, objective: G.objective, health: Math.round(p.health),
      position: p.pos.toArray(), yaw: p.yaw, pitch: p.pitch, weapon: p.weapon,
      mag: p.ammo[p.weapon]?.mag ?? p.grenades, reserve: p.ammo[p.weapon]?.reserve ?? 0,
      ammo: JSON.parse(JSON.stringify(p.ammo)), grenades: p.grenades, reloading: p.reloadLeft > 0, aiming: p.aiming, crouched: p.crouched,
      enemies: G.enemies.map(e => ({ id: e.id, hp: e.hp, state: e.state, position: e.pos.toArray(), visible: e.visible, dead: e.dead })),
      projectiles: G.projectiles.length, bombs: G.bombs.length, elapsed: G.elapsed, stats: { ...p.stats },
      drawCalls: renderer.info.render.calls, weapons: Object.keys(WEAPONS),
    };
  },
};
