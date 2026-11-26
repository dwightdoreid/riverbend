// Game flow: mission select, deploy, pause, resume, checkpoint retry, win/lose.
import { G } from './state.js';
import { initAudio, sound } from '../engine/audio.js';
import { prepareMission, beginPlay } from './mission.js';
import { recordWin } from './progress.js';
import { say } from '../ui/hud.js';
import { showPlaying, showPause, showFinish, showBriefing } from '../ui/menu.js';
import { requestMouse, releaseMouse, clearInput } from '../input.js';
import { CAMPAIGN } from '../missions/index.js';

function enterPlay(fresh) {
  initAudio();
  G.status = 'playing';
  clearInput(); showPlaying(); requestMouse();
  beginPlay(fresh);
}

/** Start the selected mission from the beginning. */
export function deploy() { prepareMission(G.mission); enterPlay(true); }
export const restart = deploy;

export function resume() { if (G.status === 'paused') enterPlay(false); }

/** Restart from the last checkpoint of this run. */
export function retry() {
  if (!G.checkpoint) { deploy(); return; }
  prepareMission(G.mission, G.checkpoint);
  enterPlay(false);
  say('Restarted from checkpoint · ' + G.checkpoint.name, 3);
}

export function pause() {
  if (G.status !== 'playing') return;
  G.status = 'paused';
  clearInput(); releaseMouse(); showPause();
}

export function finish(won) {
  if (G.status !== 'playing') return;
  G.status = won ? 'won' : 'lost';
  if (won) recordWin(G.missionIndex, G.mission.id, G.elapsed);
  clearInput(); releaseMouse(); showFinish(won); sound('objective');
}

export function selectMission(i) {
  G.missionIndex = i;
  prepareMission(CAMPAIGN[i]);
  G.status = 'briefing'; G.menuOrbit = 0;
  showBriefing(G.mission);
}
export const hasNextMission = () => G.missionIndex + 1 < CAMPAIGN.length;
export function nextMission() { if (hasNextMission()) selectMission(G.missionIndex + 1); }
