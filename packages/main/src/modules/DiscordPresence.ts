import { ipcMain } from 'electron';
import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import net from 'node:net';
import path from 'node:path';

const CLIENT_ID = '1525638304995999795'; // Default YouTube Music client ID

interface PresenceInfo {
  state?: string;
  details?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  largeImageKey?: string;
  buttons?: { label: string; url: string }[];
}

class DiscordPresence implements AppModule {
  private socket: net.Socket | null = null;
  private connected = false;
  private isConnecting = false;
  private connectionCooldown = false;
  private queuedPresence: PresenceInfo | null = null;
  private currentPresence: PresenceInfo | null = null;
  private buffer = Buffer.alloc(0);

  enable({ app }: ModuleContext): void | Promise<void> {
    ipcMain.handle('update-discord-presence', (_event, presence: PresenceInfo | null) => {
      this.updatePresence(presence);
    });

    app.on('will-quit', () => {
      this.disconnect();
    });
  }

  private disconnect() {
    this.connected = false;
    this.isConnecting = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.buffer = Buffer.alloc(0);
  }

  private updatePresence(presence: PresenceInfo | null) {
    if (!presence) {
      // Clear presence / disconnect
      this.currentPresence = null;
      this.queuedPresence = null;
      if (this.connected && this.socket) {
        this.sendActivity(null);
      }
      return;
    }

    this.currentPresence = presence;

    if (this.connected && this.socket) {
      this.sendActivity(presence);
    } else {
      this.queuedPresence = presence;
      this.connect();
    }
  }

  private connect() {
    if (this.isConnecting || this.connected || this.connectionCooldown) {
      return;
    }

    this.isConnecting = true;
    const paths = this.getSocketPaths();
    this.tryNextPath(paths, 0);
  }

  private getSocketPaths(): string[] {
    const paths: string[] = [];
    if (process.platform === 'win32') {
      for (let i = 0; i < 10; i++) {
        paths.push(`\\\\.\\pipe\\discord-ipc-${i}`);
      }
    } else {
      const dirs = [
        process.env.XDG_RUNTIME_DIR,
        process.env.TMPDIR,
        process.env.TMP,
        process.env.TEMP,
        '/tmp'
      ].filter(Boolean) as string[];

      for (const dir of dirs) {
        for (let i = 0; i < 10; i++) {
          paths.push(path.join(dir, `discord-ipc-${i}`));
        }
      }
    }
    return paths;
  }

  private tryNextPath(paths: string[], index: number) {
    if (index >= paths.length) {
      // All paths failed
      this.isConnecting = false;
      this.triggerCooldown();
      return;
    }

    const socketPath = paths[index];
    const socket = net.createConnection(socketPath);

    socket.once('connect', () => {
      socket.removeAllListeners('error');
      this.socket = socket;
      this.setupSocketListeners();
      this.sendHandshake();
    });

    socket.once('error', () => {
      socket.destroy();
      this.tryNextPath(paths, index + 1);
    });
  }

  private triggerCooldown() {
    this.connectionCooldown = true;
    setTimeout(() => {
      this.connectionCooldown = false;
      // If we have a queued presence, try connecting again
      if (this.queuedPresence) {
        this.connect();
      }
    }, 15000); // 15 seconds cooldown
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('data', (chunk) => {
      const chunkBuf = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as any);
      this.buffer = Buffer.concat([this.buffer, chunkBuf]);
      this.parseBuffer();
    });

    this.socket.on('error', (err) => {
      console.error('Discord RPC socket error:', err);
      this.disconnect();
      this.triggerCooldown();
    });

    this.socket.on('close', () => {
      this.disconnect();
    });
  }

  private parseBuffer() {
    while (this.buffer.length >= 8) {
      const op = this.buffer.readUInt32LE(0);
      const len = this.buffer.readUInt32LE(4);
      if (this.buffer.length < 8 + len) {
        break; // Need more data
      }
      const payloadBuffer = this.buffer.subarray(8, 8 + len);
      this.buffer = this.buffer.subarray(8 + len);

      const payloadStr = payloadBuffer.toString('utf8');
      try {
        const payload = JSON.parse(payloadStr);
        if (op === 1) { // FRAME
          if (payload.evt === 'READY') {
            this.connected = true;
            this.isConnecting = false;
            if (this.queuedPresence) {
              this.sendActivity(this.queuedPresence);
              this.queuedPresence = null;
            }
          }
        } else if (op === 2) { // CLOSE
          this.disconnect();
        }
      } catch (e) {
        console.error('Failed to parse Discord IPC response payload:', e);
      }
    }
  }

  private sendHandshake() {
    if (!this.socket) return;
    const payload = {
      v: 1,
      client_id: CLIENT_ID
    };
    this.sendFrame(0, payload);
  }

  private sendActivity(presence: PresenceInfo | null) {
    if (!this.socket) return;

    const payload = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: presence ? {
          type: 2,
          status_display_type: 2,
          state: presence.state,
          details: presence.details,
          timestamps: (presence.startTimestamp || presence.endTimestamp) ? {
            ...(presence.startTimestamp ? { start: presence.startTimestamp } : {}),
            ...(presence.endTimestamp ? { end: presence.endTimestamp } : {})
          } : undefined,
          assets: {
            large_image: presence.largeImageKey,
          },
          buttons: presence.buttons
        } : null
      },
      nonce: Math.random().toString(36).substring(2, 15)
    };

    this.sendFrame(1, payload);
  }

  private sendFrame(op: number, payloadObj: any) {
    if (!this.socket) return;
    try {
      const payloadStr = JSON.stringify(payloadObj);
      const payloadBuffer = Buffer.from(payloadStr, 'utf8');
      const header = Buffer.alloc(8);
      header.writeUInt32LE(op, 0);
      header.writeUInt32LE(payloadBuffer.length, 4);
      this.socket.write(Buffer.concat([header, payloadBuffer]));
    } catch (e) {
      console.error('Failed to send frame to Discord RPC:', e);
    }
  }
}

export function discordPresenceModule() {
  return new DiscordPresence();
}
