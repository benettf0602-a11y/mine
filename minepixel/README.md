# MinePixel (Minecraft 1.20.1 stílus)

Indítás:
1. Telepítsd a Node.js-t (https://nodejs.org)
2. A mappában: `npm install` majd `npm start`  (Windowson: dupla kattintás a `start.bat`-ra)
3. Telepítőkészítés: `npm run dist`

Ajtó: 6 deszka -> 3 tölgyajtó (2x3 recept). Jobb klikk = nyit/zár, törés = mindkét fél eltűnik.

Irányítás: WASD mozgás · Szóköz ugrás (kreatívban dupla = repülés) · Ctrl/dupla W futás · Shift lopakodás
Bal egér: bányászat/támadás · Jobb egér: lerakás/használat/evés · Görgő / 1-9: gyorssáv · E: inventár · Q: eldobás
F3: debug · F4: játékmód váltás · F11: teljes képernyő · Esc: szünet

Új (2. verzió): 146 blokk / 101 tárgy / 166 recept – réz, lapis, redstone, smaragd érc; ásványblokkok; andezit/gránit/diorit; agyag, tégla, kvarc;
lapok és lépcsők (11 anyagból); 16 színű gyapjú és beton (festékekkel); páncél (bőr/vas/arany/gyémánt, jobb klikk = felvétel);
íj+nyíl (tartsd a jobb gombot), vödör (víz/láva), kapa, olló, kovakő és acél, ágy (alvás éjjel + újraéledési pont),
búzatermesztés (kapa -> termőföld -> búzamag), kenyér, aranyalma, csemete -> fa; csirke, csontváz, pók.

Tartalom: végtelen világ (8 biom, barlangok, ércek, fák), nap/éjszaka, barkácsolás (2x2 és 3x3),
kemence, láda, szerszámok (fa/kő/vas/arany/gyémánt), éhség/élet/fulladás/esés, disznó/tehén/birka/zombi/creeper,
TNT (jobb klikk kovával), hullócsapás sorrend: homok/murva, kreatív és túlélő mód, mentés (AppData/saves).

## Multiplayer (Barátok)
- Főmenü → **Barátok · Multiplayer**: neved, barátlista, csatlakozás meghívó kóddal.
- Világ létrehozásakor "Barátok meghívása: BE", vagy játék közben Szünet → **Barátok meghívása** → kód másolása (pl. `K7Q2MX@192.168.1.5:25566`).
- LAN-on azonnal megy; interneten a 25566-os TCP port továbbítása kell, vagy saját relay: `node server/relay.cjs` (alap port 8787), a címet Barátok → Haladó mezőbe írd.
- Nézet váltás (harmadik személy): F5
- Chat: T / Enter · Játékoslista: Tab.
- Figyelem: a multiplayer még nincs végigtesztelve két klienssel.

## Parancsok (chat: / vagy T)
`/tp x y z` · `/tp ~ ~5 ~` · `/tp x z` · `/tp <játékos>` · `/tp <játékos> here` · `/spawn` · `/setspawn` · `/pos`
`/gamerule keepInventory|doDaylightCycle|doMobSpawning|mobGriefing|fallDamage true|false`
`/gamemode survival|creative` · `/time set day|noon|night|midnight|szám` · `/difficulty peaceful|easy|normal|hard`
`/give <item> [db]` · `/clear` · `/kill` · `/seed` · `/list` · `/help`
Multiplayerben a világot érintő parancsokat (gamerule, time, difficulty, gamemode, give) csak a host használhatja.

## Windows telepítő
1. Telepítsd az Inno Setup 6-ot (jrsoftware.org) és a Node.js-t.
2. Futtasd: `installer\build_installer.bat`
3. Az eredmény: `installer\Output\MinePixel_Setup_1.1.0.exe` (Minecraft stílusú telepítő, opcionális tűzfal-szabály a multiplayerhez).

## Új: játékmenet (2. kör)
- **Mentés**: automatikus biztonsági mentések (világonként az utolsó 5), visszaállítás a világlistában.
- **Víz/láva folyás**, **ajtó, kerítés, kerítéskapu, létra, csapóajtó**.
- **Redstone**: kar, kőgomb, nyomólap, redstone por (0–15 szint), lámpa, redstone fáklya, redstone blokk; ajtók/kapuk/csapóajtók/TNT áramra nyílnak/gyulladnak.
- **Parancsblokk** (kreatívban jobb klikk): sima / ismétlő / láncolt, „mindig aktív", „feltételes". Támogatott parancsok: say, tellraw, title, tp, give, kill, setblock, fill, summon, time, gamerule, gamemode, difficulty, execute … run. Szelektorok: @p @a @r @s @e[type=..].
- **Minecraft Java térkép importálás** (Új világ → „Minecraft térkép importálása"): válaszd ki a világ mappáját (ahol a level.dat van). 1.13+ formátum, 0–127 magasságra vágva, blokkok leképezve, ládák és parancsblokkok átjönnek. Nether/End, lények, falusiak nem.
- **Multiplayer**: PvP (`/gamerule pvp false`), kézben tartott tárgy látszik, TNT gyújtózsinór, nyírás, kemence és redstone szinkron.

## Új: 3. kör (szék, tehén, fészek, konyha, Nether, End)
- **Szék**: jobb klikk → leülsz (Space/Shift: felállás). Recept: bot+deszka.
- **Fejőállvány** (bot+deszka): tegyél alá vödröt, vezess rá tehenet (búzát tartva követ), jobb klikk a tehénre → tej az állványban; jobb klikk az állványra → tejesvödör. Vödörrel közvetlenül is fejhető.
- **Tojásfészek** (búza): a közeli csirke beköltözik; búzamaggal megetetve másnapra (új nap = alvás/éjfél) tojás lesz; jobb klikk → tojás.
- **Konyhai sütő** (tégla + szén): saját receptek (sajt, rántotta, tükörtojás, pizza, palacsinta, szendvics, almás pite, dinnyeturmix) – nem Minecraft receptek.
- **Nether**: obszidián keret (min. 4×5) + kovakő és acél → portál. 3 mp a portálban. Zombi-pigman, kvarcérc, izzókő, lávatenger. Koordináták 1:8.
- **End**: stronghold a Felvilágban a föld alatt (Y≈26); Vég szeme (véggyöngy + izzókőpor) jobb klikkel irányt mutat, a 12 keretbe rakva megnyílik a portál. Végen Ender sárkány (150 HP), endermanek. Kijárat: a sárkány halála után a középső portál.
- Többjátékos: dimenzióváltáskor mindenki együtt utazik.

## Új: 4. kör
- **Varázsasztal** (bőr+2 gyémánt+4 obszidián): kézben tartott eszköz/páncél, 3 szint + 3 lazurit → véletlen varázslat (élesség, hatékonyság, védelem, törhetetlenség). **Üllő**: sérült eszköz + nyersanyag + 1 szint = javítás.
- **Bájitalfőző** (blaze-por + 3 kő): üvegpalack + hozzávalók → gyógyító / gyorsasági / erő / tűzállóság főzet.
- **Blaze** (Nether-erőd téglapadlóján spawnol, blaze-port ejt), **Nether-erőd**.
- **Falvak** (kőpadlós házak, falusiak): smaragdért adnak-vesznek (jobb klikk; smaragddal a kezedben vásárolsz).
- **Csónak** (5 deszka): vízre tenni, jobb klikk ráülni, WASD, Shift kiszállás.
- **Teljesítmények**: `/achievements`.

## Új: Multiplayer · MinePixel SMP
Főmenü → **Multiplayer · MinePixel SMP**: egyetlen közös túlélő világ mindenkinek (építés, felfedezés, bányászat, kereskedés). Kreatív mód **csak az adminnak** van.

**Szerver indítása (admin):** Multiplayer → *Admin: szerver indítása*. A világ (`smp_main` mentés), a pénzek, otthonok, warpok, tiltások automatikusan mentődnek. A világ addig él, amíg az admin játéka fut.
**Csatlakozás:** a játékosok a Multiplayer menüben megadják a szerver címét (*Szerver beállítások*), majd *Csatlakozás*.
- Saját relay (ajánlott, nem kell port-továbbítás): `SMP_ADMIN_KEY=titkos node server/relay.cjs` → cím: `ws://cím:8787` vagy `wss://…`. Az admin ugyanezt a kulcsot adja meg a menüben, így más nem nyithatja meg a szervert. Opcionális: `SMP_ROOM`, `MAX_CLIENTS`, `PORT`.
- Relay nélkül: az admin IP-je és a 25566-os port (LAN-on azonnal megy).
- Az alapértelmezett cím a `src/smp.js`-ben (`SMP.defaultAddr`) állítható, hogy a játékosoknak ne kelljen beírni.

**Oldalsáv:** MinePixel · név · pénz · rang · online · játékidő · világ. **Bolt:** `B` billentyű vagy `/shop` (vásárlás + eladás, 250+ tétel, kereső, mennyiség 1/8/16/64).

**Játékos parancsok:** `/bal [játékos]` · `/baltop` · `/pay <játékos> <összeg>` · `/daily` · `/kit` · `/shop` · `/sell hand|all` · `/worth` · `/tpa` · `/tpahere` · `/tpaccept` · `/tpdeny` · `/tpcancel` · `/home` · `/sethome` · `/delhome` · `/homes` · `/spawn` · `/warp` · `/warps` · `/back` · `/rtp` · `/msg` · `/r` · `/me` · `/list` · `/seen` · `/playtime` · `/rules` · `/help`
**Admin parancsok:** `/bal give|take|set <játékos> <összeg>` · `/give [játékos] <item> [db]` · `/gamemode` · `/tp` · `/kick` · `/ban` · `/unban` · `/banlist` · `/mute` · `/unmute` · `/broadcast` · `/setwarp` · `/delwarp` · `/clear`
**Csak a tulajdonos (host):** `/op` · `/deop` · `/protect <sugár>` · `/time` · `/gamerule` · `/difficulty` · `/setspawn`

**Egyéb:** spawn-védelem (alap 12 blokk, a host is ellenőrzi), név-védelem azonosító tokennel, chat anti-spam, rang-előtag a chaten, halál-pont (`/back`), teleport 3 mp várakozással (mozgásra megszakad), napi jutalom sorozattal, kezdő csomag, ranglista, kitiltás/némítás/kirúgás indoklással.

## Új: MinePixelSS szerverek, pluginok, WorldEdit
- `ht.<név>.gg` címek: Barátok → Haladó → Gateway megadása után a kódmezőbe írt `ht.legend.gg`-vel lehet csatlakozni egy MinePixelSS szerverre (lásd a `minepixelss` mappát).
- A szerver SMP módban pluginokat és a beépített WorldEdit-et is futtat (`src/plugins.js`, `src/worldedit.js`).
- A `/ad <kód>` és a `/plugins` parancs minden SMP szerveren elérhető.
