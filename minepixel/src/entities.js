// Mobok (disznó, tehén, birka, zombi, creeper), eldobott tárgyak, részecskék
import * as THREE from '../vendor/three.module.js';
import { B, I, BLOCKS, SOLID, FK, isBlockItem, itemDef } from './blocks.js';
import { moveBox, rayAABB } from './physics.js';
import { blockModel } from './mesher.js';
import { iconCanvas, avgColor } from './textures.js';
import * as A from './audio.js';

const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- modell-építés ----------
function shadeBox(w, h, d, col, jitter = 0.05) {
  const g = new THREE.BoxGeometry(w, h, d), n = g.attributes.position.count, c = new Float32Array(n * 3);
  const sh = [0.8, 0.8, 1.05, 0.55, 0.9, 0.7]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v, k = 1 + (Math.random() - 0.5) * jitter * 2;
    c[i * 3] = Math.min(1, col[0] * sh[f] * k); c[i * 3 + 1] = Math.min(1, col[1] * sh[f] * k); c[i * 3 + 2] = Math.min(1, col[2] * sh[f] * k);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function part(parent, mat, w, h, d, col, x, y, z, pivotY = 0, jitter) {
  // pivot a doboz tetején (pivotY = h/2) vagy közepén (0)
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = new THREE.Mesh(shadeBox(w, h, d, col, jitter), mat); m.position.y = -pivotY; g.add(m); parent.add(g); return g;
}
const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

const DEFS = {
  pig: { w: 0.8, h: 0.9, hp: 10, speed: 1.6, passive: true, snd: 'pig', drops: () => [[I.RAW_PORK, 1 + (Math.random() * 2 | 0)]],
    build(root, mat) {
      const pink = hex(0xf0a8a8), dk = hex(0xd88a8a);
      const body = part(root, mat, 0.6, 0.55, 0.95, pink, 0, 0.55, 0); body.position.y = 0.55;
      const head = part(root, mat, 0.5, 0.5, 0.5, pink, 0, 0.7, 0.6, 0);
      part(head, mat, 0.26, 0.2, 0.1, dk, 0, -0.07, 0.29, 0); part(head, mat, 0.05, 0.07, 0.02, [0.2, 0.1, 0.1], -0.08, -0.07, 0.35); part(head, mat, 0.05, 0.07, 0.02, [0.2, 0.1, 0.1], 0.08, -0.07, 0.35);
      part(head, mat, 0.08, 0.08, 0.02, [0, 0, 0], -0.12, 0.1, 0.26); part(head, mat, 0.08, 0.08, 0.02, [0, 0, 0], 0.12, 0.1, 0.26);
      const legs = [];
      for (const [lx, lz] of [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]]) legs.push(part(root, mat, 0.2, 0.3, 0.2, dk, lx, 0.3, lz, 0.15));
      return { head, legs, body };
    } },
  cow: { w: 0.9, h: 1.4, hp: 10, speed: 1.4, passive: true, snd: 'cow', drops: () => { const o = [[I.RAW_BEEF, 1 + (Math.random() * 2 | 0)]]; const l = Math.random() * 3 | 0; if (l) o.push([I.LEATHER, l]); return o; },
    build(root, mat) {
      const brown = hex(0x4a3020), white = hex(0xe8e4dc);
      const body = part(root, mat, 0.75, 0.7, 1.15, brown, 0, 0.95, 0, 0, 0.12);
      part(body, mat, 0.3, 0.02, 0.4, white, 0.2, 0.355, 0.1); part(body, mat, 0.25, 0.02, 0.3, white, -0.2, 0.355, -0.25); part(body, mat, 0.02, 0.35, 0.4, white, 0.38, 0, -0.15);
      const head = part(root, mat, 0.5, 0.5, 0.45, brown, 0, 1.25, 0.75);
      part(head, mat, 0.3, 0.2, 0.08, white, 0, -0.15, 0.25); part(head, mat, 0.06, 0.2, 0.06, [0.9, 0.9, 0.8], -0.3, 0.2, 0); part(head, mat, 0.06, 0.2, 0.06, [0.9, 0.9, 0.8], 0.3, 0.2, 0);
      part(head, mat, 0.08, 0.08, 0.02, [0, 0, 0], -0.14, 0.05, 0.23); part(head, mat, 0.08, 0.08, 0.02, [0, 0, 0], 0.14, 0.05, 0.23);
      const legs = [];
      for (const [lx, lz] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) legs.push(part(root, mat, 0.22, 0.6, 0.22, brown, lx, 0.6, lz, 0.3));
      return { head, legs, body };
    } },
  sheep: { w: 0.9, h: 1.3, hp: 8, speed: 1.4, passive: true, snd: 'sheep', drops: () => [[B.WOOL, 1], [I.RAW_MUTTON, 1 + (Math.random() * 2 | 0)]],
    build(root, mat) {
      const wool = hex(0xe8e8e8), skin = hex(0xc9b8a4);
      const body = part(root, mat, 0.8, 0.75, 1.1, wool, 0, 0.95, 0, 0, 0.1);
      const head = part(root, mat, 0.4, 0.42, 0.42, skin, 0, 1.2, 0.7); part(head, mat, 0.44, 0.2, 0.3, wool, 0, 0.3, -0.05);
      part(head, mat, 0.07, 0.07, 0.02, [0, 0, 0], -0.11, 0.05, 0.22); part(head, mat, 0.07, 0.07, 0.02, [0, 0, 0], 0.11, 0.05, 0.22);
      const legs = [];
      for (const [lx, lz] of [[-0.22, 0.35], [0.22, 0.35], [-0.22, -0.35], [0.22, -0.35]]) legs.push(part(root, mat, 0.18, 0.55, 0.18, skin, lx, 0.55, lz, 0.275));
      return { head, legs, body };
    } },
  zombie: { w: 0.6, h: 1.95, hp: 20, speed: 2.2, hostile: true, snd: 'zombie', drops: () => Math.random() < 0.7 ? [[I.ROTTEN, 1 + (Math.random() * 2 | 0)]] : [],
    build(root, mat) {
      const skin = hex(0x5c9a48), shirt = hex(0x2a7a8c), pants = hex(0x30307c);
      const body = part(root, mat, 0.5, 0.75, 0.25, shirt, 0, 1.35, 0, 0.375, 0.06);
      const head = part(root, mat, 0.5, 0.5, 0.5, skin, 0, 1.75, 0, 0, 0.08);
      part(head, mat, 0.12, 0.09, 0.02, [0.05, 0.05, 0.1], -0.12, 0.02, 0.255); part(head, mat, 0.12, 0.09, 0.02, [0.05, 0.05, 0.1], 0.12, 0.02, 0.255);
      const la = part(root, mat, 0.25, 0.75, 0.25, skin, -0.375, 1.7, 0, 0.125); la.rotation.x = -Math.PI / 2;
      const ra = part(root, mat, 0.25, 0.75, 0.25, skin, 0.375, 1.7, 0, 0.125); ra.rotation.x = -Math.PI / 2;
      const legs = [part(root, mat, 0.25, 0.75, 0.25, pants, -0.125, 0.75, 0, 0.375), part(root, mat, 0.25, 0.75, 0.25, pants, 0.125, 0.75, 0, 0.375)];
      return { head, legs, body, arms: [la, ra] };
    } },
  pigman: { w: 0.6, h: 1.95, hp: 20, speed: 2.6, neutral: true, snd: 'zombie', drops: () => Math.random() < 0.5 ? [[I.GOLD_INGOT, 1]] : [[I.ROTTEN, 1]],
    build(root, mat) {
      const skin = hex(0xd88a8a), cloth = hex(0x9a5a3a), pants = hex(0x6a3a28);
      const body = part(root, mat, 0.5, 0.75, 0.25, cloth, 0, 1.35, 0, 0.375, 0.06);
      const head = part(root, mat, 0.5, 0.5, 0.5, skin, 0, 1.75, 0, 0, 0.08);
      part(head, mat, 0.2, 0.15, 0.02, [0.9, 0.7, 0.6], 0, -0.1, 0.255); part(head, mat, 0.1, 0.08, 0.02, [0.1, 0.05, 0.05], -0.12, 0.05, 0.255); part(head, mat, 0.1, 0.08, 0.02, [0.1, 0.05, 0.05], 0.12, 0.05, 0.255);
      const la = part(root, mat, 0.25, 0.75, 0.25, skin, -0.375, 1.7, 0, 0.125); la.rotation.x = -Math.PI / 2;
      const ra = part(root, mat, 0.25, 0.75, 0.25, skin, 0.375, 1.7, 0, 0.125); ra.rotation.x = -Math.PI / 2;
      const legs = [part(root, mat, 0.25, 0.75, 0.25, pants, -0.125, 0.75, 0, 0.375), part(root, mat, 0.25, 0.75, 0.25, pants, 0.125, 0.75, 0, 0.375)];
      return { head, legs, body, arms: [la, ra] };
    } },
  enderman: { w: 0.6, h: 2.9, hp: 40, speed: 3.0, neutral: true, tele: true, dmg: 7, snd: 'zombie', drops: () => Math.random() < 0.6 ? [[I.ENDER_PEARL, 1]] : [],
    build(root, mat) {
      const k = hex(0x161616), ey = hex(0xd060ff);
      const body = part(root, mat, 0.45, 0.9, 0.22, k, 0, 1.85, 0, 0.45, 0.02);
      const head = part(root, mat, 0.45, 0.45, 0.45, k, 0, 2.55, 0, 0, 0.02);
      part(head, mat, 0.14, 0.05, 0.02, ey, -0.11, 0.0, 0.235); part(head, mat, 0.14, 0.05, 0.02, ey, 0.11, 0.0, 0.235);
      const la = part(root, mat, 0.12, 1.1, 0.12, k, -0.3, 2.25, 0, 0.1), ra = part(root, mat, 0.12, 1.1, 0.12, k, 0.3, 2.25, 0, 0.1);
      const legs = [part(root, mat, 0.14, 1.4, 0.14, k, -0.12, 1.4, 0, 0.7), part(root, mat, 0.14, 1.4, 0.14, k, 0.12, 1.4, 0, 0.7)];
      return { head, legs, body, arms: [la, ra] };
    } },
  dragon: { w: 4, h: 2, hp: 150, speed: 9, hostile: true, dragon: true, snd: 'zombie', drops: () => [],
    build(root, mat) {
      const k = hex(0x1a1a20), pu = hex(0x7a2a9a);
      const body = part(root, mat, 2.2, 1.8, 6, k, 0, 1.4, 0, 0, 0.03);
      const head = part(root, mat, 1.6, 1.4, 2, k, 0, 1.6, 4, 0, 0.03);
      part(head, mat, 0.3, 0.3, 0.02, pu, -0.5, 0.2, 1.01); part(head, mat, 0.3, 0.3, 0.02, pu, 0.5, 0.2, 1.01);
      part(root, mat, 1.0, 0.8, 4, k, 0, 1.4, -4.5, 0, 0.03); part(root, mat, 0.7, 0.6, 3, k, 0, 1.4, -8, 0, 0.03);
      const wl = part(root, mat, 7, 0.25, 3.5, pu, -4.5, 2.3, 0, 0, 0.03), wr = part(root, mat, 7, 0.25, 3.5, pu, 4.5, 2.3, 0, 0, 0.03);
      return { head, body, wings: [wl, wr] };
    } },
  blaze: { w: 0.6, h: 1.8, hp: 20, speed: 2.2, hostile: true, ranged: true, fly: true, snd: 'zombie', drops: () => Math.random() < 0.7 ? [[I.BLAZE_POWDER, 1 + (Math.random() * 2 | 0)]] : [],
    build(root, mat) {
      const y = hex(0xe8b020), o = hex(0xf07010);
      const body = part(root, mat, 0.3, 0.9, 0.3, y, 0, 0.9, 0, 0, 0.1);
      const head = part(root, mat, 0.5, 0.5, 0.5, y, 0, 1.55, 0, 0, 0.1);
      part(head, mat, 0.1, 0.1, 0.02, [0.1, 0.05, 0], -0.12, 0.03, 0.255); part(head, mat, 0.1, 0.1, 0.02, [0.1, 0.05, 0], 0.12, 0.03, 0.255);
      const rods = []; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; rods.push(part(root, mat, 0.1, 0.5, 0.1, o, Math.cos(a) * 0.45, 0.8 + (k % 3) * 0.3, Math.sin(a) * 0.45, 0)); }
      return { head, body, legs: [] };
    } },
  villager: { w: 0.6, h: 1.85, hp: 20, speed: 1.3, passive: true, villager: true, snd: 'pig', drops: () => [],
    build(root, mat) {
      const robe = hex(0x7a5a3a), skin = hex(0xc89a78), nose = hex(0xa87a5a);
      const body = part(root, mat, 0.5, 1.0, 0.3, robe, 0, 1.0, 0, 0, 0.06);
      const head = part(root, mat, 0.45, 0.5, 0.45, skin, 0, 1.75, 0, 0, 0.06);
      part(head, mat, 0.12, 0.25, 0.14, nose, 0, -0.05, 0.28); part(head, mat, 0.08, 0.08, 0.02, [0.1, 0.3, 0.1], -0.11, 0.05, 0.23); part(head, mat, 0.08, 0.08, 0.02, [0.1, 0.3, 0.1], 0.11, 0.05, 0.23);
      const arms = part(root, mat, 0.8, 0.25, 0.25, robe, 0, 1.3, 0.15, 0);
      const legs = [part(root, mat, 0.22, 0.5, 0.22, robe, -0.12, 0.5, 0, 0.25), part(root, mat, 0.22, 0.5, 0.22, robe, 0.12, 0.5, 0, 0.25)];
      return { head, legs, body };
    } },
  boat: { w: 1.4, h: 0.5, hp: 6, speed: 0, passive: true, vehicle: true, snd: 'pig', drops: () => [[I.BOAT, 1]],
    build(root, mat) {
      const w = hex(0x96703a), dk = hex(0x6e4e26);
      const body = part(root, mat, 1.2, 0.15, 1.6, w, 0, 0.1, 0, 0, 0.04);
      part(root, mat, 0.12, 0.35, 1.6, dk, -0.6, 0.25, 0, 0, 0.04); part(root, mat, 0.12, 0.35, 1.6, dk, 0.6, 0.25, 0, 0, 0.04);
      part(root, mat, 1.2, 0.35, 0.12, dk, 0, 0.25, 0.8, 0, 0.04); part(root, mat, 1.2, 0.35, 0.12, dk, 0, 0.25, -0.8, 0, 0.04);
      return { body, legs: [] };
    } },
  creeper: { w: 0.6, h: 1.7, hp: 20, speed: 2.0, hostile: true, creeper: true, snd: 'creeper', drops: () => Math.random() < 0.8 ? [[I.GUNPOWDER, 1 + (Math.random() * 2 | 0)]] : [],
    build(root, mat) {
      const g = hex(0x4ea84a), dg = hex(0x2f7a30);
      const body = part(root, mat, 0.5, 0.75, 0.3, g, 0, 1.0, 0, 0, 0.25);
      const head = part(root, mat, 0.5, 0.5, 0.5, g, 0, 1.6, 0, 0, 0.25);
      for (const [ex, ey, w, h] of [[-0.12, 0.08, 0.14, 0.14], [0.12, 0.08, 0.14, 0.14], [0, -0.06, 0.1, 0.12], [-0.08, -0.16, 0.08, 0.14], [0.08, -0.16, 0.08, 0.14]]) part(head, mat, w, h, 0.02, [0.02, 0.05, 0.02], ex, ey, 0.255);
      const legs = [];
      for (const [lx, lz] of [[-0.15, 0.2], [0.15, 0.2], [-0.15, -0.2], [0.15, -0.2]]) legs.push(part(root, mat, 0.22, 0.4, 0.22, dg, lx, 0.4, lz, 0.2));
      return { head, legs, body };
    } },

  chicken: { w: 0.4, h: 0.7, hp: 4, speed: 1.5, passive: true, snd: 'pig', drops: () => { const o = [[I.RAW_CHICKEN, 1]]; const f = Math.random() * 3 | 0; if (f) o.push([I.FEATHER, f]); return o; },
    build(root, mat) {
      const w = hex(0xeeeeee), y = hex(0xe8b020), r = hex(0xcc2222);
      const body = part(root, mat, 0.35, 0.3, 0.5, w, 0, 0.42, 0, 0, 0.04);
      const head = part(root, mat, 0.2, 0.28, 0.2, w, 0, 0.78, 0.2, 0.1);
      part(head, mat, 0.12, 0.06, 0.1, y, 0, -0.02, 0.14); part(head, mat, 0.05, 0.08, 0.05, r, 0, -0.1, 0.1);
      part(head, mat, 0.04, 0.05, 0.02, [0, 0, 0], -0.06, 0.05, 0.11); part(head, mat, 0.04, 0.05, 0.02, [0, 0, 0], 0.06, 0.05, 0.11);
      part(body, mat, 0.1, 0.18, 0.1, w, 0, 0.05, -0.3);
      part(body, mat, 0.05, 0.2, 0.3, hex(0xd8d8d8), -0.2, 0.0, -0.03); part(body, mat, 0.05, 0.2, 0.3, hex(0xd8d8d8), 0.2, 0.0, -0.03);
      const legs = [part(root, mat, 0.05, 0.28, 0.05, y, -0.08, 0.28, 0, 0.14), part(root, mat, 0.05, 0.28, 0.05, y, 0.08, 0.28, 0, 0.14)];
      return { head, legs, body };
    } },
  skeleton: { w: 0.6, h: 1.95, hp: 20, speed: 2.0, hostile: true, ranged: true, burns: true, snd: 'zombie', drops: () => { const o = []; const b = Math.random() * 3 | 0; if (b) o.push([I.BONE, b]); const a = Math.random() * 3 | 0; if (a) o.push([I.ARROW, a]); return o; },
    build(root, mat) {
      const bone = hex(0xd8d8cc), dk = hex(0x9a9a90);
      const body = part(root, mat, 0.4, 0.75, 0.2, bone, 0, 1.35, 0, 0.375, 0.05);
      for (const yy of [-0.2, -0.05, 0.1, 0.25]) part(body, mat, 0.42, 0.04, 0.22, dk, 0, yy, 0);
      const head = part(root, mat, 0.5, 0.5, 0.5, bone, 0, 1.75, 0, 0, 0.05);
      part(head, mat, 0.11, 0.1, 0.02, [0.02, 0.02, 0.02], -0.12, 0.03, 0.255); part(head, mat, 0.11, 0.1, 0.02, [0.02, 0.02, 0.02], 0.12, 0.03, 0.255); part(head, mat, 0.2, 0.05, 0.02, [0.1, 0.1, 0.1], 0, -0.14, 0.255);
      const la = part(root, mat, 0.15, 0.75, 0.15, bone, -0.3, 1.7, 0, 0.125); la.rotation.x = -1.2;
      const ra = part(root, mat, 0.15, 0.75, 0.15, bone, 0.3, 1.7, 0, 0.125); ra.rotation.x = -1.2;
      part(ra, mat, 0.05, 0.5, 0.05, hex(0x6b4a28), 0.07, -0.55, 0.0); 
      const legs = [part(root, mat, 0.15, 0.75, 0.15, bone, -0.12, 0.75, 0, 0.375), part(root, mat, 0.15, 0.75, 0.15, bone, 0.12, 0.75, 0, 0.375)];
      return { head, legs, body, arms: [la, ra] };
    } },
  spider: { w: 1.3, h: 0.9, hp: 16, speed: 3.2, hostile: true, spider: true, snd: 'creeper', drops: () => { const o = []; const s = Math.random() * 3 | 0; if (s) o.push([I.STRING, s]); return o; },
    build(root, mat) {
      const dk = hex(0x3a3028), rd = hex(0xa01010);
      const body = part(root, mat, 0.7, 0.5, 0.8, dk, 0, 0.55, -0.1, 0, 0.1);
      const head = part(root, mat, 0.5, 0.45, 0.5, dk, 0, 0.55, 0.55, 0, 0.1);
      part(head, mat, 0.1, 0.1, 0.02, rd, -0.12, 0.08, 0.255); part(head, mat, 0.1, 0.1, 0.02, rd, 0.12, 0.08, 0.255); part(head, mat, 0.06, 0.06, 0.02, rd, -0.05, -0.04, 0.255); part(head, mat, 0.06, 0.06, 0.02, rd, 0.05, -0.04, 0.255);
      const legs = [];
      for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) { const l = part(root, mat, 0.7, 0.1, 0.1, dk, sd * 0.55, 0.5, 0.3 - k * 0.22, 0.0); l.rotation.z = sd * 0.5; l.rotation.y = sd * (0.3 - k * 0.2); legs.push(l); }
      return { head, legs, body, spiderLegs: true };
    } },
};
export const MOB_KINDS = Object.keys(DEFS);

