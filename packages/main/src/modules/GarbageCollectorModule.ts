import { BrowserWindow } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

export function garbageCollectorModule(): AppModule {
  return {
    enable({ app }: ModuleContext): void {
      setInterval(() => {
        // Trigger GC in the main process
        if (typeof global !== 'undefined' && (global as any).gc) {
          try {
            (global as any).gc();
          } catch (e) {
            console.error('Failed to run main process GC:', e);
          }
        }

        // Trigger GC in all open renderer windows
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.executeJavaScript('if (typeof window !== "undefined" && window.gc) { window.gc(); }')
              .catch(() => { });
          }
        });
      }, 30000); // Run every 30 seconds
    }
  };
}
