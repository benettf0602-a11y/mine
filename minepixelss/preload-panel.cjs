const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('ss', {
  list: () => inv('p:list'), create: c => inv('p:create', c), update: (id, patch) => inv('p:update', id, patch), remove: id => inv('p:remove', id),
  start: id => inv('p:start', id), stop: id => inv('p:stop', id), cmd: (id, l) => inv('p:cmd', id, l), say: (id, t) => inv('p:say', id, t),
  settings: () => inv('p:settings'), setSettings: s => inv('p:setSettings', s), info: () => inv('p:info'),
  backups: id => inv('p:backups', id), restore: (id, stamp) => inv('p:restore', id, stamp),
  plugins: id => inv('p:plugins', id), togglePlugin: (id, f, on) => inv('p:togglePlugin', id, f, on), addPlugin: id => inv('p:addPlugin', id), removePlugin: (id, f) => inv('p:removePlugin', id, f), samplePlugin: id => inv('p:samplePlugin', id), openPlugins: id => inv('p:openPlugins', id),
  logs: id => inv('p:logs', id),
  onEvent: cb => ipcRenderer.on('p:event', (e, m) => cb(m)),
});
