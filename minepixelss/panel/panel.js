// MinePixelSS kezelőpanel
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ST = { servers: [], sel: null, tab: 'overview', info: null, settings: null, logs: {}, plugins: [], backups: [] };
const STATE_TXT = { offline: 'Offline', starting: 'Indítás…', online: 'Online', stopping: 'Leállítás…', error: 'Hiba' };
const DIFF = ['Békés', 'Könnyű', 'Normál', 'Nehéz'];
const cur = () => ST.servers.find(s => s.id === ST.sel);
const addr = s => s.address;
let toastT; const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), 2600); };
const fmtUp = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(x).padStart(2, '0'); };
const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Kimásolva: ' + t); } catch { toast(t); } };

async function load() {
  const r = await ss.list(); ST.servers = r.servers; ST.settings = r.settings; ST.info = r.info;
  if (!cur()) ST.sel = ST.servers[0] ? ST.servers[0].id : null;
  renderAll();
}
function renderAll() { renderList(); renderGw(); renderMain(); }

function renderList() {
  const l = $('#list'); l.innerHTML = '';
  for (const s of ST.servers) {
    const d = document.createElement('div'); d.className = 'sv' + (s.id === ST.sel ? ' sel' : '');
    d.innerHTML = `<span class="dot ${s.state}"></span><div><div class="nm">${esc(s.name)}</div><div class="sub">${s.state === 'online' ? s.players.length + ' / ' + s.maxPlayers + ' játékos' : STATE_TXT[s.state]}</div></div>`;
    d.onclick = () => { ST.sel = s.id; ST.tab = 'overview'; renderAll(); }; l.appendChild(d);
  }
  if (!ST.servers.length) l.innerHTML = '<div class="hint" style="padding:6px">Még nincs szervered.</div>';
}
function renderGw() {
  const i = ST.info; if (!i) return; const ok = i.gateway.running;
  $('#gw').innerHTML = `Gateway: <b class="${ok ? 'ok' : 'bad'}">${ok ? 'fut (:' + i.gateway.port + ')' : 'leállt'}</b>${i.gateway.error ? '<br><span class="bad">' + esc(i.gateway.error) + '</span>' : ''}<br>LAN: <span class="mono">${esc(i.ips[0] || '—')}</span>`;
}

function renderMain() {
  const m = $('#main'), s = cur();
  if (!s) { m.innerHTML = `<div class="empty"><h2>Üdv a MinePixelSS-ben!</h2><p>Hozd létre az első szerveredet, és hívd meg a barátaidat.</p><button class="btn green" id="e-new">+ Új szerver</button></div>`; $('#e-new').onclick = openNew; return; }
  m.innerHTML = `
    <div class="head"><div><h1>${esc(s.name)}</h1><div class="chip" id="chip" title="Kattints a másoláshoz">${esc(addr(s))} <small>másolás</small></div></div></div>
    <div class="status" id="status"></div>
    <div class="tabs">${[['overview', 'Áttekintés'], ['console', 'Konzol'], ['players', 'Játékosok'], ['plugins', 'Pluginok'], ['settings', 'Beállítások'], ['backups', 'Mentések']].map(([k, n]) => `<div class="tab${ST.tab === k ? ' on' : ''}" data-t="${k}">${n}</div>`).join('')}</div>
    <div id="tab"></div>`;
  $('#chip').onclick = () => copy(addr(s));
  $$('.tab', m).forEach(t => t.onclick = () => { ST.tab = t.dataset.t; renderMain(); });
  renderStatus(); renderTab();
}
function renderStatus() {
  const s = cur(), e = $('#status'); if (!s || !e) return; const busy = s.state === 'starting' || s.state === 'stopping';
  e.innerHTML = `<div class="big"><span class="dot ${s.state}"></span>${STATE_TXT[s.state]}</div>
    <div class="stat">Játékosok<b>${s.state === 'online' ? s.players.length + ' / ' + s.maxPlayers : '—'}</b></div>
    <div class="stat">Üzemidő<b>${s.state === 'online' ? fmtUp(s.uptime) : '—'}</b></div>
    <div class="stat">Nehézség<b>${DIFF[s.diff]}</b></div>
    ${s.err && s.state !== 'online' ? `<div class="err" style="flex-basis:100%">⚠ ${esc(s.err)}</div>` : ''}
    <div class="go">${s.state === 'offline' || s.state === 'error' ? '<button class="btn green" id="go">▶ Indítás</button>' : `<button class="btn red" id="go" ${busy ? 'disabled' : ''}>■ Leállítás</button>`}</div>`;
  $('#go').onclick = async () => { const r = (s.state === 'offline' || s.state === 'error') ? await ss.start(s.id) : await ss.stop(s.id); if (r && r.ok === false) toast('Nem sikerült.'); };
}
function renderTab() {
  const s = cur(), t = $('#tab'); if (!s || !t) return; ({ overview: tabOverview, console: tabConsole, players: tabPlayers, plugins: tabPlugins, settings: tabSettings, backups: tabBackups })[ST.tab](s, t);
}