export class Mobs {
  constructor(scene, world, game) { this.scene = scene; this.world = world; this.game = game; this.list = []; this.spawnT = 0; this.nid = 1; this.remote = false; }
  spawn(kind, x, y, z, rid) {
    const d = DEFS[kind], root = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const parts = d.build(root, mat); root.position.set(x, y, z); this.scene.add(root);
    const m = { kind, d, root, mat, parts, pos: [x, y, z], vel: [0, 0, 0], yaw: Math.random() * 6.28, hp: d.hp, hurt: 0, flee: 0, timer: rnd(1, 4), walking: false, tyaw: 0,
      anim: 0, ground: false, dead: 0, age: 0, fuse: 0, attackCd: 0, soundT: rnd(4, 14), kb: [0, 0], inWater: false, id: rid || this.nid++ };
    this.list.push(m); return m;
  }
  remove(m) { this.scene.remove(m.root); m.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); m.mat.dispose(); const i = this.list.indexOf(m); if (i >= 0) this.list.splice(i, 1); }
  clear() { for (const m of [...this.list]) this.remove(m); }
  damage(m, dmg, fromX, fromZ, kb = 1) {
    if (m.dead) return;
    if (this.remote) { this.game.net.send({ t: 'hit', id: m.id, dmg, fx: fromX, fz: fromZ, kb }); m.hurt = 0.4; A.sndHurt(); return; }
    m.hp -= dmg; m.hurt = 0.4; m.flee = m.d.passive ? 5 : 0; if (m.d.spider) m.angry = 30; if (m.d.neutral) { m.angry = 60; if (m.d.tele && m.hp > 0) this.teleportAway(m); }
    const dx = m.pos[0] - fromX, dz = m.pos[2] - fromZ, l = Math.hypot(dx, dz) || 1;
    m.vel[0] = dx / l * 5 * kb; m.vel[2] = dz / l * 5 * kb; m.vel[1] = 5.5 * kb;
    m.kb = [dx / l, dz / l]; m.fuseHold = 0;
    A.sndHurt(); if (m.hp <= 0) this.kill(m);
  }
  kill(m) {
    m.dead = 0.001; A.sndDeathMob(); if (m.kind === 'dragon') this.game.dragonDefeated();
    for (const [id, n] of m.d.drops()) this.game.dropItem(id, n, m.pos[0], m.pos[1] + 0.6, m.pos[2]);
    { const xp = m.d.hostile ? 5 : 2; if (this.attacker) this.game.net.sendTo(this.attacker, { t: 'xp', n: xp }); else if (this.game.addXP) this.game.addXP(xp); }
    this.game.particles.burst(m.pos[0], m.pos[1] + m.d.h * 0.5, m.pos[2], [0.85, 0.85, 0.85], 14, 0.12);
  }
  raycast(ox, oy, oz, dx, dy, dz, maxD) {
    let best = null, bt = maxD;
    for (const m of this.list) {
      if (m.dead) continue;
      const hw = m.d.w / 2 + 0.05, t = rayAABB(ox, oy, oz, dx, dy, dz, m.pos[0] - hw, m.pos[1], m.pos[2] - hw, m.pos[0] + hw, m.pos[1] + m.d.h, m.pos[2] + hw);
      if (t >= 0 && t < bt) { bt = t; best = m; }
    }
    return best ? { mob: best, dist: bt } : null;
  }
  lightAt(x, y, z, day) {
    const ix = Math.floor(x), iy = Math.floor(y + 0.5), iz = Math.floor(z);
    const L = Math.max(this.world.getSky(ix, iy, iz) / 15 * day, this.world.getBlk(ix, iy, iz) / 15);
    return 0.12 + 0.88 * Math.pow(L, 1.5);
  }
  nearest(pos, players) {
    let best = null, bd = 1e18;
    for (const p of players) { const dx = p.pos[0] - pos[0], dz = p.pos[2] - pos[2], dd = dx * dx + dz * dz + (p.dead || p.creative ? 1e6 : 0); if (dd < bd) { bd = dd; best = p; } }
    return best || players[0];
  }
  applySnapshot(arr) {
    const byId = new Map(this.list.map(m => [m.id, m])), seen = new Set();
    for (const [id, kind, x, y, z, yaw, fuse, dead, hurt, shr] of arr) {
      if (!DEFS[kind]) continue; seen.add(id);
      let m = byId.get(id);
      if (!m) { m = this.spawn(kind, x, y, z, id); m.pos = [x, y, z]; }
      m.tpos = [x, y, z]; m.tyaw = yaw; m.fuse = fuse; m.sheared = !!shr;
      if (hurt && m.hurt <= 0) m.hurt = 0.35;
      if (dead && !m.dead) { m.dead = 0.001; A.sndDeathMob(); this.game.particles.burst(x, y + m.d.h * 0.5, z, [0.85, 0.85, 0.85], 14, 0.12); }
    }
    for (const m of [...this.list]) if (!seen.has(m.id)) this.remove(m);
  }
  updateRemote(dt, day) {
    for (const m of [...this.list]) {
      m.age += dt;
      if (m.dead && m.dead > 0.9) { this.remove(m); continue; }
      if (m.dead) { m.dead += dt; m.root.rotation.z = Math.min(Math.PI / 2, m.dead * 6); m.root.position.set(m.pos[0], m.pos[1], m.pos[2]); continue; }
      if (m.milkT > 0) m.milkT -= dt;
      m.hurt = Math.max(0, m.hurt - dt);
      if (m.tpos) {
        const k = Math.min(1, dt * 10), dx = m.tpos[0] - m.pos[0], dz = m.tpos[2] - m.pos[2];
        if (Math.hypot(dx, dz) > 8) { m.pos = m.tpos.slice(); } else { m.pos[0] += dx * k; m.pos[1] += (m.tpos[1] - m.pos[1]) * k; m.pos[2] += dz * k; }
        m.vel[0] = dx * 8; m.vel[2] = dz * 8;
        let dy = m.tyaw - m.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); m.yaw += dy * Math.min(1, dt * 10);
      }
      this.animate(m, dt, day);
    }
  }
  update(dt, players, day, cam) {
    const w = this.world, g = this.game;
    if (this.remote) { this.updateRemote(dt, day); return; }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], d = m.d;
      const player = this.nearest(m.pos, players);
      const px = player.pos[0], py = player.pos[1], pz = player.pos[2];
      const dxp = px - m.pos[0], dzp = pz - m.pos[2], dist = Math.hypot(dxp, dzp);
      if (!d.dragon && (dist > 96 || (m.age > 600 && dist > 40 && d.hostile))) { this.remove(m); continue; }
      if (!w.isLoaded(Math.floor(m.pos[0]), Math.floor(m.pos[2]))) continue;
      m.age += dt;
      if (m.dead) {
        m.dead += dt; m.root.rotation.z = Math.min(Math.PI / 2, m.dead * 6); m.root.position.y = m.pos[1];
        if (m.dead > 0.7) this.remove(m);
        continue;
      }
      if (d.dragon) { this.updateDragon(m, dt, player, dist, day); continue; }
      if (d.vehicle) { this.updateBoat(m, dt, day); continue; }
      m.hurt = Math.max(0, m.hurt - dt); m.attackCd = Math.max(0, m.attackCd - dt); m.flee = Math.max(0, m.flee - dt);
      // viselkedés
      let mx = 0, mz = 0, speed = d.speed, want = false;
      const alive = !player.dead && !player.creative;
      let back = 1; m.angry = Math.max(0, (m.angry || 0) - dt);
      const hostileNow = (d.hostile || (d.neutral && m.angry > 0)) && !(d.spider && day > 0.6 && !m.angry);
      if (hostileNow && alive && dist < (d.creeper ? 18 : 28) && Math.abs(py - m.pos[1]) < 12) {
        m.tyaw = Math.atan2(dxp, dzp); want = true;
        if (d.ranged) {
          if (dist < 6) back = -1; else if (dist < 11) want = false;
          if (m.attackCd <= 0 && dist < 20) { m.attackCd = 1.8 + Math.random(); const ey = m.pos[1] + 1.6, tx = px, ty = py + 1.3, tz = pz, ddx = tx - m.pos[0], ddy = ty - ey, ddz = tz - m.pos[2], l = Math.hypot(ddx, ddy, ddz); g.shootArrow(m.pos[0], ey, m.pos[2], ddx / l + (Math.random() - 0.5) * 0.06, ddy / l + dist * 0.006 + (Math.random() - 0.5) * 0.04, ddz / l + (Math.random() - 0.5) * 0.06, 20, 3, 'mob'); }
        } else if (d.spider) {
          if (dist < 4 && dist > 1.8 && m.ground && m.attackCd <= 0.6 && Math.random() < dt * 2) { m.vel[1] = 6.2; m.vel[0] += dxp / dist * 4; m.vel[2] += dzp / dist * 4; }
          if (dist < 1.6 && Math.abs(py - m.pos[1]) < 1.2) { want = false; if (m.attackCd <= 0) { m.attackCd = 1; g.hurtAny(player, 2, m.pos[0], m.pos[2], 'zombie'); } }
        } else if (d.creeper) {
          if (dist < 3.2 && m.fuse >= 0) { if (m.fuse === 0) A.sndFuse(); m.fuse += dt; want = false; }
          else if (dist > 5.5 && m.fuse > 0) m.fuse = Math.max(0, m.fuse - dt * 2);
          if (m.fuse > 1.5) { this.explode(m); continue; }
        } else if (dist < 1.25 && Math.abs(py - m.pos[1]) < 1.6) {
          want = false;
          if (m.attackCd <= 0) { m.attackCd = 1; g.hurtAny(player, d.dmg || 3, m.pos[0], m.pos[2], 'zombie'); }
        }
      } else if (m.flee > 0) { m.tyaw = Math.atan2(-m.kb[0], -m.kb[1]) ; m.tyaw = Math.atan2(m.kb[0], m.kb[1]); want = true; speed *= 1.9; }
      else if (m.kind === 'cow' && this.onMilker(m)) { want = false; m.vel[0] = 0; m.vel[2] = 0; }
      else if (this.lure(m, player)) { want = true; }
      else if (m.kind === 'chicken' && this.nestSeek(m, dt)) { want = true; speed *= 0.9; }
      else {
        m.timer -= dt;
        if (m.timer <= 0) { m.walking = Math.random() < 0.55; m.tyaw = Math.random() * 6.283; m.timer = rnd(2, 6); }
        want = m.walking;
        if (d.creeper && m.fuse > 0) m.fuse = Math.max(0, m.fuse - dt * 2);
      }
      // fordulás
      let dy = m.tyaw - m.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); m.yaw += dy * Math.min(1, dt * 8);
      if (want) { mx = Math.sin(m.yaw) * speed * back; mz = Math.cos(m.yaw) * speed * back; }
      // sebzés napfényben (zombi)
      if (d.burns && day > 0.7 && w.getSky(Math.floor(m.pos[0]), Math.floor(m.pos[1] + 1), Math.floor(m.pos[2])) >= 14 && FK[w.getBlock(Math.floor(m.pos[0]), Math.floor(m.pos[1]), Math.floor(m.pos[2]))] !== 1) {
        m.burn = (m.burn || 0) + dt; if (m.burn > 1) { m.burn = 0; this.damage(m, 2, m.pos[0], m.pos[2], 0); }
        if (Math.random() < dt * 8) g.particles.burst(m.pos[0], m.pos[1] + 1.5, m.pos[2], [1, 0.5, 0.1], 1, 0.05);
      }
      // fizika
      const bx = Math.floor(m.pos[0]), bz = Math.floor(m.pos[2]);
      const feet = w.getBlock(bx, Math.floor(m.pos[1] + 0.2), bz);
      m.inWater = FK[feet] === 1;
      const accel = m.ground ? 14 : 3;
      if (m.hurt > 0.25) { /* lökés alatt nem irányít */ } else {
        m.vel[0] += (mx - m.vel[0]) * Math.min(1, accel * dt); m.vel[2] += (mz - m.vel[2]) * Math.min(1, accel * dt);
      }
      if (m.inWater) { m.vel[1] += (Math.random() < 0.5 ? 14 : 0) * dt - 3 * dt; m.vel[1] = Math.min(m.vel[1], 2.5); m.vel[0] *= 0.9; m.vel[2] *= 0.9; }
      else if (d.fly) m.vel[1] += ((player.pos[1] + 2.5 - m.pos[1]) * 2 - m.vel[1]) * Math.min(1, dt * 2);
      else m.vel[1] -= 28 * dt;
      m.vel[1] = Math.max(m.vel[1], -50);
      const r = moveBox(w, m.pos, d.w, d.h, m.vel, dt);
      m.ground = r.ground;
      if ((r.hitX || r.hitZ) && m.ground && want) m.vel[1] = 8.4;
      if (FK[feet] === 2) { m.lava = (m.lava || 0) + dt; if (m.lava > 0.5) { m.lava = 0; this.damage(m, 4, m.pos[0], m.pos[2], 0.3); } }
      if (m.pos[1] < -20) { this.remove(m); continue; }
      // hang
      m.soundT -= dt; if (m.soundT <= 0) { m.soundT = rnd(6, 16); if (dist < 16) A.sndMob(d.snd); }
      this.animate(m, dt, day);
    }
    // spawn
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 1.2; this.trySpawn(players[(Math.random() * players.length) | 0], day); }
  }
  updateBoat(m, dt, day) {
    const w = this.world, bx = Math.floor(m.pos[0]), bz = Math.floor(m.pos[2]);
    let y = Math.floor(m.pos[1] + 0.3), inW = FK[w.getBlock(bx, y, bz)] === 1;
    if (inW) { while (FK[w.getBlock(bx, y + 1, bz)] === 1) y++; m.vel[1] += ((y + 0.85 - m.pos[1]) * 6 - m.vel[1] * 2) * dt; }
    else m.vel[1] -= 20 * dt;
    const dr = m.drive; let fw = 0;
    if (dr) { fw = dr[0]; m.yaw = dr[2]; m.vel[0] += (Math.sin(m.yaw) * fw * (inW ? 7 : 1.5) - m.vel[0]) * Math.min(1, dt * 3); m.vel[2] += (Math.cos(m.yaw) * fw * (inW ? 7 : 1.5) - m.vel[2]) * Math.min(1, dt * 3); }
    else { m.vel[0] *= 0.9; m.vel[2] *= 0.9; }
    moveBox(w, m.pos, 1.3, 0.5, m.vel, dt);
    m.root.position.set(m.pos[0], m.pos[1], m.pos[2]); m.root.rotation.y = m.yaw;
    const lt = this.lightAt(m.pos[0], m.pos[1], m.pos[2], day); m.mat.color.setRGB(lt, lt, lt);
  }
  teleportAway(m) {
    const w = this.world;
    for (let t = 0; t < 12; t++) {
      const x = Math.floor(m.pos[0] + rnd(-10, 10)), z = Math.floor(m.pos[2] + rnd(-10, 10)); if (!w.isLoaded(x, z)) continue;
      for (let y = Math.floor(m.pos[1]) + 6; y > Math.floor(m.pos[1]) - 8; y--) if (SOLID[w.getBlock(x, y - 1, z)] && !SOLID[w.getBlock(x, y, z)] && !SOLID[w.getBlock(x, y + 1, z)] && !SOLID[w.getBlock(x, y + 2, z)]) { this.game.particles.burst(m.pos[0], m.pos[1] + 1.5, m.pos[2], [0.7, 0.2, 1], 12, 0.1); m.pos = [x + 0.5, y, z + 0.5]; m.vel = [0, 0, 0]; return; }
    }
  }
  updateDragon(m, dt, player, dist, day) {
    const g = this.game; m.hurt = Math.max(0, m.hurt - dt); m.attackCd = Math.max(0, m.attackCd - dt); m.t = (m.t || 0) + dt; m.ang = m.ang || 0;
    if (!m.mode) m.mode = 'circle';
    const alive = !player.dead && !player.creative; let tgt;
    if (m.mode === 'circle') { m.ang += dt * 0.35; tgt = [Math.cos(m.ang) * 38, 84 + Math.sin(m.ang * 2) * 6, Math.sin(m.ang) * 38]; if (m.t > 11 && alive && dist < 80) { m.mode = 'dive'; m.t = 0; } }
    else { tgt = [player.pos[0], player.pos[1] + 1.2, player.pos[2]]; if (m.t > 7 || !alive) { m.mode = 'circle'; m.t = 0; } }
    const dx = tgt[0] - m.pos[0], dy = tgt[1] - m.pos[1], dz = tgt[2] - m.pos[2], l = Math.hypot(dx, dy, dz) || 1, sp = m.mode === 'dive' ? 15 : 10;
    m.vel = [dx / l * sp, dy / l * sp, dz / l * sp]; for (let k = 0; k < 3; k++) m.pos[k] += m.vel[k] * dt;
    m.yaw = Math.atan2(m.vel[0], m.vel[2]);
    const pd = Math.hypot(player.pos[0] - m.pos[0], player.pos[1] + 1 - (m.pos[1] + 1.5), player.pos[2] - m.pos[2]);
    if (alive && pd < 3.6 && m.attackCd <= 0) { m.attackCd = 1.5; g.hurtAny(player, 7, m.pos[0], m.pos[2], 'zombie'); if (m.mode === 'dive') { m.mode = 'circle'; m.t = 0; } }
    if (m.parts.wings) { const f = Math.sin(m.age * 3) * 0.45; m.parts.wings[0].rotation.z = f; m.parts.wings[1].rotation.z = -f; }
    m.age += dt; m.soundT -= dt; if (m.soundT <= 0) { m.soundT = rnd(5, 9); if (dist < 60) A.sndMob('zombie'); }
    this.animate(m, dt, day);
  }
  onMilker(m) { const id = this.world.getBlock(Math.floor(m.pos[0]), Math.floor(m.pos[1] - 0.1), Math.floor(m.pos[2])); return id >= B.MILKER && id <= B.MILKER_M; }
  lure(m, player) {
    if (m.kind !== 'cow' && m.kind !== 'sheep' && m.kind !== 'pig' && m.kind !== 'chicken') return false;
    const want = m.kind === 'pig' ? 0 : 0, h = player.heldId ?? player.held; // (az item azonosító számként érkezik)
    const food = m.kind === 'chicken' ? I.SEEDS : I.WHEAT; void want;
    if (!h || h !== food) return false;
    const dx = player.pos[0] - m.pos[0], dz = player.pos[2] - m.pos[2], dd = Math.hypot(dx, dz);
    if (dd > 9 || dd < 1.6) return false;
    m.tyaw = Math.atan2(dx, dz); return true;
  }
  nestSeek(m, dt) {
    m.nestT = (m.nestT || 0) - dt;
    if (m.nestT <= 0) {
      m.nestT = 1 + Math.random(); m.nest = null; const w = this.world, bx = Math.floor(m.pos[0]), by = Math.floor(m.pos[1]), bz = Math.floor(m.pos[2]);
      let best = 1e9;
      for (let x = bx - 8; x <= bx + 8; x++) for (let z = bz - 8; z <= bz + 8; z++) for (let y = by - 2; y <= by + 2; y++) if (w.getBlock(x, y, z) === B.NEST) { const d2 = (x - bx) ** 2 + (z - bz) ** 2; if (d2 < best) { best = d2; m.nest = [x, y, z]; } }
    }
    if (!m.nest) return false;
    const [nx, ny, nz] = m.nest, w = this.world;
    if (w.getBlock(nx, ny, nz) !== B.NEST) { m.nest = null; return false; }
    const dx = nx + 0.5 - m.pos[0], dz = nz + 0.5 - m.pos[2], dd = Math.hypot(dx, dz);
    if (dd < 0.7 && Math.abs(ny - m.pos[1]) < 1.3) { w.setBlock(nx, ny, nz, B.NEST_C); this.remove(m); return false; }
    m.tyaw = Math.atan2(dx, dz); return true;
  }
  animate(m, dt, day) {
    const d = m.d;
      const hs = Math.hypot(m.vel[0], m.vel[2]);
      m.anim += hs * dt * 3.2;
      const sw = Math.sin(m.anim) * Math.min(1, hs / 1.5) * 0.75;
      const L = m.parts.legs; if (L && m.parts.spiderLegs) { for (let k = 0; k < L.length; k++) L[k].rotation.x = Math.sin(m.anim * 1.5 + k * 1.3) * 0.25 * Math.min(1, hs / 1.5); } else if (L) for (let k = 0; k < L.length; k++) L[k].rotation.x = (k % 2 === 0 ? sw : -sw) * (L.length === 4 && (k === 1 || k === 2) ? -1 : 1) * (L.length === 4 ? 1 : 1);
      if (m.parts.arms) { const b = Math.sin(m.age * 2) * 0.06; m.parts.arms[0].rotation.x = -Math.PI / 2 + b + sw * 0.1; m.parts.arms[1].rotation.x = -Math.PI / 2 - b - sw * 0.1; }
      if (m.parts.head && !d.hostile) m.parts.head.rotation.x = Math.sin(m.age * 0.8) * 0.05;
      const sc = m.fuse > 0 ? 1 + Math.sin(m.fuse * 30) * 0.06 + m.fuse * 0.2 : 1;
      m.root.scale.set(sc, sc, sc);
      m.root.position.set(m.pos[0], m.pos[1], m.pos[2]); m.root.rotation.y = m.yaw;
      const lt = this.lightAt(m.pos[0], m.pos[1], m.pos[2], day);
      if (m.hurt > 0) m.mat.color.setRGB(1, 0.35, 0.35);
      else if (m.fuse > 0 && Math.floor(m.fuse * 8) % 2 === 0) m.mat.color.setRGB(2.2, 2.2, 2.2);
      else m.mat.color.setRGB(lt, lt, lt);
  }
  explode(m) {
    const x = m.pos[0], y = m.pos[1] + 0.8, z = m.pos[2];
    this.remove(m); this.game.explode(x, y, z, 3.2, 'creeper');
  }
  trySpawn(player, day) {
    const w = this.world, g = this.game;
    if (g.rules && g.rules.doMobSpawning === false) return;
    const dim = g.dim || 'overworld';
    if (dim !== 'overworld') {
      let kind = dim === 'nether' ? 'pigman' : 'enderman'; const cap0 = 0; void cap0; const cap = dim === 'nether' ? 10 : 6;
      if (this.list.filter(m => m.kind === kind).length >= cap || (dim === 'end' && g.dragonDead && false)) return;
      const ang = Math.random() * 6.283, r = rnd(14, 36), x = Math.floor(player.pos[0] + Math.cos(ang) * r), z = Math.floor(player.pos[2] + Math.sin(ang) * r);
      if (!w.isLoaded(x, z)) return;
      for (let y = Math.floor(player.pos[1]) + 10; y > Math.max(2, Math.floor(player.pos[1]) - 20); y--) {
        const gd = w.getBlock(x, y - 1, z);
        if (SOLID[gd] && !w.getBlock(x, y, z) && !w.getBlock(x, y + 1, z) && (dim === 'end' ? gd === B.END_STONE : (gd === B.NETHERRACK || gd === B.SOUL_SAND || gd === B.NETHER_BRICKS))) { if (dim === 'nether' && gd === B.NETHER_BRICKS) { if (this.list.filter(m => m.kind === 'blaze').length < 5) this.spawn('blaze', x + 0.5, y + 1, z + 0.5); break; } this.spawn(kind, x + 0.5, y, z + 0.5); break; }
      }
      return;
    }
    { const gx = Math.floor(player.pos[0] + rnd(-20, 20)), gz = Math.floor(player.pos[2] + rnd(-20, 20));
      if (w.isLoaded(gx, gz) && this.list.filter(m => m.kind === 'villager').length < 6) {
        for (let y = Math.floor(player.pos[1]) + 8; y > Math.floor(player.pos[1]) - 12; y--) if (w.getBlock(gx, y - 1, gz) === B.COBBLE && !w.getBlock(gx, y, gz) && !w.getBlock(gx, y + 1, gz) && w.getSky(gx, y, gz) >= 8 && w.getBlock(gx + 1, y + 3, gz) !== undefined) { let near = 0; for (let k = -3; k <= 3; k++) if (w.getBlock(gx + k, y - 1, gz) === B.COBBLE) near++; if (near >= 5 && Math.random() < 0.3) this.spawn('villager', gx + 0.5, y, gz + 0.5); break; }
      } }
    const passive = this.list.filter(m => m.d.passive && !m.d.villager).length, hostile = this.list.filter(m => m.d.hostile).length;
    const wantPassive = passive < 18, wantHostile = hostile < 12 && g.difficulty > 0;
    if (!wantPassive && !wantHostile) return;
    const ang = Math.random() * 6.283, r = rnd(20, 48);
    const x = Math.floor(player.pos[0] + Math.cos(ang) * r), z = Math.floor(player.pos[2] + Math.sin(ang) * r);
    if (!w.isLoaded(x, z)) return;
    let y = -1; for (let yy = 127; yy > 1; yy--) { const id = w.getBlock(x, yy, z); if (SOLID[id]) { y = yy + 1; break; } if (FK[id] === 1) return; }
    if (y < 0 || w.getBlock(x, y, z) || w.getBlock(x, y + 1, z)) return;
    const ground = w.getBlock(x, y - 1, z);
    const sky = w.getSky(x, y, z), blk = w.getBlk(x, y, z);
    // cave-ben is spawnolhat (sötét hely)
    if (wantPassive && ground === B.GRASS && sky >= 12 && day > 0.35 && Math.random() < 0.5) {
      const kind = ['pig', 'cow', 'sheep', 'chicken'][(Math.random() * 4) | 0], n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) this.spawn(kind, x + 0.5 + rnd(-2, 2), y, z + 0.5 + rnd(-2, 2));
    } else if (wantHostile) {
      const eff = Math.max(sky * day, blk);
      if (eff <= 7 && ground !== B.LEAVES && FK[ground] !== 1 && ground !== B.ICE) { const q = Math.random(); this.spawn(q < 0.2 ? 'creeper' : q < 0.5 ? 'zombie' : q < 0.78 ? 'skeleton' : 'spider', x + 0.5, y, z + 0.5); }
    }
  }
  snapshot(centers, R = 90) { return this.list.filter(m => centers.some(p => Math.abs(p.pos[0] - m.pos[0]) < R && Math.abs(p.pos[2] - m.pos[2]) < R)).slice(0, 120).map(m => [m.id, m.kind, +m.pos[0].toFixed(2), +m.pos[1].toFixed(2), +m.pos[2].toFixed(2), +m.yaw.toFixed(2), +(m.fuse || 0).toFixed(2), m.dead ? 1 : 0, m.hurt > 0.25 ? 1 : 0, m.sheared ? 1 : 0]); }
  serialize() { return this.list.filter(m => !m.dead && m.d.passive).slice(0, 40).map(m => ({ k: m.kind, p: m.pos.map(v => +v.toFixed(2)), hp: m.hp, y: +m.yaw.toFixed(2) })); }
  load(arr) { this.clear(); for (const s of arr || []) { const m = this.spawn(s.k, s.p[0], s.p[1], s.p[2]); m.hp = s.hp; m.yaw = s.y; } }
}

