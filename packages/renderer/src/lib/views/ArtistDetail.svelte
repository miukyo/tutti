<script lang="ts">
  import { onMount } from "svelte";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { ytmusic } from "@app/preload";
  import type { ArtistFull } from "@app/api/src";
  import { ChevronDownIcon, PlayIcon } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { player, type Track } from "$lib/stores/player.svelte";
  import SongTable from "$lib/components/song-table.svelte";
  import Image from "$lib/components/ui/image.svelte";
  import RowSection from "$lib/components/row-section.svelte";
  import { Spinner } from "$lib/components/ui/spinner";

  let { params }: { params: { id: string } } = $props();

  let artist: ArtistFull | null = $state(null);
  let loading = $state(true);
  let showAll = $state(false);
  let songs: Track[] = $state([]);

  async function fetchArtist() {
    loading = true;
    try {
      artist = await ytmusic.getArtist(params.id);
      songs = await getQueue();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (params.id) {
      fetchArtist();
    }
  });

  async function getQueue(): Promise<Track[]> {
    if (!artist) return [];
    const fetchedSongs = await ytmusic.getArtistSongs(params.id);
    return fetchedSongs.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artists: s.artists,
      thumbnail: s.thumbnails?.at(0)?.url || "",
      duration: s.duration,
    }));
  }

  async function playsongs() {
    if (songs.length > 0) {
      player.playTrack(songs[0], songs);
    }
  }
</script>

<ScrollArea class="w-full h-full">
  <div class="h-max mb-25">
    {#if loading}
      <div
        class="flex flex-col items-center justify-center min-h-[70vh] w-full gap-3"
      >
        <Spinner />
        <p class="text-xs text-muted-foreground animate-pulse">Loading...</p>
      </div>
    {:else if artist}
      <div
        class="flex flex-col md:flex-row gap-6 items-end mb-8 h-100 px-6 relative"
      >
        <Image
          src={artist.thumbnails?.at(-1)?.url || ""}
          alt={artist.name}
          class="size-full object-cover absolute top-0 left-0 h-100 mask-b-from-0% pointer-events-none"
        />
        <div class="flex-1 z-10 mt-15">
          <h1
            class="text-4xl md:text-5xl font-extrabold tracking-tight mt-2 mb-4 leading-none"
          >
            {artist.name}
          </h1>
          <p class="text-xs opacity-50 max-w-2xl line-clamp-3">
            {artist.description}
          </p>
          {#if songs.length > 0}
            <div class="flex items-center gap-4 mt-4">
              <Button size="lg" class="rounded-full gap-2" onclick={playsongs}>
                <PlayIcon class="size-5 fill-current" /> Play
              </Button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Top Songs -->
      {#if songs.length > 0}
        <div class="mb-8 font-semibold px-6">
          <div class="flex justify-between items-center mb-2">
            <h2 class="text-xl font-bold text-foreground">Songs</h2>
            <Button
              variant="link"
              size="sm"
              class="hover:no-underline"
              onclick={() => (showAll = !showAll)}
              >{#if showAll}Show less{:else}Show all{/if}
              <ChevronDownIcon
                class={`${showAll ? "rotate-180" : ""}`}
              /></Button
            >
          </div>
          <SongTable showHeader={false} limit={showAll ? 10000 : 5} {songs} />
        </div>
      {/if}

      <!-- Top Albums -->
      {#if artist.topAlbums && artist.topAlbums.length > 0}
        <div class="mb-8">
          <h2 class="text-xl font-bold px-6">Albums</h2>
          <RowSection contents={artist.topAlbums} />
        </div>
      {/if}

      <!-- Top Singles -->
      {#if artist.topSingles && artist.topSingles.length > 0}
        <div class="mb-8">
          <h2 class="text-xl font-bold px-6">Singles & EPs</h2>
          <RowSection contents={artist.topSingles} />
        </div>
      {/if}
    {:else}
      <div class="flex items-center justify-center h-64">
        <p class="text-muted-foreground">Artist not found.</p>
      </div>
    {/if}
  </div>
</ScrollArea>
