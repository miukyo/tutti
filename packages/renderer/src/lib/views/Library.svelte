<script lang="ts">
  import { onMount } from "svelte";
  import { ytmusic } from "@app/preload";
  import { Button } from "$lib/components/ui/button";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import Image from "$lib/components/ui/image.svelte";
  import SongTable from "$lib/components/song-table.svelte";
  import type {
    PlaylistDetailed,
    AlbumDetailed,
    ArtistDetailed,
  } from "@app/api/src";
  import {
    LogInIcon,
    MusicIcon,
    PlayIcon,
    GridIcon,
    ListIcon,
  } from "@lucide/svelte";
  import { player, type Track } from "$lib/stores/player.svelte";

  import { push } from "svelte-spa-router";
  import { Spinner } from "$lib/components/ui/spinner";

  type LibraryItem = PlaylistDetailed | AlbumDetailed | ArtistDetailed;

  let { params } = $props<{ params?: { filter?: string } }>();

  let isAuthed = $state<boolean | null>(null);
  let accountInfo = $state<any>(null);
  let activeFilter = $state<"playlists" | "songs" | "albums" | "artists">(
    "playlists",
  );

  $effect(() => {
    if (
      params?.filter &&
      ["playlists", "songs", "albums", "artists"].includes(params.filter)
    ) {
      activeFilter = params.filter as any;
    }
  });
  let items = $state<any[]>([]);
  let loading = $state(true);

  // Verification helper for guest check
  async function checkAuth() {
    try {
      const info = await ytmusic.getAccountInfo();
      if (info && info.accountName) {
        accountInfo = info;
        isAuthed = true;
      } else {
        isAuthed = false;
      }
    } catch (e) {
      console.warn("Failed to get account info, treating as guest:", e);
      isAuthed = false;
    }
  }

  async function fetchLibraryData() {
    if (!isAuthed) return;
    loading = true;
    items = [];
    try {
      if (activeFilter === "playlists") {
        items = await ytmusic.getLibraryPlaylists(100);
      } else if (activeFilter === "songs") {
        const fetched = await ytmusic.getLibrarySongs(100);
        items = fetched.map((s) => ({
          videoId: s.videoId,
          name: s.name,
          artists: s.artists,
          thumbnail: s.thumbnails?.at(0)?.url || "",
          duration: s.duration,
        }));
      } else if (activeFilter === "albums") {
        items = await ytmusic.getLibraryAlbums(100);
      } else if (activeFilter === "artists") {
        items = await ytmusic.getLibraryArtists(100);
      }
    } catch (e) {
      console.error(`Failed to fetch library ${activeFilter}:`, e);
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await checkAuth();
    if (!isAuthed) {
      loading = false;
    }
  });

  // Fetch data when active filter changes
  $effect(() => {
    if (isAuthed && activeFilter) {
      fetchLibraryData();
    }
  });

  async function handleLogin() {
    const success = await ytmusic.login();
    if (success) {
      await checkAuth();
      if (isAuthed) {
        await fetchLibraryData();
      }
    }
  }

  function getDetailUrl(item: any) {
    if (item.type === "PLAYLIST") return `#/playlist/${item.playlistId}`;
    if (item.type === "ALBUM") return `#/album/${item.albumId}`;
    if (item.type === "ARTIST") return `#/artist/${item.artistId}`;
    return "";
  }

  async function playCollection(item: any) {
    loading = true;
    try {
      let tracks: Track[] = [];
      if (item.type === "PLAYLIST") {
        const playlistVideos = await ytmusic.getPlaylistVideos(item.playlistId);
        tracks = playlistVideos.map((s: any) => ({
          videoId: s.videoId,
          name: s.name,
          artists: s.artists,
          thumbnail: s.thumbnails?.at(0)?.url || "",
          duration: s.duration,
        }));
      } else if (item.type === "ALBUM") {
        const album = await ytmusic.getAlbum(item.albumId);
        tracks = album.songs.map((s: any) => ({
          videoId: s.videoId,
          name: s.name,
          artists: s.artists,
          thumbnail:
            album.thumbnails?.at(0)?.url || s.thumbnails?.at(0)?.url || "",
          duration: s.duration,
        }));
      } else if (item.type === "ARTIST") {
        const songs = await ytmusic.getArtistSongs(item.artistId);
        tracks = songs.map((s: any) => ({
          videoId: s.videoId,
          name: s.name,
          artists: s.artists,
          thumbnail: s.thumbnails?.at(0)?.url || "",
          duration: s.duration,
        }));
      }

      if (tracks.length > 0) {
        player.playTrack(tracks[0], tracks);
      }
    } catch (e) {
      console.error("Failed to play library collection:", e);
    } finally {
      loading = false;
    }
  }
