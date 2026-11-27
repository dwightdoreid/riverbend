// Adaptive procedural soundtrack, ambience beds and footsteps. Runs on every machine (host and
// clients) from the local player's view of the game.
//
// Music: a 16-step sequencer (Web Audio clock, lookahead scheduling) playing pad, bass, arpeggio,
// hats, kick/snare and a boss lead. Each part has its own gain node; the intensity
// (0 calm, 1 tension, 2 combat, 3 boss) cross-fades them. The mood (key, scale, tempo, timbre)
// comes from the environment, or mission.music. Stingers mark checkpoints, the alarm, wins and
// losses. Ambience: wind, rain, the 50 Hz grid hum near equipment, cave drips, plus reverb per
// level. Footsteps follow the local player, with a sound per surface.
import { G } from './state.js';
import { audioCtx, sound, setReverb } from '../engine/audio.js';
import { windVec } from './weather.js';
import { inWater, isActive } from './players.js';

const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10] };
const PROGS = { minor: [0, 5, 2, 6], dorian: [0, 3, 0, 6], phrygian: [0, 1, 0, 6] };
export const MOODS = {
  day:         { root: 50, scale: 'dorian',   bpm: 92,  cutoff: 1900, pad: 'triangle' },
  dusk:        { root: 45, scale: 'minor',    bpm: 88,  cutoff: 1600, pad: 'sawtooth' },
  night:       { root: 52, scale: 'minor',    bpm: 84,  cutoff: 1100, pad: 'sawtooth' },
  storm:       { root: 49, scale: 'minor',    bpm: 104, cutoff: 1500, pad: 'sawtooth' },
  underground: { root: 41, scale: 'phrygian', bpm: 80,  cutoff: 850,  pad: 'sawtooth' },
  snow:        { root: 47, scale: 'minor',    bpm: 76,  cutoff: 1400, pad: 'triangle' },
};
const LAYERS = { pad: [1, .85, .7, .7], bass: [.35, .7, 1, 1], arp: [0, .55, .8, .9], hats: [0, .35, .8, 1], drums: [0, 0, 1, 1], lead: [0, 0, 0, .7] };
// Levels with live equipment hum (0..1), and how much each space reverberates.
const HUM = { riverbend: .5, calder: .35, kelso: .7, peaker: .45, datahalls: .6, control: .5, corechamber: .8, caverns: .25, office: .2, ridge: .25 };
const VERB = { tunnels: .45, caverns: .5, datahalls: .32, control: .25, corechamber: .5, office: .22 };
const SURFACE = { tunnels: 'hard', caverns: 'gravel', datahalls: 'metal', control: 'hard', corechamber: 'metal', office: 'hard', viaduct: 'metal' };

const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const S = { on: false, mood: null, intensity: 0, held: 0, step: 0, next: 0, layers: null, beds: null, notes: 0, steps: 0, walked: 0, dripIn: 2, timer: null };

/** For tests and the debug overlay. */
export const soundtrackState = () => ({
  on: S.on, mood: S.moodName, intensity: S.intensity, notes: S.notes, steps: S.steps,
  layers: S.layers ? Object.fromEntries(Object.entries(S.layers).map(([k, g]) => [k, +g.target.toFixed(2)])) : null,
  beds: S.beds ? Object.fromEntries(Object.entries(S.beds).map(([k, b]) => [k, +b.target.toFixed(2)])) : null,
});

function ensureGraph() {
  const A = audioCtx(); if (!A) return null;
  if (!S.layers) {
    S.layers = {};
    for (const k of Object.keys(LAYERS)) { const g = A.audio.createGain(); g.gain.value = 0; g.connect(A.bus.music); S.layers[k] = { node: g, target: 0 }; }
    // Ambience beds: long looping noise through filters, and the hum oscillators.
    const loop = (type, freq, q = .7) => {
      const src = A.audio.createBufferSource(); src.buffer = A.longNoise; src.loop = true;
      const f = A.audio.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = A.audio.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(A.bus.amb); src.start();
      return { node: g, filter: f, target: 0 };
    };
    const hum = A.audio.createGain(); hum.gain.value = 0; hum.connect(A.bus.amb);
    for (const [f, a] of [[50, .5], [100, .3], [150, .12], [250, .05]]) { const o = A.audio.createOscillator(); o.frequency.value = f; const g = A.audio.createGain(); g.gain.value = a; o.connect(g); g.connect(hum); o.start(); }
    S.beds = { wind: loop('bandpass', 420, .5), rain: loop('highpass', 3200), hum: { node: hum, target: 0 } };
  }
  return A;
}

function setTarget(x, v, tau = 1.2) { const A = audioCtx(); x.target = v; x.node.gain.setTargetAtTime(v, A.audio.currentTime, tau); }

