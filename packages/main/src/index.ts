import { app, ipcMain } from 'electron';
import type { AppInitConfig } from './AppInitConfig.js';
import { disallowMultipleAppInstance } from './modules/SingleInstanceApp.js';
import { createWindowManagerModule } from './modules/WindowManager.js';
import { terminateAppOnLastWindowClose } from './modules/ApplicationTerminatorOnLastWindowClose.js';
import { hardwareAccelerationMode } from './modules/HardwareAccelerationModule.js';
import { autoUpdater } from './modules/AutoUpdater.js';
import { allowInternalOrigins } from './modules/BlockNotAllowdOrigins.js';
import { allowExternalUrls } from './modules/ExternalUrls.js';
import { ytmusicModule } from './modules/YTMusicApiModule.js';
import { garbageCollectorModule } from './modules/GarbageCollectorModule.js';
import { discordPresenceModule } from './modules/DiscordPresence.js';
import { deepLinkModule } from './modules/DeepLink.js';
import { floatingLyricsModule } from './modules/FloatingLyricsModule.js';

export async function initApp(initConfig: AppInitConfig) {
  app.name = 'Tutti';
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.miukyo.tutti');
  }
  // Expose garbage collection globally in Node and Chromium
  app.commandLine.appendSwitch('js-flags', '--expose-gc');

  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('clear-cache', async () => {
    const { session } = require('electron');
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ['appcache', 'shadercache', 'cachestorage', 'serviceworkers']
    });
  });

  const modules = [
    disallowMultipleAppInstance(),
    terminateAppOnLastWindowClose(),
    hardwareAccelerationMode({ enable: true }),
    autoUpdater(),
    ytmusicModule(),
    discordPresenceModule(),
    deepLinkModule(),
    allowInternalOrigins(
      new Set([
        ...(initConfig.renderer instanceof URL ? [initConfig.renderer.origin] : []),
        'https://accounts.google.com',
        'https://music.youtube.com',
        'https://accounts.youtube.com',
      ]),
    ),
    // ponytail: simplified empty Set instantiation
    allowExternalUrls(new Set()),
    garbageCollectorModule(),
    createWindowManagerModule({ initConfig }),
    floatingLyricsModule({ initConfig }),
  ];

  for (const module of modules) {
    await module.enable({ app });
  }
}