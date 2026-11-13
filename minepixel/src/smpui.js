// MinePixel SMP – felület: oldalsáv (név, pénz) és bolt
import { catalog, sellPrice, itemName, fmt, fmtTime, SMP } from './smp.js';
import { iconURL } from './textures.js';

const $ = id => document.getElementById(id);

export function renderSidebar(game) {
  const e = $('sidebar'); if (!e) return;
  if (!game.smpMode || game.state !== 'play') { e.classList.add('hidden'); return; }
  const me = game.smp.me, on = game.net.active ? game.net.count() : 1;
  e.classList.remove('hidden');
  $('sb-name').textContent = game.net.myName || '';
  $('sb-bal').textContent = fmt(me.bal);
  $('sb-rank').textContent = me.rank === 'admin' ? 'Admin' : 'Játékos'; $('sb-rank').className = me.rank === 'admin' ? 'gold' : '';
  $('sb-on').textContent = on; $('sb-time').textContent = fmtTime(me.play || 0);
  $('sb-dim').textContent = { overworld: 'Felvilág', nether: 'Nether', end: 'Vég' }[game.dim] || game.dim;
  const sb = $('shop-bal'); if (sb) sb.textContent = fmt(me.bal);
}

export function initShop(game, api) {
  const st = { tab: 'buy', cat: 0, qty: 1, q: '' };
  const cats = () => catalog().cats;
  const msg = (text, ok) => { const e = $('shop-msg'); e.textContent = text || ''; e.className = 'status ' + (ok ? 'ok' : 'err'); };
  game.onShopReply = (ok, m) => { if ($('shop').classList.contains('hidden')) game.chatAdd('', (ok ? '' : '✖ ') + m, true); else msg(m, ok); renderSidebar(game); if (!$('shop').classList.contains('hidden') && st.tab === 'sell') render(); };

  const card = (e, price, extra, onClick) => {
    const d = document.createElement('div'); d.className = 'si';
    const img = document.createElement('img'); img.src = iconURL(e.id); img.width = 32; img.height = 32; d.appendChild(img);
    const t = document.createElement('div'); t.className = 'sn'; t.textContent = itemName(e.id) + (extra || ''); d.appendChild(t);
    const p = document.createElement('div'); p.className = 'sp'; p.textContent = fmt(price) + (st.qty > 1 ? ' / db' : ''); d.appendChild(p);
    d.onclick = onClick; return d;
  };
  function inventorySellables() {
    const m = new Map(); for (const s of game.inv.slots) if (s && sellPrice(s.id) > 0 && !(s.d > 0)) m.set(s.id, (m.get(s.id) || 0) + s.n);
    return [...m].map(([id, n]) => ({ id, n }));
  }
  function render() {
    const bal = $('shop-bal'); bal.textContent = fmt(game.smp.me.bal);
    for (const b of document.querySelectorAll('[data-st]')) b.classList.toggle('on', b.dataset.st === st.tab);
    for (const b of document.querySelectorAll('[data-qty]')) b.classList.toggle('on', +b.dataset.qty === st.qty);
    const cl = $('shop-cats'), grid = $('shop-grid'); cl.innerHTML = ''; grid.innerHTML = '';
    $('shop-sellbtns').classList.toggle('hidden', st.tab !== 'sell');
    const q = st.q.trim().toLowerCase();
    if (st.tab === 'buy') {
      cats().forEach((c, i) => { const b = document.createElement('button'); b.className = 'btn small' + (i === st.cat && !q ? ' on' : ''); b.textContent = c.name; b.onclick = () => { st.cat = i; st.q = ''; $('shop-q').value = ''; render(); }; cl.appendChild(b); });
      const items = q ? [...catalog().by.values()].filter(e => e.buy > 0 && itemName(e.id).toLowerCase().includes(q)) : (cats()[st.cat] ? cats()[st.cat].items : []);
      for (const e of items) if (e.buy > 0) grid.appendChild(card(e, e.buy, '', () => { api.buy(e.id, st.qty); }));
      if (!items.length) grid.innerHTML = '<div class="empty">Nincs találat.</div>';
    } else {
      const l = inventorySellables().filter(e => !q || itemName(e.id).toLowerCase().includes(q));
      cl.innerHTML = '<div class="hint">Kattints egy tárgyra az eladáshoz (a kiválasztott mennyiség szerint).</div>';
      for (const e of l) grid.appendChild(card(e, sellPrice(e.id), '  ×' + e.n, () => { api.sell([[e.id, Math.min(st.qty, e.n)]]); }));
      if (!l.length) grid.innerHTML = '<div class="empty">Nincs eladható tárgy az inventáradban.</div>';
    }
  }
  for (const b of document.querySelectorAll('[data-st]')) b.onclick = () => { st.tab = b.dataset.st; msg(''); render(); };
  for (const b of document.querySelectorAll('[data-qty]')) b.onclick = () => { st.qty = +b.dataset.qty; render(); };
  $('shop-q').addEventListener('input', e => { st.q = e.target.value; render(); });
  $('shop-q').addEventListener('keydown', e => e.stopPropagation());
  $('shop-sell-hand').onclick = () => { const s = game.inv.slots[game.player.hot]; if (!s || sellPrice(s.id) <= 0 || s.d > 0) return msg('A kezedben lévő tárgyat nem veszi meg a bolt.'); api.sell([[s.id, s.n]]); };
  $('shop-sell-all').onclick = () => { const l = inventorySellables().map(e => [e.id, e.n]); if (!l.length) return msg('Nincs eladható tárgyad.'); api.sell(l); };
  return { open() { st.q = ''; $('shop-q').value = ''; msg(''); render(); }, render };
}
