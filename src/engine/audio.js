// Procedural Web Audio; no sound files. Three buses feed the master gain:
//   sfx (one-shot effects, with a reverb send), music (src/engine/music.js), ambience (beds).
// Volumes are saved in this browser. sound(kind, level, pan, opt) plays a one-shot effect;
// opt.muffle (0..1) low-passes it for distance, opt.surface picks a footstep material.
let audio = null, master = null, noiseBuffer = null, longNoise = null;
const bus = {};
const vol = { master: .35, music: .4, amb: .8 };
const VKEY = 'riverbend.audio';
try { Object.assign(vol, JSON.parse(localStorage.getItem(VKEY) ?? '{}')); } catch { /* defaults */ }
const saveVol = () => { try { localStorage.setItem(VKEY, JSON.stringify(vol)); } catch { /* not persisted */ } };

/** A synthetic room impulse: decaying stereo noise. */
function impulse(seconds, decay) {
  const n = Math.floor(audio.sampleRate * seconds), b = audio.createBuffer(2, n, audio.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}

export function initAudio() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createGain(); master.gain.value = vol.master; master.connect(audio.destination);
      const mk = g => { const n = audio.createGain(); n.gain.value = g; n.connect(master); return n; };
      bus.sfx = mk(1); bus.music = mk(vol.music); bus.amb = mk(vol.amb);
      bus.verb = audio.createConvolver(); bus.verb.buffer = impulse(2.2, 3);
      bus.wet = audio.createGain(); bus.wet.gain.value = .12; bus.verb.connect(bus.wet); bus.wet.connect(master);
      bus.send = audio.createGain(); bus.send.gain.value = 1; bus.send.connect(bus.verb);
      noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .22), audio.sampleRate);
      const d = noiseBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      longNoise = audio.createBuffer(1, audio.sampleRate * 3, audio.sampleRate);
      const l = longNoise.getChannelData(0); for (let i = 0; i < l.length; i++) l[i] = Math.random() * 2 - 1;
    }
    audio.resume();
  } catch { /* audio unavailable */ }
}

/** For music.js and ambience: the context, buses and a looping noise buffer (null before init). */
export const audioCtx = () => audio ? { audio, bus, master, longNoise, noiseBuffer } : null;

export function setVolume(v) { vol.master = v; if (master) master.gain.value = v; saveVol(); }
export function setMusicVolume(v) { vol.music = v; if (bus.music) bus.music.gain.value = v; saveVol(); }
export const volumes = () => ({ ...vol });
/** Reverb amount for the current space (wide open .08, tunnels and halls up to .45). */
export function setReverb(wet) { if (bus.wet) bus.wet.gain.setTargetAtTime(wet, audio.currentTime, .3); }

/** A sound panned left/right (-1..1), e.g. a beacon ping heard from one side. */
export function soundPanned(kind, level, pan) { sound(kind, level, pan); }

const GUN = { shot: [1500, .11, .28, 160], pistol: [2100, .11, .28, 160], blast: [380, .42, .8, 90], shotgun: [900, .2, .42, 160], dmr: [1250, .2, .38, 160] };
const STEP = { gravel: [900, .06, 'lowpass'], metal: [2400, .05, 'bandpass'], snow: [500, .09, 'lowpass'], water: [1300, .12, 'bandpass'], hard: [1600, .04, 'bandpass'] };

export function sound(kind = 'shot', level = 1, pan = 0, opt = {}) {
  if (!audio || !master || vol.master === 0 || level <= 0) return;
  const t = audio.currentTime, g = audio.createGain();
  // Output chain: [muffle lowpass] -> [pan] -> sfx bus (+ reverb send for loud things).
  let out = g;
  if (opt.muffle > .05) { const f = audio.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 9000 * Math.pow(1 - Math.min(.95, opt.muffle), 2) + 300; out.connect(f); out = f; }
  if (pan && audio.createStereoPanner) { const sp = audio.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(sp); out = sp; }
  out.connect(bus.sfx);
  if (GUN[kind] || kind === 'explode' || kind === 'ricochet') out.connect(bus.send);
  const noise = (freq, type = 'lowpass', dur = .2, q = 1) => {
    const n = audio.createBufferSource(); n.buffer = noiseBuffer;
    const f = audio.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    n.connect(f); f.connect(g); n.start(t); n.stop(t + Math.min(.21, dur)); return n;
  };
  const tone = (type, f0, f1, dur, gain = 1) => {
    const o = audio.createOscillator(), og = audio.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    og.gain.value = gain; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur); return o;
  };
  if (GUN[kind]) {
    const [cut, dur, gain, body] = GUN[kind];
    g.gain.setValueAtTime(gain * level, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    noise(cut, 'lowpass', dur); tone('triangle', kind === 'blast' ? 90 : body, 35, dur);
    if (kind !== 'blast') {   // the supersonic crack on top
      const crack = audio.createGain(); crack.gain.setValueAtTime(.5, t); crack.gain.exponentialRampToValueAtTime(.001, t + .03);
      const n = audio.createBufferSource(); n.buffer = noiseBuffer; const f = audio.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3500;
      n.connect(f); f.connect(crack); crack.connect(g); n.start(t); n.stop(t + .04);
    }
  } else if (kind === 'explode') {
    // A crack, a body and a long sub rumble.
    g.gain.setValueAtTime(.9 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.4);
    noise(600, 'lowpass', .2); tone('sine', 70, 28, 1.3, 1.2); tone('triangle', 140, 40, .5, .5);
    const r = audio.createBufferSource(); r.buffer = longNoise; const f = audio.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    r.connect(f); f.connect(g); r.start(t); r.stop(t + 1.4);
  } else if (kind === 'ricochet') {
    g.gain.setValueAtTime(.05 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .25);
    const f0 = 2200 + Math.random() * 1800; tone('sine', f0, f0 * .55, .25); noise(4000, 'highpass', .04);
  } else if (kind === 'step') {
    const [freq, dur, type] = STEP[opt.surface] ?? STEP.gravel;
    g.gain.setValueAtTime(.09 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    noise(freq * (.85 + Math.random() * .3), type, dur, type === 'bandpass' ? 2 : 1);
    if (opt.surface === 'metal') tone('sine', 380 + Math.random() * 60, 0, .08, .25);
  } else if (kind === 'drip') {
    g.gain.setValueAtTime(.05 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
    const f0 = 900 + Math.random() * 700; tone('sine', f0, f0 * 1.9, .12);
  } else if (kind === 'click') {
    g.gain.setValueAtTime(.05 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); tone('square', 1800, 900, .05, .3);
  } else if (kind === 'steam') {
    const n = audio.createBufferSource(); n.buffer = noiseBuffer; n.loop = true;
    const f = audio.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2600;
    g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(.32 * level, t + .08); g.gain.exponentialRampToValueAtTime(.001, t + 1.6);
    n.connect(f); f.connect(g); n.start(t); n.stop(t + 1.65);
  } else if (kind === 'heal') {
    g.gain.setValueAtTime(.04 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); tone('sine', 520, 980, .25);
  } else if (kind === 'arc') {
    g.gain.setValueAtTime(.06 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .18); tone('square', 1500, 260, .16);
  } else {
    g.gain.setValueAtTime(.075 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .13);
    const o = tone('sine', kind === 'hit' ? 760 : kind === 'reload' ? 310 : kind === 'hurt' ? 130 : kind === 'radio' ? 1180 : 560, 0, .15);
    if (kind === 'radio') o.frequency.setValueAtTime(880, t + .06);
  }
}
