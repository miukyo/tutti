import { BrowserWindow, ipcMain, screen, app } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import type { AppInitConfig } from '../AppInitConfig.js';
import path from 'node:path';
import fs from 'node:fs';

class FloatingLyricsManager implements AppModule {
  readonly #preload: { path: string };
  readonly #renderer: { path: string } | URL;
  #floatingLyricsWindow: BrowserWindow | null = null;
  #isFloatingLyricsLocked = false;

  get #configPath() {
    return path.join(app.getPath('userData'), 'floating-lyrics-config.json');
  }

  #loadConfig() {
    try {
      if (fs.existsSync(this.#configPath)) {
        const data = fs.readFileSync(this.#configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load floating lyrics config:', e);
    }
    return null;
  }

  #saveConfig(config: { x?: number; y?: number; width?: number; height?: number; isLocked?: boolean }) {
    try {
      const current = this.#loadConfig() || {};
      const updated = { ...current, ...config };
      fs.writeFileSync(this.#configPath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save floating lyrics config:', e);
    }
  }

  constructor({ initConfig }: { initConfig: AppInitConfig }) {
    this.#preload = initConfig.preload;
    this.#renderer = initConfig.renderer;

    // Load initial lock state
    const config = this.#loadConfig();
    this.#isFloatingLyricsLocked = config?.isLocked ?? false;
  }

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();

    // Register IPC channels for Floating Lyrics
    ipcMain.handle('toggle-floating-lyrics', () => {
      if (this.#floatingLyricsWindow) {
        this.closeFloatingLyrics();
        return false;
      } else {
        this.openFloatingLyrics();
        return true;
      }
    });

    ipcMain.handle('is-floating-lyrics-open', () => {
      return this.#floatingLyricsWindow !== null;
    });

    ipcMain.on('update-player-state', (event, state) => {
      if (this.#floatingLyricsWindow && !this.#floatingLyricsWindow.isDestroyed()) {
        this.#floatingLyricsWindow.webContents.send('player-state-updated', state);
      }
    });

    ipcMain.on('request-player-state', (event) => {
      const mainWindow = BrowserWindow.getAllWindows().find(w => (w as any).isMainWindow && !w.isDestroyed());
      if (mainWindow) {
        mainWindow.webContents.send('request-player-state');
      }
    });

    ipcMain.handle('toggle-floating-lyrics-lock', () => {
      this.#isFloatingLyricsLocked = !this.#isFloatingLyricsLocked;
      this.#saveConfig({ isLocked: this.#isFloatingLyricsLocked });
      if (this.#floatingLyricsWindow && !this.#floatingLyricsWindow.isDestroyed()) {
        this.#floatingLyricsWindow.setIgnoreMouseEvents(this.#isFloatingLyricsLocked, { forward: true });
        this.#floatingLyricsWindow.webContents.send('floating-lyrics-lock-status', this.#isFloatingLyricsLocked);
      }

      const mainWindow = BrowserWindow.getAllWindows().find(w => (w as any).isMainWindow && !w.isDestroyed());
      mainWindow?.webContents.send('floating-lyrics-lock-status', this.#isFloatingLyricsLocked);
      return this.#isFloatingLyricsLocked;
    });

    ipcMain.handle('is-floating-lyrics-locked', () => {
      return this.#isFloatingLyricsLocked;
    });
  }

  openFloatingLyrics() {
    if (this.#floatingLyricsWindow) return;

    const config = this.#loadConfig();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: scrWidth, height: scrHeight } = primaryDisplay.workAreaSize;

    const defaultWidth = Math.max(250, Math.floor(scrWidth * 0.15));
    const defaultHeight = Math.max(300, Math.floor(scrHeight * 0.35));

    const winWidth = defaultWidth;
    const winHeight = defaultHeight;

    let isVisible = false;
    if (config && typeof config.x === 'number' && typeof config.y === 'number') {
      const rect = { x: config.x, y: config.y, width: winWidth, height: winHeight };
      const displays = screen.getAllDisplays();
      for (const display of displays) {
        const bounds = display.bounds;
        const overlapX = Math.max(0, Math.min(rect.x + rect.width, bounds.x + bounds.width) - Math.max(rect.x, bounds.x));
        const overlapY = Math.max(0, Math.min(rect.y + rect.height, bounds.y + bounds.height) - Math.max(rect.y, bounds.y));
        if (overlapX > 50 && overlapY > 50) {
          isVisible = true;
          break;
        }
      }
    }

    const winX = isVisible && config ? config.x : Math.floor((scrWidth - winWidth) / 2);
    const winY = isVisible && config ? config.y : Math.floor((scrHeight - winHeight) / 2);

    this.#floatingLyricsWindow = new BrowserWindow({
      width: winWidth,
      height: winHeight,
      x: winX,
      y: winY,
      frame: false,
      transparent: true,
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      title: 'Lyrics',
      icon: path.join(app.getAppPath(), 'buildResources', 'icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: this.#preload.path,
      },
    });

    if (this.#renderer instanceof URL) {
      this.#floatingLyricsWindow.loadURL(`${this.#renderer.origin}/#/floating-lyrics`);
    } else {
      this.#floatingLyricsWindow.loadFile(this.#renderer.path, { hash: '/floating-lyrics' });
    }

    const saveBounds = () => {
      if (this.#floatingLyricsWindow && !this.#floatingLyricsWindow.isDestroyed()) {
        const bounds = this.#floatingLyricsWindow.getBounds();
        this.#saveConfig({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        });
      }
    };

    let saveTimeout: NodeJS.Timeout | null = null;
    const debouncedSaveBounds = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveBounds, 500);
    };

    this.#floatingLyricsWindow.on('moved', debouncedSaveBounds);
    this.#floatingLyricsWindow.on('resized', debouncedSaveBounds);

    this.#floatingLyricsWindow.once('ready-to-show', () => {
      this.#floatingLyricsWindow?.setAlwaysOnTop(true, "screen-saver")
      this.#floatingLyricsWindow?.show();
      if (this.#isFloatingLyricsLocked) {
        this.#floatingLyricsWindow?.setIgnoreMouseEvents(true, { forward: true });
      }
      this.#floatingLyricsWindow?.webContents.send('floating-lyrics-lock-status', this.#isFloatingLyricsLocked);
    });

    const mainWindow = BrowserWindow.getAllWindows().find(w => (w as any).isMainWindow && !w.isDestroyed());
    const handleMainWindowClosed = () => {
      this.closeFloatingLyrics();
    };
    if (mainWindow) {
      mainWindow.once('closed', handleMainWindowClosed);
    }

    this.#floatingLyricsWindow.on('closed', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      this.#floatingLyricsWindow = null;

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.off('closed', handleMainWindowClosed);
      }

      const currentMainWindow = BrowserWindow.getAllWindows().find(w => (w as any).isMainWindow && !w.isDestroyed());
      currentMainWindow?.webContents.send('floating-lyrics-status', false);
      currentMainWindow?.webContents.send('floating-lyrics-lock-status', false);
    });

    mainWindow?.webContents.send('floating-lyrics-status', true);
    mainWindow?.webContents.send('floating-lyrics-lock-status', this.#isFloatingLyricsLocked);
  }

  closeFloatingLyrics() {
    if (this.#floatingLyricsWindow) {
      this.#floatingLyricsWindow.close();
      this.#floatingLyricsWindow = null;
    }
  }
}

export function floatingLyricsModule(options: ConstructorParameters<typeof FloatingLyricsManager>[0]): AppModule {
  return new FloatingLyricsManager(options);
}
