import { tick } from "svelte";

export interface EqualizerPreset {
  name: string;
  bands: number[]; // Array of 5 gain values (dB)
}

export const EQ_PRESETS: EqualizerPreset[] = [
  { name: "Flat", bands: [0, 0, 0, 0, 0] },
  { name: "Bass Booster", bands: [6, 4, 0, 0, -2] },
  { name: "Vocal Booster", bands: [-2, 0, 3, 4, 1] },
  { name: "Classical", bands: [4, 2, 0, 2, 4] },
  { name: "Rock", bands: [4, 2, -1, 2, 3] },
  { name: "Electronic", bands: [5, 2, 0, 1, 4] },
  { name: "Pop", bands: [-1, 2, 3, 2, -1] }
];

export const EQ_FREQUENCIES = [60, 230, 910, 4000, 14000];

class EqualizerStore {
  // Svelte 5 Runes for reactive states
  enabled = $state(false);
  preset = $state("Flat");
  bands = $state<number[]>([0, 0, 0, 0, 0]); // 60Hz, 230Hz, 910Hz, 4kHz, 14kHz

  // Web Audio API properties
  #audioContext: AudioContext | null = null;
  #sourceNode: MediaElementAudioSourceNode | null = null;
  #filters: BiquadFilterNode[] = [];
  #isInitialized = false;

  constructor() {
    this.loadState();
  }

  /**
   * Initializes the Web Audio nodes and hooks them to the HTMLAudioElement.
   * Crucial: audio.crossOrigin must be set to "anonymous" before this is called
   * to avoid CORS issues with googlevideo.com audio streams.
   */
  init(audio: HTMLAudioElement) {
    if (this.#isInitialized || typeof window === "undefined" || !audio) return;

    try {
      // Force CORS headers support on the audio element to avoid Web Audio API blockade
      audio.crossOrigin = "anonymous";

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.#audioContext = new AudioContextClass();
      this.#sourceNode = this.#audioContext.createMediaElementSource(audio);

      const filterTypes: BiquadFilterType[] = [
        "lowshelf",
        "peaking",
        "peaking",
        "peaking",
        "highshelf"
      ];

      let lastNode: AudioNode = this.#sourceNode;

      // Create and chain the 5-band filters
      this.#filters = EQ_FREQUENCIES.map((freq, index) => {
        const filter = this.#audioContext!.createBiquadFilter();
        filter.type = filterTypes[index];
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        // Apply stored gain values if enabled, otherwise Flat (0dB)
        filter.gain.value = this.enabled ? this.bands[index] : 0;

        lastNode.connect(filter);
        lastNode = filter;
        return filter;
      });

      // Connect the final filter to the output speakers/destination
      lastNode.connect(this.#audioContext.destination);
      this.#isInitialized = true;
      console.log("[Equalizer] Audio context & filters initialized successfully.");
    } catch (e) {
      console.error("[Equalizer] Failed to initialize Web Audio API:", e);
    }
  }

  toggle(val: boolean) {
    this.enabled = val;
    this.applyBands();
    this.saveState();
  }

  setBand(index: number, gain: number) {
    if (index < 0 || index >= this.bands.length) return;
    this.bands[index] = Math.min(12, Math.max(-12, gain));
    this.preset = "Custom";
    this.applyBands();
    this.saveState();
  }

  setPreset(presetName: string) {
    const selected = EQ_PRESETS.find(p => p.name === presetName);
    if (!selected) return;

    this.preset = selected.name;
    this.bands = [...selected.bands];
    this.applyBands();
    this.saveState();
  }

  applyBands() {
    if (!this.#isInitialized || this.#filters.length === 0) return;

    // Resume context if suspended (browser security policy check)
    if (this.#audioContext && this.#audioContext.state === "suspended") {
      this.#audioContext.resume().catch(console.error);
    }

    this.#filters.forEach((filter, index) => {
      // If disabled, bypass filters by setting gain to 0 (flat response)
      const targetGain = this.enabled ? this.bands[index] : 0;
      
      // Use smooth transition (Ramp) to avoid audio pops/crackles
      if (this.#audioContext) {
        filter.gain.setTargetAtTime(targetGain, this.#audioContext.currentTime, 0.05);
      } else {
        filter.gain.value = targetGain;
      }
    });
  }

  saveState() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      "tutti:equalizer",
      JSON.stringify({
        enabled: this.enabled,
        preset: this.preset,
        bands: this.bands
      })
    );
  }

  loadState() {
    if (typeof localStorage === "undefined") return;
    try {
      const stored = localStorage.getItem("tutti:equalizer");
      if (stored) {
        const parsed = JSON.parse(stored);
        this.enabled = parsed.enabled ?? false;
        this.preset = parsed.preset ?? "Flat";
        this.bands = parsed.bands ?? [0, 0, 0, 0, 0];
      }
    } catch (e) {
      console.warn("[Equalizer] Failed to load settings state:", e);
    }
  }
}

export const equalizer = new EqualizerStore();
