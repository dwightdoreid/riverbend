// Full-screen menu states: briefing, mission select, co-op lobby, pause, and the scorecard.
import { $ } from '../engine/dom.js';
import { G } from '../game/state.js';
import { timeText, resetHUD } from './hud.js';
import { CAMPAIGN } from '../missions/index.js';
import { unlockedCount, bestTime } from '../game/progress.js';
import { deploy, resume, restart, retry, selectMission, nextMission, hasNextMission } from '../game/flow.js';
import { net, isHost, isClient, inCoop, hostGame, joinGame, leave, onNetChange } from '../net/net.js';

const transportKind = new URLSearchParams(location.search).get('net') === 'local' ? 'local' : 'peer';
let lastMenu = null;   // re-render function for the current menu state

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
    if (b.disabled) el.disabled = true;
    el.onclick = b.onClick;
    box.append(el);
  }
}

const missionsButton = () => !isClient() && { label: 'Missions', id: 'missionsBtn', onClick: () => toggleMissionList() };
const coopButton = () => ({ label: inCoop() ? 'Co-op room' + (net.roster.length ? ' (' + net.roster.length + ')' : '') : 'Co-op', id: 'coopBtn', onClick: () => toggleCoop() });
const waitingButton = { label: 'Waiting for host…', primary: true, disabled: true, id: 'waitBtn' };

export function showBriefing(m) {
  const b = m.briefing;
  showScreen();
  $('menuEyebrow').textContent = b.eyebrow;
  $('menuTitle').innerHTML = b.title;
  $('menuText').textContent = b.lede;
  $('briefing').innerHTML = '<p>' + b.body + '</p><div class="stages">'
    + b.stages.map(([head, line1, line2]) => '<div class="stage"><strong>' + head + '</strong>' + line1 + '<br>' + line2 + '</div>').join('')
    + '</div><p>' + b.tip + '</p>';
  if ($('coopPanel').classList.contains('hidden')) $('briefing').classList.remove('hidden');
  $('scorecard').classList.add('hidden');
  lastMenu = () => buttons([
    isClient() ? waitingButton : { label: isHost() ? 'Deploy squad (' + net.roster.length + ')' : (b.deploy ?? 'Deploy'), primary: true, onClick: deploy },
    missionsButton(), coopButton(),
  ]);
  lastMenu();
}

function toggleMissionList() {
  const list = $('missionList');
  $('coopPanel').classList.add('hidden');
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

// ------------------------------------------------------------------ co-op panel

function storedName() {
  try { return localStorage.getItem('riverbend.name') || ''; } catch { return ''; }
}
function playerName() {
  const n = $('coopName').value.trim().slice(0, 16) || 'Operator';
  try { localStorage.setItem('riverbend.name', n); } catch { /* not persisted */ }
  return n;
}

function toggleCoop(force) {
  const panel = $('coopPanel'), open = force ?? panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !open);
  $('missionList').classList.add('hidden');
  $('briefing').classList.toggle('hidden', open || G.status !== 'briefing');
  $('scorecard').classList.toggle('hidden', open || !(G.status === 'won' || G.status === 'lost'));
  renderCoop();
}

function renderCoop() {
  if (!$('coopName').value) $('coopName').value = storedName() || 'Operator-' + Math.floor(Math.random() * 90 + 10);
  $('coopIdle').classList.toggle('hidden', inCoop());
  $('coopRoom').classList.toggle('hidden', !inCoop());
  $('coopName').disabled = inCoop();
  $('roomCode').textContent = net.code ?? '';
  $('roster').innerHTML = net.roster.map(r => '<li><span>' + r.name.replace(/[<&]/g, '') + (r.id === net.myId ? ' (you)' : '') + '</span><small>'
    + (r.id === 0 ? 'host' : r.active ? 'in squad' : 'joins at next checkpoint') + '</small></li>').join('');
  $('coopStatus').textContent = net.status;
}

