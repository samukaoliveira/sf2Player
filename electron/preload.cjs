const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sf2LocalCache', {
  read: url => ipcRenderer.invoke('soundfont-cache:ler', url),
  write: (url, bytes) => ipcRenderer.invoke('soundfont-cache:gravar', url, bytes),
  listLocal: () => ipcRenderer.invoke('soundfont-local:listar'),
  readLocal: nome => ipcRenderer.invoke('soundfont-local:ler', nome),
  importLocal: (nome, categoria, bytes) => ipcRenderer.invoke(
    'soundfont-local:importar', nome, categoria, bytes
  ),
  readScenes: () => ipcRenderer.invoke('cenas-local:ler'),
  writeScenes: conteudo => ipcRenderer.invoke('cenas-local:gravar', conteudo),
  directory: process.platform === 'win32'
    ? 'C:\\Samnat-Synth\\soundfonts'
    : 'Pasta de dados local do SamNat Synth'
});
