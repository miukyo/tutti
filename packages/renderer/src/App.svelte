<script lang="ts">
  import Router from "svelte-spa-router";
  import * as Resizable from "$lib/components/ui/resizable/";
  import * as InputGroup from "$lib/components/ui/input-group/";
  import {
    SearchIcon,
    HouseIcon,
    LibraryIcon,
    CompassIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    EllipsisIcon,
    MicVocalIcon,
    ListIcon,
    LogInIcon,
    LogOutIcon,
    FolderOpenIcon,
    MusicIcon,
    DiscIcon,
    UserIcon,
    ListMusicIcon,
    HistoryIcon,
    CheckIcon,
    InfoIcon,
    RefreshCwIcon,
    CaseSensitiveIcon,
    GaugeIcon,
    PlusIcon,
    Gamepad2Icon,
    RadioIcon,
    SettingsIcon,
  } from "@lucide/svelte/icons";
  import {
    ytmusic,
    versions,
    platform,
    checkForUpdates,
    getAppVersion,
    restartAndInstall,
    onUpdateDownloaded,
    updatePlayerState,
    onRequestPlayerState,
  } from "@app/preload";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Dialog from "$lib/components/ui/dialog";
  import Home from "$lib/views/Home.svelte";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import Glow from "$lib/components/ui/glow.svelte";
  import PlayerBar from "$lib/components/player-bar.svelte";
  import Explore from "$lib/views/Explore.svelte";
  import PlaylistDetail from "$lib/views/PlaylistDetail.svelte";
  import AlbumDetail from "$lib/views/AlbumDetail.svelte";
  import ArtistDetail from "$lib/views/ArtistDetail.svelte";
  import Search from "$lib/views/Search.svelte";
  import Library from "$lib/views/Library.svelte";
  import History from "$lib/views/History.svelte";
  import { player } from "$lib/stores/player.svelte";
  import { navigation } from "$lib/stores/navigation.svelte";
  import { syncStore } from "$lib/stores/sync.svelte";
  import SongTable from "$lib/components/song-table.svelte";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import SearchInput from "$lib/components/search-input.svelte";
  import { pop, replace } from "svelte-spa-router";
  import { onMount } from "svelte";
  import type { PlaylistDetailed, AccountInfo } from "@app/api/src";
  import Image from "$lib/components/ui/image.svelte";
  import Lyrics from "$lib/components/lyrics.svelte";
  import ListenTogether from "$lib/components/listen-together.svelte";
  import ExtendedPlayer from "$lib/components/extended-player.svelte";
  import * as Select from "$lib/components/ui/select";
  import CreatePlaylistDialog from "$lib/components/create-playlist-dialog.svelte";
  import FloatingLyrics from "$lib/views/FloatingLyrics.svelte";
  import SettingsDialog from "$lib/components/settings-dialog.svelte";
  import WindowControls from "$lib/components/window-controls.svelte";

  let accountInfo = $state<AccountInfo | null>(null);
  let sidebarPlaylists = $state<PlaylistDetailed[]>([]);
  let appVersion = $state("1.0.0");
  let showSettingsModal = $state(false);

  let updateStatus = $state<
    "idle" | "checking" | "available" | "downloaded" | "not-available" | "error"
  >("idle");
  let updateVersion = $state<string | null>(null);
  let updateErrorMessage = $state<string | null>(null);
  let isCreatePlaylistOpen = $state(false);
  async function handleCheckForUpdates() {
    updateStatus = "checking";
    updateVersion = null;
    updateErrorMessage = null;
    try {
      const res = await checkForUpdates();
      if (res.status === "available") {
        updateStatus = "available";
        updateVersion = res.version || null;
      } else if (res.status === "not-available") {
        updateStatus = "not-available";
        updateVersion = res.version || null;
      } else {
        updateStatus = "error";
        updateErrorMessage =
          res.message || "An error occurred while checking for updates.";
      }
    } catch (err: any) {
      updateStatus = "error";
      updateErrorMessage = err?.message || "Failed to check for updates.";
    }
  }

  onMount(() => {
    player.init();
    syncStore.init();

    const unsubscribeUpdate = onUpdateDownloaded((info) => {
      updateStatus = "downloaded";
      updateVersion = info.version || null;
    });

    const handleResize = () => {
      innerWidth = window.innerWidth;
    };
    window.addEventListener("resize", handleResize);

    const refreshPlaylists = async () => {
      try {
        sidebarPlaylists = await ytmusic.getLibraryPlaylists(100);
      } catch (e) {
        console.warn("Failed to refresh sidebar playlists:", e);
      }
    };
    window.addEventListener("playlists-changed", refreshPlaylists);

    async function loadInitialData() {
      try {
        appVersion = await getAppVersion();
      } catch (e) {
        console.warn("Failed to get app version:", e);
      }
      try {
        const info = await ytmusic.getAccountInfo();
        if (info && info.accountName) {
          accountInfo = info;
          player.isAuthed = true;
          syncStore.setLocalProfile({
            name: info.accountName,
            photoUrl: info.accountPhotoUrl,
          });
          await refreshPlaylists();
        } else {
          player.isAuthed = false;
        }
      } catch (e) {
        console.warn("Failed to fetch sidebar playlists:", e);
        player.isAuthed = false;
      }
    }

    let unsubscribeRequest: (() => void) | null = null;
    if (!isFloatingLyricsWindow) {
      unsubscribeRequest = onRequestPlayerState(() => {
        updatePlayerState({
          isPlaying: player.isPlaying,
          currentTrack: $state.snapshot(player.currentTrack),
          currentTime: player.currentTime,
          duration: player.duration,
          selectedSource: player.selectedSource,
          lyricsFontSize: player.lyricsFontSize,
          lyricsFontSizeExtended: player.lyricsFontSizeExtended,
          lyricsFontSizeFloating: player.lyricsFontSizeFloating,
        });
      });
    }

    loadInitialData();

    return () => {
      unsubscribeUpdate();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("playlists-changed", refreshPlaylists);
      if (unsubscribeRequest) unsubscribeRequest();
    };
  });

  let innerWidth = $state(window.innerWidth);
  let leftSideWidth = $derived(Math.ceil((300 / innerWidth) * 100));
  let rightSideWidth = $derived(Math.ceil((400 / innerWidth) * 100));

  const routes = {
    "/": Home,
    "/explore": Explore,
    "/library": Library,
    "/library/:filter": Library,
    "/history": History,
    "/playlist/:id": PlaylistDetail,
    "/album/:id": AlbumDetail,
    "/artist/:id": ArtistDetail,
    "/search/:query": Search,
    "/floating-lyrics": FloatingLyrics,
  };

  let isFloatingLyricsWindow = $derived(window.location.hash === "#/floating-lyrics");

  let activeSidebar = $derived(player.activeSidebar);
  let queue = $derived(player.queue);
  let currentTrack = $derived(player.currentTrack);

  // Initialize navigation history tracker
  navigation.init();

  let canGoBack = $derived(navigation.canGoBack);
  let canGoForward = $derived(navigation.canGoForward);
  let showAboutModal = $state(false);
  // Synchronize player state changes to the floating window
  $effect(() => {
    if (!isFloatingLyricsWindow) {
      updatePlayerState({
        isPlaying: player.isPlaying,
        currentTrack: $state.snapshot(player.currentTrack),
        currentTime: player.currentTime,
        duration: player.duration,
        selectedSource: player.selectedSource,
        lyricsFontSize: player.lyricsFontSize,
        lyricsFontSizeExtended: player.lyricsFontSizeExtended,
        lyricsFontSizeFloating: player.lyricsFontSizeFloating,
      });
    }
  });
