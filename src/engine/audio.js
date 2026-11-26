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
  if (kind === 'shot' || kind === 'pistol' || kind === 'blast') {
    const n = audio.createBufferSource(); n.buffer = noiseBuffer;
    const f = audio.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = kind === 'blast' ? 380 : kind === 'pistol' ? 2100 : 1500;
    const dur = kind === 'blast' ? .42 : .11;
    g.gain.setValueAtTime((kind === 'blast' ? .8 : .28) * level, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    n.connect(f); f.connect(g); n.start(t); n.stop(t + Math.min(.21, dur));
    const o = audio.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(kind === 'blast' ? 90 : 160, t); o.frequency.exponentialRampToValueAtTime(35, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur);
  } else {
    const o = audio.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(kind === 'hit' ? 760 : kind === 'reload' ? 310 : kind === 'hurt' ? 130 : 560, t);
    g.gain.setValueAtTime(.075 * level, t); g.gain.exponentialRampToValueAtTime(.001, t + .13);
    o.connect(g); o.start(t); o.stop(t + .15);
  }
}
