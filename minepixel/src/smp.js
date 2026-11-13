// MinePixel SMP – a közös szerver logikája: pénz, bolt, parancsok, moderáció.
// DOM-mentes. A host (admin játéka) a hiteles fél; a kliensek kéréseket küldenek (cmd / buy / sell).
import { itemDef } from './blocks.js';

export const SMP = {
  name: 'MinePixel SMP', id: 'smp_main', room: 'MINEPIXELSMP',
  // Alap szerver-cím (relay): pl. 'wss://minepixel.onrender.com'. Üresen a játékosok a menüben adják meg.
  defaultAddr: '',
  startBal: 250, protect: 12, homeMax: 3, homeMaxAdmin: 10, maxPlayers: 16,
  rules: ['1. Ne griefelj, ne lopj – más építményéhez ne nyúlj.', '2. Tilos csalni (hack, bug-kihasználás).', '3. Légy kedves a többiekkel a chaten.', '4. A spawn környéke védett, ott nem lehet építeni.', '5. Kreatív mód csak az adminnak van.'],
};

// ---------------- Bolt-katalógus: [id, vételár, eladási ár] ----------------
let _cat = null;
export function catalog() {
  if (_cat) return _cat;
  const cats = [], by = new Map();
  const add = (id, buy, sell) => { if (!itemDef(id) || by.has(id)) return null; const e = { id, buy: buy | 0, sell: sell | 0 }; by.set(id, e); return e; };
  const cat = (key, name, icon, rows) => { const items = []; for (const r of rows) { const e = add(r[0], r[1], r[2] || 0); if (e) items.push(e); } cats.push({ key, name, icon, items }); };
  cat('build', 'Építőblokkok', 24, [[1, 8, 1], [4, 6, 1], [3, 2], [5, 8, 2], [39, 8, 2], [40, 8, 2], [14, 20, 4], [35, 20, 4], [37, 20, 4], [9, 6, 1], [10, 6, 1], [16, 14, 2], [24, 40, 8], [31, 14, 2], [30, 12, 2], [74, 12, 2], [75, 16, 3], [63, 8, 1], [64, 8, 1], [65, 8, 1], [66, 10, 1], [67, 10], [68, 16], [69, 16], [70, 16], [71, 12], [72, 12], [73, 12], [76, 6, 1], [77, 14], [78, 24], [79, 80, 12], [47, 150, 30], [26, 60, 10], [210, 24], [20, 20, 3], [19, 4], [85, 40], [29, 120], [80, 60, 12], [84, 70]]);
  const slabBase = [8, 8, 8, 6, 8, 14, 40, 12, 80, 10, 24];
  cat('stairs', 'Lapok & lépcsők', 135, [...slabBase.map((p, i) => [124 + i, Math.ceil(p * 0.55)]), ...slabBase.map((p, i) => [135 + i, Math.ceil(p * 0.9)])]);
  cat('color', 'Színes blokkok', 27, [[27, 18, 3], ...Array.from({ length: 14 }, (_, i) => [93 + i, 20]), ...Array.from({ length: 16 }, (_, i) => [108 + i, 24]), ...Array.from({ length: 16 }, (_, i) => [350 + i, 10])]);
  const tools = [], mat = [3, 3, 45, 60, 260], units = [3, 3, 1, 2, 2], sticks = [2, 2, 2, 1, 2];
  for (let ti = 0; ti < 5; ti++) for (let mi = 0; mi < 5; mi++) tools.push([280 + ti * 5 + mi, Math.round(units[ti] * mat[mi] + sticks[ti] * 2 + 6)]);
  tools.push([342, 70], [345, 90], [346, 60], [347, 90], [348, 3], [419, 50]);
  cat('tools', 'Eszközök & fegyverek', 282, tools);
  const arm = [], am = [8, 45, 60, 260], au = [5, 8, 7, 4];
  for (let m = 0; m < 4; m++) for (let p = 0; p < 4; p++) arm.push([380 + m * 4 + p, Math.round(au[p] * am[m] + 10)]);
  cat('armor', 'Páncélok', 385, arm);
  cat('ores', 'Ércek & nyersanyag', 260, [[257, 24, 6], [258, 70, 20], [259, 110, 35], [260, 420, 150], [268, 50, 14], [269, 80, 26], [320, 40, 10], [321, 25, 7], [322, 30, 9], [323, 20, 6], [324, 300, 100], [325, 45, 12], [267, 60, 14], [329, 20, 4], [330, 24, 5], [328, 16, 3], [331, 28, 7], [270, 14, 3], [326, 12, 2], [327, 18, 3], [410, 200, 60], [413, 100, 30], [412, 22, 6],
    [55, 216, 50], [56, 640, 170], [57, 990, 300], [58, 3780, 1300], [59, 2700, 900], [60, 270, 80], [61, 360, 80], [62, 180, 50]]);
  cat('food', 'Étel', 334, [[261, 14, 3], [262, 8, 2], [263, 16, 4], [264, 8, 2], [265, 18, 5], [334, 12, 3], [333, 8, 2], [332, 4, 1], [335, 7, 2], [336, 15, 4], [337, 7, 2], [338, 16, 4], [339, 260, 60], [340, 5, 1], [341, 4, 1], [400, 30, 8], [401, 28, 8], [402, 30, 8], [403, 30, 8], [404, 45, 12], [405, 30, 8], [406, 36, 10], [407, 40, 10], [408, 36, 10], [81, 20, 4], [83, 40, 8]]);
  cat('nature', 'Természet', 91, [[91, 12, 2], [33, 8, 1], [34, 8, 1], [21, 12, 2], [86, 6], [430, 350], [431, 350], [432, 350], [433, 350]]);
  cat('redstone', 'Redstone & szerkezetek', 170, [[170, 20], [172, 10], [174, 14], [192, 60], [194, 24], [28, 250], [146, 30], [162, 10], [163, 16], [165, 8], [166, 14], [46, 40], [23, 30], [22, 24], [25, 4], [92, 80], [199, 36], [200, 60], [203, 40], [207, 90], [214, 1200], [215, 600], [216, 500], [414, 12], [415, 180], [416, 180], [417, 180], [418, 180]]);
  // védelem: a vétel mindig drágább az eladásnál
  for (const e of by.values()) if (e.sell >= e.buy && e.buy > 0) e.sell = Math.max(0, e.buy - 1);
  _cat = { cats, by };
  return _cat;
}
export const buyPrice = id => { const e = catalog().by.get(id); return e && e.buy > 0 ? e.buy : 0; };
export const sellPrice = id => { const e = catalog().by.get(id); return e ? e.sell : 0; };
export const itemName = id => { const d = itemDef(id); return d ? d.name : '#' + id; };
export const fmt = n => Math.round(n).toLocaleString('hu-HU') + ' $';
export const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + 'ó ' + m + 'p' : m + 'p'; };
const key = n => String(n || '').toLowerCase();
const hash = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
const fresh = () => ({ v: 1, bal: {}, names: {}, homes: {}, warps: {}, ops: [], bans: {}, mutes: {}, tok: {}, daily: {}, streak: {}, kit: {}, seen: {}, first: {}, play: {}, protect: SMP.protect });
const NAME_RE = /^[A-Za-z0-9_áéíóöőúüűÁÉÍÓÖŐÚÜŰ]{3,16}$/;

