import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';

// ponytail: stateless AppModule replacement for HardwareAccelerationModule class
export function hardwareAccelerationMode({ enable }: { enable: boolean }): AppModule {
  return {
    enable({ app }: ModuleContext): void {
      if (!enable) {
        app.disableHardwareAcceleration();
      }
    }
  };
}