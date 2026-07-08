<script lang="ts">
  import { onMount } from "svelte";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { ytmusic } from "@app/preload";
  import type { AlbumFull } from "@app/api/src";
  import { PlayIcon } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { player, type Track } from "$lib/stores/player.svelte";
  import SongTable from "$lib/components/song-table.svelte";
  import Image from "$lib/components/ui/image.svelte";
  import { Spinner } from "$lib/components/ui/spinner";

  let { params }: { params: { id: string } } = $props();

  let album: AlbumFull | null = $state(null);
  let loading = $state(true);

  async function fetchAlbum() {
    loading = true;
    try {
      album = await ytmusic.getAlbum(params.id);
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (params.id) {
      fetchAlbum();
    }
  });

  function getQueue(): Track[] {
    if (!album) return [];
    return album.songs.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artist: s.artist?.name || album?.artist?.name || "Unknown Artist",
      artistId: s.artist?.artistId || album?.artist?.artistId,
      thumbnail:
        album?.thumbnails?.at(0)?.url || s.thumbnails?.at(0)?.url || "",
      duration: s.duration,
    }));
  }

  function playAlbum() {
    const queue = getQueue();
    if (queue.length > 0) {
      player.playTrack(queue[0], queue);
    }
  }
</script>

<ScrollArea class="w-full h-full">
  <div class="h-max mb-25 px-6">
    {#if loading}
      <div
        class="flex flex-col items-center justify-center min-h-[70vh] w-full gap-3"
      >
        <Spinner />
        <p class="text-xs text-muted-foreground animate-pulse">Loading...</p>
      </div>
    {:else if album}
      <div
        class="flex flex-col md:flex-row gap-6 items-end mb-8 pt-14 relative"
      >
        <Image
          src={album.thumbnails?.at(-1)?.url || ""}
          class="absolute inset-0 h-100 w-full scale-x-110 object-cover -z-10 mask-b-from-0% blur-3xl"
        />
        <div class="size-48 md:size-60 rounded-3xl overflow-hidden">
          <Image
            src={album.thumbnails?.at(-1)?.url || ""}
            alt={album.name}
            class="size-full object-cover"
          />
        </div>
        <div class="flex-1">
          <h1
            class="text-4xl md:text-5xl font-extrabold tracking-tight leading-none"
          >
            {album.name}
          </h1>
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            {#if album.artist?.name}
              <a
                href="#/artist/{album.artist.artistId}"
                class="hover:underline font-medium text-foreground"
              >
                {album.artist.name}
              </a>
              <span>•</span>
            {/if}
            {#if album.year}
              <span>{album.year}</span>
              <span>•</span>
            {/if}
            <span>{album.songs.length} tracks</span>
          </div>
          <div class="flex items-center gap-4 mt-4">
            <Button size="lg" class="rounded-full gap-2" onclick={playAlbum}>
              <PlayIcon class="size-5 fill-current" /> Play
            </Button>
          </div>
        </div>
      </div>

      <div class="w-full">
        <SongTable songs={getQueue()} showThumbnails={false} />
      </div>
    {:else}
      <div class="flex items-center justify-center h-64">
        <p class="text-muted-foreground">Album not found.</p>
      </div>
    {/if}
  </div>
</ScrollArea>
