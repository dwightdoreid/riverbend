// Full-screen menu states: briefing, pause, and the end-of-mission scorecard.
import { $ } from '../engine/dom.js';
import { G } from '../game/state.js';
import { timeText, resetHUD } from './hud.js';

function showScreen() {
  document.body.classList.remove('playing');
  $('screen').classList.remove('hidden');
  $('tapResume').style.display = 'none';
}

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
  $('startBtn').textContent = b.deploy ?? 'Deploy';
  $('restartBtn').classList.add('hidden');
}

export function showPlaying() {
  document.body.classList.add('playing');
  $('hud').style.display = 'block';
  $('screen').classList.add('hidden');
  $('tapResume').style.display = 'none';
  resetHUD();
}

export function showPause() {
  showScreen();
  $('menuEyebrow').textContent = 'Riverbend / mission paused';
  $('menuTitle').innerHTML = 'HOLDING<br><span>POSITION.</span>';
  $('menuText').textContent = 'Resume when you are ready.';
  $('briefing').classList.add('hidden');
  $('scorecard').classList.add('hidden');
  $('startBtn').textContent = 'Resume mission';
  $('restartBtn').classList.remove('hidden');
}

export function showFinish(won) {
  const m = G.mission, r = won ? m.success : m.failure, p = G.local, s = p.stats, total = m.objectives.length;
  const kills = G.players.reduce((n, q) => n + q.stats.kills, 0);
  showScreen();
  $('menuEyebrow').textContent = r.eyebrow;
  $('menuTitle').innerHTML = r.title;
  $('menuText').textContent = r.text;
  $('briefing').classList.add('hidden');
  $('startBtn').textContent = 'Play again';
  $('restartBtn').classList.add('hidden');
  const values = [
    [timeText(G.elapsed), 'MISSION TIME'],
    [kills + ' / ' + G.enemies.length, 'SENTRIES DISABLED'],
    [(s.shots ? Math.round(s.hits / s.shots * 100) : 0) + '%', 'HIT ACCURACY'],
    [s.shots, 'ROUNDS FIRED'],
    [s.grenades, 'GRENADES THROWN'],
    [(won ? total : G.objective) + ' / ' + total, 'OBJECTIVES'],
  ];
  $('scorecard').innerHTML = values.map(([v, k]) => '<div><b>' + v + '</b><span>' + k + '</span></div>').join('');
  $('scorecard').classList.remove('hidden');
}
