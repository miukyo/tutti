<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { player } from "$lib/stores/player.svelte";
  import { clearCache } from "@app/preload";
  import {
    Gamepad2Icon,
    Trash2Icon,
    CaseSensitiveIcon,
    KeyboardIcon,
    RotateCcwIcon,
  } from "@lucide/svelte/icons";
  import Switch from "./ui/switch/switch.svelte";
  import ScrollArea from "./ui/scroll-area/scroll-area.svelte";
  import Slider from "./ui/slider/slider.svelte";

  let {
    open = $bindable(false),
  }: {
    open: boolean;
  } = $props();

  let activeTab = $state<"general" | "lyrics" | "hotkeys">("general");
  let clearingCache = $state(false);
  let clearCacheStatus = $state<"idle" | "done" | "error">("idle");

  let sidebarSizeArray = $state([Math.round(player.lyricsFontSize * 100)]);
  let extendedSizeArray = $state([
    Math.round(player.lyricsFontSizeExtended * 100),
  ]);
  let floatingSizeArray = $state([
    Math.round(player.lyricsFontSizeFloating * 100),
  ]);

  $effect(() => {
    player.setLyricsFontSize("sidebar", sidebarSizeArray[0] / 100);
  });
  $effect(() => {
    player.setLyricsFontSize("extended", extendedSizeArray[0] / 100);
  });
  $effect(() => {
    player.setLyricsFontSize("floating", floatingSizeArray[0] / 100);
  });

  $effect(() => {
    if (open) {
      sidebarSizeArray = [Math.round(player.lyricsFontSize * 100)];
      extendedSizeArray = [Math.round(player.lyricsFontSizeExtended * 100)];
      floatingSizeArray = [Math.round(player.lyricsFontSizeFloating * 100)];
    }
  });

  // Hotkey recording state
  let recordingAction = $state<string | null>(null);

  const hotkeyMetadata = [
    { key: "togglePlay", label: "Play / Pause" },
    { key: "seekBackward", label: "Seek Backward (5s)" },
    { key: "seekForward", label: "Seek Forward (5s)" },
    { key: "seekForwardAlt", label: "Seek Forward (Alt)" },
    { key: "seekBackwardAlt", label: "Seek Backward (Alt)" },
    { key: "toggleMute", label: "Toggle Mute" },
    { key: "nextTrack", label: "Next Track" },
    { key: "prevTrack", label: "Previous Track" },
  ];

  async function handleClearCache() {
    clearingCache = true;
    clearCacheStatus = "idle";
    try {
      await clearCache();
      clearCacheStatus = "done";
      setTimeout(() => {
        clearCacheStatus = "idle";
      }, 3000);
    } catch (e) {
      console.error(e);
      clearCacheStatus = "error";
    } finally {
      clearingCache = false;
    }
  }

  function startRecording(actionKey: string) {
    recordingAction = actionKey;
    window.addEventListener("keydown", handleRecordKey, { capture: true });
  }

  function handleRecordKey(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (recordingAction) {
      const keyName = e.key;
      (player.hotkeys as any)[recordingAction] = keyName;
      player.saveState();
    }

    cancelRecording();
  }

  function cancelRecording() {
    recordingAction = null;
    window.removeEventListener("keydown", handleRecordKey, { capture: true });
  }

  function resetHotkeys() {
    player.hotkeys = {
      togglePlay: " ",
      seekBackward: "ArrowLeft",
      seekForward: "ArrowRight",
      seekForwardAlt: "ArrowUp",
      seekBackwardAlt: "ArrowDown",
      toggleMute: "m",
      nextTrack: "n",
      prevTrack: "p",
    };
    player.saveState();
  }

  function formatKeyDisplay(key: string) {
    if (key === " ") return "Space";
    return key;
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(val) => {
    if (!val) cancelRecording();
  }}
