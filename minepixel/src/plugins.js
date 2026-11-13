// MinePixel pluginrendszer (szerver oldalon, SMP módban fut).
// Plugin formátum (egy .js fájl a szerver plugins mappájában):
//   module.exports = { name: 'Nev', version: '1.0', onEnable(api) { api.command('/hello', { desc: 'Köszön', run(ctx, args) { ctx.tell('Szia ' + ctx.name); } }); }, onDisable() {} };
import { itemDef, BLOCKS } from './blocks.js';
import worldedit from './worldedit.js';

export class Plugins {
  constructor(game) { this.g = game; this.reset(); }
  reset() { for (const p of this.list || []) { try { p.mod.onDisable && p.mod.onDisable(); } catch {} } this.list = []; this.cmds = new Map(); this.ev = new Map(); this.tickAcc = 0; this.logs = []; }
  names() { return [...this.cmds.keys()]; }
  has(cmd) { return this.cmds.has(cmd); }
  log(who, t) { const m = '[' + who + '] ' + t; this.logs.push(m); if (this.g.ssLog) this.g.ssLog(m); else console.log(m); }
  // beépített + külső pluginok betöltése. list: [{file, code}]
  loadAll(list, { worldedit: we = true } = {}) {
    this.reset();
    if (we) this.register(worldedit, 'WorldEdit (beépített)');
    for (const p of list || []) {
      try {
        const module = { exports: {} }; new Function('module', 'exports', p.code)(module, module.exports);
        this.register(module.exports, p.file);
      } catch (e) { this.log('Plugin', p.file + ' betöltése sikertelen: ' + e.message); }
    }
    return this.list.map(p => p.name);
  }
  register(mod, file) {
    if (typeof mod === 'function') mod = { name: file, onEnable: mod };
    const name = String(mod.name || file).slice(0, 40), api = this.makeApi(name);
    try { mod.onEnable && mod.onEnable(api); this.list.push({ name, version: mod.version || '', file, mod }); this.log('Plugin', name + ' betöltve'); }
    catch (e) { this.log('Plugin', name + ' hiba: ' + e.message); }
  }
  makeApi(pname) {
    const g = this.g, smp = g.smp, self = this;
    return {
      name: pname,
      command: (name, def) => { name = String(name).toLowerCase(); self.cmds.set(name, { ...def, plugin: pname }); },
      on: (ev, fn) => { if (!self.ev.has(ev)) self.ev.set(ev, []); self.ev.get(ev).push({ fn, pname }); },
      log: t => self.log(pname, t),
      broadcast: t => g.net.sysChat(String(t)),
      tell: (name, t) => smp.tellName(name, String(t)),
      players: () => smp.online().map(p => ({ name: p.name, admin: smp.isAdmin(p.name), pos: smp.posOf(p.name) })),
      isAdmin: n => smp.isAdmin(n),
      pos: n => smp.posOf(n),
      teleport: (n, p) => smp.tpTo(n, p),
      give: (n, id, c = 1) => { const p = smp.find(n); if (!p) return false; if (p.me) { g.inv.add(id, c); g.refreshHotbar(); } else g.net.sendTo(p.cid, { t: 'give', id, n: c }); return true; },
      getBlock: (x, y, z) => g.world.getBlock(x, y, z),
      setBlock: (x, y, z, id) => g.world.setBlock(x, y, z, id),
      findItem: q => g.findItem(q), itemName: id => (itemDef(id) || {}).name || '#' + id, isBlock: id => !!BLOCKS[id],
      economy: { get: n => smp.bal(n), add: (n, v) => smp.addBal(n, v) },
      storage: {
        get: (k, def) => { const d = (smp.d.plug || {})[pname]; return d && k in d ? d[k] : def; },
        set: (k, v) => { smp.d.plug = smp.d.plug || {}; (smp.d.plug[pname] = smp.d.plug[pname] || {})[k] = v; },
      },
    };
  }
  emit(ev, data) {
    data = data || {}; data.cancelled = false; data.cancel = () => { data.cancelled = true; };
    for (const h of this.ev.get(ev) || []) { try { h.fn(data); } catch (e) { this.log(h.pname, ev + ' esemény hiba: ' + e.message); } }
    return data;
  }
  tick(dt) { this.tickAcc += dt; if (this.tickAcc >= 1) { const d = this.tickAcc; this.tickAcc = 0; if (this.ev.has('tick')) this.emit('tick', { dt: d }); } }
  // parancs futtatása. true, ha plugin-parancs volt
  run(s, cmd, args) {
    const c = this.cmds.get(cmd); if (!c) return false; const smp = this.g.smp;
    if (c.admin && !smp.isAdmin(s.name)) { smp.tell(s, 'Ehhez a parancshoz admin jog kell.', true); return true; }
    const ctx = { name: s.name, admin: smp.isAdmin(s.name), tell: t => smp.tell(s, String(t)), error: t => smp.tell(s, String(t), true), pos: () => smp.posOf(s.name) };
    try { c.run(ctx, args); } catch (e) { smp.tell(s, 'Plugin hiba (' + c.plugin + '): ' + e.message, true); this.log(c.plugin, cmd + ' hiba: ' + e.message); }
    return true;
  }
}
