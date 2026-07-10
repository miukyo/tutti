<script lang="ts">
  import { PlayIcon, ClockIcon } from "@lucide/svelte";
  import * as Table from "$lib/components/ui/table";
  import { player, type Track } from "$lib/stores/player.svelte";
  import Image from "$lib/components/ui/image.svelte";

  let {
    songs,
    limit,
    showThumbnails = true,
    playWithUpNext = false,
    showHeader = true,
    showTime = true,
  }: {
    songs: Track[];
    limit?: number;
    showThumbnails?: boolean;
    playWithUpNext?: boolean;
    showHeader?: boolean;
    showTime?: boolean;
  } = $props();

  let currentTrack = $derived(player.currentTrack);

  function playTrack(index: number) {
    if (playWithUpNext) {
      player.playWithUpNext(songs[index]);
      return;
    }
    player.playTrack(songs[index], songs);
  }
  function formatDuration(seconds: number | null | undefined): string {
    if (!seconds) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
</script>

<Table.Root class="h-max">
  {#if showHeader}
    <Table.Header>
      <Table.Row>
        <Table.Head>Title</Table.Head>
        {#if songs[0]?.duration && showTime}
          <Table.Head class="w-20 text-right"
            ><ClockIcon class="size-4 inline" /></Table.Head
          >
        {/if}
      </Table.Row>
    </Table.Header>
  {/if}
  <Table.Body>
    {#each songs.slice(0, limit) as song, index}
      {@const isCurrent = currentTrack?.videoId === song.videoId}
      <Table.Row class="group cursor-pointer" onclick={() => playTrack(index)}>
        <Table.Cell class="max-w-0">
          <div class="flex items-center gap-3 min-w-0">
            {#if showThumbnails && song.thumbnail}
              <div class="size-10 rounded-lg overflow-hidden shrink-0">
                <Image
                  src={song.thumbnail}
                  alt={song.name}
                  width={40}
                  height={40}
                  class="size-full object-cover"
                />
              </div>
            {/if}
            <div class="min-w-0">
              <p
                class="font-medium text-sm truncate {isCurrent
                  ? 'text-primary'
                  : ''}"
              >
                {song.name}
              </p>
              <p class="text-xs text-muted-foreground truncate">
                {#if song.artistId}
                  <a
                    href="#/artist/{song.artistId}"
                    class="hover:underline {isCurrent
                      ? 'text-primary opacity-80'
                      : ''}"
                  >
                    {song.artist}
                  </a>
                {:else}
                  <span class={isCurrent ? "text-primary opacity-80" : ""}
                    >{song.artist}</span
                  >
                {/if}
              </p>
            </div>
          </div>
        </Table.Cell>
        {#if songs[0]?.duration && showTime}
          <Table.Cell
            class="w-20 text-right text-muted-foreground text-sm {isCurrent
              ? 'text-primary'
              : ''}"
          >
            {formatDuration(song.duration)}
          </Table.Cell>
        {/if}
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