// ---------- eldobott tárgyak ----------
export class Drops {
  constructor(scene, world, mat) { this.scene = scene; this.world = world; this.mat = mat; this.list = []; this.cache = new Map(); this.spriteMats = new Map(); this.nid = 1; this.remote = false; }
  geoFor(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    let geo;
    if (isBlockItem(id)) {
      const m = blockModel(id); geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
      geo.setAttribute('aux', new THREE.BufferAttribute(m.aux, 3)); geo.setAttribute('tint', new THREE.BufferAttribute(m.tint, 3)); geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
    } else geo = null;
    this.cache.set(id, geo); return geo;
  }
  spriteMat(id) {
    if (this.spriteMats.has(id)) return this.spriteMats.get(id);
    const tex = new THREE.CanvasTexture(iconCanvas(id)); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }); this.spriteMats.set(id, m); return m;
  }
  add(id, n, x, y, z, vx, vy, vz, delay = 0.5) {
    const geo = this.geoFor(id); let mesh;
    if (geo) { mesh = new THREE.Mesh(geo, this.mat); mesh.scale.setScalar(0.28); }
    else { mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), this.spriteMat(id)); }
    this.scene.add(mesh);
    const dr = { nid: this.nid++, id, n, pos: [x, y, z], vel: [vx ?? (Math.random() - 0.5) * 2.2, vy ?? 3.4, vz ?? (Math.random() - 0.5) * 2.2], mesh, age: 0, delay, ground: false, geoOwn: !geo };
    this.list.push(dr); return dr;
  }
  remove(dr) { this.scene.remove(dr.mesh); if (dr.geoOwn) dr.mesh.geometry.dispose(); const i = this.list.indexOf(dr); if (i >= 0) this.list.splice(i, 1); }
  clear() { for (const d of [...this.list]) this.remove(d); }
  snapshot(centers, R = 70) { return this.list.filter(d => centers.some(p => Math.abs(p.pos[0] - d.pos[0]) < R && Math.abs(p.pos[2] - d.pos[2]) < R)).slice(0, 160).map(d => [d.nid, d.id, d.n, +d.pos[0].toFixed(2), +d.pos[1].toFixed(2), +d.pos[2].toFixed(2)]); }
  applySnapshot(arr) {
    const by = new Map(this.list.map(d => [d.nid, d])), seen = new Set();
    for (const [nid, id, n, x, y, z] of arr) {
      seen.add(nid); let d = by.get(nid);
      if (!d) { d = this.add(id, n, x, y, z, 0, 0, 0, 999); d.nid = nid; d.tpos = [x, y, z]; }
      d.n = n; d.tpos = [x, y, z];
    }
    for (const d of [...this.list]) if (!seen.has(d.nid)) this.remove(d);
  }
  updateRemote(dt, time) {
    for (const d of this.list) {
      d.age += dt; d.mesh.visible = true;
      if (d.tpos) { const k = Math.min(1, dt * 10); d.pos[0] += (d.tpos[0] - d.pos[0]) * k; d.pos[1] += (d.tpos[1] - d.pos[1]) * k; d.pos[2] += (d.tpos[2] - d.pos[2]) * k; }
      const bob = Math.sin(time * 2 + d.age * 3) * 0.05 + 0.18;
      d.mesh.position.set(d.pos[0], d.pos[1] + bob, d.pos[2]); d.mesh.rotation.y = time * 1.4 + d.age;
    }
  }
  update(dt, players, time, onPickup) {
    if (this.remote) { this.updateRemote(dt, time); return; }
    const w = this.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i]; d.age += dt;
      if (d.age > 300 || d.pos[1] < -10) { this.remove(d); continue; }
      if (!w.isLoaded(Math.floor(d.pos[0]), Math.floor(d.pos[2]))) { d.mesh.visible = false; continue; }
      d.mesh.visible = true;
      const bid = w.getBlock(Math.floor(d.pos[0]), Math.floor(d.pos[1] + 0.1), Math.floor(d.pos[2]));
      if (FK[bid] === 2) { this.remove(d); continue; }
      if (FK[bid] === 1) { d.vel[1] += 20 * dt; d.vel[1] = Math.min(d.vel[1], 1.5); d.vel[0] *= 0.92; d.vel[2] *= 0.92; } else d.vel[1] -= 24 * dt;
      const wasG = d.ground;
      const r = moveBox(w, d.pos, 0.25, 0.25, d.vel, dt); d.ground = r.ground;
      if (r.ground) { d.vel[0] *= Math.pow(0.0005, dt); d.vel[2] *= Math.pow(0.0005, dt); }
      // összeolvadás
      if (d.age > 0.6 && Math.floor(d.age * 4) !== Math.floor((d.age - dt) * 4)) {
        for (const o of this.list) if (o !== d && o.id === d.id && o.age > 0.6 && Math.abs(o.pos[0] - d.pos[0]) < 0.6 && Math.abs(o.pos[1] - d.pos[1]) < 0.6 && Math.abs(o.pos[2] - d.pos[2]) < 0.6 && d.n + o.n <= 64 && !d.merged) { d.n += o.n; o.merged = true; this.remove(o); break; }
      }
      // felvétel
      let picked = false;
      for (const player of players) {
        const dx = player.pos[0] - d.pos[0], dy = player.pos[1] + 0.9 - d.pos[1], dz = player.pos[2] - d.pos[2], dd = Math.hypot(dx, dy, dz);
        if (player.dead || d.age <= d.delay || dd >= 1.6) continue;
        const k = Math.min(1, dt * 10 / Math.max(dd, 0.2));
        d.pos[0] += dx * k * 0.8; d.pos[1] += dy * k * 0.8; d.pos[2] += dz * k * 0.8; d.vel[1] = 0;
        if (dd < 0.55) { const left = onPickup(player, d.id, d.n); if (left === 0) { if (player.cid === undefined) A.sndPop(); this.remove(d); picked = true; break; } d.n = left; }
      }
      if (picked) continue;
      const bob = Math.sin(time * 2 + d.age * 3) * 0.05 + 0.18;
      d.mesh.position.set(d.pos[0], d.pos[1] + bob, d.pos[2]); d.mesh.rotation.y = time * 1.4 + d.age;
    }
  }
}

