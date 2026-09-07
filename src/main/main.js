const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

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

// ─── Chromium sandbox fallback ───────────────────────────────────────────────
// On some Windows 10 machines Chromium cannot start its sandboxed child
// processes: the app shows a transparent window for a moment and dies with
// exception 0x80000003 (STATUS_BREAKPOINT). --disable-gpu changes nothing;
// --no-sandbox fixes it. It is environment-specific (security software,
// policy, or Win32k lockdown settings), and running the portable build out of
// %TEMP% makes it more likely.
//
// Rather than disabling the sandbox for everyone, detect the failure and retry
// without it. Two signals feed this:
//   1. A launch marker written before the window is created and cleared once
//      the UI has loaded. Finding it set at startup means the previous run died
//      before showing anything — the exact symptom above.
//   2. child-process-gone / render-process-gone with a launch failure, which is
//      the direct signal; that path relaunches immediately (see below).
const SANDBOX_OFF = 'sandboxFallback';
const LAUNCH_PENDING = 'launchPending';
if (store.get(SANDBOX_OFF, false) || store.get(LAUNCH_PENDING, false)) {
  if (!store.get(SANDBOX_OFF, false)) {
    console.warn('[startup] previous launch never finished loading — disabling the Chromium sandbox for this machine');
    store.set(SANDBOX_OFF, true);
  }
  app.commandLine.appendSwitch('no-sandbox');
}
store.set(LAUNCH_PENDING, true);

let sandboxRelaunching = false;
/** Turn the sandbox off for this machine and restart, once. */
function relaunchWithoutSandbox(reason) {
  if (sandboxRelaunching || store.get(SANDBOX_OFF, false)) return;
  sandboxRelaunching = true;
  console.warn(`[startup] child process failed to launch (${reason}) — restarting without the Chromium sandbox`);
  store.set(SANDBOX_OFF, true);
  store.set(LAUNCH_PENDING, false);
  app.relaunch({ args: process.argv.slice(1) });
  app.exit(0);
}

app.on('child-process-gone', (_e, details) => {
  if (details?.reason === 'launch-failed' || details?.reason === 'crashed') {
    relaunchWithoutSandbox(`${details.type}/${details.reason}`);
  }
});

let mainWindow = null;
let stagingWatcher = null;
let tray = null;
let isQuitting = false;

function getPortablePath() {
  // Windows portable build: electron-builder sets this to the folder the .exe
  // was launched from.
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  // Linux AppImage: process.execPath points INSIDE the read-only squashfs mount
  // (/tmp/.mount_XXXXXX/usr/bin/...), which is recreated with a different random
  // name on every launch — useless for storing staging/ and disabled-mods/.
  // AppImage exports APPIMAGE with the real path of the .AppImage file, so use
  // the folder it lives in. That mirrors the Windows portable behaviour: your
  // staging folder sits next to the app you launched.
  if (process.env.APPIMAGE) {
    const dir = path.dirname(process.env.APPIMAGE);
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // AppImage stored somewhere read-only — fall through to userData below.
      return app.getPath('userData');
    }
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
  // The window rendered — this launch is healthy, so clear the marker that would
  // otherwise trip the sandbox fallback on the next start.
  mainWindow.webContents.on('did-finish-load', () => {
    try { store.set(LAUNCH_PENDING, false); } catch {}
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    if (details?.reason === 'launch-failed' || details?.reason === 'crashed') {
      relaunchWithoutSandbox(`renderer/${details.reason}`);
    }
  });

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

app.on('before-quit', () => {
  isQuitting = true;
  // A normal shutdown is not a failed launch.
  try { store.set(LAUNCH_PENDING, false); } catch {}
  try { modManager.sweepPendingDeletes(); } catch {}
});
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
  try {
    const resolved = modManager.setGamePath(p);
    return { success: true, path: resolved, adjusted: resolved !== p };
  }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('game:launch', () => {
  try { return { success: true, ...gameDetector.launchGame(modManager.gamePath) }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('game:bepinex', () => {
  try { return modManager.getBepInExStatus(); }
  catch (e) { console.error('[game:bepinex]', e); return { installed: false, reason: 'Status check failed.' }; }
});
ipcMain.handle('game:remove-duplicate-plugins', async () => {
  try { return { success: true, removed: await modManager.removeDuplicatePluginDlls() }; }
  catch (e) { console.error('[game:remove-duplicate-plugins]', e); return { success: false, error: e.message }; }
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
  if (result.canceled) return { success: false, canceled: true };
  // Spread the result: addToStaging returns { added, skipped, pruned }, and
  // nesting it under `added` meant the renderer read added.length off an object
  // (undefined) and saw no skipped/pruned lists at all — so adding archives
  // reported nothing, and later reported "Mod version already added" for files
  // that had in fact just been added.
  return { success: true, ...(await modManager.addToStaging(result.filePaths)) };
});
ipcMain.handle('staging:remove', async (_, f) => {
  try { return await modManager.removeFromStaging(f); }
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
modManager.onProgress = (percent, done, total, phase) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // phase: 'removing' while the previous version's files are deleted,
    // 'installing' while the new archive is extracted.
    mainWindow.webContents.send('install-progress', { percent, done, total, phase: phase || 'installing' });
  }
};

ipcMain.handle('mods:install', async (_, filename, targetKey, modName, skipRemoval) => {
  try { return { success: true, mod: await modManager.installMod(filename, targetKey, modName, skipRemoval) }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:list', () => modManager.getInstalledMods());
ipcMain.handle('mods:uninstall', async (event, id) => {
  try {
    await modManager.uninstallMod(id, (done, total) => {
      try { event.sender.send('mods:toggle-progress', { id, done, total }); } catch {}
    });
    return { success: true };
  }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:fresh-install', async () => {
  try { return await modManager.freshInstall(); }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:toggle', async (event, id) => {
  try {
    const mod = await modManager.toggleMod(id, (done, total) => {
      try { event.sender.send('mods:toggle-progress', { id, done, total }); } catch {}
    });
    return { success: true, mod };
  }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('mods:conflicts', () => modManager.detectConflicts());
ipcMain.handle('mods:rename', (_, id, name) => {
  try { return { success: true, mod: modManager.renameMod(id, name) }; }
  catch (e) { return { success: false, error: e.message }; }
});
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
ipcMain.handle('profiles:activate', async (event, id) => {
  try {
    await modManager.activateProfile(id, (p) => {
      try { event.sender.send('profiles:activate-progress', p); } catch {}
    });
    return { success: true };
  }
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
// Language: null means "not chosen yet" so we fall back to the system locale on
// first run. Once the user picks a language it must survive restarts.
ipcMain.handle('settings:get-language', () => store.get('language', null));
ipcMain.handle('settings:set-language', (_, lang) => { store.set('language', lang); return { success: true }; });
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
