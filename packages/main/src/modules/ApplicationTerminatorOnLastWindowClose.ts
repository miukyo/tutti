import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

// ponytail: stateless AppModule replacement for ApplicationTerminatorOnLastWindowClose class
export function terminateAppOnLastWindowClose(): AppModule {
  return {
    enable({ app }: ModuleContext): void {
      app.on('window-all-closed', () => app.quit());
    }
  };
}