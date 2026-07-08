<script lang="ts">
  import ScrollArea from "./ui/scroll-area/scroll-area.svelte";
  import type { SearchResult } from "@app/api/src";
  import { link } from "svelte-spa-router";
  import { player, type Track } from "$lib/stores/player.svelte";
  import Image from "$lib/components/ui/image.svelte";

  let { contents }: { contents: SearchResult[] } = $props();

  function getItemHref(item: SearchResult): string | undefined {
    if (item.type === "PLAYLIST") {
      return `#/playlist/${item.playlistId}`;
    } else if (item.type === "ALBUM") {
      return `#/album/${item.albumId}`;
    } else if (item.type === "ARTIST") {
      return `#/artist/${item.artistId}`;
    }
    return undefined;
  }

  function getQueue(): Track[] {
    return contents
      .filter(
        (item): item is Extract<SearchResult, { type: "SONG" | "VIDEO" }> =>
          item.type === "SONG" || item.type === "VIDEO",
      )
      .map((item) => ({
        videoId: item.videoId,
        name: item.name,
        artist: item.artist?.name || "Unknown Artist",
        artistId: item.artist?.artistId,
        thumbnail: item.thumbnails?.at(0)?.url || "",
        duration: item.duration,
      }));
  }

  function playItem(item: SearchResult) {
    if (item.type === "SONG" || item.type === "VIDEO") {
      const track: Track = {
        videoId: item.videoId,
        name: item.name,
        artist: item.artist?.name || "Unknown Artist",
        artistId: item.artist?.artistId,
        thumbnail: item.thumbnails?.at(0)?.url || "",
        duration: item.duration,
      };
      player.playWithUpNext(track);
    }
  }

  let viewportEl = $state<HTMLElement | null>(null);
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let isDragging = false;

  $effect(() => {
    if (!viewportEl) return;
    const el = viewportEl;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      isDragging = false;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (!isDragging && Math.abs(walk) > 10) {
        isDragging = true;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = 'grabbing';
        el.style.userSelect = 'none';
      }
      if (isDragging) {
        el.scrollLeft = scrollLeft - walk;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDown) return;
      isDown = false;
      
      if (isDragging) {
        el.releasePointerCapture(e.pointerId);
        el.style.cursor = 'grab';
        el.style.userSelect = '';
        setTimeout(() => {
          isDragging = false;
        }, 0);
      } else {
        isDragging = false;
      }
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (isDragging) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointerleave', handlePointerUp);
    el.addEventListener('click', handleClickCapture, true);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointerleave', handlePointerUp);
      el.removeEventListener('click', handleClickCapture, true);
    };
  });
</script>

<ScrollArea
  bind:viewportRef={viewportEl}
  class="w-full **:data-scroll-area-scrollbar:hidden"
  orientation="horizontal"
>
  <div class="w-max flex px-4 py-2 s">
    {#each contents as item}
      {@const href = getItemHref(item)}
      {#if href}
        <a
          {href}
          use:link
          draggable="false"
          ondragstart={(e) => e.preventDefault()}
          class="flex flex-col p-2 shrink-0 hover:scale-105 transition-transform ease-out cursor-pointer"
          class:w-54={item.type !== "VIDEO"}
          class:w-[384px]={item.type === "VIDEO"}
        >
          {#if item.type === "PLAYLIST" || item.type === "ALBUM" || item.type === "EPISODE"}
            <div class="rounded-3xl overflow-hidden aspect-square">
              <Image
                src={item?.thumbnails[0]?.url}
                alt={item?.name}
                class="size-full object-cover"
                width={150}
                height={150}
              />
            </div>
            <p class="line-clamp-1 mt-2 font-semibold leading-tight">
              {item?.name}
            </p>
            <p class="text-xs opacity-50">
              {item.type.charAt(0).toUpperCase() +
                item.type.slice(1).toLowerCase()}
            </p>
          {:else if item.type === "ARTIST"}
            <div class="rounded-full overflow-hidden aspect-square">
              <Image
                src={item?.thumbnails[0]?.url}
                alt={item?.name}
                class="size-full object-cover"
                width={150}
                height={150}
              />
            </div>
            <p
              class="line-clamp-1 mt-2 font-semibold leading-tight text-center"
            >
              {item?.name}
            </p>
            <p class="text-xs opacity-50 text-center">
              {item.type.charAt(0).toUpperCase() +
                item.type.slice(1).toLowerCase()}
            </p>
          {/if}
        </a>
      {:else}
        <button
          onclick={() => playItem(item)}
          draggable="false"
          ondragstart={(e) => e.preventDefault()}
          class="flex flex-col p-2 shrink-0 hover:scale-105 transition-transform ease-out cursor-pointer text-left border-0 bg-transparent outline-none p-0 m-0"
          class:w-54={item.type !== "VIDEO"}
          class:w-[384px]={item.type === "VIDEO"}
        >
          {#if item.type === "SONG"}
            <div class="rounded-3xl overflow-hidden aspect-square w-full">
              <Image
                src={item?.thumbnails[0]?.url}
                alt={item?.name}
                class="size-full object-cover"
                width={150}
                height={150}
              />
            </div>

            <p class="line-clamp-1 mt-2 font-semibold leading-tight w-full">
              {item?.name}
            </p>
            <p class="text-xs opacity-50 w-full">{item?.artist?.name}</p>
          {:else if item.type === "VIDEO"}
            <div class="rounded-3xl overflow-hidden w-full h-[200px]">
              <Image
                src={item?.thumbnails[0]?.url}
                alt={item?.name}
                class="size-full object-cover"
                width={266}
                height={150}
              />
            </div>
            <p class="line-clamp-1 mt-2 font-semibold leading-tight w-full">
              {item?.name}
            </p>
            <p class="text-xs opacity-50 w-full">{item?.artist.name}</p>
          {:else if item.type === "EPISODE"}
            <div class="rounded-3xl overflow-hidden aspect-square w-full">
              <Image
                src={item?.thumbnails[0]?.url}
                alt={item?.name}
                class="size-full object-cover"
                width={150}
                height={150}
              />
            </div>
            <p class="line-clamp-1 mt-2 font-semibold leading-tight w-full">
              {item?.name}
            </p>
            <p class="text-xs opacity-50 w-full">
              {item.type.charAt(0).toUpperCase() +
                item.type.slice(1).toLowerCase()}
            </p>
          {/if}
        </button>
      {/if}
    {/each}
  </div>
</ScrollArea>
