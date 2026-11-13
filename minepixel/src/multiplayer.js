// MinePixel – többjátékos mód (host-autoritatív, WebSocket relay/beágyazott szerver)
import * as THREE from '../vendor/three.module.js';
import { ckey } from './world.js';
import { B } from './blocks.js';
import { gw, parseSsName } from './ss.js';

export const DEFAULT_PORT = 25566;
const MAXP = 8;

// Meghívó kód:  SZOBA@cím   (cím: host:port vagy ws(s)://host)
export function parseCode(code) {
  code = String(code || '').trim();
  const sn = parseSsName(code); if (sn) { if (!gw.url) return null; return { room: sn.toUpperCase(), url: gw.url, addr: sn + '.gg', ss: true }; }
  const m = code.match(/^([A-Za-z0-9]{3,24})@(.+)$/); if (!m) return null;
  const addr = m[2].trim();
  const url = /^wss?:\/\//i.test(addr) ? addr : 'ws://' + (/:\d+$/.test(addr) ? addr : addr + ':' + DEFAULT_PORT);
  return { room: m[1].toUpperCase(), url, addr };
}
export const makeCode = (room, addr) => room + '@' + addr;
export function randomRoom() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += c[(Math.random() * c.length) | 0]; return s; }

function openWS(url, timeout = 5000) {
  return new Promise((res, rej) => {
    let ws; try { ws = new WebSocket(url); } catch (e) { return rej(new Error('bad_url')); }
    const t = setTimeout(() => { try { ws.close(); } catch {} rej(new Error('timeout')); }, timeout);
    ws.onopen = () => { clearTimeout(t); res(ws); };
    ws.onerror = () => { clearTimeout(t); rej(new Error('unreachable')); };
  });
}
// Egy barát/szoba állapotának lekérdezése
export async function pingRoom(code, timeout = 3500) {
  const pc = parseCode(code); if (!pc) return null;
  let ws; try { ws = await openWS(pc.url, timeout); } catch { return null; }
  return new Promise(res => {
    const t = setTimeout(() => { try { ws.close(); } catch {} res(null); }, timeout);
    ws.onmessage = e => { try { const m = JSON.parse(e.data); if (m.t === 'pong') { clearTimeout(t); ws.close(); res(m); } } catch {} };
    ws.onclose = () => { clearTimeout(t); res(null); };
    ws.send(JSON.stringify({ t: 'ping', room: pc.room }));
  });
}

// ---------- távoli játékos avatar ----------
const SKINS = [[0.2, 0.45, 0.85], [0.85, 0.25, 0.25], [0.25, 0.7, 0.35], [0.9, 0.7, 0.15], [0.65, 0.3, 0.8], [0.15, 0.7, 0.75], [0.9, 0.45, 0.15], [0.8, 0.4, 0.6]];
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
const g0 = n => n.game;
function nameTag(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d');
  g.font = 'bold 28px monospace'; const w = Math.min(250, g.measureText(name).width + 18);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect((256 - w) / 2, 4, w, 40); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 25);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, fog: false })); sp.scale.set(1.6, 0.3, 1); sp.position.y = 2.25; sp.renderOrder = 50; return sp;
}
export function buildAvatar(name) {
  const col = SKINS[hashStr(name) % SKINS.length], root = new THREE.Group(), mats = [];
  const mk = (w, h, d, c) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) }); m.base = c; mats.push(m); return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); };
  const pivot = (mesh, x, y, down) => { const g = new THREE.Group(); g.position.set(x, y, 0); mesh.position.y = -down; g.add(mesh); root.add(g); return g; };
  const skin = [0.87, 0.67, 0.53], pants = [0.2, 0.22, 0.5], hair = [0.28, 0.18, 0.1];
  const body = mk(0.5, 0.7, 0.26, col); body.position.y = 1.05; root.add(body);
  const head = new THREE.Group(); head.position.y = 1.4; const hm = mk(0.5, 0.5, 0.5, skin); hm.position.y = 0.25; head.add(hm);
  const hr = mk(0.52, 0.16, 0.52, hair); hr.position.y = 0.46; head.add(hr);
  const e1 = mk(0.1, 0.06, 0.02, [0.1, 0.1, 0.25]), e2 = mk(0.1, 0.06, 0.02, [0.1, 0.1, 0.25]); e1.position.set(-0.12, 0.27, -0.255); e2.position.set(0.12, 0.27, -0.255); head.add(e1, e2); root.add(head);
  const armL = pivot(mk(0.2, 0.7, 0.24, skin), -0.35, 1.4, 0.3), armR = pivot(mk(0.2, 0.7, 0.24, skin), 0.35, 1.4, 0.3);
  const legL = pivot(mk(0.25, 0.7, 0.25, pants), -0.125, 0.7, 0.35), legR = pivot(mk(0.25, 0.7, 0.25, pants), 0.125, 0.7, 0.35);
  const tag = nameTag(name); root.add(tag);
  return { root, mats, head, armL, armR, legL, legR, tag };
}

