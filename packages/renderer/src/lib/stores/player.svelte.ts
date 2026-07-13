import { ytmusic, updateDiscordPresence } from "@app/preload";
import { tick } from "svelte";

export interface Track {
  videoId: string;
  name: string;
  artist: string;
  artistId?: string | null;
  thumbnail: string;
  duration?: number | null;
  setVideoId?: string | null;
}

class PlayerStore {
  // Playback state
  isPlaying = $state(false);
  isBuffering = $state(false);
  currentTrack = $state<Track | null>(null);
  queue = $state<Track[]>([]);
  currentIndex = $state(-1);
  currentTime = $state(0);
  duration = $state(0);
  volume = $state(50); // 0-100
  isMuted = $state(false);
  discordPresenceEnabled = $state(true);
  #showExtended = $state(false);
  get showExtended() {
    return this.#showExtended;
  }
  set showExtended(val: boolean) {
    if (typeof document !== "undefined" && document.startViewTransition) {
      document.startViewTransition(async () => {
        this.#showExtended = val;
        await tick();
      });
    } else {
      this.#showExtended = val;
    }
  }
  playbackRate = $state(1.0);
  lyricsFontSize = $state<'small' | 'medium' | 'large'>('medium');
  repeatMode = $state<'off' | 'all' | 'one'>('off');
  isShuffled = $state(false);
  originalQueue = $state<Track[]>([]);
  selectedSource = $state("Auto");
  likeStatus = $state<'Indifferent' | 'Like' | 'Dislike'>('Indifferent');
  likedSongsLoaded = $state(false);
  likedSongIds = $state<string[]>([]);
  isAuthed = $state<boolean | null>(null);
  disableQueueControls = $state(false);

  // Right sidebar tab state: 'none' | 'lyrics' | 'queue' | 'listen-together'
  #activeSidebar = $state<'none' | 'lyrics' | 'queue' | 'listen-together'>('queue');
  get activeSidebar() {
    return this.#activeSidebar;
  }
  set activeSidebar(val: 'none' | 'lyrics' | 'queue' | 'listen-together') {
    if (typeof document !== "undefined" && document.startViewTransition) {
      document.startViewTransition(async () => {
        this.#activeSidebar = val;
        await tick();
      });
    } else {
      this.#activeSidebar = val;
    }
    this.saveState();
  }

  // HTML Audio instance (created on client)
  audio: HTMLAudioElement | null = null;
  #stateLoaded = false;
  currentAbortController: AbortController | null = null;
  #stuckTimeout: any = null;

  init() {
    if (typeof window !== "undefined" && !this.audio) {
      this.audio = new Audio();
      this.loadState();

      if (this.isAuthed === null) {
        ytmusic.getAccountInfo().then((info) => {
          if (info && info.accountName) {
            this.isAuthed = true;
            this.fetchLikedSongs();
          } else {
            this.isAuthed = false;
          }
        }).catch(() => {
          this.isAuthed = false;
        });
      } else if (this.isAuthed) {
        this.fetchLikedSongs();
      }

      this.audio.volume = this.volume / 100;
      this.audio.muted = this.isMuted;

      let lastSaveTime = 0;
      this.audio.addEventListener("timeupdate", () => {
        this.clearStuckTimeout();
        this.isBuffering = false;
        if (this.audio && this.audio.readyState >= 1) {
          this.currentTime = this.audio.currentTime;
          const now = Date.now();
          if (now - lastSaveTime > 2000) {
            this.saveState();
            lastSaveTime = now;
          }
          this.#updateMediaSessionPositionState();
        }
      });

      this.audio.addEventListener("durationchange", () => {
        if (this.audio) {
          this.duration = this.audio.duration || 0;
          this.saveState();
          this.#updateMediaSessionPositionState();
        }
      });

      this.audio.addEventListener("ended", () => {
        this.clearStuckTimeout();
        this.isBuffering = false;
        this.handleSongEnded();
      });

      this.audio.addEventListener("waiting", () => {
        this.isBuffering = true;
        if (this.isPlaying && this.audio) {
          this.clearStuckTimeout();
          this.#stuckTimeout = setTimeout(() => {
            console.warn("Audio playback stuck. Attempting recovery...");
            this.recoverStuckAudio();
          }, 3000);
        }
      });

