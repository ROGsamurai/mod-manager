const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Single instance check — do this BEFORE loading anything else
// Second instance exits immediately without loading modules
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { process.exit(0); }

const chokidar = require('chokidar');
const Store = require('electron-store');
const store = new Store({ name: 'mod-manager' });
const modManager = require('./mod-manager');
const gameDetector = require('./game-detector');

// Safety net: log uncaught exceptions and unhandled rejections instead of crashing.
// Electron's default behavior shows an ugly "A JavaScript error occurred" dialog for
// any uncaught exception in the main process — that's a worse experience than just
// logging and continuing. fs errors from OneDrive/antivirus are the typical cause.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// Fix blurry rendering on Windows 11 with display scaling
app.disableHardwareAcceleration();
app.setName('Real TCG Overhaul Mod Manager');

let mainWindow = null;
let stagingWatcher = null;
let tray = null;
let isQuitting = false;

function getPortablePath() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  return app.isPackaged ? path.dirname(process.execPath) : process.cwd();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.setTitle('Real TCG Overhaul Mod Manager');
    mainWindow.focus();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300, height: 850, minWidth: 900, minHeight: 550,
    title: 'Real TCG Overhaul Mod Manager',
    backgroundColor: '#141414',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true,
    },
    frame: false,
    icon: path.join(__dirname, '../../assets/icon.ico'),
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
  mainWindow.on('closed', () => { mainWindow = null; });

  // Prevent the HTML page or Electron from overriding the window title
  mainWindow.on('page-title-updated', (e) => { e.preventDefault(); });

  // Intercept close — hide to tray if enabled
  mainWindow.on('close', (e) => {
    if (!isQuitting && store.get('minimizeToTray', false)) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, '../../assets/icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Real TCG Overhaul Mod Manager');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.setTitle('Real TCG Overhaul Mod Manager'); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.setTitle('Real TCG Overhaul Mod Manager'); mainWindow.focus(); } });
}

function watchStaging() {
  const stagingPath = modManager.getStagingPath();
  if (stagingWatcher) stagingWatcher.close();
  stagingWatcher = chokidar.watch(stagingPath, {
    ignoreInitial: true, depth: 0,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
  });
  // Wrap notify so a per-file error (EPERM on OneDrive online-only files, AV lock,
  // mid-sync placeholders) can't propagate out of chokidar and crash the main
  // process with "A JavaScript error occurred in the main process".
  const notify = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      mainWindow.webContents.send('staging:changed', modManager.getStagedFiles());
    } catch (err) {
      console.warn('[staging watcher] notify failed:', err.message);
    }
  };
  stagingWatcher.on('add', notify);
  stagingWatcher.on('unlink', notify);
  // Prevent chokidar errors (e.g. EPERM scanning OneDrive folders) from bubbling up.
  stagingWatcher.on('error', (err) => {
    console.warn('[staging watcher] error:', err.message || err);
  });
}

