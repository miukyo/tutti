<script lang="ts">
  import { onMount } from "svelte";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { ytmusic } from "@app/preload";
  import type { PlaylistFull, VideoDetailed } from "@app/api/src";
  import { PlayIcon, Trash2Icon } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { player, type Track } from "$lib/stores/player.svelte";
  import SongTable from "$lib/components/song-table.svelte";
  import Image from "$lib/components/ui/image.svelte";
  import { Spinner } from "$lib/components/ui/spinner";
  import { replace } from "svelte-spa-router";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";

  let { params }: { params: { id: string } } = $props();

  let playlist: PlaylistFull | null = $state(null);
  let videos: VideoDetailed[] = $state([]);
  let loading = $state(true);

  async function fetchPlaylist() {
    loading = true;
    try {
      playlist = await ytmusic.getPlaylist(params.id);
      videos = await ytmusic.getPlaylistVideos(params.id);
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (params.id) {
      fetchPlaylist();
    }
  });

  let queue = $derived.by(() => {
    return videos.map((v) => ({
      videoId: v.videoId,
      name: v.name,
      artists: v.artists,
      thumbnail: v.thumbnails?.at(0)?.url || "",
      duration: v.duration,
      setVideoId: v.setVideoId,
    }));
  });

  function playPlaylist() {
    if (queue.length > 0) {
      player.playTrack(queue[0], queue);
    }
  }

  async function handleDeleteTrack(song: Track, index: number) {
    if (!song.setVideoId) {
      console.warn("Cannot delete track: setVideoId is missing.");
      return;
    }
    try {
      await ytmusic.removePlaylistItems(params.id, [
        {
          setVideoId: song.setVideoId,
          removedVideoId: song.videoId,
        },
      ]);
      videos = videos.filter((_, i) => i !== index);
    } catch (e) {
      console.error("Failed to delete track from playlist:", e);
    }
  }

  let isDeleteAlertOpen = $state(false);

  async function confirmDeletePlaylist() {
    if (!playlist) return;
    try {
      loading = true;
      await ytmusic.deletePlaylist(params.id);
      window.dispatchEvent(new CustomEvent("playlists-changed"));
      replace("/library");
      loading = false;
    } catch (e) {
      console.error("Failed to delete playlist:", e);
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
    {:else if playlist}
      <div
        class="flex flex-col md:flex-row gap-6 items-end mb-8 pt-14 relative"
      >
        <Image
          src={playlist.thumbnails?.at(-1)?.url || ""}
          class="absolute inset-0 h-100 w-full scale-x-110 object-cover -z-10 mask-b-from-0% blur-3xl"
        />
        <div class="size-48 md:size-60 rounded-3xl overflow-hidden">
          <Image
            src={playlist.thumbnails?.at(-1)?.url || ""}
            alt={playlist.name}
            class="size-full object-cover"
          />
        </div>
        <div class="flex-1">
          <h1
            class="text-4xl md:text-5xl font-extrabold tracking-tight leading-none"
          >
            {playlist.name}
          </h1>
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            {#if playlist.artists && playlist.artists.length > 0}
              {#each playlist.artists as artist, idx}
                {#if idx > 0}
                  <span>&bull;</span>
                {/if}
                {#if artist.artistId}
                  <a
                    href="#/artist/{artist.artistId}"
                    class="hover:underline font-medium text-foreground"
                  >
                    {artist.name}
                  </a>
                {:else}
                  <span class="font-medium text-foreground">{artist.name}</span>
                {/if}
              {/each}
              <span>•</span>
            {/if}
            <span>{videos.length} tracks</span>
          </div>
          <div class="flex items-center gap-2 mt-4">
            <Button size="lg" class="rounded-full gap-2" onclick={playPlaylist}>
              <PlayIcon class="size-5 fill-current" /> Play
            </Button>
            {#if playlist.editable}
              <Button
                size="lg"
                variant="outline"
                class="rounded-full gap-2"
                onclick={() => (isDeleteAlertOpen = true)}
              >
                <Trash2Icon class="size-5" /> Delete
              </Button>

              <AlertDialog.Root bind:open={isDeleteAlertOpen}>
                <AlertDialog.Content>
                  <AlertDialog.Header>
                    <AlertDialog.Title
                      >Are you absolutely sure?</AlertDialog.Title
                    >
                    <AlertDialog.Description>
                      This action cannot be undone. This will permanently delete
                      the playlist "{playlist.name}".
                    </AlertDialog.Description>
                  </AlertDialog.Header>
                  <AlertDialog.Footer>
                    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                    <AlertDialog.Action
                      onclick={confirmDeletePlaylist}
                      class="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {#if loading}
                        <Spinner variant="circle" />
                      {:else}
                        Delete
                      {/if}
                    </AlertDialog.Action>
                  </AlertDialog.Footer>
                </AlertDialog.Content>
              </AlertDialog.Root>
            {/if}
          </div>
        </div>
      </div>

      <div class="w-full">
        <SongTable
          songs={queue}
          onDeleteTrack={playlist?.editable ? handleDeleteTrack : undefined}
        />
      </div>
    {:else}
      <div class="flex items-center justify-center h-64">
        <p class="text-muted-foreground">Playlist not found.</p>
      </div>
    {/if}
  </div>
</ScrollArea>