export class Net {
  constructor(game) {
    this.game = game; this.role = null; this.ws = null; this.myId = null; this.myName = 'Játékos';
    this.remotes = new Map(); // id -> {id,cid,name,pos,yaw,pitch,avatar,...}
    this.outBlocks = []; this.pending = []; this.queue = []; this.ready = false; this.info = null;
    this.posT = 0; this.snapT = 0; this.contT = 0; this.saveT = 0; this.pendT = 0; this.lastCont = ''; this.avScene = null;
    this.onClosed = null;
    this.pendJoin = new Map(); this.maxPlayers = MAXP; this.token = ''; this.lastDeny = '';
  }
  get active() { return !!this.role; }
  get isHost() { return this.role === 'host'; }
  get isClient() { return this.role === 'client'; }

  // ---- kommunikáció ----
  send(d) { // kliens -> host
    if (this.role === 'client' && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'msg', d }));
  }
  bcast(d, except) { if (this.role === 'host' && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'all', d, except })); }
  sendTo(cid, d) { if (this.role === 'host' && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'to', cid, d })); }
  kick(cid) { if (this.role === 'host' && this.ws) this.ws.send(JSON.stringify({ t: 'kick', cid })); }

  // ---- host ----
  async startHosting({ name, worldName, relay, room, key }) {
    if (this.role) throw new Error('already');
    let url, addr, ips = [];
    if (relay) { url = relay; addr = relay.replace(/^ws:\/\//, ''); }
    else if (window.mp && window.mp.netStart) {
      const r = await window.mp.netStart(DEFAULT_PORT); if (!r || !r.ok) throw new Error('server_start');
      url = 'ws://127.0.0.1:' + r.port; ips = r.ips || []; addr = (ips[0] || '127.0.0.1') + ':' + r.port;
    } else throw new Error('no_relay');
    this.myName = name; const ws = await openWS(url, relay ? 70000 : 5000); // relay hidegindítás (Render) akár 60 mp
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), 15000);
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'hosted') { clearTimeout(t); res(); } else if (m.t === 'error') { clearTimeout(t); rej(new Error(m.e)); } };
      ws.send(JSON.stringify({ t: 'host', room, name: name + '|' + worldName, key: key || undefined }));
    });
    this.ws = ws; this.role = 'host'; this.myId = 'h'; this.ready = true;
    ws.onmessage = e => { try { this.onRelay(JSON.parse(e.data)); } catch (err) { console.warn('net', err); } };
    ws.onclose = () => { if (this.role) { this.reset(); this.game.onNetClosed && this.game.onNetClosed('lost-host'); } };
    this.info = { room, addr, code: makeCode(room, addr), ips, relay: !!relay, publicCode: null };
    if (!relay) { // nyilvános IP (opcionális, ha van net)
      const ac = new AbortController(); setTimeout(() => ac.abort(), 4000);
      fetch('https://api.ipify.org?format=json', { signal: ac.signal }).then(r => r.json()).then(j => { if (j && j.ip && this.info) { this.info.publicCode = makeCode(room, j.ip + ':' + DEFAULT_PORT); this.game.onHostInfo && this.game.onHostInfo(); } }).catch(() => {});
    }
    return this.info;
  }
  async stopHosting() {
    if (this.role !== 'host') return;
    this.bcast({ t: 'chat', n: '', m: 'A host lezárta a világot.' });
    try { this.ws.onclose = null; this.ws.close(); } catch {}
    this.reset(); if (window.mp && window.mp.netStop) window.mp.netStop();
  }
  playerList() { return [this.game.player, ...[...this.remotes.values()].filter(r => r.cid)]; }
  count() { return this.remotes.size + 1; }
  names() { const rem = [...this.remotes.values()].map(r => ({ id: r.id, cid: r.cid, name: r.name, host: r.id === 'h' })), me = { id: this.myId, name: this.myName, me: true, host: this.role === 'host' }; return this.role === 'host' ? [me, ...rem] : [...rem, me]; }

  onRelay(m) {
    const g = this.game;
    if (this.role === 'host') {
      if (m.t === 'join') this.hostOnJoin(m.cid, m.name);
      else if (m.t === 'leave') this.hostOnLeave(m.cid);
      else if (m.t === 'msg') this.hostOnMsg(m.cid, m.d);
    } else if (this.role === 'client') {
      if (m.t === 'msg') { if (this.ready) this.clientOnMsg(m.d); else this.queue.push(m.d); }
      else if (m.t === 'closed') { const why = m.why; this.reset(); g.onNetClosed && g.onNetClosed(why === 'kick' ? 'kick' : 'host'); }
    }
  }
  hostOnJoin(cid, name) {
    if (this.game.smpMode) { // SMP: előbb azonosítás (hello + token), csak utána jön az init
      this.pendJoin.set(cid, name); setTimeout(() => { if (this.pendJoin.has(cid)) { this.pendJoin.delete(cid); this.kick(cid); } }, 8000); return;
    }
    this.finishJoin(cid, name);
  }
  smpAdmit(cid, name, tok) {
    const smp = this.game.smp; const ex = [...this.remotes.values()].find(r => r.name.toLowerCase() === String(name).toLowerCase());
    const hh = smp.admit(name, tok, null);
    if (hh.ok && ex) { if (smp.d.tok[name.toLowerCase()] === hh.h) { this.kick(ex.cid); this.hostOnLeave(ex.cid); } else hh.ok = false, hh.msg = 'Ezzel a névvel már be vannak jelentkezve.'; }
    if (!hh.ok) { this.sendTo(cid, { t: 'deny', m: hh.msg }); setTimeout(() => this.kick(cid), 200); return; }
    this.finishJoin(cid, hh.name, hh.h);
  }
  finishJoin(cid, name, h) {
    const g = this.game, w = g.world;
    name = String(name || 'Játékos').slice(0, 16);
    let n = name, k = 2; const used = new Set(this.names().map(x => x.name));
    while (used.has(n)) n = name + k++;
    if (this.remotes.size + (g.dedicated ? 0 : 1) >= this.maxPlayers) { this.sendTo(cid, { t: 'deny', m: 'A szerver megtelt.' }); setTimeout(() => this.kick(cid), 200); return; }
    const me = (g.mpPlayers || {})[n] || null;
    const smpInit = g.smpMode ? g.smp.initFor(n) : undefined;
    const init = { t: 'init', smp: smpInit, dim: g.dim, seed: g.seed, wname: g.name, mode: g.smpMode ? 'survival' : g.mode, diff: g.difficulty, day: g.dayTime, spawn: g.spawn, hostName: this.myName, hostPos: g.player.pos.slice(), yourName: n, yourId: cid,
      rules: g.rules, chunks: w.collectModified(), facing: [...w.facing], containers: [...w.containers], me,
      players: [...(g.dedicated ? [] : [{ id: 'h', name: this.myName }]), ...[...this.remotes.values()].map(r => ({ id: r.id, name: r.name }))] };
    this.sendTo(cid, init);
    const r = { id: cid, cid, name: n, pos: [g.player.pos[0], g.player.pos[1], g.player.pos[2]], yaw: 0, pitch: 0, dead: false, creative: g.mode === 'creative' };
    this.remotes.set(cid, r); this.addAvatar(r);
    this.bcast({ t: 'join', id: cid, name: n }, cid);
    this.sysChat(n + ' csatlakozott a világhoz'); if (g.smpMode) g.smp.onJoined(n, h, cid);
    this.game.onNetPlayers && this.game.onNetPlayers();
  }
  hostOnLeave(cid) {
    this.pendJoin.delete(cid); const r = this.remotes.get(cid); if (!r) return;
    if (g0(this).smpMode) g0(this).smp.onLeft(r.name);
    this.removeAvatar(r); this.remotes.delete(cid);
    this.bcast({ t: 'leave', id: cid }); this.sysChat(r.name + ' kilépett'); this.game.onNetPlayers && this.game.onNetPlayers();
  }
  sysChat(text) { this.game.chatAdd('', text, true); this.bcast({ t: 'chat', n: '', m: text }); }
  hostOnMsg(cid, d) {
    const g = this.game;
    if (d.t === 'hello' && this.pendJoin.has(cid)) { const nm = this.pendJoin.get(cid); this.pendJoin.delete(cid); this.smpAdmit(cid, nm, d.tok); return; }
    const r = this.remotes.get(cid); if (!r) return;
    switch (d.t) {
      case 'cmd': if (g.smpMode) g.smp.run({ name: r.name, me: false, cid }, String(d.l || '').slice(0, 300)); break;
      case 'buy': if (g.smpMode) g.smp.buy({ name: r.name, me: false, cid }, d.id, d.n); break;
      case 'sell': if (g.smpMode) g.smp.sell({ name: r.name, me: false, cid }, Array.isArray(d.l) ? d.l.slice(0, 40) : []); break;
      case 'p': if (g.smpMode && d.d && !r.dead && r.pos) g.smp.onDeath(r.name, r.pos);
        Object.assign(r, { tpos: [d.x, d.y, d.z], tyaw: d.yw, pitch: d.pt, sneak: d.s, dead: !!d.d, creative: !!d.c, held: d.h }); if (!r.pos2) { r.pos = [d.x, d.y, d.z]; r.pos2 = true; } r.yaw = r.yaw ?? d.yw;
        this.bcast({ t: 'p', id: cid, x: d.x, y: d.y, z: d.z, yw: d.yw, pt: d.pt, s: d.s, d: d.d, c: d.c, h: d.h }, cid); break;
      case 'blks': {
        let l = d.l; if (g.smpMode && !g.smp.isAdmin(r.name)) { const ok = [], back = [], w = g.world; for (const e of l) { if (g.smp.blockedFor(e[0], e[2])) { const k = e[0] + ',' + e[1] + ',' + e[2], fv = w.facing.get(k); back.push([e[0], e[1], e[2], w.getBlock(e[0], e[1], e[2]), fv === undefined ? 0 : fv + 1]); } else ok.push(e); } if (back.length) this.sendTo(cid, { t: 'blks', l: back }); l = ok; }
        if (l.length) { this.applyBlocks(l); this.bcast({ t: 'blks', l }, cid); } break; }
      case 'hit': { const m = g.mobs.list.find(x => x.id === d.id); if (m && d.dmg > 0 && d.dmg < 60) { g.mobs.attacker = cid; g.mobs.damage(m, d.dmg, d.fx, d.fz, d.kb || 1); g.mobs.attacker = null; } break; }
      case 'drop': if (g.drops) g.drops.add(...d.a); break;
      case 'arrow': g.arrows && g.arrows.fire(...d.a, 'remote'); this.bcast({ t: 'arrow', a: d.a, o: 'remote' }, cid); break;
      case 'tnt': g.igniteTNT(d.x, d.y, d.z, d.tt, true); break;
      case 'cmdset': if (g.world.getBlock(...d.k.split(',').map(Number)) >= B.CMD) g.setCmdBlock(d.k, d.v); break;
      case 'dimreq': if (['nether', 'overworld', 'end'].includes(d.d)) g.travel(d.d, d.d === 'overworld' && g.dim === 'end' ? { respawn: true } : {}); break;
      case 'milk': { const m = g.mobs.list.find(x => x.id === d.id); if (m && m.kind === 'cow') m.milkT = 60; break; }
      case 'shear': { const m = g.mobs.list.find(x => x.id === d.id); if (m && m.kind === 'sheep' && !m.sheared) { m.sheared = true; for (let k = 0, n = 1 + (Math.random() * 3 | 0); k < n; k++) g.dropItem(B.WOOL, 1, m.pos[0], m.pos[1] + 0.8, m.pos[2]); } break; }
      case 'pvp': {
        if (g.rules.pvp === false || !(d.dmg > 0 && d.dmg < 30)) break;
        if (d.to === 'h') g.hurtPlayer(d.dmg, d.fx, d.fz, 'pvp');
        else { const t = this.remotes.get(d.to); if (t && t.cid && t.cid !== cid) this.sendTo(t.cid, { t: 'hurt', dmg: d.dmg, sx: d.fx, sz: d.fz, src: 'pvp' }); }
        break;
      }
      case 'cont': g.world.containers.set(d.k, d.v); break;
      case 'chat': { const m = String(d.m || '').slice(0, 200); if (!m) break;
        if (g.smpMode) { const e = g.smp.chatCheck(r.name); if (e) { this.sendTo(cid, { t: 'chat', n: '', m: '✖ ' + e }); break; } if (g.plugins && g.plugins.emit('chat', { name: r.name, message: m }).cancelled) break; const n = g.smp.chatName(r.name); g.chatAdd(n, m); this.bcast({ t: 'chat', n, m }); break; }
        g.chatAdd(r.name, m); this.bcast({ t: 'chat', n: r.name, m }); break; }
      case 'save': g.mpPlayers = g.mpPlayers || {}; g.mpPlayers[r.name] = d.s; break;
      case 'tpreq': { if (d.name === this.myName) g.teleport(d.x, d.y, d.z); else { const t = [...this.remotes.values()].find(x => x.name === d.name); if (t) this.sendTo(t.cid, { t: 'tp', x: d.x, y: d.y, z: d.z }); } break; }
    }
  }

  // ---- kliens ----
  async join(code, name) {
    const pc = parseCode(code); if (!pc) throw new Error('bad_code');
    this.myName = name; this.lastDeny = ''; const ws = await openWS(pc.url, /^wss:/i.test(pc.url) ? 70000 : 6000);
    const init = await new Promise((res, rej) => {
      const t = setTimeout(() => { try { ws.close(); } catch {} rej(new Error('timeout')); }, 20000);
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'joined') ws.send(JSON.stringify({ t: 'msg', d: { t: 'hello', tok: this.token } }));
        else if (m.t === 'msg' && m.d.t === 'deny') { clearTimeout(t); try { ws.close(); } catch {} rej(new Error('deny:' + m.d.m)); }
        else if (m.t === 'error') { clearTimeout(t); try { ws.close(); } catch {} rej(new Error(m.e)); }
        else if (m.t === 'closed') { clearTimeout(t); rej(new Error(m.why === 'kick' ? 'kick' : 'host')); }
        else if (m.t === 'msg' && m.d.t === 'init') { clearTimeout(t); res(m.d); }
      };
      ws.onclose = () => { clearTimeout(t); rej(new Error('closed')); };
      ws.send(JSON.stringify({ t: 'join', room: pc.room, name }));
    });
    this.ws = ws; this.role = 'client'; this.myId = init.yourId; this.myName = init.yourName; this.ready = false; this.queue = [];
    this.info = { room: pc.room, addr: pc.addr, code: pc.ss ? String(code).trim() : makeCode(pc.room, pc.addr) };
    ws.onmessage = e => { try { this.onRelay(JSON.parse(e.data)); } catch (err) { console.warn('net', err); } };
    ws.onclose = () => { if (this.role) { this.reset(); this.game.onNetClosed && this.game.onNetClosed('lost'); } };
    for (const p of init.players) if (p.id !== this.myId) { const r = { id: p.id, name: p.name, pos: init.hostPos.slice(), yaw: 0, pitch: 0 }; this.remotes.set(p.id, r); }
    return init;
  }
  // a világ felállása után hívja a játék
  attach() {
    for (const r of this.remotes.values()) this.addAvatar(r);
    this.ready = true; const q = this.queue; this.queue = []; for (const d of q) this.clientOnMsg(d);
    this.game.onNetPlayers && this.game.onNetPlayers();
  }
  clientOnMsg(d) {
    const g = this.game;
    switch (d.t) {
      case 'p': { const r = this.remotes.get(d.id); if (!r) break; Object.assign(r, { tpos: [d.x, d.y, d.z], tyaw: d.yw, pitch: d.pt, sneak: d.s, dead: !!d.d, held: d.h }); if (!r.pos2) { r.pos = [d.x, d.y, d.z]; r.pos2 = true; } break; }
      case 'blks': this.applyBlocks(d.l); break;
      case 'st': if (g.mobs) g.mobs.applySnapshot(d.m); if (g.drops) g.drops.applySnapshot(d.d); if (typeof d.day === 'number') g.dayTime = d.day; break;
      case 'join': { const r = { id: d.id, name: d.name, pos: g.player.pos.slice(), yaw: 0, pitch: 0 }; this.remotes.set(d.id, r); this.addAvatar(r); g.onNetPlayers && g.onNetPlayers(); break; }
      case 'leave': { const r = this.remotes.get(d.id); if (r) { this.removeAvatar(r); this.remotes.delete(d.id); g.onNetPlayers && g.onNetPlayers(); } break; }
      case 'chat': g.chatAdd(d.n, d.m, !d.n); break;
      case 'conts': this.applyConts(d.c); break;
      case 'xp': g.addXP(d.n); break;
      case 'rules': Object.assign(g.rules, d.r); break;
      case 'dim': g.travel(d.d, { pos: d.pos }); break;
      case 'tp': g.teleport(d.x, d.y, d.z); if (!d.q) g.chatAdd('', 'A host teleportált téged.', true); break;
      case 'hurt': g.hurtPlayer(d.dmg, d.sx, d.sz, d.src); break;
      case 'give': { const left = g.inv.add(d.id, d.n); if (left > 0) g.dropItem(d.id, left, g.player.pos[0], g.player.pos[1] + 1, g.player.pos[2]); g.refreshHotbar(); break; }
      case 'arrow': g.arrows && g.arrows.fire(...d.a, d.o); break;
      case 'fuse': g.spawnTntVisual(d.x, d.y, d.z, d.tt); break;
      case 'sb': if (g.smp) g.smp.applySb(d); break;
      case 'shopr': g.onShopReply && g.onShopReply(d.ok, d.m); break;
      case 'deny': this.lastDeny = d.m; break;
      case 'gm': if (!d.c) { g.player.creative = false; g.player.flying = false; g.mode = 'survival'; g.updateBars && g.updateBars(true); } else { g.player.creative = true; g.mode = 'creative'; g.updateBars && g.updateBars(true); } break;
      case 'spawn': g.spawn = d.p.slice(); break;
      case 'fx': if (d.k === 'ex') g.explode(d.x, d.y, d.z, d.r, d.src, true); break;
    }
  }

  // ---- blokkok ----
  queueBlock(x, y, z, id) { this.outBlocks.push([x, y, z, id]); }
  flushBlocks() {
    if (!this.outBlocks.length || !this.ready) { if (!this.ready) this.outBlocks = []; return; }
    const w = this.game.world, seen = new Map();
    for (const b of this.outBlocks) seen.set(b[0] + ',' + b[1] + ',' + b[2], b);
    this.outBlocks = [];
    const l = [...seen.values()].map(b => { const k = b[0] + ',' + b[1] + ',' + b[2]; const fv = w.facing.get(k); return [b[0], b[1], b[2], w.getBlock(b[0], b[1], b[2]), fv === undefined ? 0 : fv + 1]; });
    for (let i = 0; i < l.length; i += 400) { const part = l.slice(i, i + 400); if (this.role === 'host') this.bcast({ t: 'blks', l: part }); else this.send({ t: 'blks', l: part }); }
  }
  applyBlocks(list, fromPending) {
    const g = this.game, w = g.world; if (!w) return; const touched = new Set();
    for (const e of list) {
      const [x, y, z, id, f] = e, key = x + ',' + y + ',' + z, c = w.chunks.get(ckey(x >> 4, z >> 4));
      if (!c || !c.generated) { if (!fromPending) this.pending.push(e); else this.pending.push(e); continue; }
      if (f) w.facing.set(key, f - 1); else w.facing.delete(key);
      w.suppress = true; w.setBlock(x, y, z, id); w.suppress = false;
      if (!id) w.containers.delete(key);
      touched.add((x >> 4) + ',' + (z >> 4) + ',' + x + ',' + z);
      if (g.particles && !fromPending && Math.abs(x - g.player.pos[0]) < 24 && Math.abs(z - g.player.pos[2]) < 24 && Math.abs(y - g.player.pos[1]) < 24 && !id) g.particles.burst(x + 0.5, y + 0.5, z + 0.5, [0.6, 0.6, 0.6], 4, 0.4);
    }
    const done = new Set();
    for (const t of touched) { const [cx, cz, x, z] = t.split(',').map(Number), k = cx + ',' + cz; if (done.has(k)) continue; done.add(k); g.flushNear(x, z); }
  }
  // ---- konténerek ----
  applyConts(arr) {
    const g = this.game, w = g.world, open = g.ui && g.ui.open ? g.ui.ctx : null;
    const keep = new Set();
    for (const [k, v] of arr) { keep.add(k); const cur = w.containers.get(k); if (cur && cur === open) { // épp nyitott kemence: az égés / sütés állapotát és a kimenetet a host szerint frissítjük
        if (cur.burn !== undefined && v && v.burn !== undefined) { cur.burn = v.burn; cur.burnMax = v.burnMax; cur.cook = v.cook; const o = v.slots && v.slots[2]; if (o && (!cur.slots[2] || cur.slots[2].id === o.id)) cur.slots[2] = o; }
        continue;
      }
      w.containers.set(k, v); }
    for (const k of [...w.containers.keys()]) if (!keep.has(k) && w.containers.get(k) !== open) w.containers.delete(k);
  }
  attackPlayer(r, dmg) {
    const p = this.game.player;
    if (this.role === 'host') { if (r.cid) this.sendTo(r.cid, { t: 'hurt', dmg, sx: p.pos[0], sz: p.pos[2], src: 'pvp' }); }
    else this.send({ t: 'pvp', to: r.id, dmg, fx: p.pos[0], fz: p.pos[2] });
  }
  sendContainer(ctx) {
    const w = this.game.world; if (!ctx || !w) return;
    for (const [k, v] of w.containers) if (v === ctx) { if (this.role === 'client') this.send({ t: 'cont', k, v }); else this.lastCont = ''; return; }
  }

  // ---- avatarok ----
  addAvatar(r) {
    if (r.avatar) return; const a = buildAvatar(r.name); r.avatar = a; r.anim = 0; this.game.scene.add(a.root); a.root.visible = !!r.pos;
  }
  removeAvatar(r) { if (!r.avatar) return; this.game.scene.remove(r.avatar.root); r.avatar.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); r.avatar = null; }
  setHeld(a, id) {
    if (a.heldId === id) return; a.heldId = id;
    if (a.heldMesh) { a.armR.remove(a.heldMesh); if (a.heldMesh.material.map) a.heldMesh.material.map.dispose(); a.heldMesh.material.dispose(); a.heldMesh.geometry.dispose(); a.heldMesh = null; }
    if (!id) return;
    const g = this.game; if (!g.iconCanvas) return;
    let tex; try { tex = new THREE.CanvasTexture(g.iconCanvas(id)); } catch { return; }
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    m.position.set(0.02, -0.62, -0.26); m.rotation.set(-0.6, 0, 0);
    a.armR.add(m); a.heldMesh = m;
  }
  updateAvatars(dt, day) {
    const g = this.game;
    for (const r of this.remotes.values()) {
      const a = r.avatar; if (!a) continue;
      if (r.tpos) {
        const k = Math.min(1, dt * 12), dx = r.tpos[0] - r.pos[0], dz = r.tpos[2] - r.pos[2];
        if (Math.hypot(dx, dz) > 10) r.pos = r.tpos.slice(); else { r.pos[0] += dx * k; r.pos[1] += (r.tpos[1] - r.pos[1]) * k; r.pos[2] += dz * k; }
        let dy = r.tyaw - r.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.yaw += dy * k; r.spd = Math.hypot(dx, dz) * 12;
      }
      r.anim = (r.anim || 0) + (r.spd || 0) * dt * 1.6;
      const sw = Math.sin(r.anim) * Math.min(1, (r.spd || 0) / 2) * 0.8;
      this.setHeld(a, r.dead ? 0 : (r.held || 0));
      a.legL.rotation.x = sw; a.legR.rotation.x = -sw; a.armL.rotation.x = -sw; a.armR.rotation.x = a.heldId ? sw * 0.3 - 0.9 : sw; a.head.rotation.x = r.pitch || 0;
      a.root.position.set(r.pos[0], r.pos[1] - (r.sneak === 2 ? 0.45 : r.sneak ? 0.15 : 0), r.pos[2]); a.root.rotation.y = r.yaw; a.root.rotation.z = r.dead ? Math.PI / 2 : 0;
      a.tag.visible = !r.dead;
      const lt = g.mobs ? g.mobs.lightAt(r.pos[0], r.pos[1], r.pos[2], day) : 1;
      for (const m of a.mats) m.color.setRGB(m.base[0] * lt, m.base[1] * lt, m.base[2] * lt);
    }
  }

  // ---- fő ciklus ----
  update(dt, day) {
    if (!this.role || !this.ready) return;
    const g = this.game, p = g.player, w = g.world;
    this.flushBlocks();
    this.posT -= dt;
    if (this.posT <= 0) {
      this.posT = 0.05;
      const d = { t: 'p', x: +p.pos[0].toFixed(3), y: +p.pos[1].toFixed(3), z: +p.pos[2].toFixed(3), yw: +p.yaw.toFixed(3), pt: +p.pitch.toFixed(3), s: p.sit ? 2 : p.sneak ? 1 : 0, d: p.dead ? 1 : 0, c: p.creative ? 1 : 0, h: (g.inv.slots[p.hot] || {}).id || 0 };
      if (this.role === 'host') { if (!g.dedicated) this.bcast({ ...d, id: 'h' }); } else this.send(d);
    }
    this.pendT -= dt;
    if (this.pendT <= 0 && this.pending.length) { this.pendT = 0.5; const l = this.pending; this.pending = []; this.applyBlocks(l, true); }
    if (this.role === 'host') {
      this.snapT -= dt;
      if (this.snapT <= 0 && this.remotes.size) {
        this.snapT = 0.1; const pl = this.playerList();
        this.bcast({ t: 'st', m: g.mobs.snapshot(pl), d: g.drops.snapshot(pl), day: Math.round(g.dayTime) });
      }
      this.contT -= dt;
      if (this.contT <= 0) {
        this.contT = 1; const s = JSON.stringify([...w.containers]);
        if (s !== this.lastCont && this.remotes.size) { this.lastCont = s; this.bcast({ t: 'conts', c: [...w.containers] }); } else if (!this.remotes.size) this.lastCont = s;
      }
    } else {
      this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 10; this.sendState(); }
    }
    this.updateAvatars(dt, day);
  }
  sendState() { if (this.role === 'client' && this.game.playerState) this.send({ t: 'save', s: this.game.playerState() }); }

  reset() {
    for (const r of this.remotes.values()) this.removeAvatar(r);
    this.pendJoin.clear(); this.remotes.clear(); this.role = null; this.ready = false; this.queue = []; this.pending = []; this.outBlocks = []; this.info = null;
    if (this.ws) { try { this.ws.onclose = null; this.ws.close(); } catch {} this.ws = null; }
  }
  leave() {
    if (this.role === 'client') { this.sendState(); const ws = this.ws; this.ws = null; this.reset(); setTimeout(() => { try { ws.onclose = null; ws.close(); } catch {} }, 250); return; }
    if (this.role === 'host') this.stopHosting();
  }
}

