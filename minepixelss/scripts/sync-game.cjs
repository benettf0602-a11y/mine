// A MinePixel játék fájljainak másolása a ./game mappába (a szerver-ablakok ezt töltik be).
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..', 'minepixel'), dst = path.join(__dirname, '..', 'game');
if (!fs.existsSync(path.join(src, 'index.html'))) { if (fs.existsSync(path.join(dst, 'index.html'))) { console.log('sync: a ../minepixel nem található, a meglévő game/ mappát használom.'); process.exit(0); } console.error('Hiba: a ../minepixel mappa nem található (a MinePixelSS mellett kell lennie).'); process.exit(1); }
fs.rmSync(dst, { recursive: true, force: true }); fs.mkdirSync(dst, { recursive: true });
for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(src, f), path.join(dst, f));
for (const d of ['src', 'vendor', 'server']) fs.cpSync(path.join(src, d), path.join(dst, d), { recursive: true });
console.log('sync: game/ frissítve.');
