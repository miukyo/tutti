import { ytmusic } from "@app/preload";

export interface Track {
  videoId: string;
  name: string;
  artist: string;
  artistId?: string | null;
  thumbnail: string;
  duration?: number | null;
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
  showExtended = $state(false);
  playbackRate = $state(1.0);
  lyricsFontSize = $state<'small' | 'medium' | 'large'>('medium');
  repeatMode = $state<'off' | 'all' | 'one'>('off');
  isShuffled = $state(false);
  originalQueue = $state<Track[]>([]);

  // Right sidebar tab state: 'none' | 'lyrics' | 'queue'
  #activeSidebar = $state<'none' | 'lyrics' | 'queue'>('queue');
  get activeSidebar() {
    return this.#activeSidebar;
  }
  set activeSidebar(val: 'none' | 'lyrics' | 'queue') {
    this.#activeSidebar = val;
    this.saveState();
  }

  // HTML Audio instance (created on client)
  audio: HTMLAudioElement | null = null;
  #stateLoaded = false;
  currentAbortController: AbortController | null = null;
  currentObjectUrl: string | null = null;
  #stuckTimeout: any = null;

  init() {
    if (typeof window !== "undefined" && !this.audio) {
      this.audio = new Audio();
      this.loadState();

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
        }
      });

      this.audio.addEventListener("durationchange", () => {
        if (this.audio) {
          this.duration = this.audio.duration || 0;
          this.saveState();
        }
      });

      this.audio.addEventListener("ended", () => {
        this.clearStuckTimeout();
        this.isBuffering = false;
        this.handleSongEnded();
      });

      this.audio.addEventListener("waiting", () => {
        this.isBuffering = true;
        if (this.isPlaying && this.audio && this.audio.src !== this.currentObjectUrl) {
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
      });

      this.audio.addEventListener("error", () => {
        console.error("Audio error encountered:", this.audio?.error);
        this.clearStuckTimeout();
        this.isBuffering = false;
        this.recoverStuckAudio();
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
    if (this.currentObjectUrl && this.audio) {
      console.log("Recovering from local Blob URL...");
      const savedTime = this.currentTime;
      this.audio.src = this.currentObjectUrl;
      const onCanPlay = () => {
        if (this.audio) {
          this.audio.currentTime = savedTime;
          this.audio.play().then(() => {
            this.isPlaying = true;
          }).catch((err) => {
            console.error("Failed to play recovered Blob:", err);
          });
        }
      };
      this.audio.addEventListener("canplay", onCanPlay, { once: true });
    } else {
      console.log("Blob URL not ready yet. Retrying stream recovery...");
      this.resumeTrackStream();
    }
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
        if (state.currentTrack) this.currentTrack = state.currentTrack;
        if (Array.isArray(state.queue)) this.queue = state.queue;
        if (typeof state.currentIndex === "number") this.currentIndex = state.currentIndex;
        if (typeof state.currentTime === "number") this.currentTime = state.currentTime;
        if (typeof state.duration === "number") this.duration = state.duration;
        if (typeof state.playbackRate === "number") this.playbackRate = state.playbackRate;
        if (state.lyricsFontSize) this.lyricsFontSize = state.lyricsFontSize;
        if (state.repeatMode) this.repeatMode = state.repeatMode;
        if (typeof state.isShuffled === "boolean") this.isShuffled = state.isShuffled;
        if (Array.isArray(state.originalQueue)) this.originalQueue = state.originalQueue;
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
      };
      localStorage.setItem("tutti_player_state", JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save player state:", e);
    }
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
    if (this.repeatMode === 'off') {
      this.repeatMode = 'all';
    } else if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
    } else {
      this.repeatMode = 'off';
    }
    this.saveState();
  }

  handleSongEnded() {
    if (this.repeatMode === 'one') {
      if (this.audio) {
        this.audio.currentTime = 0;
        this.audio.play().catch(console.error);
      }
    } else if (this.repeatMode === 'off' && this.currentIndex === this.queue.length - 1) {
      this.isPlaying = false;
      this.isBuffering = false;
    } else {
      this.next();
    }
  }

  async downloadTrack(url: string, size: number, container: string, signal: AbortSignal): Promise<Blob> {
    if (!size || size <= 0) {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return await response.blob();
    }

    const chunkSize = 1024 * 1024; // 1MB chunks
    const numChunks = Math.ceil(size / chunkSize);
    const buffers = new Array<ArrayBuffer>(numChunks);

    // Limit concurrency to 3 parallel requests
    const limit = 3;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < numChunks && !signal.aborted) {
        const index = nextIndex++;
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize - 1, size - 1);

        try {
          const res = await fetch(url, {
            headers: {
              Range: `bytes=${start}-${end}`
            },
            signal
          });
          if (!res.ok) throw new Error(`HTTP error ${res.status} on chunk ${index}`);
          buffers[index] = await res.arrayBuffer();
        } catch (e) {
          if (signal.aborted) throw e;
          console.warn(`Retry chunk ${index} due to error:`, e);
          await new Promise((resolve) => setTimeout(resolve, 500));
          const res = await fetch(url, {
            headers: {
              Range: `bytes=${start}-${end}`
            },
            signal
          });
          if (!res.ok) throw new Error(`HTTP error ${res.status} on chunk ${index} retry`);
          buffers[index] = await res.arrayBuffer();
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(limit, numChunks); i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    if (signal.aborted) {
      throw new Error("Download aborted");
    }

    return new Blob(buffers, { type: `audio/${container}` });
  }

  async #fetchAndPlayStream(track: Track, startTime: number, signal: AbortSignal): Promise<void> {
    const manifest = await ytmusic.getStreamManifest(track.videoId);
    if (signal.aborted || this.currentTrack?.videoId !== track.videoId) return;

    const audioStreams = manifest.streams.filter((s: any) => s.type === "audio");
    if (audioStreams.length === 0) {
      throw new Error("No audio streams found");
    }

    const bestStream = audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate)[0];

    if (!this.audio) return;

    this.audio.src = bestStream.url;

    if (startTime > 0) {
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
            this.audio.currentTime = startTime;
            this.audio.play().then(resolve).catch(reject);
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
    } else {
      await this.audio.play();
    }

    this.isPlaying = true;
    this.saveState();

    // Start downloading chunks in the background in parallel
    this.downloadTrack(bestStream.url, bestStream.size, bestStream.container || "mp4", signal)
      .then((blob) => {
        if (signal.aborted || this.currentTrack?.videoId !== track.videoId) return;
        if (this.currentObjectUrl) {
          URL.revokeObjectURL(this.currentObjectUrl);
        }
        this.currentObjectUrl = URL.createObjectURL(blob);
        console.log("Background download complete. Blob URL ready.");
      })
      .catch((err) => {
        if (!signal.aborted) {
          console.error("Background track download failed:", err);
        }
      });
  }

  async #startStreamPlayback(track: Track, startTime: number, signal: AbortSignal): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      if (signal.aborted || this.currentTrack?.videoId !== track.videoId) return;

      try {
        await this.#fetchAndPlayStream(track, startTime, signal);
        if (startTime === 0) {
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

  async playTrack(track: Track, newQueue: Track[] = []) {
    this.init();

    // Instantly stop and reset the previous song
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio.load();
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
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
    this.isPlaying = false;
    this.isBuffering = true;
    this.currentTime = 0;
    this.duration = track.duration || 0;
    this.saveState();

    await this.#startStreamPlayback(track, 0, signal);
  }

  async playWithUpNext(track: Track) {
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

  async resumeTrackStream() {
    if (!this.currentTrack || !this.audio) return;
    this.isBuffering = true;
    const track = this.currentTrack;

    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    await this.#startStreamPlayback(track, this.currentTime, signal);
  }

  togglePlay() {
    this.init();
    if (!this.audio || !this.currentTrack) return;

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
      this.isBuffering = false;

      // Swap to Blob URL while paused so the next play is local and instant!
      if (this.currentObjectUrl && this.audio.src !== this.currentObjectUrl) {
        const savedTime = this.currentTime;
        this.audio.src = this.currentObjectUrl;
        this.audio.currentTime = savedTime;
      }

      this.saveState();
    } else {
      if (!this.audio.src || this.audio.src === "") {
        this.resumeTrackStream();
      } else {
        this.audio.play().then(() => {
          this.isPlaying = true;
          this.saveState();
        }).catch((e) => {
          console.warn("Failed to resume playback from cached src, attempting stream recovery...", e);
          this.resumeTrackStream();
        });
      }
    }
  }

  seek(time: number) {
    if (this.audio) {
      this.isBuffering = true;
      if (this.currentObjectUrl && this.audio.src !== this.currentObjectUrl) {
        // Swap to the local Blob URL since we are seeking anyway!
        const wasPlaying = this.isPlaying;
        this.audio.src = this.currentObjectUrl;
        this.audio.currentTime = time;
        this.currentTime = time;
        if (wasPlaying) {
          this.audio.play().catch(console.error);
        }
      } else {
        this.audio.currentTime = time;
        this.currentTime = time;
      }
      this.saveState();
    }
  }

  next() {
    if (this.queue.length === 0) return;
    let nextIdx = this.currentIndex + 1;
    if (nextIdx >= this.queue.length) {
      nextIdx = 0; // Loop queue
    }
    this.playTrack(this.queue[nextIdx]);
  }

  prev() {
    if (this.queue.length === 0) return;
    let prevIdx = this.currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = this.queue.length - 1;
    }
    this.playTrack(this.queue[prevIdx]);
  }
}

export const player = new PlayerStore();