app.whenReady().then(async () => {
  modManager.setPortablePath(getPortablePath());
  createWindow();
  createTray();
  watchStaging();
  if (!modManager.getGamePath()) {
    const detected = await gameDetector.detect();
    if (detected) modManager.setGamePath(detected);
  }
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => { if (stagingWatcher) stagingWatcher.close(); if (tray) tray.destroy(); app.quit(); });

// Window controls
ipcMain.handle('window:minimize', () => {
  if (store.get('minimizeButtonToTray', false)) {
    mainWindow?.hide();
  } else {
    mainWindow?.minimize();
  }
});
ipcMain.handle('window:maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
ipcMain.handle('window:close', () => {
  if (store.get('minimizeToTray', false)) {
    mainWindow?.hide();
  } else {
    mainWindow?.close();
  }
});

// Game
ipcMain.handle('game:detect', async () => {
  try { const p = await gameDetector.detect(); if (p) modManager.setGamePath(p); return p; }
  catch (e) { console.error('[game:detect]', e); return null; }
});
ipcMain.handle('game:get-path', () => { try { return modManager.getGamePath(); } catch { return null; } });
ipcMain.handle('game:set-path', (_, p) => {
  try { modManager.setGamePath(p); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('game:launch', () => {
  try { gameDetector.launchGame(modManager.gamePath); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('game:bepinex', () => {
  try { return modManager.getBepInExStatus(); }
  catch (e) { console.error('[game:bepinex]', e); return { installed: false, reason: 'Status check failed.' }; }
});
ipcMain.handle('game:bepinex-health', () => {
  try { return modManager.bepinexHealthCheck(); }
  catch (e) { console.error('[game:bepinex-health]', e); return { ok: false, checks: [{ file: 'Health Check', status: 'warn', detail: 'Check failed: ' + e.message }] }; }
});

// Staging
ipcMain.handle('staging:list', () => { try { return modManager.getStagedFiles(); } catch (e) { console.error('[staging:list]', e); return []; } });
ipcMain.handle('staging:add', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select mod archive(s)',
    filters: [{ name: 'Mod Archives', extensions: ['zip', 'rar', '7z'] }, { name: 'All Files', extensions: ['*'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return { success: false };
  return { success: true, added: await modManager.addToStaging(result.filePaths) };
});
ipcMain.handle('staging:remove', (_, f) => {
  try { return modManager.removeFromStaging(f); }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('staging:clear', () => {
  try { return modManager.clearStaging(); }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('staging:peek', async (_, f) => {
  try { return { success: true, ...(await modManager.peekArchive(f)) }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('staging:detect-targets', async () => {
  try {
    const files = modManager.getStagedFiles();
    const results = {};
    for (const f of files) {
      try {
        const archivePath = require('path').join(modManager.getStagingPath(), f.filename);
        const paths = await modManager._quickScanArchivePaths(archivePath);
        results[f.filename] = modManager._detectTarget(paths.map(p => ({ path: p })));
      } catch { results[f.filename] = 'plugins'; }
    }
    return results;
  } catch { return {}; }
});

// Targets
ipcMain.handle('targets:list', () => { try { return modManager.getTargets(); } catch (e) { console.error('[targets:list]', e); return []; } });

// Mods
// Send extraction progress to renderer
modManager.onProgress = (percent, done, total) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('install-progress', { percent, done, total });
  }
};

ipcMain.handle('mods:install', async (_, filename, targetKey, modName, skipRemoval) => {
  try { return { success: true, mod: await modManager.installMod(filename, targetKey, modName, skipRemoval) }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:list', () => modManager.getInstalledMods());
ipcMain.handle('mods:uninstall', async (_, id) => {
  try { await modManager.uninstallMod(id); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:fresh-install', async () => {
  try { return await modManager.freshInstall(); }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:toggle', async (_, id) => {
  try { return { success: true, mod: await modManager.toggleMod(id) }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:conflicts', () => modManager.detectConflicts());
ipcMain.handle('mods:mark-core', (_, id, isCore) => {
  try { return { success: true, mod: modManager.markCore(id, isCore) }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:mark-core-bulk', (_, ids, isCore) => {
  try {
    const updated = [];
    const failed = [];
    for (const id of (Array.isArray(ids) ? ids : [])) {
      try { updated.push(modManager.markCore(id, isCore)); }
      catch (e) { failed.push({ id, error: e.message }); }
    }
    return { success: true, updated: updated.length, failed: failed.length, failedDetails: failed };
  } catch (e) { return { success: false, error: e.message }; }
});

// Profiles
ipcMain.handle('profiles:list', () => modManager.getProfiles());
ipcMain.handle('profiles:active', () => modManager.getActiveProfileId());
ipcMain.handle('profiles:create', (_, name) => modManager.createProfile(name));
ipcMain.handle('profiles:activate', async (_, id) => {
  try { await modManager.activateProfile(id); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('profiles:delete', (_, id) => { modManager.deleteProfile(id); return { success: true }; });

// Profile Export/Import
ipcMain.handle('profiles:export', async (_, id) => {
  try {
    const data = modManager.exportProfile(id);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Profile',
      defaultPath: `${data.profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
      filters: [{ name: 'Profile JSON', extensions: ['json'] }],
    });
    if (result.canceled) return { success: false };
    const fs = require('fs-extra');
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, path: result.filePath };
  } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('profiles:import', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Profile',
      filters: [{ name: 'Profile JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled) return { success: false };
    const fs = require('fs-extra');
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const data = JSON.parse(raw);
    return await modManager.importProfile(data);
  } catch (e) { return { success: false, error: e.message }; }
});

// Config Editor
ipcMain.handle('config:list', () => modManager.getConfigFiles());
ipcMain.handle('config:read', (_, filename) => {
  try { return { success: true, config: modManager.readConfigFile(filename) }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('config:save', (_, filename, section, key, value) => {
  try { return modManager.saveConfigValue(filename, section, key, value); }
  catch (e) { return { success: false, error: e.message }; }
});

// Dependencies
ipcMain.handle('mods:check-deps', () => { try { return modManager.checkDependencies(); } catch (e) { console.error('[mods:check-deps]', e); return []; } });

ipcMain.handle('mods:regroup-all', () => {
  try { return modManager.regroupAllMods(); }
  catch (e) { console.error('[mods:regroup-all]', e); return { success: false, error: e.message }; }
});

// Mod Groups
ipcMain.handle('groups:list', () => modManager.getModGroups());
ipcMain.handle('groups:create', (_, name) => modManager.createModGroup(name));
ipcMain.handle('groups:delete', (_, id) => { modManager.deleteModGroup(id); return { success: true }; });
ipcMain.handle('groups:rename', (_, id, name) => { modManager.renameModGroup(id, name); return { success: true }; });
ipcMain.handle('groups:reorder', (_, orderedIds) => { modManager.reorderModGroups(orderedIds); return { success: true }; });
ipcMain.handle('groups:get-collapsed', () => store.get('collapsedGroups', []));
ipcMain.handle('groups:set-collapsed', (_, ids) => { store.set('collapsedGroups', ids); return { success: true }; });
ipcMain.handle('groups:set-mod', (_, modId, groupId) => { modManager.setModGroup(modId, groupId); return { success: true }; });
ipcMain.handle('groups:set-mods', (_, modIds, groupId) => { modManager.setModsGroup(modIds, groupId); return { success: true }; });

// Settings
ipcMain.handle('settings:get-delete-after-install', () => modManager.getDeleteAfterInstall());
ipcMain.handle('settings:set-delete-after-install', (_, val) => { modManager.setDeleteAfterInstall(val); return { success: true }; });
ipcMain.handle('settings:get-theme', () => store.get('theme', 'midnight'));
ipcMain.handle('settings:set-theme', (_, theme) => { store.set('theme', theme); return { success: true }; });
ipcMain.handle('settings:get-minimize-to-tray', () => store.get('minimizeToTray', false));
ipcMain.handle('settings:set-minimize-to-tray', (_, val) => { store.set('minimizeToTray', val); return { success: true }; });
ipcMain.handle('settings:get-minimize-btn-to-tray', () => store.get('minimizeButtonToTray', false));
ipcMain.handle('settings:set-minimize-btn-to-tray', (_, val) => { store.set('minimizeButtonToTray', val); return { success: true }; });

// Dialogs
ipcMain.handle('dialog:open-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: 'Select game folder', properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:open-staging', () => { shell.openPath(modManager.getStagingPath()); return { success: true }; });
ipcMain.handle('dialog:open-appdata', () => { shell.openPath(app.getPath('userData')); return { success: true }; });
ipcMain.handle('dialog:open-saves', () => {
  const savePath = path.join(app.getPath('home'), 'AppData', 'LocalLow', 'OPNeonGames', 'Card Shop Simulator');
  shell.openPath(savePath);
  return { success: true };
});
ipcMain.handle('dialog:open-game', () => {
  if (modManager.gamePath) { shell.openPath(modManager.gamePath); return { success: true }; }
  return { success: false, error: 'Game path not set' };
});
ipcMain.handle('dialog:open-url', (_, url) => {
  shell.openExternal(url);
  return { success: true };
});
ipcMain.handle('app:get-locale', () => app.getLocale());
