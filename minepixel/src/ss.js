// MinePixelSS – kapcsolódás a közös szerverekhez (ht.<név>.gg címek feloldása a gateway-en keresztül)
export const SS = {
  // A MinePixelSS gateway nyilvános címe. Ide írd a saját gateway-ed címét, hogy a játékosoknak ne kelljen beírniuk.
  defaultGateway: '',
};
export const gw = { url: '' };
// 'host:port' / 'ws://host:port' / 'wss://host' -> websocket cím
export function normGateway(v) {
  v = String(v || '').trim(); if (!v) return '';
  if (/^wss?:\/\//i.test(v)) return v.replace(/\/+$/, '');
  return 'ws://' + (/:\d+$/.test(v) ? v : v + ':8787');
}
export const setGateway = v => { gw.url = normGateway(v || SS.defaultGateway); };
// ht.legend.gg  |  legend.gg  ->  'legend' (különben null)
export const parseSsName = s => { const m = String(s || '').trim().match(/^(?:ht\.)?([a-z0-9]{3,20})\.gg$/i); return m ? m[1].toLowerCase() : null; };