// ---------- részecskék ----------
export class Particles {
  constructor(scene, max = 700) {
    this.max = max; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.n = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true })); this.pts.frustumCulled = false; scene.add(this.pts); this.head = 0;
  }
  burst(x, y, z, col, n, spread = 0.5, grav = 1) {
    for (let i = 0; i < n; i++) {
      const k = this.head++ % this.max, v = 0.75 + Math.random() * 0.5;
      this.pos[k * 3] = x + (Math.random() - 0.5) * spread * 2; this.pos[k * 3 + 1] = y + (Math.random() - 0.5) * spread * 2; this.pos[k * 3 + 2] = z + (Math.random() - 0.5) * spread * 2;
      this.vel[k * 3] = (Math.random() - 0.5) * 4; this.vel[k * 3 + 1] = Math.random() * 3.5 + 0.5; this.vel[k * 3 + 2] = (Math.random() - 0.5) * 4;
      this.col[k * 3] = col[0] * v; this.col[k * 3 + 1] = col[1] * v; this.col[k * 3 + 2] = col[2] * v; this.life[k] = 0.5 + Math.random() * 0.7;
    }
  }
  block(x, y, z, id, n = 22) { const b = BLOCKS[id]; const c = avgColor(b.tex.side); this.burst(x + 0.5, y + 0.5, z + 0.5, c, n, 0.5); }
  update(dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -999; continue; }
      this.life[k] -= dt; this.vel[k * 3 + 1] -= 14 * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}


