import type { AppModule } from '../AppModule.js';
import { ModuleContext } from '../ModuleContext.js';
import { BrowserWindow, session, app } from 'electron';
import type { AppInitConfig } from '../AppInitConfig.js';
import path from 'node:path';

class WindowManager implements AppModule {
  readonly #preload: { path: string };
  readonly #renderer: { path: string } | URL;
  readonly #openDevTools;
  #mainWindow: BrowserWindow | null = null;

  constructor({ initConfig, openDevTools = false }: { initConfig: AppInitConfig, openDevTools?: boolean }) {
    this.#preload = initConfig.preload;
    this.#renderer = initConfig.renderer;
    this.#openDevTools = openDevTools;
  }

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();

    // Intercept image requests to bypass Google/YouTube Music rate limits by spoofing headers
    session.defaultSession.webRequest.onBeforeSendHeaders(
      {
        urls: ['<all_urls>']
      },
      (details, callback) => {
        const headers = { ...details.requestHeaders };

        // Delete referer to make it look like a direct request
        delete headers['Referer'];
        delete headers['referer'];

        // Spoof browser user-agent and client hints
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
        headers['sec-ch-ua'] = '"Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"';
        headers['sec-fetch-mode'] = 'navigate';
        headers['sec-fetch-site'] = 'none';

        callback({ requestHeaders: headers });
      }
    );

    await this.restoreOrCreateWindow(true);
    app.on('second-instance', () => this.restoreOrCreateWindow(true));
    app.on('activate', () => this.restoreOrCreateWindow(true));
  }

  async createWindow(): Promise<BrowserWindow> {
    const browserWindow = new BrowserWindow({
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      minWidth: 1280,
      minHeight: 700,
      autoHideMenuBar: true,
      icon: path.join(app.getAppPath(), 'buildResources', 'icon.png'),
      titleBarStyle: 'hidden',
      ...(process.platform !== 'darwin' ? {
        titleBarOverlay: {
          height: 8,
          color: "#00000000",
          symbolColor: "white"
        }
      } : {}),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
        webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
        preload: this.#preload.path,
      },
    });

    if (this.#renderer instanceof URL) {
      await browserWindow.loadURL(this.#renderer.href);
    } else {
      await browserWindow.loadFile(this.#renderer.path);
    }

    browserWindow.on('closed', () => {
      this.#mainWindow = null;
    });

    this.#mainWindow = browserWindow;
    return browserWindow;
  }

  async restoreOrCreateWindow(show = false) {
    let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

    if (window === undefined) {
      window = await this.createWindow();
    }

    this.#mainWindow = window;

    if (!show) {
      return window;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    window?.show();

    if (this.#openDevTools) {
      window?.webContents.openDevTools();
    }

    window.focus();

    return window;
  }
}

export function createWindowManagerModule(...args: ConstructorParameters<typeof WindowManager>) {
  return new WindowManager(...args);
}