export class Smp {
  constructor(game) { this.g = game; this.reset(); }
  reset() {
    this.d = fresh(); this.tpa = new Map(); this.cool = new Map(); this.lastMsg = new Map(); this.back = new Map(); this.chatT = new Map(); this.acc = 0; this.pushT = 0;
    this.me = { bal: 0, rank: 'player', play: 0, protect: SMP.protect, admins: new Set(), pcmds: new Set() };
  }
  load(o) { this.d = Object.assign(fresh(), o || {}); }
  serialize() { return this.d; }
  get net() { return this.g.net; }
  hostName() { return this.net.myName; }
  isAdmin(name) { const k = key(name); return k === key(this.hostName()) || this.d.ops.includes(k); }
  amAdmin() { return this.net.isHost || this.me.rank === 'admin'; }
  protectR() { return this.net.isHost ? this.d.protect : this.me.protect; }
  // építés védett-e a spawn körül (nem adminnak)
  blocked(x, z) {
    const r = this.protectR(); if (!r || this.amAdmin() || this.g.dim !== 'overworld') return false;
    const s = this.g.spawn; return Math.hypot(x + 0.5 - s[0], z + 0.5 - s[2]) <= r;
  }
  blockedFor(x, z) { const r = this.d.protect; if (!r || this.g.dim !== 'overworld') return false; const sp = this.g.spawn; return Math.hypot(x + 0.5 - sp[0], z + 0.5 - sp[2]) <= r; }
  // ---------- játékosok ----------
  online() { const out = this.g.dedicated ? [] : [{ name: this.net.myName, me: true }]; for (const r of this.net.remotes.values()) if (r.cid) out.push({ name: r.name, me: false, cid: r.cid, r }); return out; }
  find(q) { q = key(q); if (!q) return null; const on = this.online(); return on.find(p => key(p.name) === q) || on.find(p => key(p.name).startsWith(q)) || null; }
  known(q) { q = key(q); if (!q) return null; if (this.d.names[q]) return this.d.names[q]; const k = Object.keys(this.d.names).find(n => n.startsWith(q)); return k ? this.d.names[k] : null; }
  posOf(name) { const p = this.find(name); if (!p) return null; return p.me ? this.g.player.pos.slice() : (p.r.pos ? p.r.pos.slice() : null); }
  tell(s, text, err) { const m = (err ? '✖ ' : '') + text; if (s.me) this.g.chatAdd('', m, true); else this.net.sendTo(s.cid, { t: 'chat', n: '', m }); }
  tellName(name, text) { const p = this.find(name); if (p) this.tell(p, text); }
  shopReply(s, ok, m) { if (s.me) this.g.onShopReply && this.g.onShopReply(ok, m); else this.net.sendTo(s.cid, { t: 'shopr', ok, m }); }
  tpTo(name, pos) { const p = this.find(name); if (!p) return; if (p.me) this.g.teleport(pos[0], pos[1], pos[2]); else this.net.sendTo(p.cid, { t: 'tp', x: pos[0], y: pos[1], z: pos[2], q: 1 }); }
  setBack(name, pos) { if (pos) this.back.set(key(name), pos.slice()); }
  onDeath(name, pos) { this.setBack(name, pos); this.tellName(name, 'Meghaltál. A /back paranccsal visszatérhetsz a halálod helyére.'); }