export function setupCoopPanel() {
  $('hostBtn').onclick = async () => {
    try { await hostGame(playerName(), transportKind); } catch (e) { net.status = 'Could not open a room: ' + e.message; }
    renderCoop(); lastMenu?.();
  };
  $('joinBtn').onclick = async () => {
    const code = $('joinCode').value.trim();
    if (code.length < 5) { net.status = 'Enter the 5-letter room code.'; renderCoop(); return; }
    try { await joinGame(code, playerName(), transportKind); } catch { /* status already set */ }
    renderCoop(); lastMenu?.();
  };
  $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
  $('leaveBtn').onclick = () => leave();
  onNetChange(() => { renderCoop(); if (G.status !== 'playing' || G.overlay) lastMenu?.(); });
}

// ------------------------------------------------------------------ other states

export function showPlaying() {
  document.body.classList.add('playing');
  $('missionTag').textContent = 'Riverbend / ' + G.mission.codename.toLowerCase();
  $('hud').style.display = 'block';
  $('screen').classList.add('hidden');
  $('coopPanel').classList.add('hidden');
  $('tapResume').style.display = 'none';
  resetHUD();
}

export function showPause() {
  showScreen();
  $('coopPanel').classList.add('hidden');
  $('menuEyebrow').textContent = G.mission.briefing.eyebrow + (inCoop() ? ' / menu' : ' / paused');
  $('menuTitle').innerHTML = inCoop() ? 'SQUAD<br><span>MENU.</span>' : 'HOLDING<br><span>POSITION.</span>';
  $('menuText').textContent = inCoop() ? 'The mission keeps running while this menu is open.' : 'Resume when you are ready.';
  $('briefing').classList.add('hidden');
  $('scorecard').classList.add('hidden');
  lastMenu = () => buttons([
    { label: 'Resume mission', primary: true, onClick: resume },
    !isClient() && G.checkpoint && { label: 'Last checkpoint', id: 'retryBtn', onClick: retry },
    !isClient() && { label: 'Restart mission', id: 'restartBtn', onClick: restart },
    inCoop() && coopButton(),
  ]);
  lastMenu();
}

export function showFinish(won) {
  const m = G.mission, r = won ? (m.endings?.[G.ending] ?? m.success) : m.failure, p = G.local, s = p.stats, total = m.objectives.length;
  const kills = G.players.reduce((n, q) => n + q.stats.kills, 0);
  showScreen();
  $('coopPanel').classList.add('hidden');
  $('menuEyebrow').textContent = r.eyebrow;
  $('menuTitle').innerHTML = r.title;
  $('menuText').textContent = r.text;
  $('briefing').classList.add('hidden');
  const values = [
    [timeText(G.elapsed), 'MISSION TIME'],
    [(inCoop() ? 'You ' + s.kills + ' · Team ' + kills : kills) + ' / ' + G.enemies.length, 'MACHINES DISABLED'],
    [(s.shots ? Math.round(s.hits / s.shots * 100) : 0) + '%', 'HIT ACCURACY'],
    [s.shots, 'ROUNDS FIRED'],
    [s.grenades, 'GRENADES THROWN'],
    [(won ? total : G.objective) + ' / ' + total, 'OBJECTIVES'],
  ];
  $('scorecard').innerHTML = values.map(([v, k]) => '<div><b>' + v + '</b><span>' + k + '</span></div>').join('');
  $('scorecard').classList.remove('hidden');
  lastMenu = () => {
    if (isClient()) buttons([waitingButton, coopButton()]);
    else if (won) buttons([
      hasNextMission() && { label: 'Next mission', primary: true, id: 'nextBtn', onClick: nextMission },
      { label: 'Replay mission', primary: !hasNextMission(), id: 'replayBtn', onClick: restart },
      missionsButton(), inCoop() && coopButton(),
    ]);
    else buttons([
      G.checkpoint && { label: 'Retry from checkpoint', primary: true, id: 'retryBtn', onClick: retry },
      { label: 'Restart mission', primary: !G.checkpoint, id: 'restartBtn', onClick: restart },
      missionsButton(), inCoop() && coopButton(),
    ]);
  };
  lastMenu();
}
