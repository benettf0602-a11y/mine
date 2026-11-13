const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mp', {
  list: () => ipcRenderer.invoke('save:list'),
  read: id => ipcRenderer.invoke('save:read', id),
  write: (id, data) => ipcRenderer.invoke('save:write', id, data),
  del: id => ipcRenderer.invoke('save:delete', id),
  backups: id => ipcRenderer.invoke('save:backups', id),
  restore: (id, stamp) => ipcRenderer.invoke('save:restore', id, stamp),
  fullscreen: on => ipcRenderer.send('fullscreen', on),
  quit: () => ipcRenderer.send('quit'),
  netStart: port => ipcRenderer.invoke('net:start', port),
  netStop: () => ipcRenderer.invoke('net:stop'),
});
