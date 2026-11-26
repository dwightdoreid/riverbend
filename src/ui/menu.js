// Full-screen menu states: briefing, mission select, pause, and the end-of-mission scorecard.
import { $ } from '../engine/dom.js';
import { G } from '../game/state.js';
import { timeText, resetHUD } from './hud.js';
import { CAMPAIGN } from '../missions/index.js';
import { unlockedCount, bestTime } from '../game/progress.js';
import { deploy, resume, restart, retry, selectMission, nextMission, hasNextMission } from '../game/flow.js';

function showScreen() {
  document.body.classList.remove('playing');
  $('screen').classList.remove('hidden');
  $('tapResume').style.display = 'none';
  $('missionList').classList.add('hidden');
}

/** Renders the menu's action buttons. The first primary button gets id="startBtn". */
function buttons(list) {
  const box = $('menuButtons'); box.innerHTML = '';
  let primaryDone = false;
  for (const b of list.filter(Boolean)) {
    const el = document.createElement('button');
    el.textContent = b.label;
    if (b.primary) { el.classList.add('primary'); if (!primaryDone) { el.id = 'startBtn'; primaryDone = true; } }
    if (b.id) el.id = b.id;
    el.onclick = b.onClick;
    box.append(el);
  }
}

const missionsButton = { label: 'Missions', id: 'missionsBtn', onClick: () => toggleMissionList() };

export function showBriefing(m) {
  const b = m.briefing;
  showScreen();
  $('menuEyebrow').textContent = b.eyebrow;
  $('menuTitle').innerHTML = b.title;
  $('menuText').textContent = b.lede;
  $('briefing').innerHTML = '<p>' + b.body + '</p><div class="stages">'
    + b.stages.map(([head, line1, line2]) => '<div class="stage"><strong>' + head + '</strong>' + line1 + '<br>' + line2 + '</div>').join('')
    + '</div><p>' + b.tip + '</p>';
  $('briefing').classList.remove('hidden');
  $('scorecard').classList.add('hidden');
  buttons([{ label: b.deploy ?? 'Deploy', primary: true, onClick: deploy }, missionsButton]);
}

function toggleMissionList() {
  const list = $('missionList');
  if (!list.classList.contains('hidden')) { list.classList.add('hidden'); $('briefing').classList.toggle('hidden', G.status !== 'briefing'); return; }
  const unlocked = unlockedCount();
  list.innerHTML = '';
  CAMPAIGN.forEach((m, i) => {
    const el = document.createElement('button'), locked = i >= unlocked, best = bestTime(m.id);
    el.className = 'mission-card' + (locked ? ' locked' : '') + (i === G.missionIndex ? ' current' : '');
    el.dataset.mission = m.id;
    el.innerHTML = '<strong>' + m.number + ' / ' + m.codename + '</strong>' + m.title
      + '<small>' + (locked ? 'Locked · complete the previous mission' : best !== null ? 'Best ' + timeText(best) : 'Not completed') + '</small>';
    el.disabled = locked;
    el.onclick = () => selectMission(i);
    list.append(el);
  });
  list.classList.remove('hidden');
  $('briefing').classList.add('hidden');
  $('scorecard').classList.add('hidden');
}

export function showPlaying() {
  document.body.classList.add('playing');
  $('missionTag').textContent = 'Riverbend / ' + G.mission.codename.toLowerCase();
  $('hud').style.display = 'block';
  $('screen').classList.add('hidden');
  $('tapResume').style.display = 'none';
  resetHUD();
}

export function showPause() {
  showScreen();
  $('menuEyebrow').textContent = G.mission.briefing.eyebrow + ' / paused';
  $('menuTitle').innerHTML = 'HOLDING<br><span>POSITION.</span>';
  $('menuText').textContent = 'Resume when you are ready.';
  $('briefing').classList.add('hidden');
  $('scorecard').classList.add('hidden');
  buttons([
    { label: 'Resume mission', primary: true, onClick: resume },
    G.checkpoint && { label: 'Last checkpoint', id: 'retryBtn', onClick: retry },
    { label: 'Restart mission', id: 'restartBtn', onClick: restart },
  ]);
}

export function showFinish(won) {
  const m = G.mission, r = won ? m.success : m.failure, p = G.local, s = p.stats, total = m.objectives.length;
  const kills = G.players.reduce((n, q) => n + q.stats.kills, 0);
  showScreen();
  $('menuEyebrow').textContent = r.eyebrow;
  $('menuTitle').innerHTML = r.title;
  $('menuText').textContent = r.text;
  $('briefing').classList.add('hidden');
  const values = [
    [timeText(G.elapsed), 'MISSION TIME'],
    [kills + ' / ' + G.enemies.length, 'MACHINES DISABLED'],
    [(s.shots ? Math.round(s.hits / s.shots * 100) : 0) + '%', 'HIT ACCURACY'],
    [s.shots, 'ROUNDS FIRED'],
    [s.grenades, 'GRENADES THROWN'],
    [(won ? total : G.objective) + ' / ' + total, 'OBJECTIVES'],
  ];
  $('scorecard').innerHTML = values.map(([v, k]) => '<div><b>' + v + '</b><span>' + k + '</span></div>').join('');
  $('scorecard').classList.remove('hidden');
  if (won) buttons([
    hasNextMission() && { label: 'Next mission', primary: true, id: 'nextBtn', onClick: nextMission },
    { label: 'Replay mission', primary: !hasNextMission(), id: 'replayBtn', onClick: restart },
    missionsButton,
  ]);
  else buttons([
    G.checkpoint && { label: 'Retry from checkpoint', primary: true, id: 'retryBtn', onClick: retry },
    { label: 'Restart mission', primary: !G.checkpoint, id: 'restartBtn', onClick: restart },
    missionsButton,
  ]);
}