function tabOverview(s, t) {
  const gw = ST.settings.gateway || (ST.info.ips[0] ? 'ws://' + ST.info.ips[0] + ':' + ST.settings.port : 'ws://<a-te-gepeed>:' + ST.settings.port);
  const invite = `MinePixel → Barátok → Haladó → Gateway: ${gw}\nMinePixel → Barátok → Csatlakozás: ${s.address}`;
  t.innerHTML = `
    <div class="card"><h3>Hogyan csatlakoznak a barátaid?</h3>
      <ol class="steps"><li>MinePixel → <b>Barátok · Multiplayer</b> → <b>Haladó</b> → Gateway: <code id="o-gw">${esc(gw)}</code> <button class="btn small" id="cp-gw">Másol</button></li>
      <li>A kódmezőbe: <code>${esc(s.address)}</code> → <b>Csatlakozás</b></li></ol>
      <div class="row" style="justify-content:flex-start"><button class="btn" id="cp-inv">Meghívó szöveg másolása</button></div>
      ${ST.settings.gateway ? '' : '<p class="hint">⚠ A <b>Beállítások</b>ban még nincs nyilvános gateway cím – addig csak a helyi hálózaton (LAN) tudnak csatlakozni. Az internetes eléréshez tovább kell engedni a ' + ST.settings.port + '-es portot.</p>'}</div>
    <div class="card"><h3>Szerver adatai</h3><table><tr><td>Világ magja</td><td><span class="mono">${s.seed}</span></td></tr><tr><td>Mód</td><td>${s.smp !== false ? 'SMP (pénz, bolt, otthonok, pluginok)' : 'Alap'}</td></tr><tr><td>Spawn-védelem</td><td>${s.protect} blokk</td></tr><tr><td>Admin kód</td><td>${s.adminCode ? 'beállítva – a játékban: <code>/ad &lt;kód&gt;</code>' : '<span class="err" style="display:inline">nincs beállítva</span> (a Beállításokban add meg)'}</td></tr></table></div>`;
  $('#cp-gw').onclick = () => copy(gw); $('#cp-inv').onclick = () => copy(invite);
}

async function tabConsole(s, t) {
  t.innerHTML = `<div id="console"></div><div class="cmdline"><input id="cmd" placeholder="Parancs (pl. list, time set day, kick Pista, broadcast Szia)…" autocomplete="off" ${s.state === 'online' ? '' : 'disabled'}><button class="btn" id="send" ${s.state === 'online' ? '' : 'disabled'}>Küldés</button><button class="btn green" id="say" ${s.state === 'online' ? '' : 'disabled'}>Üzenet a játékosoknak</button></div>`;
  const c = $('#console'); for (const l of ST.logs[s.id] || await ss.logs(s.id)) addLine(l, c); ST.logs[s.id] = ST.logs[s.id] || []; c.scrollTop = c.scrollHeight;
  const send = async () => { const v = $('#cmd').value.trim(); if (!v) return; $('#cmd').value = ''; await ss.cmd(s.id, v); }, say = async () => { const v = $('#cmd').value.trim(); if (!v) return; $('#cmd').value = ''; await ss.say(s.id, v); };
  $('#send').onclick = send; $('#say').onclick = say; $('#cmd').onkeydown = e => { if (e.key === 'Enter') send(); };
}
function addLine(l, c = $('#console')) { if (!c) return; const d = document.createElement('div'); d.textContent = l; if (/\] > /.test(l)) d.className = 'cmd'; else if (/✖|hiba|Hiba|rossz admin/i.test(l)) d.className = 'warn'; const bottom = c.scrollTop + c.clientHeight >= c.scrollHeight - 30; c.appendChild(d); while (c.childElementCount > 600) c.firstChild.remove(); if (bottom) c.scrollTop = c.scrollHeight; }

function tabPlayers(s, t) {
  if (s.state !== 'online') { t.innerHTML = '<div class="card hint">A szerver nem fut.</div>'; return; }
  t.innerHTML = `<div class="card"><table><tr><th>Játékos</th><th>Pozíció</th><th></th></tr>${s.players.map(p => `<tr><td>${esc(p.name)}${p.admin ? '<span class="badge">admin</span>' : ''}</td><td class="mono">${p.pos ? p.pos.join(', ') : '—'}</td><td class="act"><button class="btn small" data-a="op" data-n="${esc(p.name)}">${p.admin ? 'Admin elvétele' : 'Admin'}</button> <button class="btn small" data-a="kick" data-n="${esc(p.name)}">Kirúg</button> <button class="btn small red" data-a="ban" data-n="${esc(p.name)}">Kitilt</button></td></tr>`).join('') || '<tr><td colspan="3" class="hint">Nincs játékos online.</td></tr>'}</table></div>`;
  $$('[data-a]', t).forEach(b => b.onclick = async () => { const n = b.dataset.n, a = b.dataset.a; const p = s.players.find(x => x.name === n); await ss.cmd(s.id, a === 'op' ? (p && p.admin ? 'deop ' : 'op ') + n : a + ' ' + n); toast('Végrehajtva: ' + a + ' ' + n); });
}

