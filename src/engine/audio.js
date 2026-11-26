// Procedural Web Audio effects; no sound files required.
let audio = null, master = null, noiseBuffer = null, volume = .35;

export function initAudio() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createGain(); master.gain.value = volume; master.connect(audio.destination);
      noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .22), audio.sampleRate);
      const d = noiseBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    audio.resume();
  } catch { /* audio unavailable */ }
}

export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

export function sound(kind = 'shot', level = 1) {
  if (!audio || !master || volume === 0) return;
  const t = audio.currentTime, g = audio.createGain(); g.connect(master);
  if (kind === 'shot' || kind === 'pistol' || kind === 'blast' || kind === 'shotgun' || kind === 'dmr') {
    const n = audio.createBufferSource(); n.buffer = noiseBuffer;
    const f = audio.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = kind === 'blast' ? 380 : kind === 'pistol' ? 2100 : kind === 'shotgun' ? 900 : kind === 'dmr' ? 1250 : 1500;
    const dur = kind === 'blast' ? .42 : kind === 'shotgun' || kind === 'dmr' ? .2 : .11;
    g.gain.setValueAtTime((kind === 'blast' ? .8 : kind === 'shotgun' ? .42 : kind === 'dmr' ? .38 : .28) * level, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    n.connect(f); f.connect(g); n.start(t); n.stop(t + Math.min(.21, dur));
    const o = audio.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(kind === 'blast' ? 90 : 160, t); o.frequency.exponentialRampToValueAtTime(35, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur);
  } else if (kind === 'arc') {
    const o = audio.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(260, t + .16);
    g.gain.setValueAtTime(.06 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
    o.connect(g); o.start(t); o.stop(t + .2);
  } else {
    const o = audio.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(kind === 'hit' ? 760 : kind === 'reload' ? 310 : kind === 'hurt' ? 130 : kind === 'radio' ? 1180 : 560, t);
    if (kind === 'radio') o.frequency.setValueAtTime(880, t + .06);
    g.gain.setValueAtTime(.075 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .13);
    o.connect(g); o.start(t); o.stop(t + .15);
  }
}
