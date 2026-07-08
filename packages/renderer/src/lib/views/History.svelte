<script lang="ts">
  import { onMount } from "svelte";
  import { ytmusic } from "@app/preload";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import SongTable from "$lib/components/song-table.svelte";
  import { Spinner } from "$lib/components/ui/spinner";
  import { HistoryIcon, LogInIcon } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";

  let historyItems = $state<any[]>([]);
  let loading = $state(true);
  let isAuthed = $state<boolean | null>(null);

  // Grouped history items
  let groupedHistory = $derived.by(() => {
    const groups: { [key: string]: any[] } = {};
    for (const item of historyItems) {
      const key = item.played || "Recent";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push({
        videoId: item.videoId,
        name: item.title,
        artist: item.artists.map((a: any) => a.name).join(", ") || "Unknown Artist",
        artistId: item.artists[0]?.artistId || null,
        thumbnail: item.thumbnails?.[0]?.url || "",
        duration: null
      });
    }
    return Object.entries(groups).map(([title, songs]) => ({ title, songs }));
  });

  async function checkAuth() {
    try {
      const info = await ytmusic.getAccountInfo();
      isAuthed = !!(info && info.accountName);
    } catch {
      isAuthed = false;
    }
  }

  async function fetchHistory() {
    loading = true;
    try {
      historyItems = await ytmusic.getHistory();
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await checkAuth();
    if (isAuthed) {
      await fetchHistory();
    } else {
      loading = false;
    }
  });

  async function handleLogin() {
    const success = await ytmusic.login();
    if (success) {
      await checkAuth();
      if (isAuthed) {
        await fetchHistory();
      }
    }
  }
</script>

<ScrollArea class="w-full h-full">
  <div class="h-max mb-25 px-6 pt-14">
    {#if loading && isAuthed === null}
      <div class="flex flex-col items-center justify-center h-96">
        <p class="text-muted-foreground animate-pulse">
          Checking credentials...
        </p>
      </div>
    {:else if isAuthed === false}
      <!-- Guest login prompt view -->
      <div
        class="flex flex-col items-center justify-center min-h-[70vh] max-w-md mx-auto text-center gap-6"
      >
        <div
          class="p-6 rounded-full bg-primary/10 text-primary border border-primary/20 shadow-glass animate-bounce"
        >
          <HistoryIcon class="size-16" />
        </div>
        <div class="space-y-2">
          <h1 class="text-3xl font-extrabold tracking-tight">
            Listening History
          </h1>
          <p class="text-muted-foreground text-sm leading-relaxed">
            Log in to see your recently played songs from YouTube Music.
          </p>
        </div>
        <Button
          size="lg"
          class="rounded-full gap-2 px-8 w-full md:w-auto"
          onclick={handleLogin}
        >
          <LogInIcon class="size-5" /> Log In to YouTube Music
        </Button>
      </div>
    {:else}
      <!-- Authenticated view -->
      <div class="flex flex-col gap-4 mb-8">
        <h1 class="text-3xl font-extrabold tracking-tight">History</h1>
        <p class="text-sm text-muted-foreground">
          Your recently played songs on YouTube Music.
        </p>
      </div>

      {#if loading}
        <div
          class="flex flex-col items-center justify-center min-h-[40vh] w-full gap-3"
        >
          <Spinner />
          <p class="text-xs text-muted-foreground animate-pulse">Loading...</p>
        </div>
      {:else if groupedHistory.length === 0}
        <div
          class="flex flex-col items-center justify-center py-20 text-center gap-3"
        >
          <p class="text-lg font-semibold text-muted-foreground">
            No history found
          </p>
          <p class="text-sm text-muted-foreground/60">
            Songs you play on YouTube Music will appear here.
          </p>
        </div>
      {:else}
        <div class="flex flex-col gap-8 w-full">
          {#each groupedHistory as group}
            <div class="flex flex-col gap-3">
              <h2 class="text-lg font-bold text-foreground border-b border-border/50 pb-2">{group.title}</h2>
              <SongTable songs={group.songs} showHeader={false} />
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</ScrollArea>
