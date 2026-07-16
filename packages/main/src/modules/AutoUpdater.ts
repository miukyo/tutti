import {AppModule} from '../AppModule.js';
import electronUpdater, {type AppUpdater, type Logger} from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';

type DownloadNotification = Parameters<AppUpdater['checkForUpdatesAndNotify']>[0];

export class AutoUpdater implements AppModule {

  readonly #logger: Logger | null;
  readonly #notification: DownloadNotification;

  constructor(
    {
      logger = null,
      downloadNotification = undefined,
    }:
      {
        logger?: Logger | null | undefined,
        downloadNotification?: DownloadNotification
      } = {},
  ) {
    this.#logger = logger;
    this.#notification = downloadNotification;
  }

  async enable(): Promise<void> {
    const updater = this.getAutoUpdater();

    ipcMain.handle('check-for-updates', async () => {
      return new Promise((resolve) => {
        let resolved = false;
        
        const onUpdateAvailable = (info: any) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve({ status: 'available', version: info.version });
        };
        
        const onUpdateNotAvailable = (info: any) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve({ status: 'not-available', version: info.version });
        };
        
        const onError = (err: any) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve({ status: 'error', message: err?.message || String(err) });
        };
        
        const cleanup = () => {
          updater.off('update-available', onUpdateAvailable);
          updater.off('update-not-available', onUpdateNotAvailable);
          updater.off('error', onError);
        };
        
        updater.on('update-available', onUpdateAvailable);
        updater.on('update-not-available', onUpdateNotAvailable);
        updater.on('error', onError);
        
        updater.checkForUpdates().catch((err) => {
          onError(err);
        });
      });
    });

    ipcMain.handle('restart-and-install', () => {
      updater.quitAndInstall();
    });

    updater.on('update-downloaded', (info) => {
      const window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && (w as any).isMainWindow);
      if (window) {
        window.webContents.send('update-downloaded', info);
      }
    });

    await this.runAutoUpdater();
  }

  getAutoUpdater(): AppUpdater {
    // Using destructuring to access autoUpdater due to the CommonJS module of 'electron-updater'.
    // It is a workaround for ESM compatibility issues, see https://github.com/electron-userland/electron-builder/issues/7976.
    const {autoUpdater} = electronUpdater;
    return autoUpdater;
  }

  async runAutoUpdater() {
    const updater = this.getAutoUpdater();
    try {
      updater.logger = this.#logger || null;
      updater.fullChangelog = true;

      if (import.meta.env.VITE_DISTRIBUTION_CHANNEL) {
        updater.channel = import.meta.env.VITE_DISTRIBUTION_CHANNEL;
      }

      return await updater.checkForUpdatesAndNotify(this.#notification);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('No published versions')) {
          return null;
        }
      }

      throw error;
    }
  }
}


export function autoUpdater(...args: ConstructorParameters<typeof AutoUpdater>) {
  return new AutoUpdater(...args);
}