/** Start (or retune) the music for the current mission. Safe to call repeatedly. */
export function startSoundtrack() {
  const A = ensureGraph(); if (!A) return;
  const name = G.mission?.music?.mood ?? G.env?.name ?? 'day';
  S.moodName = MOODS[name] ? name : 'night'; S.mood = { ...MOODS[S.moodName], ...(G.mission?.music ?? {}) };
  S.intensity = 0; S.held = 0;
  if (!S.on) { S.on = true; S.next = A.audio.currentTime + .1; S.step = 0; S.timer = setInterval(schedule, 25); }
  setReverb(VERB[G.level?.id] ?? .08);
}
export function stopSoundtrack(fade = 2) {
  if (!S.layers) return;
  for (const l of Object.values(S.layers)) setTarget(l, 0, fade / 3);
  for (const b of Object.values(S.beds)) setTarget(b, 0, fade / 3);
  S.on = false; clearInterval(S.timer); S.timer = null;
}

// ------------------------------------------------------------------ sequencer

function chordAt(bar) {
  const m = S.mood, sc = SCALES[m.scale], deg = PROGS[m.scale][Math.floor(bar / 2) % 4];
  const n = i => { const k = deg + i; return m.root + sc[k % 7] + 12 * Math.floor(k / 7); };
  return [n(0), n(2), n(4)];
}
function voice(layer, type, freq, t, dur, gain, attack = .01, cutoff = null) {
  const A = audioCtx(), o = A.audio.createOscillator(), g = A.audio.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.setTargetAtTime(0, t + Math.max(attack, dur * .6), dur * .25);
  if (cutoff) { const f = A.audio.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(S.layers[layer].node); o.start(t); o.stop(t + dur * 1.6 + .1); S.notes++;
}
function hit(layer, kind, t) {
  const A = audioCtx(), g = A.audio.createGain(); g.connect(S.layers[layer].node); S.notes++;
  if (kind === 'kick') { const o = A.audio.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + .18); g.gain.setValueAtTime(.4, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(g); o.start(t); o.stop(t + .26); return; }
  const n = A.audio.createBufferSource(); n.buffer = A.noiseBuffer; const f = A.audio.createBiquadFilter();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const d = kind === 'hat' ? .04 : .14; g.gain.setValueAtTime(kind === 'hat' ? .12 : .25, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  n.connect(f); f.connect(g); n.start(t); n.stop(t + d + .01);
}

function schedule() {
  const A = audioCtx(); if (!A || !S.on) return;
  const m = S.mood, boss = S.intensity >= 3, spb = 60 / (m.bpm * (boss ? 1.12 : 1)) / 4;   // seconds per 16th
  while (S.next < A.audio.currentTime + .15) {
    const t = S.next, s = S.step % 16, bar = Math.floor(S.step / 16), ch = chordAt(bar), I = S.intensity;
    if (s === 0 && bar % 2 === 0) for (const n of ch) for (const det of [-6, 6]) { const v = voice('pad', m.pad, midi(n + 12) * Math.pow(2, det / 1200), t, spb * 32, .045, .9, m.cutoff); void v; }
    const bassSteps = [[0], [0, 8], [0, 3, 6, 8, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14]][I];
    if (bassSteps.includes(s)) voice('bass', 'triangle', midi(ch[0] - 12), t, spb * (I ? 1.6 : 7), .16, .01);
    if (I >= 1) { const seq = [0, 1, 2, 1], k = seq[s % 4] + (s >= 8 ? 1 : 0); voice('arp', 'square', midi(ch[k % 3] + 24 + (k > 2 ? 12 : 0)), t, spb * .9, .035, .005, 2400); }
    if (I >= 1 && (s % 4 === 2 || (I >= 2 && s % 2 === 1))) hit('hats', 'hat', t);
    if (I >= 2) { if ([0, 8].includes(s) || (boss && [4, 12].includes(s) && s !== 4)) hit('drums', 'kick', t); if ([4, 12].includes(s)) hit('drums', 'snare', t); if (boss && s === 4) hit('drums', 'kick', t); }
    if (boss && s === 0 && bar % 4 === 0) [0, 2, 3, 2].forEach((d, i) => voice('lead', 'sawtooth', midi(ch[0] + 24 + SCALES[m.scale][d]), t + i * spb * 4, spb * 3.5, .05, .02, 2000));
    S.next += spb; S.step++;
  }
}

/** One-shot musical cues on the music bus. */
export function stinger(kind) {
  const A = ensureGraph(); if (!A) return;
  const t = A.audio.currentTime + .02, r = S.mood?.root ?? 52, sc = SCALES[S.mood?.scale ?? 'minor'];
  const play = (notes, step, dur, type = 'triangle', gain = .08) => notes.forEach((n, i) => {
    const o = A.audio.createOscillator(), g = A.audio.createGain(); o.type = type; o.frequency.value = midi(n);
    g.gain.setValueAtTime(0, t + i * step); g.gain.linearRampToValueAtTime(gain, t + i * step + .02); g.gain.setTargetAtTime(0, t + i * step + dur * .5, dur * .3);
    o.connect(g); g.connect(A.bus.music); o.start(t + i * step); o.stop(t + i * step + dur * 2); S.notes++;
  });
  if (kind === 'checkpoint') play([r + 12, r + 12 + sc[2], r + 12 + sc[4], r + 24], .09, .5);
  else if (kind === 'alarm') play([r + 25, r + 19, r + 25, r + 19], .22, .2, 'square', .05);
  else if (kind === 'win') play([r, r + 7, r + 12, r + 16, r + 19, r + 24], .12, 2.4, 'triangle', .07);   // resolves to the major
  else if (kind === 'fail') play([r + 12, r + 10, r + 7, r + 3, r], .18, 1.6, 'sawtooth', .05);
}

// ------------------------------------------------------------------ per frame

function targetIntensity() {
  const me = G.local; if (!me || G.status !== 'playing') return 0;
  const near = (e, r) => Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z) < r;
  const alive = G.enemies.filter(e => !e.dead);
  if (alive.some(e => e.type.boss && near(e, 70))) return 3;
  if (alive.some(e => e.state === 'engage' && e.visible && near(e, 45))) return 2;
  if (alive.some(e => (e.state === 'investigate' || e.state === 'search') && near(e, 45)) || G.stealth?.meter > 0 || G.stealth?.alarm || currentTimeLimit()) return 1;
  return 0;
}
const currentTimeLimit = () => !!G.mission?.objectives[G.objective]?.timeLimit;

export function updateSoundtrack(dt) {
  if (!S.on || !audioCtx()) return;
  // Intensity rises at once and falls back after a few quiet seconds of game time (pausing doesn't count).
  const gdt = G.status === 'playing' ? Math.max(0, Math.min(1, G.elapsed - (S.lastElapsed ?? G.elapsed))) : 0; S.lastElapsed = G.elapsed;
  const want = targetIntensity();
  if (want >= S.intensity) { S.intensity = want; S.held = 5; } else if ((S.held -= gdt) <= 0) { S.intensity = Math.max(want, S.intensity - 1); S.held = 4; }
  const playing = G.status === 'playing';
  for (const [k, v] of Object.entries(LAYERS)) { const g = playing ? v[S.intensity] : (k === 'pad' ? .6 : 0); if (Math.abs(S.layers[k].target - g) > .01) setTarget(S.layers[k], g, 1.5); }
  // Ambience.
  const env = G.env?.name, under = env === 'underground', wind = windVec().length();
  const w = under ? .02 : Math.min(.6, .1 + wind * .05 + (env === 'storm' ? .2 : env === 'snow' ? .12 : 0));
  const rain = G.mission?.weather?.rain ? .35 : 0, hum = HUM[G.level?.id] ?? 0;
  if (Math.abs(S.beds.wind.target - w) > .01) { setTarget(S.beds.wind, w, 2); S.beds.wind.filter.frequency.value = 300 + wind * 40; }
  if (Math.abs(S.beds.rain.target - rain) > .01) setTarget(S.beds.rain, rain, 2);
  if (Math.abs(S.beds.hum.target - hum * .06) > .001) setTarget(S.beds.hum, hum * .06, 2);
  if (under && playing && (S.dripIn -= dt) <= 0) { S.dripIn = 1.2 + Math.random() * 4; sound('drip', .6 + Math.random() * .6, Math.random() * 1.6 - .8); }
  // Footsteps for the local player.
  const me = G.local;
  if (playing && me && isActive(me) && (me.elev ?? 0) < 1) {
    const moved = Math.hypot(me.pos.x - (S.lastX ?? me.pos.x), me.pos.z - (S.lastZ ?? me.pos.z));
    if (moved < 2) S.walked += moved;   // ignore teleports
    const stride = me.sprinting ? 2.5 : me.crouched ? 1.5 : 2;
    if (S.walked >= stride) {
      S.walked = 0; S.steps++;
      const surface = inWater(me.pos) ? 'water' : env === 'snow' ? 'snow' : SURFACE[G.level?.id] ?? 'gravel';
      sound('step', me.crouched ? .45 : me.sprinting ? 1.2 : .85, (S.steps % 2 ? .12 : -.12), { surface });
    }
  }
  if (me) { S.lastX = me.pos.x; S.lastZ = me.pos.z; }
}