// Páncél-réteg az avatarra (gyémánt = türkiz stb.)
const ARM_COL = [[0.55, 0.36, 0.2], [0.85, 0.85, 0.88], [1, 0.82, 0.2], [0.3, 0.92, 0.88]];
export function setAvatarArmor(av, ids) {
  if (av.armorMeshes) for (const m of av.armorMeshes) m.parent.remove(m);
  av.armorMeshes = []; av.armorKey = ids.join(',');
  const add = (parent, w, h, d, c, y, x = 0, z = 0) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) }); m.base = c; av.mats.push(m); const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); parent.add(me); av.armorMeshes.push(me); };
  const col = id => ARM_COL[Math.floor((id - 380) / 4)] || null, dk = (c, f) => [c[0] * f, c[1] * f, c[2] * f], lt = (c, f) => [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)];
  const [h, c, l, b] = ids;
  if (h) { const k = col(h); add(av.head, 0.58, 0.16, 0.58, k, 0.44); add(av.head, 0.58, 0.46, 0.09, dk(k, 0.85), 0.23, 0, 0.245); add(av.head, 0.09, 0.4, 0.5, dk(k, 0.9), 0.25, -0.245); add(av.head, 0.09, 0.4, 0.5, dk(k, 0.9), 0.25, 0.245); add(av.head, 0.58, 0.07, 0.07, dk(k, 0.7), 0.36, 0, -0.27); add(av.head, 0.1, 0.17, 0.07, dk(k, 0.7), 0.27, 0, -0.27); }
  if (c) { const k = col(c); add(av.root, 0.58, 0.74, 0.34, k, 1.05); add(av.root, 0.22, 0.5, 0.02, lt(k, 1.18), 1.1, 0, -0.175); add(av.root, 0.6, 0.1, 0.36, dk(k, 0.7), 0.72); for (const a of [av.armL, av.armR]) { add(a, 0.3, 0.2, 0.3, lt(k, 1.1), 0.0); add(a, 0.26, 0.1, 0.28, dk(k, 0.75), -0.2); } }
  if (l) { const k = col(l); for (const g of [av.legL, av.legR]) { add(g, 0.31, 0.42, 0.31, k, -0.12); add(g, 0.32, 0.06, 0.32, dk(k, 0.7), -0.01); } }
  if (b) { const k = dk(col(b), 0.85); for (const g of [av.legL, av.legR]) { add(g, 0.33, 0.26, 0.33, k, -0.57); add(g, 0.34, 0.05, 0.34, lt(k, 1.25), -0.45); } }
}