// ---------- nyílvesszők ----------
export class Arrows {
  constructor(scene, world, game) { this.scene = scene; this.world = world; this.game = game; this.list = []; }
  fire(x, y, z, dx, dy, dz, speed, dmg, owner) {
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const shaft = new THREE.Mesh(shadeBox(0.04, 0.04, 0.7, hex(0x9a7a46), 0.02), mat); g.add(shaft);
    const tip = new THREE.Mesh(shadeBox(0.07, 0.07, 0.1, hex(0x8a8a92), 0.02), mat); tip.position.z = 0.4; g.add(tip);
    const fe = new THREE.Mesh(shadeBox(0.1, 0.1, 0.12, hex(0xeeeeee), 0.02), mat); fe.position.z = -0.32; g.add(fe);
    g.position.set(x, y, z); this.scene.add(g);
    const l = Math.hypot(dx, dy, dz) || 1;
    this.list.push({ pos: [x, y, z], vel: [dx / l * speed, dy / l * speed, dz / l * speed], dmg, owner, age: 0, stuck: false, mesh: g, mat });
  }
  remove(a) { this.scene.remove(a.mesh); a.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); a.mat.dispose(); const i = this.list.indexOf(a); if (i >= 0) this.list.splice(i, 1); }
  clear() { for (const a of [...this.list]) this.remove(a); }
  update(dt, player) {
    const w = this.world, g = this.game;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i]; a.age += dt;
      if (a.stuck) {
        if (a.age > 90) { this.remove(a); continue; }
        if (a.owner === 'player' && a.age > 0.6 && !player.dead) {
          const dx = player.pos[0] - a.pos[0], dy = player.pos[1] + 0.9 - a.pos[1], dz = player.pos[2] - a.pos[2];
          if (dx * dx + dy * dy + dz * dz < 1.3) { if (player.creative || g.inv.add(I.ARROW, 1) === 0) { A.sndPop(); g.refreshHotbar(); this.remove(a); continue; } }
        }
        continue;
      }
      if (!w.isLoaded(Math.floor(a.pos[0]), Math.floor(a.pos[2])) || a.age > 30 || a.pos[1] < -10) { this.remove(a); continue; }
      const ns = 3, sdt = dt / ns; let done = false;
      for (let s = 0; s < ns && !done; s++) {
        a.vel[1] -= 14 * sdt;
        const nx = a.pos[0] + a.vel[0] * sdt, ny = a.pos[1] + a.vel[1] * sdt, nz = a.pos[2] + a.vel[2] * sdt;
        const id = w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (SOLID[id]) { a.stuck = true; a.age = 0; a.vel = [0, 0, 0]; A.sndHit('wood'); done = true; break; }
        a.pos[0] = nx; a.pos[1] = ny; a.pos[2] = nz;
        if (a.owner === 'player') {
          for (const m of this.game.mobs.list) {
            if (m.dead) continue; const hw = m.d.w / 2 + 0.15;
            if (nx > m.pos[0] - hw && nx < m.pos[0] + hw && nz > m.pos[2] - hw && nz < m.pos[2] + hw && ny > m.pos[1] - 0.1 && ny < m.pos[1] + m.d.h + 0.1) {
              this.game.mobs.damage(m, a.dmg, a.pos[0] - a.vel[0], a.pos[2] - a.vel[2], 0.8); this.remove(a); done = true; break;
            }
          }
        } else if (a.owner !== 'remote' && !player.dead) {
          if (nx > player.pos[0] - 0.4 && nx < player.pos[0] + 0.4 && nz > player.pos[2] - 0.4 && nz < player.pos[2] + 0.4 && ny > player.pos[1] - 0.1 && ny < player.pos[1] + 1.9) {
            g.hurtPlayer(a.dmg, a.pos[0] - a.vel[0], a.pos[2] - a.vel[2], 'arrow'); this.remove(a); done = true; break;
          }
        }
      }
      if (done) continue;
      a.mesh.position.set(a.pos[0], a.pos[1], a.pos[2]);
      a.mesh.lookAt(a.pos[0] + a.vel[0], a.pos[1] + a.vel[1], a.pos[2] + a.vel[2]);
    }
  }
}
