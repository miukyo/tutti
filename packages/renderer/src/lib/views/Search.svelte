<script lang="ts">
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { ytmusic } from "@app/preload";
  import type { SearchResult, SearchFilter } from "@app/api/src";
  import RowSection from "$lib/components/row-section.svelte";
  import SongTable from "$lib/components/song-table.svelte";
  import { player, type Track } from "$lib/stores/player.svelte";
  import { Button } from "$lib/components/ui/button";
  import ItemTable from "$lib/components/item-table.svelte";
  import { Spinner } from "$lib/components/ui/spinner";

  let { params }: { params: { query: string } } = $props();

  let decodedQuery = $derived(decodeURIComponent(params.query || ""));
  let results = $state<SearchResult[]>([]);
  let activeFilter = $state<SearchFilter | "All">("All");
  let loading = $state(false);

  const filters: (SearchFilter | "All")[] = [
    "All",
    "Songs",
    "Videos",
    "Albums",
    "Artists",
    "Playlists",
  ];

  async function performSearch() {
    if (!decodedQuery) return;
    loading = true;
    try {
      const filterParam = activeFilter === "All" ? null : activeFilter;
      results = await ytmusic.search(decodedQuery, filterParam);
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (decodedQuery || activeFilter) {
      performSearch();
    }
  });

  // Segregate results
  let songs = $derived(
    results.filter(
      (r): r is Extract<SearchResult, { type: "SONG" }> => r.type === "SONG",
    ),
  );
  let videos = $derived(
    results.filter(
      (r): r is Extract<SearchResult, { type: "VIDEO" }> => r.type === "VIDEO",
    ),
  );
  let albums = $derived(
    results.filter(
      (r): r is Extract<SearchResult, { type: "ALBUM" }> => r.type === "ALBUM",
    ),
  );
  let artists = $derived(
    results.filter(
      (r): r is Extract<SearchResult, { type: "ARTIST" }> =>
        r.type === "ARTIST",
    ),
  );
  let playlists = $derived(
    results.filter(
      (r): r is Extract<SearchResult, { type: "PLAYLIST" }> =>
        r.type === "PLAYLIST",
    ),
  );

  function getSongsTracks(songList: typeof songs): Track[] {
    return songList.map((s) => ({
      videoId: s.videoId,
      name: s.name,
      artist: s.artist?.name || "Unknown Artist",
      artistId: s.artist?.artistId,
      thumbnail: s.thumbnails?.at(0)?.url || "",
      duration: s.duration,
    }));
  }
</script>

<ScrollArea class="w-full h-full">
  <div class="h-max mt-14 mb-25">
    <div class="flex flex-col gap-4 mb-6 px-6">
      <div>
        <p
          class="text-xs uppercase font-bold tracking-widest text-muted-foreground"
        >
          Search Results for
        </p>
        <h1 class="text-3xl font-extrabold tracking-tight mt-1">
          "{decodedQuery}"
        </h1>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-2">
        {#each filters as filter}
          <Button
            size="sm"
            variant={activeFilter === filter ? "default" : "outline"}
            onclick={() => (activeFilter = filter)}
            class="rounded-full"
          >
            {filter}
          </Button>
        {/each}
      </div>
    </div>

    {#if loading}
      <div
        class="flex flex-col items-center justify-center min-h-[50vh] w-full gap-3"
      >
        <Spinner />
        <p class="text-xs text-muted-foreground animate-pulse">Loading...</p>
      </div>
    {:else if results.length === 0}
      <div class="flex items-center justify-center h-64">
        <p class="text-muted-foreground">No results found.</p>
      </div>
    {:else}
      <div class="flex flex-col">
        <!-- If All or Songs is selected -->
        {#if (activeFilter === "All" || activeFilter === "Songs") && songs.length > 0}
          <div class="px-6 mb-4">
            {#if activeFilter === "All"}
              <h2 class="text-xl font-bold">Songs</h2>
            {/if}
            <SongTable
              songs={getSongsTracks(songs)}
              playWithUpNext
              showHeader={false}
            />
          </div>
        {/if}

        <!-- Artists -->
        {#if (activeFilter === "All" || activeFilter === "Artists") && artists.length > 0}
          <div class={activeFilter === "All" ? "min-h-[305px]" : "px-6 mb-4"}>
            {#if activeFilter === "All"}
              <h2 class="px-6 text-xl font-bold">Artists</h2>
              <RowSection contents={artists} />
            {:else}
              <ItemTable items={artists} />
            {/if}
          </div>
        {/if}

        <!-- Albums -->
        {#if (activeFilter === "All" || activeFilter === "Albums") && albums.length > 0}
          <div class={activeFilter === "All" ? "min-h-[305px]" : "px-6 mb-4"}>
            {#if activeFilter === "All"}
              <h2 class="px-6 text-xl font-bold">Albums</h2>
              <RowSection contents={albums} />
            {:else}
              <ItemTable items={albums} />
            {/if}
          </div>
        {/if}

        <!-- Playlists -->
        {#if (activeFilter === "All" || activeFilter === "Playlists") && playlists.length > 0}
          <div class={activeFilter === "All" ? "min-h-[305px]" : "px-6 mb-4"}>
            {#if activeFilter === "All"}
              <h2 class="px-6 text-xl font-bold">Playlists</h2>
              <RowSection contents={playlists} />
            {:else}
              <ItemTable items={playlists} />
            {/if}
          </div>
        {/if}

        <!-- Videos -->
        {#if (activeFilter === "All" || activeFilter === "Videos") && videos.length > 0}
          <div
            class={activeFilter === "All"
              ? "min-h-[305px]"
              : "px-6 mb-4 overflow-hidden"}
          >
            {#if activeFilter === "All"}
              <h2 class="px-6 text-xl font-bold">Videos</h2>
              <RowSection contents={videos} />
            {:else}
              <ItemTable items={videos} playWithUpNext />
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</ScrollArea>
