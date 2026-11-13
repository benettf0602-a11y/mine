# MinePixelSS – MinePixel szerver-készítő

Aternos-szerű kezelőpanel a MinePixel játékhoz: szervereket hozol létre, indítasz és állítasz le, konzolról és plugin-okkal kezeled őket. A szerver a MinePixel játék saját motorját futtatja egy rejtett ablakban, ezért pontosan ugyanaz a világ, mint a játékban (SMP: pénz, bolt, otthonok, /tpa, spawn-védelem, stb.).

## Indítás
A `minepixelss` mappa mellett ott kell lennie a `minepixel` mappának.
```
cd minepixelss
npm install
npm start          # előtte automatikusan átmásolja a játékot a ./game mappába
npm run pack       # Windows-os csomag (dist/)
```

## Hogyan működik a cím (ht.név.gg)?
A `ht.legend.gg` **nem valódi domain**. A MinePixel játék a *gateway* nevű szolgáltatáson keresztül oldja fel: a név a szoba neve, a gateway pedig a MinePixelSS-be épített relay (alapból a 8787-es porton).
- A játékosoknak egyszer meg kell adniuk a gateway címét: **Barátok → Haladó → Gateway**. Ezt kapják tőled (a panel Áttekintés fülén van másolható szöveg).
- Utána elég a kódmezőbe írni: `ht.legend.gg`.
- Helyi hálózaton (LAN) azonnal megy: `ws://<a-gép-IP-je>:8787`.
- Interneten át: a 8787-es portot tovább kell engedni a routeren, vagy a MinePixelSS-t egy nyilvános gépen (VPS) kell futtatni. A nyilvános címet a **Beállítások**ban add meg.
- A nevek csak a te gateway-eden belül egyediek, és csak a MinePixelSS-ben létrehozott szerver nyithatja meg a saját nevét (a relay kulccsal védi).

## Fontos tudnivalók
- A szerver addig fut, amíg a MinePixelSS nyitva van azon a gépen. Ha bezárod a panelt, a szerverek mentés után leállnak.
- Az **Automatikus leállás** beállítással a szerver magától leáll, ha egy ideig üres (Aternos-szerűen). Újraindítani a panelből lehet.
- A világ 90 mp-enként és leálláskor is mentődik, 5 percenként biztonsági mentés készül (Mentések fül).
- Nether/End és nagyon nagy játékos-létszám szerver módban még nincs alaposan tesztelve.

## Adminisztrálás a játékban
- A szerver létrehozásakor megadott **admin kód**: a játékban `/ad <kód>` → admin jog.
- Admin parancsok: `/kick /ban /unban /mute /op /deop /give /bal give /tp /gamemode /time /gamerule /difficulty /setspawn /protect /setwarp /broadcast`
- A konzolról (panel → Konzol) ugyanezek parancsként, `/` nélkül is mennek: `list`, `time set day`, `kick Pista`.

## Pluginok
A szerver `plugins` mappájába (Pluginok fül → *Mappa megnyitása*) tett `.js` fájlok a következő indításkor betöltődnek. Példa: `sample-plugins/example-plugin.js`.
```js
module.exports = { name: 'Nev', version: '1.0',
  onEnable(api) {
    api.on('join', e => api.broadcast('Üdv, ' + e.name + '!'));
    api.command('hello', { desc: 'Köszön', run(ctx, args) { ctx.tell('Szia ' + ctx.name); } });
  } };
```
API: `command, on('join'|'leave'|'chat'|'tick'), broadcast, tell, players, pos, teleport, give, getBlock, setBlock, findItem, economy.get/add, storage.get/set, log`.
**Biztonság:** a pluginok teljes hozzáférést kapnak a szerverhez – csak megbízható forrásból telepíts.

## WorldEdit (beépített, admin)
`//pos1 [x y z]` · `//pos2` · `//size` · `//count <blokk>` · `//set <blokk>` · `//replace <honnan> <mire>` · `//walls <blokk>` · `//sphere/hsphere <blokk> <sugár>` · `//cyl/hcyl <blokk> <sugár> [magasság]` · `//copy` · `//cut` · `//paste [-a]` · `//rotate 90|180|270` · `//undo [n]` · `//redo`
Blokk lehet angol/magyar név vagy szám; lista véletlenszerűen keveri: `//set stone,dirt`. Egy művelet legfeljebb 400 000 blokk. A kijelölést a pozíciódból (`//pos1`) vagy koordinátákból adod meg (pálca még nincs).

## Fájlok helye
A szerverek adatai a Windows `%APPDATA%/minepixelss` mappájában vannak (`servers.json`, `saves/`, `servers/<id>/plugins`).
