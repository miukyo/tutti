<script lang="ts">
  import RowSection from "$lib/components/row-section.svelte";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import VirtualSection from "$lib/components/virtual-section.svelte";
  import type { SearchResult } from "@app/api/src";
  import { ytmusic } from "@app/preload";
  import { Spinner } from "$lib/components/ui/spinner";

  interface ExploreSection {
    title: string;
    items: SearchResult[];
  }

  let contents: ExploreSection[] = $state([]);
  let loading = $state(true);

  async function fetchExplore() {
    loading = true;
    try {
      const data = await ytmusic.getExplore();
      contents = [
        { title: "New Releases", items: data.newReleases },
        { title: "Trending", items: data.trending },
        { title: "New Music Videos", items: data.newMusicVideos },
      ];
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }
  fetchExplore();
</script>

<ScrollArea class="w-full h-full">
  <div class="h-max mt-14 mb-25">
    {#if loading}
      <div
        class="flex flex-col items-center justify-center min-h-[70vh] w-full gap-3"
      >
        <Spinner />
        <p class="text-xs text-muted-foreground animate-pulse">Loading...</p>
      </div>
    {:else}
      {#each contents as content}
        {#if content.items.length > 0}
          <VirtualSection>
            <h1 class="text-xl font-bold px-6">{content.title}</h1>
            <RowSection contents={content.items} />
          </VirtualSection>
        {/if}
      {/each}
    {/if}
  </div>
</ScrollArea>
