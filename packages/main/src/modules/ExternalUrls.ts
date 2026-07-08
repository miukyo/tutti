import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { shell } from 'electron';
import { URL } from 'node:url';

// ponytail: stateless AppModule replacement for ExternalUrls class
export function allowExternalUrls(externalUrls: Set<string>): AppModule {
  return {
    enable({ app }: ModuleContext): void {
      app.on('web-contents-created', (_, contents) => {
        contents.setWindowOpenHandler(({ url }) => {
          const { origin } = new URL(url);

          if (externalUrls.has(origin)) {
            shell.openExternal(url).catch(console.error);
          } else if (import.meta.env.DEV) {
            console.warn(`Blocked the opening of a disallowed external origin: ${origin}`);
          }

          return { action: 'deny' };
        });
      });
    }
  };
}