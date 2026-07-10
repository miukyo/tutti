<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import {
    ChevronDownIcon,
    FastForwardIcon,
    PlayIcon,
    PauseIcon,
    RepeatIcon,
    ShuffleIcon,
    Volume2Icon,
    VolumeXIcon,
  } from "@lucide/svelte";
  import Button from "./ui/button/button.svelte";
  import Slider from "./ui/slider/slider.svelte";
  import { player } from "$lib/stores/player.svelte";
  import Lyrics from "$lib/components/lyrics.svelte";
  import Image from "./ui/image.svelte";
  import PlayerBar from "./player-bar.svelte";

  let showExtended = $derived(player.showExtended);
  let currentTrack = $derived(player.currentTrack);

</script>

{#if showExtended && currentTrack}
  <div
    transition:fade={{ duration: 400 }}
    class="fixed inset-0 z-150 bg-background/95 backdrop-blur-3xl overflow-hidden flex flex-col"
  >
    <!-- Ambient blurred background -->
    <Image
      src={currentTrack.thumbnail}
      alt={currentTrack.name}
      width={512}
      height={512}
      class="absolute w-full h-full right-0 pointer-events-none blur-[100px] opacity-30 transition-all duration-1000 scale-120"
    />

    <Image
      src={currentTrack.thumbnail}
      alt={currentTrack.name}
      width={1024}
      height={1024}
      class="h-full left-0 absolute -z-10 mask-radial-from-0% mask-radial-at-left aspect-square object-cover mask-radial-[100%_200%] opacity-90"
    />

    <!-- Top bar -->
    <header
      class="absolute w-full flex items-center justify-between px-8 py-6 z-200"
    >
      <Button
        size="icon"
        variant="outline-blur"
        onclick={() => (player.showExtended = false)}
      >
        <ChevronDownIcon class="size-6" />
      </Button>
    </header>

    <!-- Main Content -->
    <main class="flex-1 w-full mx-auto min-h-0 z-10">
      <div class="w-1/2 absolute left-0 bottom-0">
        <PlayerBar isExtended />
      </div>
      <div
        transition:fly={{ y: 50, duration: 500, delay: 250 }}
        class="w-full h-full min-h-0 flex flex-col relative overflow-hidden"
      >
        <Lyrics showInfo={false} isExtended />
      </div>
    </main>
  </div>
{/if}

<style>
  /* Custom layouts and animations if needed */
</style>
