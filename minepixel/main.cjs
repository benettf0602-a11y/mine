const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let relay = null;
const os = require('os');
const saveDir = () => path.join(app.getPath('userData'), 'saves');

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 720, backgroundColor: '#000000', title: 'MinePixel',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('enter-full-screen', () => win.webContents.send('fs', true));
  win.on('leave-full-screen', () => win.webContents.send('fs', false));
}

ipcMain.handle('save:list', () => {
  fs.mkdirSync(saveDir(), { recursive: true });
  return fs.readdirSync(saveDir()).filter(f => f.endsWith('.json')).map(f => {
    try { const j = JSON.parse(fs.readFileSync(path.join(saveDir(), f), 'utf8')); return { id: f.slice(0, -5), name: j.name, mode: j.mode, time: j.time, seed: j.seed }; } catch { return null; }
  }).filter(Boolean).sort((a, b) => b.time - a.time);
});
const sid = id => String(id).replace(/[^\w-]/g, '');
const savePath = id => path.join(saveDir(), sid(id) + '.json');
const bakDir = id => path.join(saveDir(), 'backups', sid(id));
const BAK_KEEP = 5, BAK_EVERY = 5 * 60 * 1000;
function listBackups(id) {
  try { return fs.readdirSync(bakDir(id)).filter(f => f.endsWith('.json')).map(f => ({ stamp: f.slice(0, -5), time: +f.slice(0, -5) || 0, size: fs.statSync(path.join(bakDir(id), f)).size })).sort((a, b) => b.time - a.time); } catch { return []; }
}
ipcMain.handle('save:read', (e, id) => {
  try { return JSON.parse(fs.readFileSync(savePath(id), 'utf8')); } catch {}
  // sérült / hiányzó fájl: az utolsó épp biztonsági mentés
  for (const b of listBackups(id)) { try { return JSON.parse(fs.readFileSync(path.join(bakDir(id), b.stamp + '.json'), 'utf8')); } catch {} }
  return null;
});
ipcMain.handle('save:write', (e, id, data) => {
  fs.mkdirSync(saveDir(), { recursive: true });
  const f = savePath(id), tmp = f + '.tmp';
  // biztonsági mentés: a régi fájlt átmásoljuk (legfeljebb 5 percenként), az utolsó 5-öt tartjuk meg
  try {
    if (fs.existsSync(f)) {
      const bl = listBackups(id);
      if (!bl.length || Date.now() - bl[0].time > BAK_EVERY) {
        fs.mkdirSync(bakDir(id), { recursive: true });
        fs.copyFileSync(f, path.join(bakDir(id), Date.now() + '.json'));
        for (const old of listBackups(id).slice(BAK_KEEP)) { try { fs.unlinkSync(path.join(bakDir(id), old.stamp + '.json')); } catch {} }
      }
    }
  } catch (err) { console.warn('backup', err); }
  // atomikus írás: előbb tmp, aztán átnevezés – áramszünet/összeomlás sem hagy félkész mentést
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, f);
  return true;
});
ipcMain.handle('save:backups', (e, id) => listBackups(id));
ipcMain.handle('save:restore', (e, id, stamp) => {
  try {
    const src = path.join(bakDir(id), String(stamp).replace(/[^\d]/g, '') + '.json'); if (!fs.existsSync(src)) return false;
    JSON.parse(fs.readFileSync(src, 'utf8'));
    // a jelenlegi állapot is megmarad biztonsági másolatként a visszaállítás előtt
    if (fs.existsSync(savePath(id))) { fs.mkdirSync(bakDir(id), { recursive: true }); fs.copyFileSync(savePath(id), path.join(bakDir(id), Date.now() + '.json')); }
    fs.copyFileSync(src, savePath(id)); return true;
  } catch { return false; }
});
ipcMain.handle('save:delete', (e, id) => { try { fs.unlinkSync(savePath(id)); } catch {} try { fs.rmSync(bakDir(id), { recursive: true, force: true }); } catch {} return true; });
ipcMain.on('fullscreen', (e, on) => { if (win) win.setFullScreen(!!on); });
ipcMain.handle('net:start', async (e, port) => {
  try {
    if (!relay) relay = require('./server/relay.cjs').createRelay(port, '0.0.0.0');
    await new Promise((res, rej) => { if (relay.wss.address()) return res(); relay.wss.once('listening', res); relay.wss.once('error', rej); });
    // LAN IP-k: a valódi Wi-Fi / Ethernet címet tesszük előre, a virtuális adaptereket (VirtualBox, Hyper-V, WSL, VPN, Docker...) hátra
    const VIRT = /virtual|vmware|vbox|hyper-v|vethernet|wsl|docker|vpn|tap|tun|tailscale|hamachi|zerotier|loopback|bluetooth|pseudo/i;
    const cand = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) for (const n of list || []) {
      if (n.family !== 'IPv4' || n.internal || /^169\.254\./.test(n.address)) continue;
      let score = 0;
      if (VIRT.test(name)) score += 100;
      if (/^192\.168\.(56|137|99)\./.test(n.address)) score += 50; // VirtualBox host-only / Windows hotspot / VMware
      if (/^192\.168\./.test(n.address)) score += 0; else if (/^10\./.test(n.address)) score += 1; else if (/^172\.(1[6-9]|2\d|3[01])\./.test(n.address)) score += 20; else score += 30;
      if (/wi-?fi|wlan|wireless|ethernet|eth\d|en\d|local area/i.test(name)) score -= 5;
      cand.push({ ip: n.address, score });
    }
    cand.sort((a, b) => a.score - b.score);
    const ips = [...new Set(cand.map(c => c.ip))];
    // Windows tűzfal: best-effort szabály (csak rendszergazdai joggal sikerül, egyébként csendben kihagyjuk)
    if (process.platform === 'win32' && !global.__fwTried) { global.__fwTried = true; try { require('child_process').execFile('netsh', ['advfirewall', 'firewall', 'add', 'rule', 'name=MinePixel Multiplayer', 'dir=in', 'action=allow', 'protocol=TCP', 'localport=' + port, 'profile=any'], { windowsHide: true }, () => {}); } catch {} }
    return { ok: true, port, ips };
  } catch (err) { relay = null; return { ok: false, error: String(err && err.message) }; }
});
ipcMain.handle('net:stop', async () => { if (relay) { const r = relay; relay = null; try { await r.close(); } catch {} } return true; });
ipcMain.on('quit', () => app.quit());

app.whenReady().then(() => { createWindow();
  const shot = process.argv.find(a => a.startsWith('--shot='));
  if (shot) {
    win.webContents.on('console-message', (e, lvl, msg) => { if (lvl >= 2) console.log('RENDERER:', msg); });
    setTimeout(async () => {
      try { await win.webContents.executeJavaScript("window.__mp && window.__mp.startWorld(null,{id:'shot',name:'shot',seed:777,mode:'survival',diff:2})"); } catch (e) { console.log('ERR', e.message); }
      setTimeout(async () => { const img = await win.webContents.capturePage(); fs.writeFileSync(shot.slice(7), img.toPNG()); console.log('SHOT OK'); app.quit(); }, 7000);
    }, 4000);
  } app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
