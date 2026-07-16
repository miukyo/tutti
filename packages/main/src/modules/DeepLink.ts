import { ipcMain, BrowserWindow } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import path from 'node:path';

let pendingDeepLinkUrl: string | null = null;

function registerProtocol(app: any) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('tutti', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('tutti');
  }
}

// Check initial argv for deep link URL
const initialUrl = process.argv.find(arg => arg.startsWith('tutti://'));
if (initialUrl) {
  pendingDeepLinkUrl = initialUrl;
}

function sendOrQueueUrl(url: string) {
  const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && (w as any).isMainWindow);
  if (win && win.webContents && !win.webContents.isLoading()) {
    win.webContents.send('deep-link', url);
  } else {
    pendingDeepLinkUrl = url;
  }
}

class DeepLinkModule implements AppModule {
  enable({ app }: ModuleContext): void | Promise<void> {
    registerProtocol(app);

    app.on('second-instance', (event, argv) => {
      const url = argv.find(arg => arg.startsWith('tutti://'));
      if (url) {
        sendOrQueueUrl(url);
      }
    });

    app.on('open-url', (event, url) => {
      event.preventDefault();
      sendOrQueueUrl(url);
    });

    ipcMain.handle('get-pending-deep-link', () => {
      const url = pendingDeepLinkUrl;
      pendingDeepLinkUrl = null;
      return url;
    });
  }
}

export function deepLinkModule() {
  return new DeepLinkModule();
}
