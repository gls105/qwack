const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0d0d',
    titleBarStyle: 'hiddenInset',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // needed for noVNC remote desktop panel
    },
    icon: path.join(__dirname, 'assets', 'duck.png'),
    title: 'qwack.ai',
  });

  mainWindow.loadFile('index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Shell Tool ───────────────────────────────────────────────────────────────
// Runs a shell command and streams output back to renderer
ipcMain.handle('shell:run', async (event, { command, cwd }) => {
  return new Promise((resolve) => {
    const workdir = cwd || os.homedir();
    exec(command, { cwd: workdir, shell: '/bin/bash', maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: err ? (err.code ?? 1) : 0,
      });
    });
  });
});

// ─── File Tool ────────────────────────────────────────────────────────────────
const fs = require('fs');

ipcMain.handle('fs:read', async (event, filePath) => {
  try {
    return { ok: true, content: fs.readFileSync(filePath, 'utf8') };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:write', async (event, { filePath, content }) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:list', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return {
      ok: true,
      entries: entries.map((e) => ({ name: e.name, isDir: e.isDirectory() })),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ─── System Info ──────────────────────────────────────────────────────────────
ipcMain.handle('sys:info', async () => ({
  platform: process.platform,
  arch: process.arch,
  hostname: os.hostname(),
  homeDir: os.homedir(),
  cwd: process.cwd(),
}));

// ─── Window Controls ──────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());
