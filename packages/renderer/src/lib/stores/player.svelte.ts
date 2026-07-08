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
  currentTrack = $state<Track | null>(null);
  queue = $state<Track[]>([]);
  currentIndex = $state(-1);
  currentTime = $state(0);
  duration = $state(0);
  volume = $state(50); // 0-100
  isMuted = $state(false);
  
  // Right sidebar tab state: 'none' | 'lyrics' | 'queue'
  activeSidebar = $state<'none' | 'lyrics' | 'queue'>('queue');

  // HTML Audio instance (created on client)
  audio: HTMLAudioElement | null = null;

  init() {
    if (typeof window !== "undefined" && !this.audio) {
      this.audio = new Audio();
      this.audio.volume = this.volume / 100;

      this.audio.addEventListener("timeupdate", () => {
        if (this.audio) {
          this.currentTime = this.audio.currentTime;
        }
      });

      this.audio.addEventListener("durationchange", () => {
        if (this.audio) {
          this.duration = this.audio.duration || 0;
        }
      });

      this.audio.addEventListener("ended", () => {
        this.next();
      });
    }
  }

  setVolume(val: number) {
    this.volume = val;
    if (this.audio) {
      this.audio.volume = val / 100;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.audio) {
      this.audio.muted = this.isMuted;
    }
  }

  async playTrack(track: Track, newQueue: Track[] = []) {
    this.init();
    if (newQueue.length > 0) {
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
    this.currentTime = 0;
    this.duration = track.duration || 0;

    try {
      // Retrieve the stream manifest for the track
      const manifest = await ytmusic.getStreamManifest(track.videoId);
      // Select the first audio stream or best available
      const audioStreams = manifest.streams.filter((s: any) => s.type === "audio");
      if (audioStreams.length > 0) {
        // Sort by bitrate desc to get highest quality, or pick the first one
        const bestStream = audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate)[0];
        if (this.audio) {
          this.audio.src = bestStream.url;
          await this.audio.play();
          this.isPlaying = true;
          ytmusic.addHistoryItem(track.videoId).catch((err) => {
            console.error("Failed to add history item:", err);
          });
        }
      } else {
        console.error("No audio streams found for videoId:", track.videoId);
      }
    } catch (e) {
      console.error("Error playing track:", e);
    }
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
      }
    } catch (e) {
      console.error("Error getting upNexts:", e);
    }
  }

  togglePlay() {
    this.init();
    if (!this.audio || !this.currentTrack) return;

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      this.audio.play().then(() => {
        this.isPlaying = true;
      }).catch((e) => {
        console.error("Error resuming play:", e);
      });
    }
  }

  seek(time: number) {
    if (this.audio) {
      this.audio.currentTime = time;
      this.currentTime = time;
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
