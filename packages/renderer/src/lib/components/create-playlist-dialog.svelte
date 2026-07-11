<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Spinner } from "$lib/components/ui/spinner";
  import { ytmusic } from "@app/preload";

  let {
    open = $bindable(false),
    videoIds = null,
  }: {
    open: boolean;
    videoIds?: string[] | null;
  } = $props();

  let playlistTitle = $state("");
  let playlistDesc = $state("");
  let actionLoading = $state(false);

  $effect(() => {
    if (open) {
      playlistTitle = "";
      playlistDesc = "";
      actionLoading = false;
    }
  });

  async function handleCreatePlaylist() {
    if (!playlistTitle.trim()) return;
    actionLoading = true;
    try {
      await ytmusic.createPlaylist(
        playlistTitle.trim(),
        playlistDesc.trim(),
        "PRIVATE",
        videoIds,
      );
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("playlists-changed")),
        500,
      );
      open = false;
    } catch (e) {
      console.error("Failed to create playlist:", e);
    } finally {
      actionLoading = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Create playlist</Dialog.Title>
      <Dialog.Description>
        Create a new playlist to organize your music.
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-4 py-4">
      <div class="grid gap-2">
        <label
          for="new-playlist-title"
          class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Title
        </label>
        <Input
          id="new-playlist-title"
          placeholder="My Playlist"
          bind:value={playlistTitle}
          disabled={actionLoading}
        />
      </div>
      <div class="grid gap-2">
        <label
          for="new-playlist-desc"
          class="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Description
        </label>
        <Textarea
          id="new-playlist-desc"
          placeholder="An optional description..."
          bind:value={playlistDesc}
          disabled={actionLoading}
        />
      </div>
    </div>
    <Dialog.Footer class="gap-2">
      <Button
        variant="outline"
        disabled={actionLoading}
        onclick={() => (open = false)}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={!playlistTitle.trim() || actionLoading}
        onclick={handleCreatePlaylist}
      >
        {#if actionLoading}
          <Spinner variant="circle" />
        {:else}
          Create
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
