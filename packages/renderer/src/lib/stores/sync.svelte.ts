import { Peer } from "peerjs";
import { player } from "$lib/stores/player.svelte";
import { getPendingDeepLink, onDeepLink } from "@app/preload";

export interface Participant {
  peerId: string;
  name: string;
  photoUrl?: string;
  role: 'host' | 'guest';
}

export class SyncStore {
  roomCode = $state<string | null>(null);
  role = $state<'host' | 'guest' | 'none'>('none');
  peer = $state<Peer | null>(null);
  connections = $state<any[]>([]);
  status = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');
  error = $state<string | null>(null);
  participants = $state<Participant[]>([]);
  localProfile = $state<{ name: string; photoUrl?: string } | null>(null);

  init() {
    if (typeof window !== "undefined") {
      // Setup deep link handlers
      getPendingDeepLink().then((url) => {
        if (url) this.handleDeepLink(url);
      });

      onDeepLink((url) => {
        if (url) this.handleDeepLink(url);
      });
    }
  }

  setLocalProfile(profile: { name: string; photoUrl?: string }) {
    this.localProfile = profile;
  }

  handleDeepLink(url: string) {
    try {
      const parsed = new URL(url);
      const room = parsed.searchParams.get("room");
      if (room) {
        this.joinRoom(room);
      }
    } catch (e) {
      // In case URL parsing fails due to custom scheme
      const match = url.match(/[?&]room=([^&]+)/);
      if (match && match[1]) {
        this.joinRoom(match[1]);
      }
    }
  }

  async createRoom() {
    this.leaveRoom();
    this.status = 'connecting';
    this.error = null;

    // Generate a random 6-character room code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const peerId = `tutti-${code}`;

    const config = {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          {
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:5349?transport=udp',
              'turn:openrelay.metered.ca:5349?transport=tcp',
              'turns:openrelay.metered.ca:443?transport=tcp',
              'turns:openrelay.metered.ca:5349?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      },
      debug: 1
    };

    const peer = new Peer(peerId, config);

    peer.on('open', () => {
      this.peer = peer;
      this.roomCode = code;
      this.role = 'host';
      this.status = 'connected';
      this.participants = [{
        peerId: peer.id,
        name: this.localProfile?.name || 'Host',
        photoUrl: this.localProfile?.photoUrl,
        role: 'host'
      }];
      player.updatePresence();
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.connections = [...this.connections, conn];
        this.sendSyncState(conn);
      });

      conn.on('data', (data: any) => {
        if (data.type === 'hello') {
          const newGuest: Participant = {
            peerId: conn.peer,
            name: data.name || 'Guest',
            photoUrl: data.photoUrl,
            role: 'guest'
          };
          this.participants = [...this.participants.filter(p => p.peerId !== conn.peer), newGuest];
          this.broadcast({
            type: 'participants-list',
            participants: this.participants
          });
        }
      });

      conn.on('close', () => {
        this.connections = this.connections.filter(c => c !== conn);
        this.participants = this.participants.filter(p => p.peerId !== conn.peer);
        this.broadcast({
          type: 'participants-list',
          participants: this.participants
        });
      });

      conn.on('error', (err) => {
        console.error("Host connection error:", err);
        conn.close();
      });
    });

    peer.on('error', (err) => {
      console.error("Host PeerJS error:", err);
      this.error = `Failed to create room: ${err.type || 'unknown error'}`;
      this.leaveRoom();
    });
  }

  async joinRoom(code: string) {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    this.leaveRoom();
    this.status = 'connecting';
    this.error = null;

    const config = {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          {
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:5349?transport=udp',
              'turn:openrelay.metered.ca:5349?transport=tcp',
              'turns:openrelay.metered.ca:443?transport=tcp',
              'turns:openrelay.metered.ca:5349?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      },
      debug: 1
    };

    const peer = new Peer(config);

    peer.on('open', () => {
      this.peer = peer;
      const targetPeerId = `tutti-${cleanCode}`;
      const conn = peer.connect(targetPeerId);

      conn.on('open', () => {
        this.roomCode = cleanCode;
        this.role = 'guest';
        this.status = 'connected';
        this.connections = [conn];
        player.disableQueueControls = true;
        conn.send({
          type: 'hello',
          name: this.localProfile?.name || 'Guest',
          photoUrl: this.localProfile?.photoUrl
        });
        player.updatePresence();
      });

      conn.on('data', (data: any) => {
        this.handleSyncMessage(data);
      });

      conn.on('close', () => {
        this.error = "Connection to host closed.";
        this.leaveRoom();
      });

      conn.on('error', (err) => {
        console.error("Guest connection error:", err);
        this.error = "Failed to connect to host.";
        this.leaveRoom();
      });
    });

    peer.on('error', (err) => {
      console.error("Guest PeerJS error:", err);
      this.error = `Failed to connect: ${err.type || 'unknown error'}`;
      this.leaveRoom();
    });
  }

  leaveRoom() {
    this.role = 'none';
    this.roomCode = null;
    this.status = 'disconnected';
    this.participants = [];
    player.disableQueueControls = false;

    for (const conn of this.connections) {
      try {
        conn.close();
      } catch {}
    }
    this.connections = [];

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }

    player.updatePresence();
  }

  broadcast(message: any) {
    if (this.role !== 'host') return;
    for (const conn of this.connections) {
      if (conn.open) {
        conn.send(message);
      }
    }
  }

  sendSyncState(conn: any) {
    if (!player.currentTrack) return;
    conn.send({
      type: 'sync',
      track: player.currentTrack,
      isPlaying: player.isPlaying,
      currentTime: player.currentTime,
      queue: player.queue,
      currentIndex: player.currentIndex,
      sentAt: Date.now()
    });
  }

  private handleSyncMessage(data: any) {
    if (data.type === 'participants-list') {
      this.participants = data.participants;
      return;
    }

    if (data.type === 'sync') {
      const { track, isPlaying, currentTime, queue, currentIndex, sentAt } = data;

      // Sync queue list and index first
      if (queue && Array.isArray(queue)) {
        player.queue = queue;
        if (typeof currentIndex === 'number') {
          player.currentIndex = currentIndex;
        }
      }

      // Adjust for network delay
      const delay = (Date.now() - sentAt) / 1000;
      const targetTime = currentTime + delay;

      // 1. Sync track
      if (!player.currentTrack || player.currentTrack.videoId !== track.videoId) {
        player.playTrack(track, [], isPlaying, targetTime, true);
      } else {
        // 2. Sync currentTime (if difference is more than 1.5s)
        if (Math.abs(player.currentTime - targetTime) > 1.5) {
          player.seek(targetTime, true);
        }

        // 3. Sync play/pause state
        if (player.isPlaying !== isPlaying) {
          player.togglePlay(true);
        }
      }
    }
  }
}

export const syncStore = new SyncStore();
