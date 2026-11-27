// Game flow: mission select, deploy, pause, resume, checkpoint retry, win/lose.
// In co-op the host drives the flow and clients follow via network hooks.
import { earnedMedals } from './medals.js';
import { startSoundtrack, stinger } from './soundtrack.js';
import { G } from './state.js';
import { initAudio, sound } from '../engine/audio.js';
import { prepareMission, beginPlay } from './mission.js';
import { recordWin } from './progress.js';
import { say } from '../ui/hud.js';
import { showPlaying, showPause, showFinish, showBriefing } from '../ui/menu.js';
import { requestMouse, releaseMouse, clearInput } from '../input.js';
import { CAMPAIGN } from '../missions/index.js';
import { net, isHost, isClient, inCoop, activateRoster, sendStart, broadcastBrief, broadcastFinish, resetNetVisuals } from '../net/net.js';

function enterPlay(fresh) {
  initAudio(); startSoundtrack();
  G.status = 'playing'; G.overlay = false;
  clearInput(); showPlaying(); requestMouse();
  if (isClient()) { if (fresh && G.mission.intro) say(G.mission.intro.text, G.mission.intro.time); }
  else beginPlay(fresh);
}

/** Start the selected mission from the beginning (host/solo). */
export function deploy() {
  if (isClient()) return;
  if (isHost()) activateRoster();
  prepareMission(G.mission); resetNetVisuals();
  if (isHost()) sendStart(true);
  enterPlay(true);
}
export const restart = deploy;

export function resume() {
  if (G.status === 'playing' && G.overlay) { G.overlay = false; clearInput(); showPlaying(); requestMouse(); return; }
  if (G.status === 'paused') enterPlay(false);
}

/** Restart from the last checkpoint of this run (host/solo). */
export function retry() {
  if (isClient()) return;
  if (!G.checkpoint) { deploy(); return; }
  if (isHost()) activateRoster();
  prepareMission(G.mission, G.checkpoint); resetNetVisuals();
  if (isHost()) sendStart(false);
  enterPlay(false);
  say('Restarted from checkpoint · ' + G.checkpoint.name, 3);
}

export function pause() {
  if (G.status !== 'playing' || G.overlay) return;
  clearInput(); releaseMouse();
  // Co-op can't freeze time for everyone: the menu opens over the running game.
  if (inCoop()) G.overlay = true; else G.status = 'paused';
  showPause();
}

export function finish(won) {
  if (G.status !== 'playing') return;
  G.status = won ? 'won' : 'lost'; G.overlay = false;
  if (won) { G.medals = earnedMedals(); G.newMedals = recordWin(G.missionIndex, G.mission.id, G.elapsed, G.medals); }
  if (isHost()) broadcastFinish(won);
  clearInput(); releaseMouse(); showFinish(won); sound('objective'); stinger(won ? 'win' : 'fail');
}

export function selectMission(i) {
  if (isClient()) return;
  G.missionIndex = i;
  prepareMission(CAMPAIGN[i]);
  G.status = 'briefing'; G.menuOrbit = 0; G.overlay = false;
  showBriefing(G.mission);
  if (isHost()) broadcastBrief();
}
export const hasNextMission = () => G.missionIndex + 1 < CAMPAIGN.length;
export function nextMission() { if (hasNextMission()) selectMission(G.missionIndex + 1); }

// Client side: follow the host.
net.hooks.onBrief = mi => {
  G.missionIndex = mi;
  prepareMission(CAMPAIGN[mi]);
  G.status = 'briefing'; G.overlay = false;
  clearInput(); releaseMouse();
  showBriefing(G.mission);
};
net.hooks.onStart = (mi, checkpoint, fresh) => {
  G.missionIndex = mi;
  prepareMission(CAMPAIGN[mi], checkpoint); resetNetVisuals();
  enterPlay(fresh);
};
net.hooks.onFinish = won => {
  if (G.status !== 'playing') return;
  G.status = won ? 'won' : 'lost'; G.overlay = false;
  if (won) { G.medals = earnedMedals(); G.newMedals = recordWin(G.missionIndex, G.mission.id, G.elapsed, G.medals); }
  clearInput(); releaseMouse(); showFinish(won); sound('objective'); stinger(won ? 'win' : 'fail');
};
net.hooks.onLeave = () => {
  const i = G.missionIndex;
  G.status = 'briefing';
  selectMission(Math.min(i, CAMPAIGN.length - 1));
};