async function tabPlugins(s, t) {
  ST.plugins = await ss.plugins(s.id);
  t.innerHTML = `<div class="card"><h3>Pluginok</h3><table>${ST.plugins.map(p => `<tr><td>${esc(p.file)}${p.builtin ? '<span class="badge">beépített</span>' : ''}</td><td class="hint">${p.size ? Math.ceil(p.size / 1024) + ' KB' : ''}</td><td class="act"><span class="toggle ${p.enabled ? 'on' : ''}" data-f="${esc(p.file)}"></span>${p.builtin ? '' : ` <button class="btn small" data-rm="${esc(p.file)}">Törlés</button>`}</td></tr>`).join('')}</table>
    <div class="row" style="justify-content:flex-start"><button class="btn green" id="p-add">+ Plugin hozzáadása (.js)</button><button class="btn" id="p-open">Mappa megnyitása</button><button class="btn" id="p-sample">Példa plugin</button></div>
    <p class="hint">A plugin-változások a szerver következő indításakor lépnek életbe${s.state === 'online' ? ' (a szerver most fut – indítsd újra)' : ''}. A WorldEdit parancsai: <code>//pos1 //pos2 //set //replace //walls //sphere //cyl //copy //paste //undo</code> (admin). A pluginok teljes hozzáférést kapnak a szerverhez – csak megbízható forrásból telepíts!</p></div>`;
  $$('.toggle', t).forEach(e => e.onclick = async () => { await ss.togglePlugin(s.id, e.dataset.f, !e.classList.contains('on')); tabPlugins(s, t); });
  $$('[data-rm]', t).forEach(b => b.onclick = async () => { if (confirm(b.dataset.rm + ' törlése?')) { await ss.removePlugin(s.id, b.dataset.rm); tabPlugins(s, t); } });
  $('#p-add').onclick = async () => { const n = await ss.addPlugin(s.id); if (n) { toast(n + ' plugin hozzáadva'); tabPlugins(s, t); } };
  $('#p-open').onclick = () => ss.openPlugins(s.id); $('#p-sample').onclick = async () => { await ss.samplePlugin(s.id); toast('Példa plugin hozzáadva'); tabPlugins(s, t); };
}

