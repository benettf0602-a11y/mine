// Seedelt zaj-generátorok (Perlin) + segédek
export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// gyors koordináta-hash 0..1
export function hash2(x, z, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (t, a, b) => a + t * (b - a);
function g3(h, x, y, z) {
  h &= 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
const G2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

export class Noise {
  constructor(seed) {
    const rnd = mulberry32(seed >>> 0);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
  }
  n2(x, y) {
    const p = this.p;
    let X = Math.floor(x), Y = Math.floor(y);
    x -= X; y -= Y; X &= 255; Y &= 255;
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y;
    const g = (h, dx, dy) => { const q = G2[p[h] & 7]; return q[0] * dx + q[1] * dy; };
    return lerp(v, lerp(u, g(a, x, y), g(b, x - 1, y)), lerp(u, g(a + 1, x, y - 1), g(b + 1, x - 1, y - 1))) * 1.35;
  }
  n3(x, y, z) {
    const p = this.p;
    let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(w,
      lerp(v, lerp(u, g3(p[AA], x, y, z), g3(p[BA], x - 1, y, z)), lerp(u, g3(p[AB], x, y - 1, z), g3(p[BB], x - 1, y - 1, z))),
      lerp(v, lerp(u, g3(p[AA + 1], x, y, z - 1), g3(p[BA + 1], x - 1, y, z - 1)), lerp(u, g3(p[AB + 1], x, y - 1, z - 1), g3(p[BB + 1], x - 1, y - 1, z - 1))));
  }
  fbm2(x, y, oct = 4) {
    let a = 1, f = 1, s = 0, t = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n2(x * f, y * f); t += a; a *= 0.5; f *= 2; }
    return s / t;
  }
}
