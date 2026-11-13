// Szintetizált hangok (WebAudio) – nincs külső hangfájl
let ctx = null, master = null, noiseBuf = null, musicGain = null, musicTimer = null;
export const vol = { master: 0.7, music: 0.35 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = vol.master; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = vol.music; musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
}
export function setVolume(m, mu) { vol.master = m; vol.music = mu; if (master) master.gain.value = m; if (musicGain) musicGain.gain.value = mu; }

function noise(dur, freq, q, gain, type = 'bandpass', slide = 0, at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  f.type = type; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur); f.Q.value = q;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(freq, dur, gain, type = 'square', slide = 0, at = 0, dest) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
}
const MAT = {
  stone: [900, 1.2, 0.5], grass: [500, 0.8, 0.35], dirt: [380, 0.8, 0.4], wood: [260, 2.5, 0.55], sand: [2200, 0.5, 0.3],
  gravel: [1200, 0.7, 0.45], glass: [3400, 3, 0.4], cloth: [300, 0.5, 0.25],
};
export function sndBreak(m) { const p = MAT[m] || MAT.stone; noise(0.22, p[0], p[1], p[2] * 1.2); noise(0.12, p[0] * 1.6, p[1], p[2] * 0.6, 'bandpass', 0, 0.02); if (m === 'glass') tone(2400, 0.2, 0.08, 'triangle', -900); }
export function sndHit(m) { const p = MAT[m] || MAT.stone; noise(0.09, p[0], p[1], p[2] * 0.6); }
export function sndPlace(m) { const p = MAT[m] || MAT.stone; noise(0.14, p[0] * 0.8, p[1], p[2] * 0.8); }
export function sndStep(m, v = 1) { const p = MAT[m] || MAT.stone; noise(0.07, p[0] * 0.7, p[1], p[2] * 0.3 * v); }
export function sndHurt() { tone(220, 0.25, 0.25, 'sawtooth', -120); noise(0.12, 600, 1, 0.2); }
export function sndPop() { tone(520, 0.1, 0.12, 'sine', 700); }
export function sndEat() { for (let i = 0; i < 3; i++) noise(0.07, 700 + i * 120, 1, 0.3, 'bandpass', 0, i * 0.12); }
export function sndSplash() { noise(0.4, 1400, 0.6, 0.35, 'lowpass', -900); }
export function sndExplode() { noise(0.9, 400, 0.5, 0.9, 'lowpass', -300); tone(70, 0.7, 0.5, 'sawtooth', -40); }
export function sndFuse() { noise(0.6, 3000, 2, 0.15, 'highpass'); }
export function sndClick() { tone(900, 0.04, 0.08, 'square'); }
export function sndLevel() { tone(660, 0.12, 0.12, 'triangle'); tone(990, 0.2, 0.12, 'triangle', 0, 0.1); }
export function sndMob(kind, big) {
  if (kind === 'pig') { tone(180 + Math.random() * 40, 0.18, 0.2, 'sawtooth', -40); tone(150, 0.12, 0.15, 'sawtooth', -30, 0.12); }
  else if (kind === 'cow') { tone(110, 0.55, 0.22, 'sawtooth', -30); noise(0.4, 400, 1, 0.12, 'lowpass'); }
  else if (kind === 'zombie') { tone(95 + Math.random() * 25, 0.7, 0.22, 'sawtooth', -35); noise(0.5, 300, 1.5, 0.18); }
  else if (kind === 'creeper') { noise(0.5, 2500, 1, 0.12, 'highpass'); }
  else if (kind === 'sheep') { tone(330, 0.5, 0.18, 'sawtooth', -60); }
}
export function sndDeathMob() { tone(180, 0.35, 0.22, 'sawtooth', -110); }

// Lágy, algoritmikus háttérzene (pentaton zongora-szerű hangok)
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
export function startMusic() {
  if (!ctx || musicTimer) return;
  const base = 261.63;
  const playNote = () => {
    const root = [0, -3, -5, -7][(Math.random() * 4) | 0];
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const semi = root + SCALE[(Math.random() * SCALE.length) | 0], f = base * Math.pow(2, semi / 12), at = i * (0.5 + Math.random() * 0.6);
      tone(f, 2.6, 0.22, 'sine', 0, at, musicGain); tone(f * 2, 1.6, 0.05, 'triangle', 0, at, musicGain);
    }
    musicTimer = setTimeout(playNote, 14000 + Math.random() * 22000);
  };
  musicTimer = setTimeout(playNote, 4000);
}
export function stopMusic() { if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; } }

export function sndShoot() { noise(0.12, 2600, 1.5, 0.25, 'bandpass', -1800); tone(160, 0.12, 0.12, 'triangle', 90); }
