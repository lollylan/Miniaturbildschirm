const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('praxisAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  onConfigUpdated: (cb) => ipcRenderer.on('config-updated', (_e, cfg) => cb(cfg)),
});
