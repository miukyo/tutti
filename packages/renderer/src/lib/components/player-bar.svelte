<script lang="ts">
  import {
    ChevronLeftIcon,
    FastForwardIcon,
    ListIcon,
    PlayIcon,
    PauseIcon,
    RepeatIcon,
    Repeat1Icon,
    ShuffleIcon,
    ThumbsDownIcon,
    ThumbsUpIcon,
    Volume2Icon,
    VolumeXIcon,
    BookmarkIcon,
    BookmarkPlusIcon,
  } from "@lucide/svelte";
  import Button from "./ui/button/button.svelte";
  import Slider from "./ui/slider/slider.svelte";
  import { player } from "$lib/stores/player.svelte";
  import Image from "./ui/image.svelte";
  import { Spinner } from "$lib/components/ui/spinner";
  import AddToPlaylistDialog from "./add-to-playlist-dialog.svelte";

  function formatTime(seconds: number): string {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  // Synchronize mute/unmute
  let isMuted = $derived(player.isMuted);
  let isPlaying = $derived(player.isPlaying);
  let isBuffering = $derived(player.isBuffering);
  let currentTime = $derived(player.currentTime);
  let duration = $derived(player.duration);
  let currentTrack = $derived(player.currentTrack);
  let isShuffled = $derived(player.isShuffled);
  let repeatMode = $derived(player.repeatMode);
  let likeStatus = $derived(player.likeStatus);

  let isDragging = $state(false);
  let sliderValue = $state(0);

  $effect(() => {
    if (!isDragging) {
      sliderValue = currentTime;
    }
  });

  let isDialogOpened = $state(false);

  let {
    isExtended = false,
  }: {
    isExtended?: boolean;
  } = $props();
</script>

<div class="absolute bottom-0 p-4 w-full select-none z-50">
  <div
    class="flex justify-between gap-4 {isExtended
      ? ''
      : 'border border-border bg-background/50 backdrop-blur-sm shadow-glass'} p-4 rounded-4xl items-center relative"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    {#if !isExtended}
      <div
        class="absolute top-0 left-0 w-full z-10 px-4"
        onpointerdown={() => {
          isDragging = true;
        }}
      >
        <Slider
          class="w-full h-2 -mt-1 **:data-[slot='slider-track']:h-0.5 **:data-[slot='slider-track']:bg-transparent **:data-[slot='slider-thumb']:h-2 **:data-[slot='slider-thumb']:w-4 **:data-[slot='slider-thumb']:ring-0 **:data-[slot='slider-thumb']:bg-primary **:data-[slot='slider-thumb']:scale-0 **:data-[slot='slider-thumb']:group-hover:scale-100 **:data-[slot='slider-thumb']:transition-[scale]"
          type="single"
          orientation="horizontal"
          value={sliderValue}
          onValueChange={(val) => {
            if (isDragging) {
              const numVal = Array.isArray(val) ? val[0] : val;
              sliderValue = numVal;
            }
          }}
          onValueCommit={(val) => {
            const numVal = Array.isArray(val) ? val[0] : val;
            player.seek(numVal);
            isDragging = false;
          }}
          max={duration || 100}
          step={1}
        />
      </div>
    {/if}
    <div class="flex items-center order-2">
      <Button
        size="icon-sm"
        variant="link"
        class="active:not-aria-[haspopup]:scale-60 {isShuffled
          ? 'opacity-100'
          : 'opacity-50'}"
        onclick={() => player.toggleShuffle()}
      >
        <ShuffleIcon strokeWidth={4} class="size-4" />
      </Button>
      <Button
        size="icon"
        variant="link"
        class="active:not-aria-[haspopup]:scale-60"
        onclick={() => player.prev()}
      >
        <FastForwardIcon class="size-6 rotate-180" fill="currentColor" />
      </Button>
      <Button
        size="icon"
        variant="link"
        class="active:not-aria-[haspopup]:scale-60"
        onclick={() => player.togglePlay()}
      >
        {#if isBuffering}
          <Spinner variant="circle" class="size-8" />
        {:else if isPlaying}
          <PauseIcon class="size-8" fill="currentColor" />
        {:else}
          <PlayIcon class="size-8" fill="currentColor" />
        {/if}
      </Button>
      <Button
        size="icon"
        variant="link"
        class="active:not-aria-[haspopup]:scale-60"
        onclick={() => player.next()}
      >
        <FastForwardIcon class="size-6" fill="currentColor" />
      </Button>
      <Button
        size="icon-sm"
        variant="link"
        class="active:not-aria-[haspopup]:scale-60 {repeatMode !== 'off'
          ? 'opacity-100'
          : 'opacity-50'}"
        onclick={() => player.toggleRepeat()}
      >
        {#if repeatMode === "one"}
          <Repeat1Icon strokeWidth={4} class="size-4" />
        {:else}
          <RepeatIcon strokeWidth={4} class="size-4" />
        {/if}
      </Button>
    </div>

    <!-- Center playback & track info -->
    {#if !isExtended}
      <div
        class="absolute w-1/3 h-full top-0 left-1/2 -translate-x-1/2 py-2 flex flex-col justify-center order-3"
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="w-full flex items-center justify-between gap-2 bg-foreground/5 pl-1.5 pr-3 h-14 rounded-2xl border border-border/50 cursor-pointer group relative overflow-hidden shadow-glass"
          data-glow
          onclick={() => currentTrack && (player.showExtended = true)}
        >
          {#if currentTrack}
            <div class="flex gap-2 items-center min-w-0">
              <Image
                src={currentTrack.thumbnail}
                alt={currentTrack.name}
                width={36}
                height={36}
                class="size-10 bg-background rounded-lg object-cover"
                style="view-transition-name: player-thumbnail;"
              />
              <div class="min-w-0">
                <p class="text-xs font-semibold truncate leading-tight">
                  {currentTrack.name}
                </p>
                <p
                  class="text-[10px] text-muted-foreground truncate leading-tight"
                >
                  {#each currentTrack.artists as artist, idx}
                    {#if idx > 0}
                      <span>{" & "}</span>
                    {/if}
                    {#if artist.artistId}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <a
                        href="#/artist/{artist.artistId}"
                        class="hover:underline"
                        onclick={(e) => e.stopPropagation()}
                      >
                        {artist.name}
                      </a>
                    {:else}
                      <span>{artist.name}</span>
                    {/if}
                  {/each}
                </p>
              </div>
            </div>
            <div
              class="flex items-center gap-1.5 text-[10px] text-muted-foreground whitespace-nowrap"
            >
              <span
                >{formatTime(currentTime)}
                /
                {formatTime(duration)}</span
              >
            </div>
          {:else}
            <div class="w-full text-center text-xs text-muted-foreground">
              No track selected
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <div
      class="flex items-center gap-2 group transition-opacity max-w-60"
      class:order-1={isExtended}
      class:opacity-20={isExtended}
      class:hover:opacity-100={isExtended}
      class:order-4={!isExtended}
    >
      <div class="flex items-center gap-2 group/volume peer/slider order-5">
        <Button size="icon" variant="link" onclick={() => player.toggleMute()}>
          {#if isMuted}
            <VolumeXIcon class="size-5" fill="currentColor" />
          {:else}
            <Volume2Icon class="size-5" fill="currentColor" />
          {/if}
        </Button>
        <Slider
          class={`w-0 ${!isExtended ? "2xl:w-30 2xl:opacity-100" : ""} opacity-0 group-hover/volume:w-30 group-hover:opacity-100 transition-all duration-300 overflow-hidden
          **:data-slider-thumb:w-0 **:data-slider-thumb:opacity-0  **:data-[slot='slider-track']:bg-foreground/10 **:data-[slot='slider-range']:bg-foreground`}
          type="single"
          orientation="horizontal"
          value={player.isMuted ? 0 : player.volume}
          onValueChange={(val) => {
            if (Array.isArray(val)) {
              player.setVolume(val[0]);
            } else {
              player.setVolume(val);
            }
          }}
          max={100}
          step={1}
        />
      </div>

      {#if player.isAuthed}
        <Button
          size="icon"
          variant="link"
          disabled={!currentTrack}
          class="active:scale-60 -mr-3 {isExtended
            ? ''
            : 'max-2xl:peer-hover/slider:scale-0 max-2xl:peer-hover/slider:opacity-0'} transition-all duration-300"
          onclick={() => player.toggleLike()}
        >
          <ThumbsUpIcon
            class="size-5"
            fill={player.likeStatus === "Like" ? "currentColor" : "none"}
          />
        </Button>
        <Button
          size="icon"
          variant="link"
          class="active:scale-60 -mr-2 {isExtended
            ? ''
            : 'max-2xl:peer-hover/slider:scale-0 max-2xl:peer-hover/slider:opacity-0'} transition-all duration-300"
          disabled={!currentTrack}
          onclick={() => (isDialogOpened = true)}
        >
          <BookmarkPlusIcon class="size-5" />
        </Button>
      {/if}

      <!-- Svelte 5 slider volume bindings -->
    </div>
    {#if isExtended}
      <div class="order-5 {player.isAuthed ? 'w-28' : 'w-11'}"></div>
    {/if}
  </div>
</div>

<AddToPlaylistDialog bind:open={isDialogOpened} />