  // ---------- gazdaság ----------
  bal(name) { return this.d.bal[key(name)] || 0; }
  setBal(name, v) { const k = key(name); this.d.bal[k] = Math.max(0, Math.floor(v)); this.d.names[k] = this.d.names[k] || name; this.pushSb(name); }
  addBal(name, dv) { this.setBal(name, this.bal(name) + dv); }
  sbFor(name) { const k = key(name); return { t: 'sb', b: this.bal(name), pt: this.d.play[k] || 0, r: this.isAdmin(name) ? 'admin' : 'player', adm: this.adminNames(), pr: this.d.protect, pc: this.g.plugins ? this.g.plugins.names() : [] }; }
  adminNames() { return [key(this.hostName()), ...this.d.ops]; }
  pushSb(name) { const p = this.find(name); if (!p) return; const m = this.sbFor(name); if (p.me) this.applySb(m); else this.net.sendTo(p.cid, m); }
  applySb(m) { const me = this.me; me.bal = m.b; me.play = m.pt; me.rank = m.r; me.protect = m.pr; me.admins = new Set(m.adm || []); me.pcmds = new Set(m.pc || []); this.g.onSmpUpdate && this.g.onSmpUpdate(); }
  initFor(name) { return { ...this.sbFor(name), name: SMP.name, rules: SMP.rules }; }
  // csatlakozás ellenőrzése. Visszaadja {ok, name, msg}
  admit(name, tok, taken) {
    name = String(name || '').trim();
    if (!NAME_RE.test(name)) return { ok: false, msg: 'Érvénytelen név (3–16 karakter: betű, szám, _).' };
    const k = key(name), b = this.d.bans[k]; if (b) return { ok: false, msg: 'Ki vagy tiltva a szerverről. Ok: ' + (b.reason || '—') };
    if (!tok || String(tok).length < 16) return { ok: false, msg: 'Hiányzó azonosító – frissítsd a játékot.' };
    const h = hash(String(tok)); if (this.d.tok[k] && this.d.tok[k] !== h) return { ok: false, msg: 'Ezt a nevet másik játékos használja (más eszközről). Válassz másik nevet.' };
    if (key(name) === key(this.hostName())) return { ok: false, msg: 'Ez a név az adminé.' };
    if (taken && taken !== h) return { ok: false, msg: 'Ezzel a névvel már be vannak jelentkezve.' };
    return { ok: true, name, h };
  }
  onJoined(name, h, cid) {
    const k = key(name); this.d.tok[k] = h; this.d.names[k] = name;
    const firstTime = !this.d.first[k]; if (firstTime) { this.d.first[k] = Date.now(); this.d.bal[k] = SMP.startBal; }
    if (this.g.plugins) this.g.plugins.emit('join', { name, first: firstTime });
    setTimeout(() => {
      const s = { name, me: false, cid }; this.pushSb(name);
      this.tell(s, 'Üdv a ' + SMP.name + ' szerveren, ' + name + '!' + (firstTime ? ' Kezdő pénzed: ' + fmt(SMP.startBal) + '.' : ' Egyenleged: ' + fmt(this.bal(name)) + '.'));
      this.tell(s, 'Bolt: B billentyű vagy /shop · Parancsok: /help · Szabályok: /rules' + (firstTime ? ' · Kezdő csomag: /kit' : ''));
    }, 1800);
  }
  setAdminCode(code) { code = String(code || '').trim(); this.d.adminHash = code ? hash('ad:' + code) : ''; }
  hostReady(name) { const k = key(name); this.d.names[k] = name; if (!this.d.first[k]) { this.d.first[k] = Date.now(); this.d.bal[k] = Math.max(this.d.bal[k] || 0, SMP.startBal); } }
  onLeft(name) { if (this.g.plugins) this.g.plugins.emit('leave', { name }); this.d.seen[key(name)] = Date.now(); this.tpa.delete(key(name)); }
  update(dt) {
    if (!this.net.isHost) return;
    if (this.g.plugins) this.g.plugins.tick(dt);
    this.acc += dt; if (this.acc >= 1) { const s = Math.floor(this.acc); this.acc -= s; for (const p of this.online()) { const k = key(p.name); this.d.play[k] = (this.d.play[k] || 0) + s; this.d.names[k] = this.d.names[k] || p.name; } }
    this.pushT += dt; if (this.pushT >= 5) { this.pushT = 0; for (const p of this.online()) this.pushSb(p.name); }
    // admin audit: nem admin ne legyen kreatív
    for (const r of this.net.remotes.values()) if (r.cid && r.creative && !this.isAdmin(r.name)) { r.creative = false; this.net.sendTo(r.cid, { t: 'gm', c: 0 }); }
  }
  // ---------- chat ----------
  chatName(name) { return (this.isAdmin(name) ? '[Admin] ' : '') + name; }
  mutedLeft(name) { const e = this.d.mutes[key(name)]; if (e === undefined) return 0; if (e === 0) return -1; if (Date.now() > e) { delete this.d.mutes[key(name)]; return 0; } return Math.ceil((e - Date.now()) / 60000); }
  // return null ha mehet, különben a hibaszöveg
  chatCheck(name) {
    if (this.isAdmin(name)) return null;
    const m = this.mutedLeft(name); if (m) return m < 0 ? 'Némítva vagy.' : 'Némítva vagy még ' + m + ' percig.';
    const now = Date.now(), last = this.chatT.get(key(name)) || 0; if (now - last < 800) return 'Lassabban írj!'; this.chatT.set(key(name), now); return null;
  }
  // ---------- bolt ----------
  buy(s, id, n) {
    n = Math.floor(+n); const e = catalog().by.get(id);
    if (!e || e.buy <= 0 || !(n >= 1 && n <= 2304)) return this.shopReply(s, false, 'Érvénytelen vásárlás.');
    const cost = e.buy * n; if (this.bal(s.name) < cost) return this.shopReply(s, false, 'Nincs elég pénzed (' + fmt(cost) + ' kell).');
    this.addBal(s.name, -cost);
    if (s.me) { const left = this.g.inv.add(id, n); if (left > 0) this.g.dropItem(id, left, this.g.player.pos[0], this.g.player.pos[1] + 1, this.g.player.pos[2]); this.g.refreshHotbar(); }
    else this.net.sendTo(s.cid, { t: 'give', id, n });
    this.shopReply(s, true, 'Vettél ' + n + ' × ' + itemName(id) + ' – ' + fmt(cost));
  }
  sell(s, list) {
    let total = 0, bad = [], sold = 0;
    for (const [id, n0] of list || []) {
      const n = Math.floor(+n0), p = sellPrice(id);
      if (!(n >= 1 && n <= 2304) || p <= 0) { if (n >= 1 && n <= 2304 && itemDef(id)) bad.push([id, n]); continue; }
      total += p * n; sold += n;
    }
    for (const [id, n] of bad) { if (s.me) { this.g.inv.add(id, n); this.g.refreshHotbar(); } else this.net.sendTo(s.cid, { t: 'give', id, n }); }
    if (total > 0) this.addBal(s.name, total);
    this.shopReply(s, total > 0, total > 0 ? 'Eladtál ' + sold + ' tárgyat – +' + fmt(total) : 'Ezeket nem veszi meg a bolt.');
  }
  // ---------- parancsok (host oldalon) ----------
  run(s, line) {
    const a = String(line || '').trim().replace(/^\//, '').split(/\s+/), cmd = (a.shift() || '').toLowerCase();
    let r; try { r = this.exec(s, cmd, a); } catch (e) { console.warn('smp cmd', e); this.tell(s, 'Hiba a parancs futtatásakor.', true); return; }
    if (r === false) this.tell(s, 'Ismeretlen parancs: /' + cmd + ' – írd be: /help', true);
  }
  cd(s, k, sec) { if (this.isAdmin(s.name)) return 0; const id = key(s.name) + ':' + k, now = Date.now(), t = this.cool.get(id) || 0; if (now < t) return Math.ceil((t - now) / 1000); this.cool.set(id, now + sec * 1000); return 0; }
  needAdmin(s) { if (this.isAdmin(s.name)) return true; this.tell(s, 'Ehhez a parancshoz admin jog kell.', true); return false; }
  needHost(s) { if (s.me || (this.g.dedicated && this.isAdmin(s.name))) return true; this.tell(s, 'Ezt a parancsot csak a szerver tulajdonosa használhatja.', true); return false; }
  target(s, q, { self = false, onlineOnly = true } = {}) {
    const p = this.find(q); if (p) { if (!self && key(p.name) === key(s.name)) { this.tell(s, 'Magadra nem használhatod.', true); return null; } return p; }
    this.tell(s, 'Nincs ilyen online játékos: ' + (q || '?'), true); return null;
  }
  amount(s, v) { const n = Math.floor(+String(v).replace(',', '.')); if (!isFinite(n) || n < 1 || n > 1e9) { this.tell(s, 'Az összeg pozitív egész szám legyen.', true); return 0; } return n; }
  warm(s, getDest, label, delay = 3) {
    const start = this.posOf(s.name); if (!start) return; if (this.isAdmin(s.name)) delay = 0;
    const go = () => {
      const cur = this.posOf(s.name), dest = getDest(); if (!cur) return; if (!dest) return this.tell(s, 'A célpont már nem elérhető.', true);
      if (delay && Math.hypot(cur[0] - start[0], cur[1] - start[1], cur[2] - start[2]) > 1.6) return this.tell(s, 'A teleportálás megszakadt, mert elmozdultál.', true);
      this.setBack(s.name, cur); this.tpTo(s.name, dest); this.tell(s, 'Teleportálva: ' + label);
    };
    if (!delay) return go(); this.tell(s, 'Teleportálás ' + delay + ' mp múlva (' + label + ') – ne mozogj!'); setTimeout(go, delay * 1000);
  }
  exec(s, cmd, a) {
    const g = this.g, net = this.net, me = s.name;
    switch (cmd) {
      // ----- pénz -----
      case 'bal': case 'balance': case 'money': case 'egyenleg': {
        const sub = (a[0] || '').toLowerCase();
        if (['give', 'take', 'set', 'add', 'remove'].includes(sub)) {
          if (!this.needAdmin(s)) return true; if (a.length < 3) return this.tell(s, 'Használat: /bal ' + sub + ' <játékos> <összeg>', true), true;
          const tn = this.find(a[1]) ? this.find(a[1]).name : this.known(a[1]); if (!tn) return this.tell(s, 'Ismeretlen játékos: ' + a[1], true), true;
          const n = sub === 'set' ? Math.floor(+a[2]) : this.amount(s, a[2]); if (sub === 'set' ? !(n >= 0) : !n) return this.tell(s, 'Érvénytelen összeg.', true), true;
          if (sub === 'give' || sub === 'add') this.addBal(tn, n); else if (sub === 'take' || sub === 'remove') this.addBal(tn, -Math.min(n, this.bal(tn))); else this.setBal(tn, n);
          this.tell(s, tn + ' egyenlege: ' + fmt(this.bal(tn))); if (key(tn) !== key(me)) this.tellName(tn, 'Az egyenleged megváltozott: ' + fmt(this.bal(tn)));
          return true;
        }
        if (a[0]) { const tn = this.find(a[0]) ? this.find(a[0]).name : this.known(a[0]); if (!tn) return this.tell(s, 'Ismeretlen játékos: ' + a[0], true), true; this.tell(s, tn + ' egyenlege: ' + fmt(this.bal(tn))); return true; }
        this.tell(s, 'Egyenleged: ' + fmt(this.bal(me))); return true;
      }
      case 'baltop': case 'top': {
        const l = Object.entries(this.d.bal).sort((x, y) => y[1] - x[1]).slice(0, 10); this.tell(s, '— Leggazdagabbak —');
        l.forEach(([k, v], i) => this.tell(s, (i + 1) + '. ' + (this.d.names[k] || k) + ' – ' + fmt(v))); return true;
      }
      case 'pay': case 'fizet': {
        if (a.length < 2) return this.tell(s, 'Használat: /pay <játékos> <összeg>', true), true;
        const tn = this.find(a[0]) ? this.find(a[0]).name : this.known(a[0]); if (!tn) return this.tell(s, 'Ismeretlen játékos: ' + a[0], true), true;
        if (key(tn) === key(me)) return this.tell(s, 'Magadnak nem fizethetsz.', true), true;
        const n = this.amount(s, a[1]); if (!n) return true; if (this.bal(me) < n) return this.tell(s, 'Nincs elég pénzed. Egyenleged: ' + fmt(this.bal(me)), true), true;
        this.addBal(me, -n); this.addBal(tn, n); this.tell(s, 'Elküldtél ' + fmt(n) + '-t ' + tn + ' játékosnak.'); this.tellName(tn, me + ' küldött neked ' + fmt(n) + '-t.'); return true;
      }
      case 'daily': case 'napi': {
        const k = key(me), now = Date.now(), last = this.d.daily[k] || 0, wait = 22 * 3600 * 1000 - (now - last);
        if (wait > 0) return this.tell(s, 'A napi jutalmat ' + fmtTime(wait / 1000) + ' múlva veheted fel újra.', true), true;
        const st = now - last < 48 * 3600 * 1000 ? Math.min(7, (this.d.streak[k] || 0) + 1) : 1; this.d.daily[k] = now; this.d.streak[k] = st;
        const r = 100 + 25 * (st - 1); this.addBal(me, r); this.tell(s, 'Napi jutalom: +' + fmt(r) + ' (sorozat: ' + st + ' nap).'); return true;
      }
      case 'kit': {
        const k = key(me); if (this.d.kit[k]) return this.tell(s, 'A kezdő csomagot már felvetted.', true), true; this.d.kit[k] = 1;
        const items = [[280, 1], [285, 1], [290, 1], [295, 1], [334, 12], [25, 16]];
        for (const [id, n] of items) { if (s.me) { const left = g.inv.add(id, n); if (left) g.dropItem(id, left, g.player.pos[0], g.player.pos[1] + 1, g.player.pos[2]); } else net.sendTo(s.cid, { t: 'give', id, n }); }
        if (s.me) g.refreshHotbar(); this.tell(s, 'Megkaptad a kezdő csomagot (fa szerszámok, kenyér, fáklya).'); return true;
      }
      case 'give': {
        if (!this.needAdmin(s)) return true; if (!a.length) return this.tell(s, 'Használat: /give [játékos] <item> [db]', true), true;
        let n = 1; if (a.length > 1 && /^\d+$/.test(a[a.length - 1])) n = Math.min(2304, Math.max(1, +a.pop()));
        let tg = s; if (a.length > 1) { const p = this.find(a[0]); if (p) { tg = p; a.shift(); } }
        const id = g.findItem ? g.findItem(a.join(' ')) : null; if (!id) return this.tell(s, 'Nincs ilyen item: ' + a.join(' '), true), true;
        if (tg.me) { const left = g.inv.add(id, n); if (left > 0) g.dropItem(id, left, g.player.pos[0], g.player.pos[1] + 1, g.player.pos[2]); g.refreshHotbar(); } else net.sendTo(tg.cid, { t: 'give', id, n });
        this.tell(s, n + ' × ' + itemName(id) + ' → ' + tg.name); if (tg.name !== me) this.tell(tg, 'Kaptál: ' + n + ' × ' + itemName(id)); return true;
      }
      // ----- teleport -----
      case 'tpa': case 'tpahere': {
        const here = cmd === 'tpahere', t = this.target(s, a[0]); if (!t) return true;
        const w = this.cd(s, 'tpa', 5); if (w) return this.tell(s, 'Várj ' + w + ' mp-et.', true), true;
        this.tpa.set(key(t.name), { from: me, here, t: Date.now() });
        this.tell(s, 'Teleport kérés elküldve: ' + t.name + ' (60 mp-ig érvényes).');
        this.tell(t, me + (here ? ' hozzá szeretne teleportáltatni téged' : ' hozzád szeretne teleportálni') + '. /tpaccept – elfogadás, /tpdeny – elutasítás.'); return true;
      }
      case 'tpaccept': case 'tpyes': case 'tpelfogad': {
        const q = this.tpa.get(key(me)); if (!q || Date.now() - q.t > 60000) { this.tpa.delete(key(me)); return this.tell(s, 'Nincs függő teleport kérés.', true), true; }
        this.tpa.delete(key(me)); const from = this.find(q.from); if (!from) return this.tell(s, q.from + ' már nincs online.', true), true;
        this.tell(s, 'Kérés elfogadva.'); this.tell(from, me + ' elfogadta a kérésed.');
        if (q.here) this.warm(s, () => this.posOf(from.name), from.name); else this.warm(from, () => this.posOf(me), me); return true;
      }
      case 'tpdeny': case 'tpno': case 'tputasit': {
        const q = this.tpa.get(key(me)); if (!q) return this.tell(s, 'Nincs függő kérés.', true), true; this.tpa.delete(key(me)); this.tell(s, 'Kérés elutasítva.'); this.tellName(q.from, me + ' elutasította a teleport kérésed.'); return true;
      }
      case 'tpcancel': {
        let n = 0; for (const [k, q] of this.tpa) if (key(q.from) === key(me)) { this.tpa.delete(k); n++; } this.tell(s, n ? 'Kérés(ek) visszavonva.' : 'Nincs függő kérésed.'); return true;
      }
      case 'sethome': {
        const nm = (a[0] || 'home').toLowerCase().slice(0, 16), k = key(me), hs = this.d.homes[k] = this.d.homes[k] || {}, max = this.isAdmin(me) ? SMP.homeMaxAdmin : SMP.homeMax;
        if (!hs[nm] && Object.keys(hs).length >= max) return this.tell(s, 'Elérted a maximum ' + max + ' otthont. Törölj egyet: /delhome <név>', true), true;
        const p = this.posOf(me); hs[nm] = p.map(v => +v.toFixed(2)); this.tell(s, 'Otthon beállítva: ' + nm); return true;
      }
      case 'home': case 'otthon': {
        const hs = this.d.homes[key(me)] || {}, nm = (a[0] || (hs.home ? 'home' : Object.keys(hs)[0]) || '').toLowerCase(); if (!hs[nm]) return this.tell(s, Object.keys(hs).length ? 'Nincs ilyen otthonod. Otthonaid: ' + Object.keys(hs).join(', ') : 'Még nincs otthonod – /sethome', true), true;
        const w = this.cd(s, 'home', 10); if (w) return this.tell(s, 'Várj ' + w + ' mp-et.', true), true; this.warm(s, () => hs[nm], 'otthon: ' + nm); return true;
      }
      case 'delhome': { const hs = this.d.homes[key(me)] || {}, nm = (a[0] || '').toLowerCase(); if (!hs[nm]) return this.tell(s, 'Nincs ilyen otthonod.', true), true; delete hs[nm]; this.tell(s, 'Otthon törölve: ' + nm); return true; }
      case 'homes': { const hs = Object.keys(this.d.homes[key(me)] || {}); this.tell(s, hs.length ? 'Otthonaid: ' + hs.join(', ') : 'Még nincs otthonod – /sethome'); return true; }
      case 'spawn': { const w = this.cd(s, 'spawn', 10); if (w) return this.tell(s, 'Várj ' + w + ' mp-et.', true), true; const sp = g.spawn.slice(); this.warm(s, () => sp, 'spawn'); return true; }
      case 'setwarp': { if (!this.needAdmin(s)) return true; const nm = (a[0] || '').toLowerCase().slice(0, 16); if (!nm) return this.tell(s, 'Használat: /setwarp <név>', true), true; this.d.warps[nm] = this.posOf(me).map(v => +v.toFixed(2)); this.tell(s, 'Warp létrehozva: ' + nm); return true; }
      case 'delwarp': { if (!this.needAdmin(s)) return true; const nm = (a[0] || '').toLowerCase(); if (!this.d.warps[nm]) return this.tell(s, 'Nincs ilyen warp.', true), true; delete this.d.warps[nm]; this.tell(s, 'Warp törölve: ' + nm); return true; }
      case 'warps': { const w = Object.keys(this.d.warps); this.tell(s, w.length ? 'Warpok: ' + w.join(', ') : 'Még nincs warp.'); return true; }
      case 'warp': {
        const nm = (a[0] || '').toLowerCase(); if (!nm) return this.exec(s, 'warps', []); const p = this.d.warps[nm]; if (!p) return this.tell(s, 'Nincs ilyen warp: ' + nm, true), true;
        const w = this.cd(s, 'warp', 10); if (w) return this.tell(s, 'Várj ' + w + ' mp-et.', true), true; this.warm(s, () => p, 'warp: ' + nm); return true;
      }
      case 'back': { const p = this.back.get(key(me)); if (!p) return this.tell(s, 'Nincs hova visszatérni.', true), true; const w = this.cd(s, 'back', 10); if (w) return this.tell(s, 'Várj ' + w + ' mp-et.', true), true; this.warm(s, () => p, 'előző hely'); return true; }
      case 'rtp': case 'randomtp': {
        if (g.dim !== 'overworld') return this.tell(s, 'Csak a Felvilágban használható.', true), true;
        const w = this.cd(s, 'rtp', 120); if (w) return this.tell(s, 'Újra használható ' + w + ' mp múlva.', true), true;
        let dest = null; for (let i = 0; i < 25 && !dest; i++) { const x = Math.floor((Math.random() * 2 - 1) * 3000), z = Math.floor((Math.random() * 2 - 1) * 3000), h = g.world.column(x, z).h; if (h > 50) dest = [x + 0.5, h + 2, z + 0.5]; }
        if (!dest) return this.tell(s, 'Nem találtam biztonságos helyet, próbáld újra.', true), true; this.warm(s, () => dest, 'véletlen hely (' + Math.floor(dest[0]) + ', ' + Math.floor(dest[2]) + ')', 4); return true;
      }
      // ----- chat / info -----
      case 'msg': case 'w': case 'tell': case 'pm': case 'r': case 'reply': {
        let t, text; if (cmd === 'r' || cmd === 'reply') { const rn = this.lastMsg.get(key(me)); t = rn && this.find(rn); text = a.join(' '); if (!t) return this.tell(s, 'Nincs kinek válaszolni.', true), true; }
        else { t = this.target(s, a[0]); text = a.slice(1).join(' '); if (!t) return true; }
        if (!text) return this.tell(s, 'Használat: /msg <játékos> <üzenet>', true), true;
        const e = this.chatCheck(me); if (e) return this.tell(s, e, true), true;
        this.lastMsg.set(key(t.name), me); this.lastMsg.set(key(me), t.name); this.tell(s, '[Te → ' + t.name + '] ' + text.slice(0, 200)); this.tell(t, '[' + me + ' → Te] ' + text.slice(0, 200)); return true;
      }
      case 'me': { const e = this.chatCheck(me); if (e) return this.tell(s, e, true), true; const t = a.join(' ').slice(0, 200); if (t) net.sysChat('* ' + me + ' ' + t); return true; }
      case 'list': case 'online': { const on = this.online(); this.tell(s, 'Online (' + on.length + '): ' + on.map(p => (this.isAdmin(p.name) ? '★' : '') + p.name).join(', ')); return true; }
      case 'seen': {
        const q = a[0]; if (!q) return this.tell(s, 'Használat: /seen <játékos>', true), true; const on = this.find(q); if (on) return this.tell(s, on.name + ' most online van.'), true;
        const tn = this.known(q); if (!tn) return this.tell(s, 'Ismeretlen játékos.', true), true; const t = this.d.seen[key(tn)]; this.tell(s, tn + ' utoljára ' + (t ? fmtTime((Date.now() - t) / 1000) + ' perce látták' : 'régen volt itt')); return true;
      }
      case 'playtime': case 'ido': { this.tell(s, 'Játékidőd a szerveren: ' + fmtTime(this.d.play[key(me)] || 0)); return true; }
      case 'rules': case 'szabalyok': { this.tell(s, '— Szabályok —'); for (const l of SMP.rules) this.tell(s, l); return true; }
      // ----- moderáció -----
      case 'broadcast': case 'bc': case 'say': { if (!this.needAdmin(s)) return true; const t = a.join(' ').slice(0, 200); if (!t) return this.tell(s, 'Használat: /broadcast <szöveg>', true), true; net.sysChat('[Közlemény] ' + t); return true; }
      case 'kick': {
        if (!this.needAdmin(s)) return true; const t = this.target(s, a[0]); if (!t) return true; if (t.me || this.isAdmin(t.name) && !s.me) return this.tell(s, 'Őt nem rúghatod ki.', true), true;
        net.sendTo(t.cid, { t: 'deny', m: 'Kirúgtak a szerverről' + (a[1] ? ': ' + a.slice(1).join(' ') : '.') }); setTimeout(() => net.kick(t.cid), 150); this.tell(s, t.name + ' kirúgva.'); return true;
      }
      case 'ban': {
        if (!this.needAdmin(s)) return true; const tn = this.find(a[0]) ? this.find(a[0]).name : this.known(a[0]); if (!tn) return this.tell(s, 'Ismeretlen játékos.', true), true; if (this.isAdmin(tn)) return this.tell(s, 'Adminisztrátort nem tilthatsz ki.', true), true;
        this.d.bans[key(tn)] = { by: me, reason: a.slice(1).join(' '), t: Date.now() }; const p = this.find(tn); if (p && !p.me) { net.sendTo(p.cid, { t: 'deny', m: 'Ki lettél tiltva. ' + a.slice(1).join(' ') }); setTimeout(() => net.kick(p.cid), 150); } this.tell(s, tn + ' kitiltva.'); return true;
      }
      case 'unban': case 'pardon': { if (!this.needAdmin(s)) return true; const k = key(a[0]); if (!this.d.bans[k]) return this.tell(s, 'Nincs ilyen kitiltás.', true), true; delete this.d.bans[k]; this.tell(s, 'Kitiltás feloldva: ' + a[0]); return true; }
      case 'banlist': { if (!this.needAdmin(s)) return true; const b = Object.keys(this.d.bans); this.tell(s, b.length ? 'Kitiltottak: ' + b.join(', ') : 'Nincs kitiltott játékos.'); return true; }
      case 'mute': { if (!this.needAdmin(s)) return true; const tn = this.find(a[0]) ? this.find(a[0]).name : this.known(a[0]); if (!tn || this.isAdmin(tn)) return this.tell(s, 'Ezt a játékost nem némíthatod.', true), true; const m = +a[1]; this.d.mutes[key(tn)] = m > 0 ? Date.now() + m * 60000 : 0; this.tell(s, tn + ' némítva' + (m > 0 ? ' ' + m + ' percre.' : '.')); this.tellName(tn, 'Némítva lettél.'); return true; }
      case 'unmute': { if (!this.needAdmin(s)) return true; const k = key(a[0]); if (this.d.mutes[k] === undefined) return this.tell(s, 'Nincs némítva.', true), true; delete this.d.mutes[k]; this.tell(s, 'Némítás feloldva.'); return true; }
      case 'ad': {
        const k = key(me); if (this.isAdmin(me)) return this.tell(s, 'Már admin vagy.'), true;
        const f = this.adFail = this.adFail || new Map(), st = f.get(k) || { n: 0, until: 0 };
        if (Date.now() < st.until) return this.tell(s, 'Túl sok próbálkozás. Várj ' + Math.ceil((st.until - Date.now()) / 60000) + ' percet.', true), true;
        if (!this.d.adminHash || !a[0] || hash('ad:' + a[0]) !== this.d.adminHash) {
          st.n++; if (st.n >= 3) { st.n = 0; st.until = Date.now() + 10 * 60000; } f.set(k, st);
          this.g.chatAdd('', '⚠ ' + me + ' rossz admin kódot próbált.', true); return this.tell(s, 'Hibás kód.', true), true;
        }
        f.delete(k); if (!this.d.ops.includes(k)) this.d.ops.push(k);
        this.tell(s, 'Admin jogot kaptál!'); this.g.chatAdd('', '★ ' + me + ' admin lett (/ad).', true); for (const p of this.online()) this.pushSb(p.name); return true;
      }
      case 'op': case 'deop': {
        if (!this.needHost(s)) return true; const tn = this.find(a[0]) ? this.find(a[0]).name : this.known(a[0]); if (!tn) return this.tell(s, 'Ismeretlen játékos.', true), true; const k = key(tn);
        if (cmd === 'op') { if (!this.d.ops.includes(k)) this.d.ops.push(k); } else this.d.ops = this.d.ops.filter(x => x !== k);
        this.tell(s, tn + (cmd === 'op' ? ' admin lett.' : ' már nem admin.')); this.tellName(tn, cmd === 'op' ? 'Admin jogot kaptál!' : 'Az admin jogod megszűnt.'); for (const p of this.online()) this.pushSb(p.name);
        if (cmd === 'deop') { const p = this.find(tn); if (p && !p.me) net.sendTo(p.cid, { t: 'gm', c: 0 }); } return true;
      }
      case 'time': case 'gamerule': case 'difficulty': {
        if (!this.needAdmin(s)) return true; const ok = g.runBlockCommand(cmd + ' ' + a.join(' '), 0, 0, 0);
        this.tell(s, ok ? 'Kész: /' + cmd + ' ' + a.join(' ') : 'Hibás használat. Pl.: /time set day · /gamerule pvp false · /difficulty hard', !ok); return true;
      }
      case 'setspawn': { if (!this.needAdmin(s)) return true; const p = this.posOf(me); g.spawn = p.map(v => +v.toFixed(1)); net.bcast({ t: 'spawn', p: g.spawn }); this.tell(s, 'A világ spawn pontja beállítva.'); return true; }
      case 'protect': {
        if (!this.needHost(s)) return true; const r = Math.floor(+a[0]); if (!(r >= 0 && r <= 500)) return this.tell(s, 'Használat: /protect <sugár 0–500> (aktuális: ' + this.d.protect + ')', true), true;
        this.d.protect = r; for (const p of this.online()) this.pushSb(p.name); this.tell(s, 'Spawn védelem sugara: ' + r + ' blokk' + (r ? '' : ' (kikapcsolva)')); return true;
      }
      case 'plugins': case 'pl': { const pl = this.g.plugins; if (!pl || !pl.list.length) return this.tell(s, 'Nincs betöltött plugin.'), true; this.tell(s, 'Pluginok (' + pl.list.length + '): ' + pl.list.map(p => p.name + (p.version ? ' v' + p.version : '')).join(', ')); const own = [...pl.cmds].filter(([, c]) => !c.admin || this.isAdmin(me)).map(([n]) => (n[0] === '/' ? '/' : '/') + n).join(' '); if (own) this.tell(s, 'Plugin parancsok: ' + own); return true; }
    }
    if (this.g.plugins && this.g.plugins.run(s, cmd, a)) return true;
    return false;
  }
}

export const SMP_HOST_CMDS = new Set(['bal', 'balance', 'money', 'egyenleg', 'baltop', 'top', 'pay', 'fizet', 'daily', 'napi', 'kit', 'give', 'tpa', 'tpahere', 'tpaccept', 'tpyes', 'tpelfogad', 'tpdeny', 'tpno', 'tputasit', 'tpcancel', 'sethome', 'home', 'otthon', 'delhome', 'homes', 'spawn', 'setwarp', 'delwarp', 'warps', 'warp', 'back', 'rtp', 'randomtp', 'msg', 'w', 'tell', 'pm', 'r', 'reply', 'me', 'list', 'online', 'seen', 'playtime', 'ido', 'rules', 'szabalyok', 'broadcast', 'bc', 'say', 'kick', 'ban', 'unban', 'pardon', 'banlist', 'mute', 'unmute', 'op', 'deop', 'protect', 'ad', 'time', 'gamerule', 'difficulty', 'setspawn', 'plugins', 'pl']);
