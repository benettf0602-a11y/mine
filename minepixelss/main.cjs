// MinePixelSS – szerver-készítő és kezelő (Aternos-szerű). Minden szerver a MinePixel játék motorját futtatja egy rejtett ablakban.
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');

const GAME = path.join(__dirname, 'game');
const dd = () => app.getPath('userData');
const readJson = (n, d) => { try { return JSON.parse(fs.readFileSync(path.join(dd(), n), 'utf8')); } catch { return d; } };
const writeJson = (n, o) => { fs.mkdirSync(dd(), { recursive: true }); const f = path.join(dd(), n); fs.writeFileSync(f + '.tmp', JSON.stringify(o, null, 1)); fs.renameSync(f + '.tmp', f); };

let panel = null, relay = null, relayErr = '';
let servers = [], settings = { port: 8787, gateway: '', prefix: 'ht', domain: 'gg' };
const runtime = new Map();            // id -> {win, state, players, log, startedAt, emptySince, fps, err}
const confByWc = new Map(), idByWc = new Map();

// ---------------- mentések (a játék ugyanazt az API-t használja, mint az önálló MinePixel) ----------------
const saveDir = () => path.join(dd(), 'saves');
const sid = id => String(id).replace(/[^\w-]/g, '');
const savePath = id => path.join(saveDir(), sid(id) + '.json'), bakDir = id => path.join(saveDir(), 'backups', sid(id));
const BAK_KEEP = 8, BAK_EVERY = 5 * 60 * 1000;
function listBackups(id) { try { return fs.readdirSync(bakDir(id)).filter(f => f.endsWith('.json')).map(f => ({ stamp: f.slice(0, -5), time: +f.slice(0, -5) || 0, size: fs.statSync(path.join(bakDir(id), f)).size })).sort((a, b) => b.time - a.time); } catch { return []; } }
ipcMain.handle('save:list', () => { fs.mkdirSync(saveDir(), { recursive: true }); return fs.readdirSync(saveDir()).filter(f => f.endsWith('.json')).map(f => ({ id: f.slice(0, -5) })); });
ipcMain.handle('save:read', (e, id) => { try { return JSON.parse(fs.readFileSync(savePath(id), 'utf8')); } catch {} for (const b of listBackups(id)) { try { return JSON.parse(fs.readFileSync(path.join(bakDir(id), b.stamp + '.json'), 'utf8')); } catch {} } return null; });
ipcMain.handle('save:write', (e, id, data) => {
  fs.mkdirSync(saveDir(), { recursive: true }); const f = savePath(id);
  try { if (fs.existsSync(f)) { const bl = listBackups(id); if (!bl.length || Date.now() - bl[0].time > BAK_EVERY) { fs.mkdirSync(bakDir(id), { recursive: true }); fs.copyFileSync(f, path.join(bakDir(id), Date.now() + '.json')); for (const o of listBackups(id).slice(BAK_KEEP)) { try { fs.unlinkSync(path.join(bakDir(id), o.stamp + '.json')); } catch {} } } } } catch (err) { console.warn('backup', err); }
  fs.writeFileSync(f + '.tmp', JSON.stringify(data)); fs.renameSync(f + '.tmp', f); return true;
});
ipcMain.handle('save:backups', (e, id) => listBackups(id));
ipcMain.handle('save:restore', (e, id, stamp) => restoreBackup(id, stamp));
ipcMain.handle('save:delete', (e, id) => { try { fs.unlinkSync(savePath(id)); } catch {} try { fs.rmSync(bakDir(id), { recursive: true, force: true }); } catch {} return true; });
function restoreBackup(id, stamp) {
  try { const src = path.join(bakDir(id), String(stamp).replace(/[^\d]/g, '') + '.json'); if (!fs.existsSync(src)) return false; JSON.parse(fs.readFileSync(src, 'utf8'));
    if (fs.existsSync(savePath(id))) { fs.mkdirSync(bakDir(id), { recursive: true }); fs.copyFileSync(savePath(id), path.join(bakDir(id), Date.now() + '.json')); }
    fs.copyFileSync(src, savePath(id)); return true; } catch { return false; }
}

