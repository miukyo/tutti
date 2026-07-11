<script lang="ts">
  import { link, push } from "svelte-spa-router";
  import type { SearchResult } from "@app/api/src";
  import * as Table from "$lib/components/ui/table";
  import { player, type Track } from "$lib/stores/player.svelte";
  import Image from "$lib/components/ui/image.svelte";

  let {
    items,
    playWithUpNext = false,
  }: {
    items: SearchResult[];
    playWithUpNext?: boolean;
  } = $props();

  let currentTrack = $derived(player.currentTrack);

  let playableQueue = $derived(
    items
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
      })),
  );

  function playItem(item: Extract<SearchResult, { type: "SONG" | "VIDEO" }>) {
    const track: Track = {
      videoId: item.videoId,
      name: item.name,
      artist: item.artist?.name || "Unknown Artist",
      artistId: item.artist?.artistId,
      thumbnail: item.thumbnails?.at(0)?.url || "",
      duration: item.duration,
    };
    if (playWithUpNext) {
      player.playWithUpNext(track);
    } else {
      player.playTrack(track, playableQueue);
    }
  }

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

  function formatDuration(seconds: number | null | undefined): string {
    if (!seconds) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
</script>

<div class="w-full overflow-x-auto">
  <Table.Root class="w-full">
    <Table.Body>
      {#each items as item}
        {@const href = getItemHref(item)}
        {#if href}
          <!-- Non-playable items (Artist, Album, Playlist) -->
          <Table.Row
            class="group cursor-pointer"
            onclick={(e) => {
              if ((e.target as HTMLElement).closest("a")) return;
              push(href);
            }}
          >
            <Table.Cell class="max-w-0">
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="block size-10 overflow-hidden shrink-0"
                  class:rounded-full={item.type === "ARTIST"}
                  class:rounded-lg={item.type !== "ARTIST"}
                >
                  <Image
                    src={item.thumbnails?.at(0)?.url || ""}
                    alt={item.name}
                    class="size-full object-cover"
                    width={40}
                    height={40}
                  />
                </div>
                <div class="min-w-0">
                  <p class="font-medium text-sm group-hover:underline truncate">
                    {item.name}
                  </p>
                  <p class="text-xs text-muted-foreground truncate">
                    {#if item.type === "ARTIST"}
                      Artist
                    {:else if item.type === "ALBUM"}
                      Album •
                      {#if item.artist?.artistId}
                        <a
                          href="#/artist/{item.artist.artistId}"
                          use:link
                          class="hover:underline">{item.artist.name}</a
                        >
                      {:else}
                        {item.artist?.name || "Unknown Artist"}
                      {/if}
                      {#if item.year}
                        • {item.year}
                      {/if}
                    {:else if item.type === "PLAYLIST"}
                      Playlist •
                      {#if item.artist?.artistId}
                        <a
                          href="#/artist/{item.artist.artistId}"
                          use:link
                          class="hover:underline">{item.artist.name}</a
                        >
                      {:else}
                        {item.artist?.name || "Unknown Artist"}
                      {/if}
                    {:else}
                      {item.type.charAt(0).toUpperCase() +
                        item.type.slice(1).toLowerCase()}
                    {/if}
                  </p>
                </div>
              </div>
            </Table.Cell>
          </Table.Row>
        {:else if item.type === "SONG" || item.type === "VIDEO"}
          <!-- Playable items (Song, Video) -->
          {@const isCurrent = currentTrack?.videoId === item.videoId}
          <Table.Row
            class="group cursor-pointer"
            onclick={() => playItem(item)}
          >
            <Table.Cell class="max-w-0">
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="overflow-hidden shrink-0"
                  class:h-10={item.type === "VIDEO"}
                  class:w-16={item.type === "VIDEO"}
                  class:size-10={item.type !== "VIDEO"}
                  class:rounded-md={item.type === "VIDEO"}
                  class:rounded-lg={item.type !== "VIDEO"}
                >
                  <Image
                    src={item.thumbnails?.at(0)?.url || ""}
                    alt={item.name}
                    class="size-full object-cover"
                    width={item.type === "VIDEO" ? 64 : 40}
                    height={40}
                  />
                </div>
                <div class="min-w-0">
                  <p
                    class="font-medium text-sm truncate {isCurrent
                      ? 'text-primary'
                      : ''}"
                  >
                    {item.name}
                  </p>
                  <p class="text-xs text-muted-foreground truncate">
                    {item.type === "SONG" ? "Song" : "Video"} •
                    {#if item.artist?.artistId}
                      <a
                        href="#/artist/{item.artist.artistId}"
                        use:link
                        class="hover:underline">{item.artist.name}</a
                      >
                    {:else}
                      {item.artist?.name || "Unknown Artist"}
                    {/if}
                  </p>
                </div>
              </div>
            </Table.Cell>
            {#if item.duration}
              <Table.Cell
                class="w-20 text-right text-muted-foreground text-sm {isCurrent
                  ? 'text-primary'
                  : ''}"
              >
                {formatDuration(item.duration)}
              </Table.Cell>
            {/if}
          </Table.Row>
        {/if}
      {/each}
    </Table.Body>
  </Table.Root>
</div>
