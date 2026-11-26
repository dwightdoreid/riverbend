// Game flow: deploy, pause, resume, restart, win/lose.
import { G } from './state.js';
import { initAudio, sound } from '../engine/audio.js';
import { prepareMission } from './mission.js';
import { say } from '../ui/hud.js';
import { showPlaying, showPause, showFinish } from '../ui/menu.js';
import { requestMouse, releaseMouse, clearInput } from '../input.js';

export function start() {
  initAudio();
  if (G.status === 'briefing' || G.status === 'won' || G.status === 'lost') prepareMission(G.mission);
  G.status = 'playing';
  clearInput(); showPlaying(); requestMouse();
  const intro = G.mission.intro;
  if (intro && G.elapsed === 0) say(intro.text, intro.time);
}

export function restart() { G.status = 'briefing'; start(); }

export function pause() {
  if (G.status !== 'playing') return;
  G.status = 'paused';
  clearInput(); releaseMouse(); showPause();
}

export function finish(won) {
  if (G.status !== 'playing') return;
  G.status = won ? 'won' : 'lost';
  clearInput(); releaseMouse(); showFinish(won); sound('objective');
}
