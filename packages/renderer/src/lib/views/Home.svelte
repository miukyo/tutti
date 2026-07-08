<script lang="ts">
  import RowSection from "$lib/components/row-section.svelte";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import type { HomeSection } from "@app/api/src";
  import { ytmusic } from "@app/preload";
  import { Spinner } from "$lib/components/ui/spinner";
  let contents: HomeSection[] = $state([]);
  let loading = $state(true);

  async function fetchHome() {
    loading = true;
    try {
      contents = await ytmusic.getHomeSections();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }
  fetchHome();
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
        {#if content.contents.length > 0}
          <h1 class="text-xl font-bold px-6">{content.title}</h1>
          <RowSection contents={content.contents} />
        {/if}
      {/each}
    {/if}
  </div>
</ScrollArea>