function tabSettings(s, t) {
  const R = s.rules, rl = [['pvp', 'PvP (játékosok egymás ellen)'], ['mobGriefing', 'Mobok rombolása (creeper)'], ['doMobSpawning', 'Mobok megjelenése'], ['keepInventory', 'Készlet megtartása halálkor'], ['doDaylightCycle', 'Nappal-éjszaka váltakozás'], ['fallDamage', 'Esési sebzés']];
  t.innerHTML = `<div class="card"><h3>Szerver beállításai</h3>
    <div class="two"><label>Nehézség<select id="c-diff">${DIFF.map((d, i) => `<option value="${i}" ${s.diff === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <label>Max. játékos<input id="c-max" type="number" min="1" max="40" value="${s.maxPlayers}"></label></div>
    <div class="two"><label>Admin kód (/ad)<input id="c-code" type="password" value="${esc(s.adminCode || '')}"></label><label>Spawn-védelem sugara (0 = ki)<input id="c-prot" type="number" min="0" max="500" value="${s.protect}"></label></div>
    <label>Automatikus leállás, ha üres (perc, 0 = soha)<input id="c-auto" type="number" min="0" max="600" value="${s.autoStop || 0}"></label>
    <label class="chk"><input type="checkbox" id="c-smp" ${s.smp !== false ? 'checked' : ''}> SMP mód (pénz, bolt, pluginok)</label>
    <div class="rules" style="margin-top:10px">${rl.map(([k, n]) => `<label class="chk"><input type="checkbox" data-r="${k}" ${R[k] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
    <p class="hint">${s.state === 'online' ? 'A módosítások a szerver következő indításakor lépnek életbe.' : 'A módosítások mentése automatikus.'}</p></div>
    <div class="card"><h3>Veszélyes zóna</h3><button class="btn red" id="c-del">Szerver törlése</button> <span class="hint">A világ és a mentések is törlődnek.</span></div>`;
  const save = async () => { await ss.update(s.id, { diff: +$('#c-diff').value, maxPlayers: +$('#c-max').value, adminCode: $('#c-code').value, protect: +$('#c-prot').value, autoStop: +$('#c-auto').value, smp: $('#c-smp').checked, rules: Object.fromEntries($$('[data-r]', t).map(e => [e.dataset.r, e.checked])) }); toast('Mentve'); };
  $$('input,select', t).forEach(e => e.onchange = save);
  $('#c-del').onclick = async () => { if (!confirm('Biztosan törlöd a(z) ' + s.name + ' szervert és a világát?')) return; const r = await ss.remove(s.id); if (r.ok) { ST.sel = null; load(); } else toast(r.error || 'Nem sikerült.'); };
}

async function tabBackups(s, t) {
  ST.backups = await ss.backups(s.id);
  t.innerHTML = `<div class="card"><h3>Automatikus mentések</h3><table><tr><th>Időpont</th><th>Méret</th><th></th></tr>${ST.backups.map(b => `<tr><td>${new Date(b.time).toLocaleString('hu-HU')}</td><td>${(b.size / 1048576).toFixed(2)} MB</td><td class="act"><button class="btn small" data-b="${b.stamp}" ${s.state !== 'offline' ? 'disabled' : ''}>Visszaállítás</button></td></tr>`).join('') || '<tr><td colspan="3" class="hint">Még nincs biztonsági mentés (5 percenként készül).</td></tr>'}</table><p class="hint">Visszaállítani csak leállított szerveren lehet. A jelenlegi állapot is megmarad másolatként.</p></div>`;
  $$('[data-b]', t).forEach(b => b.onclick = async () => { if (!confirm('Visszaállítod ezt a mentést?')) return; const r = await ss.restore(s.id, b.dataset.b); toast(r.ok ? 'Visszaállítva' : (r.error || 'Nem sikerült')); });
}

// ---- párbeszédek ----
const slug = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
function openNew() { $('#f-new').reset(); $('#n-err').textContent = ''; $('#n-addr').textContent = ST.info.prefix + '.….' + ST.info.domain; $('#dlg-new').showModal(); setTimeout(() => $('#n-name').focus(), 50); }
$('#btn-new').onclick = openNew; $('#n-cancel').onclick = () => $('#dlg-new').close();
$('#n-name').oninput = e => { const s = slug(e.target.value); $('#n-addr').textContent = ST.info.prefix + '.' + (s || '…') + '.' + ST.info.domain; };
$('#f-new').onsubmit = async e => {
  e.preventDefault(); const r = await ss.create({ name: $('#n-name').value, seed: $('#n-seed').value, diff: +$('#n-diff').value, maxPlayers: +$('#n-max').value, adminCode: $('#n-code').value, smp: $('#n-smp').checked });
  if (!r.ok) { $('#n-err').textContent = r.error; return; } $('#dlg-new').close(); ST.sel = r.server.id; ST.tab = 'overview'; await load(); toast('Szerver létrehozva: ' + r.server.address);
};
$('#btn-settings').onclick = () => { const s = ST.settings; $('#s-port').value = s.port; $('#s-gw').value = s.gateway; $('#s-prefix').value = s.prefix; $('#s-domain').value = s.domain; $('#s-err').textContent = ''; $('#dlg-set').showModal(); };
$('#s-cancel').onclick = () => $('#dlg-set').close();
$('#f-set').onsubmit = async e => { e.preventDefault(); const r = await ss.setSettings({ port: +$('#s-port').value, gateway: $('#s-gw').value, prefix: $('#s-prefix').value, domain: $('#s-domain').value }); if (!r.ok) { $('#s-err').textContent = r.error; return; } $('#dlg-set').close(); await load(); toast('Beállítások mentve'); };

// ---- események a fő folyamattól ----
ss.onEvent(m => {
  if (m.type === 'info') { ST.info = m.info; renderGw(); return; }
  if (m.type === 'log') { (ST.logs[m.id] = ST.logs[m.id] || []).push(...m.lines); if (ST.logs[m.id].length > 600) ST.logs[m.id].splice(0, 200); if (m.id === ST.sel && ST.tab === 'console') m.lines.forEach(l => addLine(l)); return; }
  if (m.type === 'server') {
    const i = ST.servers.findIndex(s => s.id === m.server.id), prev = i >= 0 ? ST.servers[i] : null; if (i >= 0) ST.servers[i] = m.server; else ST.servers.push(m.server);
    renderList(); if (m.server.id !== ST.sel) return; renderStatus();
    if (ST.tab === 'players') renderTab();
    if (ST.tab === 'console' && prev && prev.state !== m.server.state) renderTab();
  }
});
setInterval(() => { const s = cur(); if (s && s.state === 'online') { s.uptime++; const e = $('#status .stat:nth-of-type(3) b'); if (e) e.textContent = fmtUp(s.uptime); } }, 1000);
load();