</script>

{#if isFloatingLyricsWindow}
  <main class="w-screen h-screen overflow-hidden bg-transparent select-none">
    <Router {routes} />
  </main>
{:else}
  <div
    class="absolute w-screen h-[32px] left-0 top-0"
    style="app-region: drag;"
  ></div>
  <section class="w-screen h-screen overflow-hidden">
  {#if player.showExtended}
    <ExtendedPlayer />
  {:else}
    <Resizable.PaneGroup direction="horizontal" autoSaveId="layout:main">
      <div class="w-60">
        <div
          class="flex flex-col p-2 pr-0 gap-2 h-full relative overflow-visible"
          class:pt-14={platform === "darwin"}
        >
          <SearchInput />
          <ScrollArea class="flex-1 h-full" scrollbarYClasses="hidden">
            <div class="flex flex-col gap-2 relative overflow-visible">
              <div class="flex flex-col">
                <Button
                  href="/"
                  class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                  variant="ghost"
                  size="lg"
                >
                  <HouseIcon />Home
                </Button>
                <Button
                  href="/explore"
                  class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                  variant="ghost"
                  size="lg"
                >
                  <CompassIcon />Explore
                </Button>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <p class="px-4 text-sm font-medium text-muted-foreground py-2">
                Library
              </p>
              <Button
                href="/library/playlists"
                class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                variant="ghost"
                size="lg"
              >
                <ListMusicIcon />Playlists
              </Button>
              <Button
                href="/library/songs"
                class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                variant="ghost"
                size="lg"
              >
                <MusicIcon />Songs
              </Button>
              <Button
                href="/library/albums"
                class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                variant="ghost"
                size="lg"
              >
                <DiscIcon />Albums
              </Button>
              <Button
                href="/library/artists"
                class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                variant="ghost"
                size="lg"
              >
                <UserIcon />Artists
              </Button>
              <Button
                href="/history"
                class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                variant="ghost"
                size="lg"
              >
                <HistoryIcon />History
              </Button>
            </div>
            <div class="flex flex-col flex-1 min-h-0">
              <p class="px-4 text-sm font-medium text-muted-foreground py-2">
                Playlists
              </p>
              <div class="flex flex-col gap-1 mb-30">
                <Button
                  class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                  variant="ghost"
                  size="lg"
                  onclick={() => {
                    isCreatePlaylistOpen = true;
                  }}
                >
                  <PlusIcon />
                  <span class="truncate">Create Playlist</span>
                </Button>
                <CreatePlaylistDialog bind:open={isCreatePlaylistOpen} />
                {#each sidebarPlaylists as playlist}
                  <Button
                    href="/playlist/{playlist.playlistId}"
                    class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                    variant="ghost"
                    size="lg"
                  >
                    <FolderOpenIcon />

                    <span class="truncate">{playlist.name}</span>
                  </Button>
                {/each}
              </div>
            </div>
          </ScrollArea>
          <div class="absolute bottom-2 left-2 right-0 flex flex-col">
            {#if accountInfo}
              <div
                class="flex items-center justify-between gap-3 p-3 bg-background/50 backdrop-blur-sm w-full overflow-hidden border border-border shadow-glass rounded-[1.6rem]"
              >
                <div class="flex items-center gap-3 min-w-0">
                  {#if accountInfo.accountPhotoUrl}
                    <Image
                      src={accountInfo.accountPhotoUrl}
                      alt={accountInfo.accountName}
                      width={36}
                      height={36}
                      class="size-9 rounded-full object-cover border border-border shrink-0"
                    />
                  {/if}
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-semibold text-foreground truncate"
                      >{accountInfo.accountName}</span
                    >
                    {#if accountInfo.channelHandle}
                      <span class="text-xs text-muted-foreground truncate"
                        >{accountInfo.channelHandle}</span
                      >
                    {/if}
                  </div>
                </div>
                <Button
                  variant="link"
                  size="icon"
                  class="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-2xl"
                  onclick={async () => {
                    const success = await ytmusic.logout();
                    if (success) {
                      window.location.reload();
                    }
                  }}
                  title="Logout"
                >
                  <LogOutIcon class="size-4" />
                </Button>
              </div>
            {:else}
              <Button
                class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover w-full"
                variant="ghost"
                size="lg"
                onclick={async () => {
                  const success = await ytmusic.login();
                  if (success) {
                    window.location.reload();
                  }
                }}
              >
                <LogInIcon />Login
              </Button>
            {/if}
          </div>
        </div>
      </div>
      <!-- <Resizable.Handle /> -->
      <Resizable.Pane id="mid" class="p-2 relative">
        <div
          class="relative overflow-hidden bg-card/50 size-full rounded-[1.6rem] border border-border"
        >
          <div class="absolute flex justify-between p-2 z-100 w-full">
            <div class="flex gap-1 items-center">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button
                    variant="outline-blur"
                    size="icon-sm"
                    active-scale="child"
                    class="size-10 rounded-full"
                  >
                    <EllipsisIcon class="size-6" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                  align="start"
                  class="w-56 mt-1.5 bg-background/95 backdrop-blur-xl border border-border/80 rounded-3xl p-1.5 shadow-glass"
                >
                  <!-- Settings -->
                  <DropdownMenu.Item
                    onclick={() => (showSettingsModal = true)}
                    class="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent cursor-pointer"
                  >
                    <SettingsIcon class="size-4" />
                    <span>Settings</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator
                    class="my-1 border-t border-border/50"
                  />

                  <!-- Reload App -->
                  <DropdownMenu.Item
                    onclick={() => window.location.reload()}
                    class="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent cursor-pointer text-amber-500"
                  >
                    <RefreshCwIcon class="size-4" />
                    <span>Reload App</span>
                  </DropdownMenu.Item>

                  <!-- About Tutti -->
                  <DropdownMenu.Item
                    onclick={() => {
                      updateStatus = "idle";
                      updateVersion = null;
                      updateErrorMessage = null;
                      showAboutModal = true;
                    }}
                    class="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent cursor-pointer"
                  >
                    <InfoIcon class="size-4" />
                    <span>About Tutti</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
              <ButtonGroup.Root
                class="rounded-full bg-background/50 backdrop-blur-sm border border-border h-10 items-center flex gap-1 p-1 shadow-glass hover:shadow-glass-hover transition-shadow overflow-hidden"
                style="app-region: no-drag;"
                data-glow
              >
                <Button
                  variant="link"
                  size="icon-sm"
                  active-scale="child"
                  onclick={() => navigation.back()}
                  disabled={!canGoBack}
                  class={!canGoBack ? "opacity-30 pointer-events-none" : ""}
                  ><ChevronLeftIcon class="size-6" /></Button
                >
                <div class="w-[2px] h-4 my-auto bg-border"></div>
                <Button
                  variant="link"
                  size="icon-sm"
                  active-scale="child"
                  onclick={() => navigation.forward()}
                  disabled={!canGoForward}
                  class={!canGoForward ? "opacity-30 pointer-events-none" : ""}
                  ><ChevronRightIcon class="size-6" /></Button
                >
              </ButtonGroup.Root>
            </div>
            <div>
              <ButtonGroup.Root
                class="rounded-full bg-background/50 backdrop-blur-sm  border border-border h-10 items-center flex px-2 shadow-glass hover:shadow-glass-hover transition-shadow overflow-hidden"
                style="app-region: no-drag;"
                data-glow
              >
                <div
                  class="absolute w-[48px] h-full left-0 p-1 pointer-events-none transition-all duration-200 ease-out"
                  style="
                    opacity: {player.activeSidebar === 'none' ? '0' : '1'};
                    transform: translateX({player.activeSidebar === 'none'
                    ? '0px'
                    : player.isAuthed
                      ? player.activeSidebar === 'listen-together'
                        ? '0px'
                        : player.activeSidebar === 'lyrics'
                          ? '32px'
                          : '64px'
                      : player.activeSidebar === 'lyrics'
                        ? '0px'
                        : '32px'});
                  "
                >
                  <div class="size-full bg-foreground/10 rounded-full"></div>
                </div>
                {#if player.isAuthed}
                  <Button
                    variant="link"
                    size="icon-sm"
                    active-scale="child"
                    onclick={() =>
                      (player.activeSidebar =
                        player.activeSidebar === "listen-together"
                          ? "none"
                          : "listen-together")}
                    class="relative {player.activeSidebar === 'listen-together'
                      ? 'text-primary'
                      : ''}"
                    title="Listen Together"
                  >
                    {#if syncStore.status === "connected"}
                      <div
                        class="size-2 bg-emerald-500 rounded-full absolute top-1.5 right-1 z-10"
                      ></div>
                    {/if}
                    <RadioIcon class="size-5" />
                  </Button>
                {/if}
                <Button
                  variant="link"
                  size="icon-sm"
                  active-scale="child"
                  onclick={() =>
                    (player.activeSidebar =
                      player.activeSidebar === "lyrics" ? "none" : "lyrics")}
                  class={player.activeSidebar === "lyrics"
                    ? "text-primary"
                    : ""}><MicVocalIcon /></Button
                >
                <!-- <div class="w-[2px] h-4 my-auto bg-border"></div> -->
                <Button
                  variant="link"
                  size="icon-sm"
                  active-scale="child"
                  onclick={() =>
                    (player.activeSidebar =
                      player.activeSidebar === "queue" ? "none" : "queue")}
                  class={player.activeSidebar === "queue" ? "text-primary" : ""}
                  ><ListIcon /></Button
                >
              </ButtonGroup.Root>
            </div>
          </div>

          <Router {routes} />

          <PlayerBar />
        </div>
      </Resizable.Pane>
      {#if activeSidebar !== "none"}
        <Resizable.Handle />
        <Resizable.Pane id="right" minSize={20} defaultSize={20} maxSize={30}>
          <div class="size-full overflow-hidden relative">
            {#if activeSidebar === "queue"}
              <div class="absolute left-2 right-2 flex items-center justify-between z-10 select-none" style="top: clamp(0.5rem, 1vw, 1rem); height: clamp(2.2rem, 2.5vw, 2.6rem);">
                <h2 class="text-lg font-bold text-foreground">Queue</h2>
                <div class="w-[clamp(6.5rem,8vw,7.5rem)]"></div>
              </div>
              <div
                class="w-full h-12 absolute top-0 bg-linear-to-b from-background to-transparent z-5 pointer-events-none"
              ></div>
              <div
                class="w-full h-12 absolute bottom-0 bg-linear-to-t from-background to-transparent z-5 pointer-events-none"
              ></div>
              <ScrollArea class="flex-1 min-h-0 pr-2 h-full">
                <div class="h-16"></div>
                {#if queue.length > 0}
                  <SongTable
                    songs={queue}
                    showHeader={false}
                    showTime={false}
                  />
                {:else}
                  <p class="text-sm text-muted-foreground text-center mt-10">
                    Queue is empty
                  </p>
                {/if}
                <div class="h-12"></div>
              </ScrollArea>
            {:else if activeSidebar === "lyrics"}
              <div class="absolute left-2 right-2 flex items-center justify-between z-10" style="top: clamp(0.5rem, 1vw, 1rem); height: clamp(2.2rem, 2.5vw, 2.6rem);">
                <Select.Root type="single" bind:value={player.selectedSource}>
                  <Select.Trigger
                    class="w-[150px] shadow-glass bg-background/50 border border-border backdrop-blur-md rounded-full focus-visible:ring-0 overflow-hidden"
                    data-glow
                  >
                    {player.selectedSource === "Auto"
                      ? "Auto (Default)"
                      : player.selectedSource}
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      class="bg-background/50 backdrop-blur-md border border-border/80 rounded-3xl p-1 z-500 shadow-glass w-[160px]"
                    >
                      <Select.Item value="Auto" label="Auto (Default)" />
                      <Select.Item value="Unison" label="Unison" />
                      <Select.Item value="LyricsPlus" label="LyricsPlus" />
                      <Select.Item value="LRCLib" label="LRCLib" />
                      <Select.Item
                        value="YouTube Music"
                        label="YouTube Music"
                      />
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                <div class="w-[clamp(6.5rem,8vw,7.5rem)]"></div>
              </div>

              <Lyrics />
            {:else if activeSidebar === "listen-together"}
              <ListenTogether />
            {/if}
          </div>
        </Resizable.Pane>
      {/if}
    </Resizable.PaneGroup>
  {/if}
  <Dialog.Root bind:open={showAboutModal}>
    <Dialog.Content class="sm:max-w-80">
      <Dialog.Header class="items-center">
        <Dialog.Title class="sr-only">About Tutti</Dialog.Title>
        <img src="icon.png" alt="Tutti" class="size-32 mx-auto" />
        <Dialog.Description
          class="text-sm text-center text-muted-foreground mt-2"
        >
          Tutti is a beautifully designed desktop client for YouTube Music
        </Dialog.Description>
      </Dialog.Header>

      <div
        class="flex flex-col gap-1 text-xs text-muted-foreground border-t border-border/50 pt-3"
      >
        <div>Version: {appVersion}</div>
        <div>Electron: {versions.electron || "N/A"}</div>
        <div>Chrome: {versions.chrome || "N/A"}</div>
        <div>Node: {versions.node || "N/A"}</div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="border-t border-border/50 pt-3 flex flex-col gap-0">
          {#if updateStatus === "idle"}
            <Button
              variant="outline"
              size="sm"
              onclick={handleCheckForUpdates}
              class="w-full rounded-2xl"
            >
              Check for Updates
            </Button>
          {:else if updateStatus === "checking"}
            <div
              class="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground"
            >
              <span
                class="animate-spin size-3.5 border-2 border-primary border-t-transparent rounded-full"
              ></span>
              Checking for updates...
            </div>
          {:else if updateStatus === "available"}
            <div class="text-xs text-center text-emerald-500 font-semibold">
              New version {updateVersion || ""} is available!
            </div>
            <p class="text-[10px] text-center text-muted-foreground/80">
              Downloading in background...
            </p>
          {:else if updateStatus === "downloaded"}
            <div class="text-xs text-center text-emerald-500 font-semibold">
              New version {updateVersion || ""} is ready!
            </div>
            <Button
              variant="default"
              size="sm"
              onclick={restartAndInstall}
              class="w-full rounded-2xl mt-1.5"
            >
              Restart & Install
            </Button>
          {:else if updateStatus === "not-available"}
            <div class="text-xs text-center text-muted-foreground">
              You are up to date!
            </div>
          {:else if updateStatus === "error"}
            <div class="text-xs text-center text-destructive font-medium">
              {updateErrorMessage || "Failed to check for updates"}
            </div>
            <Button
              variant="outline"
              size="sm"
              onclick={handleCheckForUpdates}
              class="w-full rounded-2xl mt-1"
            >
              Retry
            </Button>
          {/if}
        </div>

        <Button
          variant="outline"
          size="sm"
          onclick={() => (showAboutModal = false)}
          class="w-full rounded-2xl"
        >
          Close
        </Button>
      </div>
    </Dialog.Content>
  </Dialog.Root>

  <SettingsDialog bind:open={showSettingsModal} />
  <WindowControls />

    <Glow />
  </section>
{/if}