>
  <Dialog.Content
    class="sm:max-w-[640px] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-xl border border-border/80 rounded-3xl shadow-glass top-1/2 fixed!"
  >
    <div class="flex overflow-hidden">
      <!-- Sidebar Tabs -->
      <div
        class="w-48 border-r border-border/40 bg-card/20 p-4 flex flex-col gap-1.5"
      >
        <div
          class="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
        >
          Settings
        </div>
        <Button
          variant={activeTab === "general" ? "default" : "ghost"}
          class="justify-start gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all text-left cursor-pointer {activeTab ===
          'general'
            ? ''
            : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => (activeTab = "general")}
        >
          <Gamepad2Icon class="size-4" />
          <span>General</span>
        </Button>
        <Button
          variant={activeTab === "lyrics" ? "default" : "ghost"}
          class="justify-start gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all text-left cursor-pointer {activeTab ===
          'lyrics'
            ? ''
            : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => (activeTab = "lyrics")}
        >
          <CaseSensitiveIcon class="size-4" />
          <span>Lyrics</span>
        </Button>
        <Button
          variant={activeTab === "hotkeys" ? "default" : "ghost"}
          class="justify-start gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all text-left cursor-pointer {activeTab ===
          'hotkeys'
            ? ''
            : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => (activeTab = "hotkeys")}
        >
          <KeyboardIcon class="size-4" />
          <span>Hotkeys</span>
        </Button>
      </div>

      <!-- Tab Contents -->
      <div class="flex-1 p-6 flex flex-col justify-between min-h-[360px]">
        <div class="flex-1">
          {#if activeTab === "general"}
            <div class="flex flex-col gap-6">
              <div>
                <h3 class="text-base font-semibold leading-none tracking-tight">
                  General Settings
                </h3>
                <p class="text-sm text-muted-foreground mt-1">
                  Configure integrations and clear client cache.
                </p>
              </div>

              <div class="flex flex-col gap-4 border-t border-border/40 pt-4">
                <!-- Discord Presence Toggle -->
                <div class="flex items-center justify-between">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium"
                      >Discord Rich Presence</span
                    >
                    <span class="text-xs text-muted-foreground"
                      >Show your currently playing song on Discord.</span
                    >
                  </div>
                  <Switch
                    onCheckedChange={() => player.toggleDiscordPresence()}
                    checked={player.discordPresenceEnabled}
                  />
                </div>

                <!-- Cache Cleaning -->
                <div
                  class="flex items-center justify-between border-t border-border/40 pt-4 mt-2"
                >
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium">Clear Client Cache</span>
                    <span class="text-xs text-muted-foreground"
                      >Clear network cache to resolve playback issues.</span
                    >
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={clearingCache}
                    onclick={handleClearCache}
                    class="rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Trash2Icon class="size-3.5" />
                    {#if clearingCache}
                      Clearing...
                    {:else if clearCacheStatus === "done"}
                      Cleared!
                    {:else if clearCacheStatus === "error"}
                      Error
                    {:else}
                      Clear Cache
                    {/if}
                  </Button>
                </div>
              </div>
            </div>
          {:else if activeTab === "lyrics"}
            <div class="flex flex-col gap-6">
              <div>
                <h3 class="text-base font-semibold leading-none tracking-tight">
                  Lyrics Customization
                </h3>
                <p class="text-sm text-muted-foreground mt-1">
                  Adjust typography settings for lyrics layouts.
                </p>
              </div>

              <div class="flex flex-col gap-4 border-t border-border/40 pt-4">
                <!-- Sidebar Lyrics Size -->
                <div class="flex flex-col gap-2">
                  <div class="flex justify-between items-center">
                    <p
                      class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Sidebar Layout Size
                    </p>
                    <span class="text-xs font-semibold text-primary"
                      >{Math.round(sidebarSizeArray[0])}%</span
                    >
                  </div>
                  <div class="px-2 py-1 flex items-center">
                    <Slider
                      type="single"
                      min={50}
                      max={200}
                      step={5}
                      bind:value={sidebarSizeArray[0]}
                    />
                  </div>
                </div>

                <!-- Extended Player Lyrics Size -->
                <div class="flex flex-col gap-2 mt-4">
                  <div class="flex justify-between items-center">
                    <p
                      class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Extended Layout Size
                    </p>
                    <span class="text-xs font-semibold text-primary"
                      >{Math.round(extendedSizeArray[0])}%</span
                    >
                  </div>
                  <div class="px-2 py-1 flex items-center">
                    <Slider
                      type="single"
                      min={50}
                      max={200}
                      step={5}
                      bind:value={extendedSizeArray[0]}
                    />
                  </div>
                </div>

                <!-- Floating Lyrics Size -->
                <div class="flex flex-col gap-2 mt-4">
                  <div class="flex justify-between items-center">
                    <p
                      class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Floating Layout Size
                    </p>
                    <span class="text-xs font-semibold text-primary"
                      >{Math.round(floatingSizeArray[0])}%</span
                    >
                  </div>
                  <div class="px-2 py-1 flex items-center">
                    <Slider
                      type="single"
                      min={50}
                      max={200}
                      step={5}
                      bind:value={floatingSizeArray[0]}
                    />
                  </div>
                </div>
              </div>
            </div>
          {:else if activeTab === "hotkeys"}
            <div class="flex flex-col gap-4">
              <div class="flex justify-between items-start">
                <div>
                  <h3
                    class="text-base font-semibold leading-none tracking-tight"
                  >
                    Hotkeys Editor
                  </h3>
                  <p class="text-sm text-muted-foreground mt-1">
                    Configure keyboard shortcuts for control.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={resetHotkeys}
                  class="rounded-xl flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <RotateCcwIcon class="size-3" />
                  Reset Defaults
                </Button>
              </div>

              <!-- Hotkey list -->
              <ScrollArea
                class="border-t border-border/40 pt-2 pr-1 select-none flex flex-col gap-2 max-h-[200px] **:data-scroll-area-scrollbar:hidden"
              >
                {#each hotkeyMetadata as { key, label }}
                  <div
                    class="flex items-center justify-between py-1 border-b border-border/10"
                  >
                    <span class="text-xs font-medium text-foreground/80"
                      >{label}</span
                    >
                    <Button
                      variant={recordingAction === key ? "default" : "outline"}
                      onclick={() => startRecording(key)}
                      class="min-w-28 text-center text-xs font-semibold py-1.5 px-3 rounded-xl transition-all cursor-pointer h-auto {recordingAction ===
                      key
                        ? 'bg-primary/20 border-primary text-primary animate-pulse'
                        : 'bg-muted/40 hover:bg-accent hover:text-foreground'}"
                    >
                      {recordingAction === key
                        ? "Press any key..."
                        : formatKeyDisplay((player.hotkeys as any)[key])}
                    </Button>
                  </div>
                {/each}
              </ScrollArea>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
