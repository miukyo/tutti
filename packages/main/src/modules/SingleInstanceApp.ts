import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

// ponytail: stateless AppModule replacement for SingleInstanceApp class
export function disallowMultipleAppInstance(): AppModule {
  return {
    enable({ app }: ModuleContext): void {
      if (!app.requestSingleInstanceLock()) {
        app.quit();
        process.exit(0);
      }
    }
  };
}