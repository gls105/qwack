const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qwack', {
  // Shell
  runShell: (command, cwd) => ipcRenderer.invoke('shell:run', { command, cwd }),

  // Filesystem
  readFile: (filePath) => ipcRenderer.invoke('fs:read', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:write', { filePath, content }),
  listDir: (dirPath) => ipcRenderer.invoke('fs:list', dirPath),

  // System
  sysInfo: () => ipcRenderer.invoke('sys:info'),

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});
