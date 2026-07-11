<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Spinner } from "$lib/components/ui/spinner";
  import Image from "$lib/components/ui/image.svelte";
  import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";
  import { BookmarkIcon } from "@lucide/svelte";
  import { ytmusic } from "@app/preload";
  import { player, type Track } from "$lib/stores/player.svelte";
  import { type PlaylistDetailed } from "@app/api";
  import CreatePlaylistDialog from "./create-playlist-dialog.svelte";

  let {
    open = $bindable(false),
    track = null,
  }: {
    open: boolean;
    track?: Track | null;
  } = $props();

  let targetTrack = $derived(track || player.currentTrack);

  let dialogPlaylists = $state<PlaylistDetailed[]>([]);
  let editablePlaylists = $derived(dialogPlaylists.filter((p) => p.editable));
  let playlistsLoading = $state(false);
  let isCreateDialogOpen = $state(false);
  let playlistActionLoading = $state(false);

  async function loadDialogPlaylists() {
    playlistsLoading = true;
    try {
      dialogPlaylists = await ytmusic.getLibraryPlaylists(100);
    } catch (e) {
      console.warn("Failed to load playlists:", e);
    } finally {
      playlistsLoading = false;
    }
  }

  $effect(() => {
    if (open) {
      loadDialogPlaylists();
      playlistActionLoading = false;
    }
  });

  async function addToPlaylist(playlistId: string) {
    if (!targetTrack) return;
    playlistActionLoading = true;
    try {
      await ytmusic.addPlaylistItems(playlistId, [targetTrack.videoId]);
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("playlists-changed")),
        1000,
      );

      open = false;
    } catch (e) {
      console.error("Failed to add to playlist:", e);
    } finally {
      playlistActionLoading = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Add to playlist</Dialog.Title>
      <Dialog.Description>
        {#if targetTrack}
          Choose a playlist to add "{targetTrack.name}".
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <!-- Playlist list -->
    <ScrollArea class="max-h-[300px]">
      {#if playlistsLoading}
        <div class="flex flex-col items-center justify-center py-10 gap-2">
          <Spinner />
          <p class="text-xs text-muted-foreground animate-pulse">
            Loading playlists...
          </p>
        </div>
      {:else if editablePlaylists.length === 0}
        <div class="text-center py-10 text-xs text-muted-foreground">
          No editable playlists found.
        </div>
      {:else}
        {#each editablePlaylists as playlist}
          <button
            class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted text-left transition-colors disabled:opacity-50"
            disabled={playlistActionLoading}
            onclick={() => addToPlaylist(playlist.playlistId)}
          >
            <div class="size-10 rounded-lg overflow-hidden bg-muted shrink-0">
              {#if playlist.thumbnails?.at(0)?.url}
                <Image
                  src={playlist.thumbnails[0].url}
                  alt={playlist.name}
                  width={40}
                  height={40}
                  class="size-full object-cover"
                />
              {:else}
                <div
                  class="size-full bg-muted flex items-center justify-center"
                >
                  <BookmarkIcon class="size-4 text-muted-foreground" />
                </div>
              {/if}
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-sm truncate">{playlist.name}</p>
            </div>
          </button>
        {/each}
      {/if}
    </ScrollArea>
    <Dialog.Footer class="border-t border-border/50 pt-4">
      <Button
        variant="outline"
        class="w-full"
        onclick={() => {
          isCreateDialogOpen = true;
          open = false;
        }}
      >
        Create new playlist
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<CreatePlaylistDialog
  bind:open={isCreateDialogOpen}
  videoIds={targetTrack ? [targetTrack.videoId] : null}
/>
