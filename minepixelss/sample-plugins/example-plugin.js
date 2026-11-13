// Példa MinePixel plugin. Tedd a szerver plugins mappájába (MinePixelSS → Pluginok → Mappa megnyitása).
// API: api.command(név, {desc, admin, run(ctx,args)}), api.on('join'|'leave'|'chat'|'tick', fn), api.broadcast, api.tell,
//      api.players(), api.pos(név), api.teleport(név,[x,y,z]), api.give(név,id,db), api.getBlock/setBlock, api.findItem(név),
//      api.economy.get/add(név[,összeg]), api.storage.get/set(kulcs[,érték]), api.log(szöveg)
module.exports = {
  name: 'Példa',
  version: '1.0',
  onEnable(api) {
    api.on('join', e => api.broadcast('Üdv a szerveren, ' + e.name + '! Írd be: /bonusz'));
    api.on('chat', e => { if (/\b(hülye|idióta)\b/i.test(e.message)) { e.cancel(); api.tell(e.name, 'Kérlek, ne káromkodj!'); } });
    api.command('bonusz', {
      desc: 'Napi 50 $ bónusz',
      run(ctx) {
        const last = api.storage.get('bonusz:' + ctx.name, 0);
        if (Date.now() - last < 86400000) return ctx.error('A bónuszt naponta egyszer veheted fel.');
        api.storage.set('bonusz:' + ctx.name, Date.now()); api.economy.add(ctx.name, 50); ctx.tell('+50 $ bónusz!');
      },
    });
    api.command('rangsor', { desc: 'Játékosok a szerveren', run(ctx) { ctx.tell('Online: ' + api.players().map(p => p.name).join(', ')); } });
    api.command('villam', { desc: 'Admin: játékos felrepítése', admin: true, run(ctx, a) { const p = api.pos(a[0] || ctx.name); if (!p) return ctx.error('Nincs ilyen játékos.'); api.teleport(a[0] || ctx.name, [p[0], p[1] + 30, p[2]]); } });
  },
};
