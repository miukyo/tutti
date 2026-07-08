import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { URL } from 'node:url';

// ponytail: stateless AppModule replacement for BlockNotAllowedOrigins class
export function allowInternalOrigins(allowedOrigins: Set<string> = new Set()): AppModule {
  const origins = structuredClone(allowedOrigins);
  return {
    enable({ app }: ModuleContext): void {
      app.on('web-contents-created', (_, contents) => {
        contents.on('will-navigate', (event, url) => {
          const { origin } = new URL(url);
          if (origins.has(origin)) {
            return;
          }

          event.preventDefault();

          if (import.meta.env.DEV) {
            console.warn(`Blocked navigating to disallowed origin: ${origin}`);
          }
        });
      });
    }
  };
}