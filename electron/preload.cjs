const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sf2LocalCache', {
  read: url => ipcRenderer.invoke('soundfont-cache:ler', url),
  write: (url, bytes) => ipcRenderer.invoke('soundfont-cache:gravar', url, bytes)
});
