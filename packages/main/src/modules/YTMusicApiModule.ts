import { ipcMain, BrowserWindow, app, safeStorage } from 'electron';
import { YTMusic } from '@app/api';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import path from 'node:path';
import fs from 'node:fs';

export function ytmusicModule(): AppModule {
  const yt = new YTMusic();
  let initializedPromise: Promise<void> | null = null;

  const tuttiPath = path.join(app.getPath('appData'), 'tutti');
  const cookiesPath = path.join(tuttiPath, 'cookies.txt');

  function ensureInitialized() {
    if (!initializedPromise) {
      let cookies: string | null = null;
      try {
        if (fs.existsSync(cookiesPath)) {
          const fileData = fs.readFileSync(cookiesPath);
          if (safeStorage.isEncryptionAvailable()) {
            cookies = safeStorage.decryptString(fileData);
          } else {
            cookies = fileData.toString('utf-8');
          }
        }
      } catch (e) {
        console.error("Failed to read cookies:", e);
      }
      initializedPromise = yt.initialize(cookies)
        .then(async (client) => {
          if (Object.keys((client as any).config || {}).length === 0) {
            await client.initialize(null);
          }
        })
        .catch(async (err) => {
          console.error("Failed to initialize with cookies, trying guest mode:", err);
          try {
            await yt.initialize(null);
          } catch (guestErr) {
            console.error("Failed to initialize guest mode:", guestErr);
          }
        });
    }
    return initializedPromise;
  }

  async function handleLogin(): Promise<boolean> {
    return new Promise((resolve) => {
      const loginWin = new BrowserWindow({
        width: 500,
        height: 650,
        title: "Login to YouTube Music",
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: 'login-temp',
        }
      });

      loginWin.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=https://music.youtube.com/&hl=en');

      let resolved = false;

      // Intercept request headers to capture authentic credentials (cookie + x-goog-authuser)
      loginWin.webContents.session.webRequest.onBeforeSendHeaders(
        {
          urls: ['https://music.youtube.com/*'],
        },
        async (details, callback) => {
          callback({ requestHeaders: details.requestHeaders });

          if (resolved) return;

          const headers = details.requestHeaders;
          const cookieKey = Object.keys(headers).find(k => k.toLowerCase() === 'cookie');
          const authUserKey = Object.keys(headers).find(k => k.toLowerCase() === 'x-goog-authuser');

          if (cookieKey && authUserKey) {
            const rawCookie = headers[cookieKey];
            const authUser = headers[authUserKey];

            if (rawCookie.includes('__Secure-3PAPISID')) {
              resolved = true;

              const authJSON = JSON.stringify({
                cookie: rawCookie,
                'x-goog-authuser': authUser
              });

              try {
                fs.mkdirSync(tuttiPath, { recursive: true });
                if (safeStorage.isEncryptionAvailable()) {
                  const encrypted = safeStorage.encryptString(authJSON);
                  fs.writeFileSync(cookiesPath, encrypted);
                } else {
                  fs.writeFileSync(cookiesPath, authJSON, 'utf-8');
                }
                initializedPromise = yt.initialize(authJSON).then(() => { });
                await initializedPromise;
                resolve(true);
              } catch (err) {
                console.error("Failed to save credentials:", err);
                resolve(false);
              }

              // Close the window on the next tick
              setTimeout(() => {
                loginWin.close();
              }, 0);
            }
          }
        }
      );

      loginWin.on('closed', () => {
        if (!resolved) {
          resolve(false);
        }
      });
    });
  }

  return {
    async enable({ app }: ModuleContext) {
      await app.whenReady();
      // Start initialization in the background immediately after app is ready
      ensureInitialized();

      ipcMain.handle('ytmusic', async (_event, method: string, ...args: any[]) => {
        if (method === 'login') {
          const success = await handleLogin();
          if (success) {
            await yt.clearCache();
          }
          return success;
        }

        if (method === 'logout') {
          try {
            // ponytail: rmSync with force: true simplifies exist check and delete
            fs.rmSync(cookiesPath, { force: true });
          } catch (e) {
            console.error("Failed to delete cookies file:", e);
          }
          await yt.clearCache();
          initializedPromise = yt.initialize(null).then(() => {});
          await initializedPromise;
          return true;
        }

        // Ensure yt is initialized before handling any requests
        await ensureInitialized();

        const target = yt as any;
        if (typeof target[method] !== 'function') {
          throw new Error(`Method ${method} is not defined on YTMusic`);
        }
        return await target[method](...args);
      });
    }
  };
}