      this.audio.addEventListener("playing", () => {
        this.clearStuckTimeout();
        this.isBuffering = false;
        if (this.audio) {
          this.audio.playbackRate = this.playbackRate;
        }
        this.#updateMediaSessionPlaybackState();
      });

      this.audio.addEventListener("error", () => {
        console.error("Audio error encountered:", this.audio?.error);
        this.clearStuckTimeout();
        this.isBuffering = false;
        this.recoverStuckAudio();
      });

      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", () => {
          this.togglePlay();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          this.togglePlay();
        });
        navigator.mediaSession.setActionHandler("nexttrack", () => {
          this.next();
        });
        navigator.mediaSession.setActionHandler("previoustrack", () => {
          this.prev();
        });
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (details.seekTime !== undefined) {
            this.seek(details.seekTime);
          }
        });
      }

      window.addEventListener("keydown", (e) => {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.hasAttribute("contenteditable") ||
            (active as HTMLElement).isContentEditable)
        ) {
          return;
        }

        switch (e.key) {
          case " ":
            e.preventDefault();
            this.togglePlay();
            break;
          case "ArrowLeft":
            e.preventDefault();
            this.seek(Math.max(0, this.currentTime - 5));
            break;
          case "ArrowRight":
            e.preventDefault();
            this.seek(Math.min(this.duration, this.currentTime + 5));
            break;
          case "ArrowUp":
            e.preventDefault();
            this.seek(Math.max(0, this.currentTime + 5));
            break;
          case "ArrowDown":
            e.preventDefault();
            this.seek(Math.max(0, this.currentTime - 5));
            break;
          case "m":
          case "M":
            this.toggleMute();
            break;
          case "n":
          case "N":
            this.next();
            break;
          case "p":
          case "P":
            this.prev();
            break;
        }
      });
    }
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    if (this.audio) {
      this.audio.playbackRate = rate;
    }
    this.saveState();
  }

  setLyricsFontSize(size: 'small' | 'medium' | 'large') {
    this.lyricsFontSize = size;
    this.saveState();
  }

  clearStuckTimeout() {
    if (this.#stuckTimeout) {
      clearTimeout(this.#stuckTimeout);
      this.#stuckTimeout = null;
    }
  }

  recoverStuckAudio() {
    console.log("Audio playback stuck or error. Retrying stream recovery...");
    this.resumeTrackStream(this.isPlaying);
  }

  loadState() {
    if (typeof window === "undefined" || this.#stateLoaded) return;
    this.#stateLoaded = true;
    try {
      const saved = localStorage.getItem("tutti_player_state");
      if (saved) {
        const state = JSON.parse(saved);
        if (typeof state.volume === "number") this.volume = state.volume;
        if (typeof state.isMuted === "boolean") this.isMuted = state.isMuted;
        if (typeof state.discordPresenceEnabled === "boolean") this.discordPresenceEnabled = state.discordPresenceEnabled;
        if (state.currentTrack) {
          this.currentTrack = state.currentTrack;
          this.likeStatus = this.likedSongIds.includes(state.currentTrack.videoId) ? 'Like' : 'Indifferent';
        }
        if (Array.isArray(state.queue)) this.queue = state.queue;
        if (typeof state.currentIndex === "number") this.currentIndex = state.currentIndex;
        if (typeof state.currentTime === "number") this.currentTime = state.currentTime;
        if (typeof state.duration === "number") this.duration = state.duration;
        if (typeof state.playbackRate === "number") this.playbackRate = state.playbackRate;
        if (state.lyricsFontSize) this.lyricsFontSize = state.lyricsFontSize;
        if (state.repeatMode) this.repeatMode = state.repeatMode;
        if (typeof state.isShuffled === "boolean") this.isShuffled = state.isShuffled;
        if (Array.isArray(state.originalQueue)) this.originalQueue = state.originalQueue;
        if (state.selectedSource) this.selectedSource = state.selectedSource;
      }
    } catch (e) {
      console.error("Failed to load player state:", e);
    }
  }

  saveState() {
    if (typeof window === "undefined") return;
    try {
      const state = {
        volume: this.volume,
        isMuted: this.isMuted,
        currentTrack: this.currentTrack,
        queue: this.queue,
        currentIndex: this.currentIndex,
        currentTime: this.currentTime,
        duration: this.duration,
        activeSidebar: this.activeSidebar,
        playbackRate: this.playbackRate,
        lyricsFontSize: this.lyricsFontSize,
        repeatMode: this.repeatMode,
        isShuffled: this.isShuffled,
        originalQueue: this.originalQueue,
        selectedSource: this.selectedSource,
        discordPresenceEnabled: this.discordPresenceEnabled,
      };
      localStorage.setItem("tutti_player_state", JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save player state:", e);
    }
  }

  updatePresence() {
    if (typeof window === "undefined") return;
    if (!this.discordPresenceEnabled || !this.currentTrack) {
      updateDiscordPresence(null);
      return;
    }

    let startTimestamp: number | undefined;
    let endTimestamp: number | undefined;

    if (this.isPlaying) {
      const now = Date.now();
      startTimestamp = now - Math.floor(this.currentTime * 1000);
      if (this.duration) {
        endTimestamp = startTimestamp + Math.floor(this.duration * 1000);
      }
    }

    import("$lib/stores/sync.svelte").then(({ syncStore }) => {
      const buttons = [
        {
          label: "Listen on YouTube Music",
          url: `https://music.youtube.com/watch?v=${this.currentTrack!.videoId}`
        }
      ];

      // if (syncStore.role === 'host' && syncStore.roomCode) {
      //   buttons.push({
      //     label: "Listen Together",
      //     url: `https://tutti.miukyo.my.id/join?room=${syncStore.roomCode}`
      //   });
      // }

      // waiting for homepage website to be live


      updateDiscordPresence({
        state: this.currentTrack!.artist,
        details: this.currentTrack!.name,
        startTimestamp,
        endTimestamp,
        largeImageKey: this.currentTrack!.thumbnail,
        buttons
      });
    });
  }

  syncStateToPeers() {
    if (typeof window !== "undefined") {
      import("$lib/stores/sync.svelte").then(({ syncStore }) => {
        if (syncStore.role === 'host') {
          syncStore.broadcast({
            type: 'sync',
            track: this.currentTrack,
            isPlaying: this.isPlaying,
            currentTime: this.currentTime,
            queue: this.queue,
            currentIndex: this.currentIndex,
            sentAt: Date.now()
          });
        }
      });
    }
  }

  toggleDiscordPresence() {
    this.discordPresenceEnabled = !this.discordPresenceEnabled;
    this.saveState();
    this.updatePresence();
  }

  setVolume(val: number) {
    this.volume = val;
    if (this.audio) {
      this.audio.volume = val / 100;
    }
    this.saveState();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.audio) {
      this.audio.muted = this.isMuted;
    }
    this.saveState();
  }

  toggleShuffle() {
    if (this.disableQueueControls) return;
    this.isShuffled = !this.isShuffled;
    if (this.isShuffled) {
      this.originalQueue = [...this.queue];
      if (this.queue.length > 1) {
        const currentTrack = this.currentTrack;
        const otherTracks = this.queue.filter((t) => t.videoId !== currentTrack?.videoId);
        for (let i = otherTracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
        }
        if (currentTrack) {
          this.queue = [currentTrack, ...otherTracks];
          this.currentIndex = 0;
        } else {
          this.queue = otherTracks;
          this.currentIndex = -1;
        }
      }
    } else {
      if (this.originalQueue.length > 0) {
        const currentTrack = this.currentTrack;
        this.queue = [...this.originalQueue];
        if (currentTrack) {
          const idx = this.queue.findIndex((t) => t.videoId === currentTrack.videoId);
          this.currentIndex = idx !== -1 ? idx : 0;
        }
      }
    }
    this.saveState();
  }

  toggleRepeat() {
    if (this.disableQueueControls) return;
    if (this.repeatMode === 'off') {
      this.repeatMode = 'all';
    } else if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
    } else {
      this.repeatMode = 'off';
    }
    this.saveState();
  }

  async fetchLikedSongs() {
    if (this.isAuthed === false) return;
    if (this.likedSongsLoaded) return;
    try {
      const likedSongs = await ytmusic.getPlaylistVideos('VLLM');

      this.likedSongIds = likedSongs.map(s => s.videoId).filter(Boolean) as string[];
      this.likedSongsLoaded = true;
      // Update likeStatus for currentTrack if loaded
      if (this.currentTrack) {
        this.likeStatus = this.likedSongIds.includes(this.currentTrack.videoId) ? 'Like' : 'Indifferent';
      }
    } catch (e) {
      console.warn("Failed to fetch liked songs:", e);
    }
  }

  async toggleLike() {
    if (!this.currentTrack) return;
    const targetStatus = this.likeStatus === 'Like' ? 'Indifferent' : 'Like';
    const prevStatus = this.likeStatus;

    // Optimistic update
    this.likeStatus = targetStatus;
    if (targetStatus === 'Like') {
      if (!this.likedSongIds.includes(this.currentTrack.videoId)) {
        this.likedSongIds.push(this.currentTrack.videoId);
      }
    } else {
      this.likedSongIds = this.likedSongIds.filter(id => id !== this.currentTrack?.videoId);
    }

    try {
      await ytmusic.rateSong(this.currentTrack.videoId, targetStatus);
    } catch (e) {
      console.error("Failed to rate song:", e);
      // Revert on error
      this.likeStatus = prevStatus;
      if (prevStatus === 'Like') {
        if (!this.likedSongIds.includes(this.currentTrack.videoId)) {
          this.likedSongIds.push(this.currentTrack.videoId);
        }
      } else {
        this.likedSongIds = this.likedSongIds.filter(id => id !== this.currentTrack?.videoId);
      }
    }
  }

  handleSongEnded() {
    if (this.repeatMode === 'one') {
      if (this.audio) {
        this.audio.currentTime = 0;
        this.audio.play().catch(console.error);
      }
    } else {
      this.next();
    }
  }

  async #fetchAndPlayStream(track: Track, startTime: number, signal: AbortSignal, autoPlay: boolean = true): Promise<void> {
    const manifest = await ytmusic.getStreamManifest(track.videoId);
    if (signal.aborted || this.currentTrack?.videoId !== track.videoId) return;

    const audioStreams = manifest.streams.filter((s: any) => s.type === "audio");
    if (audioStreams.length === 0) {
      throw new Error("No audio streams found");
    }

    const bestStream = audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate)[0];

    if (!this.audio) return;

    this.audio.src = bestStream.url;

    await new Promise<void>((resolve, reject) => {
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        this.audio?.removeEventListener("loadedmetadata", onLoadedMetadata);
        this.audio?.removeEventListener("error", onError);
      };

      const onLoadedMetadata = () => {
        cleanup();
        if (this.audio && !signal.aborted && this.currentTrack?.videoId === track.videoId) {
          if (startTime > 0) {
            this.audio.currentTime = startTime;
          }
          if (autoPlay) {
            this.audio.play().then(resolve).catch(reject);
          } else {
            this.audio.pause();
            resolve();
          }
        } else {
          reject(new Error("Track changed or audio is null"));
        }
      };

      const onError = () => {
        cleanup();
        reject(this.audio?.error || new Error("Audio loading failed"));
      };

      this.audio?.addEventListener("loadedmetadata", onLoadedMetadata);
      this.audio?.addEventListener("error", onError);
    });

    this.isPlaying = autoPlay;
    this.saveState();
    this.#updateMediaSessionPlaybackState();
    this.updatePresence();
    this.syncStateToPeers();
  }

  async #startStreamPlayback(track: Track, startTime: number, signal: AbortSignal, autoPlay: boolean = true): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      if (signal.aborted || this.currentTrack?.videoId !== track.videoId) return;

      try {
        await this.#fetchAndPlayStream(track, startTime, signal, autoPlay);
        if (startTime === 0 && autoPlay) {
          ytmusic.addHistoryItem(track.videoId).catch((err) => {
            console.error("Failed to add history item:", err);
          });
        }
        success = true;
      } catch (e) {
        if (signal.aborted) return;
        attempt++;
        console.error(`Error playing track (attempt ${attempt}/${maxRetries}):`, e);
        if (attempt < maxRetries) {
          if (signal.aborted || this.currentTrack?.videoId !== track.videoId) return;
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        } else {
          console.error(`Failed to play track after ${maxRetries} attempts.`);
        }
      }
    }
  }

  async playTrack(track: Track, newQueue: Track[] = [], autoPlay: boolean = true, startTime: number = 0, isSyncTriggered: boolean = false) {
    if (this.disableQueueControls && !isSyncTriggered) return;
    this.init();

    // Instantly stop and reset the previous song
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio.load();
    }


    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    if (newQueue.length > 0) {
      this.isShuffled = false;
      this.originalQueue = [];
      this.queue = newQueue;
      const idx = newQueue.findIndex((t) => t.videoId === track.videoId);
      this.currentIndex = idx !== -1 ? idx : 0;
    } else {
      // Add or find in queue
      const idx = this.queue.findIndex((t) => t.videoId === track.videoId);
      if (idx !== -1) {
        this.currentIndex = idx;
      } else {
        this.queue.push(track);
        this.currentIndex = this.queue.length - 1;
      }
    }

    this.currentTrack = track;
    this.isPlaying = autoPlay;
    this.isBuffering = true;
    this.currentTime = startTime;
    this.duration = track.duration || 0;
    this.likeStatus = this.likedSongIds.includes(track.videoId) ? 'Like' : 'Indifferent';
    this.saveState();
    this.#updateMediaSessionMetadata();
    this.#updateMediaSessionPlaybackState();
    this.updatePresence();
    this.syncStateToPeers();

    await this.#startStreamPlayback(track, startTime, signal, autoPlay);
  }

  async playWithUpNext(track: Track) {
    if (this.disableQueueControls) return;
    this.init();

    // Play track immediately
    await this.playTrack(track, [track]);

    try {
      // Load next recommendations and queue them
      const upNexts = await ytmusic.getUpNexts(track.videoId);
      if (upNexts && upNexts.length > 0) {
        const recommendedTracks: Track[] = upNexts.map((item) => ({
          videoId: item.videoId,
          name: item.title,
          artist: item.artists,
          thumbnail: item.thumbnail,
          duration: null,
        }));
        // Update queue preserving current track at index 0
        this.queue = [track, ...recommendedTracks];
        this.currentIndex = 0;
        this.saveState();
      }
    } catch (e) {
      console.error("Error getting upNexts:", e);
    }
  }

  async resumeTrackStream(autoPlay: boolean = this.isPlaying) {
    if (!this.currentTrack || !this.audio) return;
    this.isBuffering = true;
    const track = this.currentTrack;

    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    await this.#startStreamPlayback(track, this.currentTime, signal, autoPlay);
  }

  togglePlay(isSyncTriggered: boolean = false) {
    if (this.disableQueueControls && !isSyncTriggered) return;
    this.init();
    if (!this.audio || !this.currentTrack) return;

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
      this.isBuffering = false;
      this.saveState();
      this.#updateMediaSessionPlaybackState();
      this.updatePresence();
      this.syncStateToPeers();
    } else {
      if (!this.audio.src || this.audio.src === "") {
        this.isPlaying = true;
        this.resumeTrackStream(true);
      } else {
        this.audio.play().then(() => {
          this.isPlaying = true;
          this.saveState();
          this.#updateMediaSessionPlaybackState();
          this.updatePresence();
          this.syncStateToPeers();
        }).catch((e) => {
          console.warn("Failed to resume playback, attempting stream recovery...", e);
          this.isPlaying = true;
          this.resumeTrackStream(true);
        });
      }
    }
  }

  seek(time: number, isSyncTriggered: boolean = false) {
    if (this.disableQueueControls && !isSyncTriggered) return;
    if (this.audio) {
      this.isBuffering = true;
      this.audio.currentTime = time;
      this.currentTime = time;
      this.saveState();
      this.#updateMediaSessionPositionState();
      this.updatePresence();
      this.syncStateToPeers();
    }
  }

  parseDurationStr(durationStr: string): number {
    if (!durationStr) return 0;
    const parts = durationStr.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parts[0] || 0;
  }

  async next() {
    if (this.disableQueueControls) return;
    if (this.queue.length === 0) return;
    let nextIdx = this.currentIndex + 1;
    if (nextIdx >= this.queue.length) {
      if (this.repeatMode === 'off') {
        const lastTrack = this.currentTrack;
        if (lastTrack) {
          this.isBuffering = true;
          try {
            const upNexts = await ytmusic.getUpNexts(lastTrack.videoId);
            const existingIds = new Set(this.queue.map((t) => t.videoId));
            const newTracks: Track[] = [];

            for (const item of upNexts) {
              if (item.videoId && !existingIds.has(item.videoId)) {
                newTracks.push({
                  videoId: item.videoId,
                  name: item.title,
                  artist: item.artists,
                  thumbnail: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                  duration: this.parseDurationStr(item.duration)
                });
              }
            }

            if (newTracks.length > 0) {
              this.queue = [...this.queue, ...newTracks];
              if (this.originalQueue.length > 0) {
                this.originalQueue = [...this.originalQueue, ...newTracks];
              }
              this.saveState();
              this.playTrack(this.queue[nextIdx]);
              return;
            }
          } catch (e) {
            console.error("Failed to fetch autoplay upnexts:", e);
          }
        }
        this.isPlaying = false;
        this.isBuffering = false;
        this.#updateMediaSessionPlaybackState();
        this.updatePresence();
        return;
      } else {
        nextIdx = 0; // Loop queue
      }
    }
    this.playTrack(this.queue[nextIdx]);
  }

  prev() {
    if (this.disableQueueControls) return;
    if (this.queue.length === 0) return;
    let prevIdx = this.currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = this.queue.length - 1;
    }
    this.playTrack(this.queue[prevIdx]);
  }

  #updateMediaSessionMetadata() {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator && this.currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentTrack.name,
        artist: this.currentTrack.artist,
        artwork: [
          {
            src: this.currentTrack.thumbnail || `https://i.ytimg.com/vi/${this.currentTrack.videoId}/hqdefault.jpg`,
            sizes: "512x512",
            type: "image/jpeg"
          }
        ]
      });
    }
  }

  #updateMediaSessionPlaybackState() {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = this.isPlaying ? "playing" : "paused";
      this.#updateMediaSessionPositionState();
    }
  }

  #updateMediaSessionPositionState() {
    if (
      typeof navigator !== "undefined" &&
      "mediaSession" in navigator &&
      "setPositionState" in navigator.mediaSession &&
      this.audio &&
      !isNaN(this.audio.duration) &&
      isFinite(this.audio.duration) &&
      !isNaN(this.audio.currentTime) &&
      isFinite(this.audio.currentTime)
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: this.audio.duration,
          playbackRate: this.audio.playbackRate || 1.0,
          position: this.audio.currentTime
        });
      } catch (e) {
        console.warn("Failed to set MediaSession position state:", e);
      }
    }
  }
}

export const player = new PlayerStore();