// ---------------- szerverek ----------------
const pluginDir = id => path.join(dd(), 'servers', sid(id), 'plugins');
const slugOf = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const RESERVED = new Set(['smp', 'minepixel', 'admin', 'server', 'szerver', 'test', 'localhost']);
const seedOf = s => { s = String(s ?? '').trim(); if (!s) return Math.floor(Math.random() * 2e9); if (/^-?\d+$/.test(s)) return +s | 0; let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h | 0; };
const addressOf = sv => `${settings.prefix}.${sv.slug}.${settings.domain}`;
function loadAll() {
  servers = readJson('servers.json', []); settings = Object.assign(settings, readJson('settings.json', {}));
  for (const sv of servers) { sv.disabledPlugins = sv.disabledPlugins || []; }
}
const saveServers = () => writeJson('servers.json', servers);
const find = id => servers.find(s => s.id === id);
function pluginFiles(id) { try { return fs.readdirSync(pluginDir(id)).filter(f => f.endsWith('.js')); } catch { return []; } }
function confOf(sv) {
  const plugins = []; for (const f of pluginFiles(sv.id)) if (!sv.disabledPlugins.includes(f)) { try { plugins.push({ file: f, code: fs.readFileSync(path.join(pluginDir(sv.id), f), 'utf8') }); } catch {} }
  return { id: sv.id, name: sv.name, slug: sv.slug, room: sv.slug.toUpperCase(), seed: sv.seed, diff: sv.diff, smp: sv.smp !== false, adminCode: sv.adminCode || '', maxPlayers: sv.maxPlayers, protect: sv.protect, rules: sv.rules, worldedit: sv.worldedit !== false, plugins, relay: 'ws://127.0.0.1:' + settings.port, key: sv.key, address: addressOf(sv), hostName: 'Konzol' };
}
function snapshot(sv) {
  const rt = runtime.get(sv.id);
  return { ...sv, address: addressOf(sv), state: rt ? rt.state : 'offline', players: rt ? rt.players : [], uptime: rt && rt.state === 'online' ? Math.floor((Date.now() - rt.startedAt) / 1000) : 0, fps: rt ? rt.fps : 0, err: rt ? rt.err : (sv.lastErr || '') };
}
const push = id => { const sv = find(id); if (sv && panel && !panel.isDestroyed()) panel.webContents.send('p:event', { type: 'server', server: snapshot(sv) }); };
const pushLog = (id, lines) => { if (lines.length && panel && !panel.isDestroyed()) panel.webContents.send('p:event', { type: 'log', id, lines }); };

// ---------------- gateway (a beépített relay) ----------------
function startGateway() {
  stopGateway(); relayErr = '';
  try {
    const { createRelay } = require(path.join(GAME, 'server', 'relay.cjs'));
    relay = createRelay(settings.port, '0.0.0.0', { requireReserved: true, maxClients: 40 });
    relay.wss.on('error', e => { relayErr = e.code === 'EADDRINUSE' ? 'A ' + settings.port + '-es port foglalt.' : String(e.message); relay = null; panelInfo(); });
    for (const sv of servers) relay.reserved.set(sv.slug.toUpperCase(), sv.key);
  } catch (e) { relayErr = String(e.message); relay = null; }
  panelInfo();
}
function stopGateway() { if (relay) { try { relay.close(); } catch {} relay = null; } }
const lanIps = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
const info = () => ({ gateway: { running: !!relay, port: settings.port, error: relayErr }, ips: lanIps(), publicGateway: settings.gateway, prefix: settings.prefix, domain: settings.domain, dataDir: dd(), version: app.getVersion() });
const panelInfo = () => { if (panel && !panel.isDestroyed()) panel.webContents.send('p:event', { type: 'info', info: info() }); };

