// MinePixel relay / beágyazott szerver. Egy "szoba" = egy host + több kliens; a szerver csak továbbít.
// Önálló futtatás: node server/relay.cjs  (PORT környezeti változó, alap: 8787)
const { WebSocketServer } = require('ws');

function createRelay(port, host = '0.0.0.0') {
  const wss = new WebSocketServer({ port, host, maxPayload: 256 * 1024 * 1024 });
  const rooms = new Map(); // kód -> { host, name, clients: Map(cid -> ws) }
  let nextCid = 1;
  const send = (ws, o) => { try { if (ws && ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch {} };

  wss.on('connection', ws => {
    ws.alive = true; ws.on('pong', () => { ws.alive = true; });
    ws.on('message', data => {
      let m; try { m = JSON.parse(data.toString()); } catch { return; }
      const room = ws.room ? rooms.get(ws.room) : null;
      switch (m.t) {
        case 'host': {
          const code = String(m.room || '').slice(0, 24);
          const ex = rooms.get(code);
          if (ex && ex.host && ex.host.readyState === 1) return send(ws, { t: 'error', e: 'room_taken' });
          rooms.set(code, { host: ws, name: String(m.name || '').slice(0, 40), clients: new Map() });
          ws.role = 'host'; ws.room = code; return send(ws, { t: 'hosted' });
        }
        case 'join': {
          const r = rooms.get(String(m.room || ''));
          if (!r) return send(ws, { t: 'error', e: 'no_room' });
          if (r.clients.size >= 7) return send(ws, { t: 'error', e: 'full' });
          const cid = 'c' + (nextCid++);
          ws.role = 'client'; ws.cid = cid; ws.room = String(m.room); r.clients.set(cid, ws);
          send(r.host, { t: 'join', cid, name: String(m.name || 'Játékos').slice(0, 20) });
          return send(ws, { t: 'joined', cid, host: r.name });
        }
        case 'ping': {
          const r = rooms.get(String(m.room || ''));
          return send(ws, { t: 'pong', ok: !!r, name: r ? r.name : '', players: r ? r.clients.size + 1 : 0 });
        }
        case 'to': if (ws.role === 'host' && room) send(room.clients.get(m.cid), { t: 'msg', d: m.d }); return;
        case 'all': if (ws.role === 'host' && room) { const s = JSON.stringify({ t: 'msg', d: m.d }); for (const [cid, c] of room.clients) if (cid !== m.except) send(c, s); } return;
        case 'kick': if (ws.role === 'host' && room) { const c = room.clients.get(m.cid); if (c) { send(c, { t: 'closed', why: 'kick' }); c.close(); } } return;
        case 'msg': if (ws.role === 'client' && room) send(room.host, { t: 'msg', cid: ws.cid, d: m.d }); return;
      }
    });
    ws.on('close', () => {
      const room = ws.room ? rooms.get(ws.room) : null; if (!room) return;
      if (ws.role === 'host') { for (const c of room.clients.values()) { send(c, { t: 'closed', why: 'host' }); c.close(); } rooms.delete(ws.room); }
      else if (ws.role === 'client') { room.clients.delete(ws.cid); send(room.host, { t: 'leave', cid: ws.cid }); }
    });
    ws.on('error', () => {});
  });
  const hb = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch {} } }, 20000);
  wss.on('close', () => clearInterval(hb));
  return { wss, rooms, close: () => new Promise(r => { clearInterval(hb); for (const c of wss.clients) c.terminate(); wss.close(() => r()); }) };
}
module.exports = { createRelay };
if (require.main === module) { const p = +process.env.PORT || 8787; createRelay(p); console.log('MinePixel relay fut a ' + p + ' porton'); }
