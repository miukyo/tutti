<script lang="ts">
  import { onMount } from "svelte";
  import {
    onPlayerStateUpdated,
    requestPlayerState,
    toggleFloatingLyricsLock,
    isFloatingLyricsLocked,
    onFloatingLyricsLockStatus,
    toggleFloatingLyrics,
  } from "@app/preload";
  import { player } from "$lib/stores/player.svelte";
  import Lyrics from "$lib/components/lyrics.svelte";
  import {
    XIcon,
    LockIcon,
    UnlockIcon,
    GripHorizontalIcon,
  } from "@lucide/svelte";

  let isLocked = $state(false);

  onMount(() => {
    document.body.style.backgroundColor = "transparent";
    // Request initial player state from the main window
    requestPlayerState();

    isFloatingLyricsLocked().then((locked) => {
      isLocked = locked;
    });

    const unsubscribeLock = onFloatingLyricsLockStatus((locked) => {
      isLocked = locked;
    });

    const unsubscribePlayerState = onPlayerStateUpdated((state) => {
      player.isPlaying = state.isPlaying;
      if (
        !player.currentTrack ||
        player.currentTrack.videoId !== state.currentTrack?.videoId
      ) {
        player.currentTrack = state.currentTrack;
      }
      player.currentTime = state.currentTime;
      player.duration = state.duration;
      player.selectedSource = state.selectedSource;
      player.lyricsFontSize = state.lyricsFontSize;
      player.lyricsFontSizeExtended = state.lyricsFontSizeExtended;
      player.lyricsFontSizeFloating = state.lyricsFontSizeFloating;
    });

    return () => {
      unsubscribeLock();
      unsubscribePlayerState();
    };
  });

  function handleLock() {
    toggleFloatingLyricsLock();
  }

  function handleClose() {
    toggleFloatingLyrics();
  }
</script>

<div
  class="relative size-full flex flex-col items-center justify-center mask-b-from-70% mask-t-from-70% bg-radial from-background/50 to-transparent to-70%"
  style="app-region: drag;"
>
  <!-- Lyrics Component Display -->
  <div class="w-full h-full flex flex-col justify-center drop-shadow-md">
    <Lyrics isFloating={true} />
  </div>
</div>
