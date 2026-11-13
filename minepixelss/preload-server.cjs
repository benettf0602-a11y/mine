// A rejtett szerver-ablak előtöltője: a játék mentés-API-ja + a szerver-vezérlés
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mp', {
  list: () => ipcRenderer.invoke('save:list'), read: id => ipcRenderer.invoke('save:read', id), write: (id, data) => ipcRenderer.invoke('save:write', id, data),
  del: id => ipcRenderer.invoke('save:delete', id), backups: id => ipcRenderer.invoke('save:backups', id), restore: (id, s) => ipcRenderer.invoke('save:restore', id, s),
  fullscreen: () => {}, quit: () => {}, netStart: async () => { throw new Error('nem támogatott'); }, netStop: async () => true,
  ssConf: () => ipcRenderer.sendSync('ss:conf'),
  ssReport: m => ipcRenderer.send('ss:report', m), ssStopped: () => ipcRenderer.send('ss:stopped'),
  onSsStop: cb => ipcRenderer.on('ss:stop', () => cb()), onSsCmd: cb => ipcRenderer.on('ss:cmd', (e, l) => cb(l)), onSsSay: cb => ipcRenderer.on('ss:say', (e, t) => cb(t)),
});