</script>

<ScrollArea class="w-full h-full">
  <div class="h-max mb-25 px-6 pt-14">
    {#if loading && isAuthed === null}
      <!-- Initial auth checking state -->
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
          <MusicIcon class="size-16" />
        </div>
        <div class="space-y-2">
          <h1 class="text-3xl font-extrabold tracking-tight">
            Your Music Library
          </h1>
          <p class="text-muted-foreground text-sm leading-relaxed">
            Log in to access all your playlists, saved albums, liked songs, and
            subscribed artists directly from YouTube Music.
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
    {:else if isAuthed === true}
      <!-- Authenticated view -->
      <div
        class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
      >
        <div class="flex items-center gap-4">
          {#if accountInfo?.accountPhotoUrl}
            <div
              class="size-16 rounded-full overflow-hidden border border-border shadow-glass"
            >
              <Image
                src={accountInfo.accountPhotoUrl}
                alt={accountInfo.accountName}
                class="size-full object-cover"
              />
            </div>
          {/if}
          <div>
            <h1 class="text-3xl font-extrabold tracking-tight">Library</h1>
            <p class="text-sm text-muted-foreground">
              {accountInfo?.accountName || "Authenticated User"}
              {#if accountInfo?.channelHandle}• {accountInfo.channelHandle}{/if}
            </p>
          </div>
        </div>
      </div>

      <!-- Filter chips -->
      <div
        class="flex gap-2 mb-6 border-b border-border pb-4 overflow-x-auto scrollbar-none"
      >
        <Button
          variant={activeFilter === "playlists" ? "default" : "outline"}
          size="sm"
          class="rounded-full"
          onclick={() => push("/library/playlists")}
        >
          Playlists
        </Button>
        <Button
          variant={activeFilter === "songs" ? "default" : "outline"}
          size="sm"
          class="rounded-full"
          onclick={() => push("/library/songs")}
        >
          Songs
        </Button>
        <Button
          variant={activeFilter === "albums" ? "default" : "outline"}
          size="sm"
          class="rounded-full"
          onclick={() => push("/library/albums")}
        >
          Albums
        </Button>
        <Button
          variant={activeFilter === "artists" ? "default" : "outline"}
          size="sm"
          class="rounded-full"
          onclick={() => push("/library/artists")}
        >
          Artists
        </Button>
      </div>

      <!-- Contents -->
      {#if loading}
        <div
          class="flex flex-col items-center justify-center min-h-[40vh] w-full gap-3"
        >
          <Spinner />
          <p class="text-xs text-muted-foreground animate-pulse">Loading...</p>
        </div>
      {:else if items.length === 0}
        <div
          class="flex flex-col items-center justify-center py-20 text-center gap-3"
        >
          <p class="text-lg font-semibold text-muted-foreground">
            No {activeFilter} found
          </p>
          <p class="text-sm text-muted-foreground/60">
            Your saved {activeFilter} will appear here.
          </p>
        </div>
      {:else if activeFilter === "songs"}
        <!-- Song List View -->
        <div class="w-full">
          <SongTable songs={items} showHeader={false} />
        </div>
      {:else}
        <!-- Grid View for Playlists, Albums, Artists -->
        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {#each items as item}
            {@const isArtist = item.type === "ARTIST"}
            <div
              class="group flex flex-col p-2 hover:scale-105 transition-transform ease-out cursor-pointer relative"
            >
              <!-- Card Thumbnail Wrapper -->
              <a
                href={getDetailUrl(item)}
                class="aspect-square overflow-hidden relative select-none w-full"
                class:rounded-3xl={!isArtist}
                class:rounded-full={isArtist}
              >
                <Image
                  src={item.thumbnails?.at(-1)?.url || ""}
                  alt={item.name}
                  class="size-full object-cover"
                />
              </a>

              <!-- Text Info -->
              <div
                class="flex flex-col min-w-0"
                class:items-center={isArtist}
                class:text-center={isArtist}
              >
                <a
                  href={getDetailUrl(item)}
                  class="line-clamp-1 mt-2 font-semibold leading-tight text-foreground text-sm hover:underline"
                >
                  {item.name}
                </a>
                {#if item.artist?.name}
                  <span class="text-xs opacity-50 mt-0.5 truncate">
                    {item.artist.name}
                  </span>
                {:else if isArtist}
                  <span class="text-xs opacity-50 mt-0.5">Artist</span>
                {:else}
                  <span class="text-xs opacity-50 mt-0.5">Playlist</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</ScrollArea>