// ---------------- szerver futtatása ----------------
function startServer(id) {
  const sv = find(id); if (!sv || runtime.has(id)) return false;
  if (!fs.existsSync(path.join(GAME, 'index.html'))) { sv.lastErr = 'Hiányzik a game/ mappa (npm run sync).'; push(id); return false; }
  if (!relay) startGateway(); if (!relay) { sv.lastErr = 'A gateway nem indult el: ' + relayErr; push(id); return false; }
  sv.lastErr = ''; relay.reserved.set(sv.slug.toUpperCase(), sv.key);
  const win = new BrowserWindow({ show: false, width: 640, height: 360, webPreferences: { preload: path.join(__dirname, 'preload-server.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const rt = { win, state: 'starting', players: [], log: [], startedAt: Date.now(), emptySince: null, fps: 0, err: '' };
  runtime.set(id, rt); confByWc.set(win.webContents.id, confOf(sv)); idByWc.set(win.webContents.id, id);
  const wcid = win.webContents.id;
  win.on('closed', () => { const r = runtime.get(id); confByWc.delete(wcid); idByWc.delete(wcid); if (r && r.win === win) { const crashed = r.state !== 'stopping'; runtime.delete(id); if (crashed) sv.lastErr = r.err || 'A szerver leállt (váratlanul).'; push(id); } });
  win.webContents.on('render-process-gone', (e, d) => { rt.err = 'A szerver összeomlott (' + d.reason + ').'; try { win.destroy(); } catch {} });
  rt.startTimer = setTimeout(() => { if (rt.state === 'starting') { rt.err = 'Időtúllépés az indításkor.'; try { win.destroy(); } catch {} } }, 180000);
  win.loadFile(path.join(GAME, 'index.html')); push(id); return true;
}
function finishServer(id) { const rt = runtime.get(id); if (!rt) return; clearTimeout(rt.killT); clearTimeout(rt.startTimer); try { rt.win.destroy(); } catch {} runtime.delete(id); push(id); }
function stopServer(id) {
  const rt = runtime.get(id); if (!rt || rt.state === 'stopping') return; rt.state = 'stopping'; push(id);
  try { rt.win.webContents.send('ss:stop'); } catch {} rt.killT = setTimeout(() => finishServer(id), 15000);
}
ipcMain.on('ss:conf', e => { e.returnValue = confByWc.get(e.sender.id) || null; });
ipcMain.on('ss:report', (e, m) => {
  const id = idByWc.get(e.sender.id), rt = id && runtime.get(id); if (!rt || !m) return;
  if (rt.state !== 'stopping') { if (m.state === 'online' && rt.state !== 'online') { rt.state = 'online'; rt.startedAt = Date.now(); clearTimeout(rt.startTimer); } else if (m.state === 'error') { rt.err = m.err || 'Hiba'; rt.state = 'error'; } }
  rt.players = Array.isArray(m.players) ? m.players : []; rt.fps = m.fps || 0;
  if (rt.players.length) rt.emptySince = null; else if (!rt.emptySince) rt.emptySince = Date.now();
  if (Array.isArray(m.logs) && m.logs.length) { rt.log.push(...m.logs); if (rt.log.length > 1500) rt.log.splice(0, 500); pushLog(id, m.logs); }
  push(id);
});
ipcMain.on('ss:stopped', e => { const id = idByWc.get(e.sender.id); if (id) finishServer(id); });
setInterval(() => { for (const [id, rt] of runtime) { const sv = find(id); if (sv && sv.autoStop > 0 && rt.state === 'online' && rt.emptySince && Date.now() - rt.emptySince > sv.autoStop * 60000) { pushLog(id, ['[MinePixelSS] A szerver üres, ' + sv.autoStop + ' perc után leáll.']); stopServer(id); } } }, 30000);

// ---------------- panel IPC ----------------
const H = (n, f) => ipcMain.handle(n, (e, ...a) => f(...a));
H('p:list', () => ({ servers: servers.map(snapshot), settings, info: info() }));
H('p:info', () => info());
H('p:settings', () => settings);
H('p:setSettings', s => {
  const old = settings.port; settings = { port: Math.max(1024, Math.min(65535, +s.port || 8787)), gateway: String(s.gateway || '').trim(), prefix: slugOf(s.prefix) || 'ht', domain: slugOf(s.domain) || 'gg' };
  writeJson('settings.json', settings); if (settings.port !== old) { if (runtime.size) return { ok: false, error: 'A port módosításához állítsd le a szervereket.', settings }; startGateway(); }
  for (const sv of servers) push(sv.id); panelInfo(); return { ok: true, settings };
});
H('p:create', c => {
  const name = String(c.name || '').trim().slice(0, 24), slug = slugOf(name);
  if (name.length < 3 || slug.length < 3) return { ok: false, error: 'A név legalább 3 betű/szám legyen.' };
  if (slug.length > 20) return { ok: false, error: 'A név legfeljebb 20 betű/szám lehet.' };
  if (RESERVED.has(slug) || servers.some(s => s.slug === slug)) return { ok: false, error: 'Ez a szervernév már foglalt.' };
  const sv = { id: crypto.randomBytes(5).toString('hex'), name, slug, key: crypto.randomBytes(12).toString('hex'), seed: seedOf(c.seed), seedText: String(c.seed || ''), diff: [0, 1, 2, 3].includes(+c.diff) ? +c.diff : 2, smp: c.smp !== false, adminCode: String(c.adminCode || '').trim().slice(0, 32), maxPlayers: Math.max(1, Math.min(40, +c.maxPlayers || 10)), protect: 12, autoStop: 0, worldedit: true, disabledPlugins: [], rules: { pvp: true, mobGriefing: true, doMobSpawning: true, keepInventory: false, doDaylightCycle: true, fallDamage: true }, created: Date.now() };
  servers.push(sv); saveServers(); fs.mkdirSync(pluginDir(sv.id), { recursive: true }); if (relay) relay.reserved.set(sv.slug.toUpperCase(), sv.key); return { ok: true, server: snapshot(sv) };
});
H('p:update', (id, patch) => {
  const sv = find(id); if (!sv) return { ok: false, error: 'Nincs ilyen szerver.' }; const live = runtime.has(id);
  const P = patch || {};
  if ('diff' in P) sv.diff = [0, 1, 2, 3].includes(+P.diff) ? +P.diff : sv.diff;
  if ('maxPlayers' in P) sv.maxPlayers = Math.max(1, Math.min(40, +P.maxPlayers || 10));
  if ('adminCode' in P) sv.adminCode = String(P.adminCode || '').trim().slice(0, 32);
  if ('protect' in P) sv.protect = Math.max(0, Math.min(500, +P.protect || 0));
  if ('autoStop' in P) sv.autoStop = Math.max(0, Math.min(600, +P.autoStop || 0));
  if ('worldedit' in P) sv.worldedit = !!P.worldedit; if ('smp' in P) sv.smp = !!P.smp;
  if (P.rules) for (const k of Object.keys(sv.rules)) if (k in P.rules) sv.rules[k] = !!P.rules[k];
  saveServers(); push(id); return { ok: true, restart: live };
});
H('p:remove', id => { if (runtime.has(id)) return { ok: false, error: 'Előbb állítsd le a szervert.' }; const sv = find(id); if (!sv) return { ok: false }; servers = servers.filter(s => s.id !== id); saveServers(); if (relay) relay.reserved.delete(sv.slug.toUpperCase()); try { fs.unlinkSync(savePath('ss_' + id)); } catch {} try { fs.rmSync(bakDir('ss_' + id), { recursive: true, force: true }); } catch {} try { fs.rmSync(path.join(dd(), 'servers', sid(id)), { recursive: true, force: true }); } catch {} return { ok: true }; });
H('p:start', id => ({ ok: startServer(id) })); H('p:stop', id => { stopServer(id); return { ok: true }; });
H('p:cmd', (id, l) => { const rt = runtime.get(id); if (!rt || rt.state !== 'online') return { ok: false }; rt.win.webContents.send('ss:cmd', String(l || '').slice(0, 300)); return { ok: true }; });
H('p:say', (id, t) => { const rt = runtime.get(id); if (!rt || rt.state !== 'online') return { ok: false }; rt.win.webContents.send('ss:say', String(t || '').slice(0, 200)); return { ok: true }; });
H('p:logs', id => { const rt = runtime.get(id); return rt ? rt.log.slice(-400) : []; });
H('p:backups', id => listBackups('ss_' + id)); H('p:restore', (id, stamp) => runtime.has(id) ? { ok: false, error: 'Előbb állítsd le a szervert.' } : { ok: restoreBackup('ss_' + id, stamp) });
H('p:plugins', id => { const sv = find(id); if (!sv) return []; return [{ file: 'WorldEdit (beépített)', builtin: true, enabled: sv.worldedit !== false }, ...pluginFiles(id).map(f => ({ file: f, enabled: !sv.disabledPlugins.includes(f), size: fs.statSync(path.join(pluginDir(id), f)).size }))]; });
H('p:togglePlugin', (id, f, on) => { const sv = find(id); if (!sv) return false; if (f.startsWith('WorldEdit')) sv.worldedit = !!on; else sv.disabledPlugins = on ? sv.disabledPlugins.filter(x => x !== f) : [...new Set([...sv.disabledPlugins, f])]; saveServers(); push(id); return true; });
H('p:addPlugin', async id => { const r = await dialog.showOpenDialog(panel, { title: 'Plugin kiválasztása', filters: [{ name: 'MinePixel plugin', extensions: ['js'] }], properties: ['openFile', 'multiSelections'] }); if (r.canceled) return 0; fs.mkdirSync(pluginDir(id), { recursive: true }); for (const f of r.filePaths) fs.copyFileSync(f, path.join(pluginDir(id), path.basename(f))); return r.filePaths.length; });
H('p:removePlugin', (id, f) => { try { fs.unlinkSync(path.join(pluginDir(id), path.basename(f))); return true; } catch { return false; } });
H('p:samplePlugin', id => { fs.mkdirSync(pluginDir(id), { recursive: true }); fs.copyFileSync(path.join(__dirname, 'sample-plugins', 'example-plugin.js'), path.join(pluginDir(id), 'example-plugin.js')); return true; });
H('p:openPlugins', id => { fs.mkdirSync(pluginDir(id), { recursive: true }); return shell.openPath(pluginDir(id)); });

// ---------------- ablak, életciklus ----------------
function createPanel() {
  panel = new BrowserWindow({ width: 1240, height: 780, minWidth: 980, minHeight: 640, backgroundColor: '#14171c', title: 'MinePixelSS', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload-panel.cjs'), contextIsolation: true, nodeIntegration: false } });
  Menu.setApplicationMenu(null); panel.loadFile(path.join(__dirname, 'panel', 'index.html')); panel.on('close', () => { if (!quitting) app.quit(); }); panel.on('closed', () => { panel = null; });
}
let quitting = false;
app.on('before-quit', e => {
  if (quitting || !runtime.size) { stopGateway(); return; } e.preventDefault(); quitting = true;
  Promise.all([...runtime.keys()].map(id => new Promise(res => { stopServer(id); const t = setInterval(() => { if (!runtime.has(id)) { clearInterval(t); res(); } }, 250); }))).then(() => { stopGateway(); app.quit(); });
});
app.whenReady().then(() => { loadAll(); startGateway(); createPanel(); });
app.on('window-all-closed', () => app.quit());
