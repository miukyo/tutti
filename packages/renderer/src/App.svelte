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
  } from "@lucide/svelte/icons";
  import { ytmusic, versions, platform } from "@app/preload";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
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
  import SongTable from "$lib/components/song-table.svelte";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import SearchInput from "$lib/components/search-input.svelte";
  import { pop, replace } from "svelte-spa-router";
  import { onMount } from "svelte";
  import type { PlaylistDetailed, AccountInfo } from "@app/api/src";
  import Image from "$lib/components/ui/image.svelte";
  import Lyrics from "$lib/components/lyrics.svelte";
  import ExtendedPlayer from "$lib/components/extended-player.svelte";

  let accountInfo = $state<AccountInfo | null>(null);
  let sidebarPlaylists = $state<PlaylistDetailed[]>([]);

  onMount(async () => {
    player.init();
    try {
      const info = await ytmusic.getAccountInfo();
      if (info && info.accountName) {
        accountInfo = info;
        sidebarPlaylists = await ytmusic.getLibraryPlaylists(100);
      }
    } catch (e) {
      console.warn("Failed to fetch sidebar playlists:", e);
    }
  });

  let innerWidth = $state(0);
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
  };

  let activeSidebar = $derived(player.activeSidebar);
  let queue = $derived(player.queue);
  let currentTrack = $derived(player.currentTrack);

  // Initialize navigation history tracker
  navigation.init();

  let canGoBack = $derived(navigation.canGoBack);
  let canGoForward = $derived(navigation.canGoForward);
  let showAboutModal = $state(false);
</script>

<svelte:window bind:innerWidth />
<div
  class="absolute w-screen h-[32px] left-0 top-0"
  style="app-region: drag;"
></div>
<section class="w-screen h-screen overflow-hidden">
  {#if player.showExtended}
    <ExtendedPlayer />
  {:else}
    <Resizable.PaneGroup direction="horizontal" autoSaveId="layout:main">
      <Resizable.Pane
        minSize={leftSideWidth * 0.7}
        defaultSize={leftSideWidth * 0.8}
        maxSize={leftSideWidth}
      >
        <div
          class="flex flex-col p-2 gap-2 h-full relative overflow-visible"
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
                {#each sidebarPlaylists as playlist}
                  <Button
                    href="/playlist/{playlist.playlistId}"
                    class="justify-start gap-4 [.active]:bg-primary [.active]:text-primary-foreground shadow-glass hover:shadow-glass-hover"
                    variant="ghost"
                    size="lg"
                  >
                    <!-- <div
                    class="size-6 shrink-0 rounded-md flex items-center justify-center overflow-hidden"
                  >
                    {#if playlist.thumbnails?.[0]?.url}
                      <img
                        src={playlist.thumbnails[0].url}
                        alt={playlist.name}
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <ListIcon class="w-5 h-5 text-white" />
                    {/if}
                  </div> -->

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
      </Resizable.Pane>
      <Resizable.Handle />
      <Resizable.Pane class="p-2 relative">
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
                  <!-- Lyrics Font Size -->
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger
                      class="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent/50 cursor-pointer"
                    >
                      <CaseSensitiveIcon class="size-4" />
                      <span>Lyrics Size</span>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.SubContent
                      class="bg-background/95 backdrop-blur-xl border border-border/80 rounded-3xl p-1.5 z-50 shadow-glass w-40"
                    >
                      <DropdownMenu.Item
                        onclick={() => player.setLyricsFontSize("small")}
                        class="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent cursor-pointer"
                      >
                        <span>Small</span>
                        {#if player.lyricsFontSize === "small"}
                          <CheckIcon class="size-4 text-primary" />
                        {/if}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onclick={() => player.setLyricsFontSize("medium")}
                        class="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent cursor-pointer"
                      >
                        <span>Medium</span>
                        {#if player.lyricsFontSize === "medium"}
                          <CheckIcon class="size-4 text-primary" />
                        {/if}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onclick={() => player.setLyricsFontSize("large")}
                        class="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent cursor-pointer"
                      >
                        <span>Large</span>
                        {#if player.lyricsFontSize === "large"}
                          <CheckIcon class="size-4 text-primary" />
                        {/if}
                      </DropdownMenu.Item>
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Sub>

                  <!-- Playback Speed -->
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger
                      class="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent/50 cursor-pointer"
                    >
                      <GaugeIcon class="size-4" />
                      <span>Speed</span>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.SubContent
                      class="bg-background/95 backdrop-blur-xl border border-border/80 rounded-3xl p-1.5 z-50 shadow-glass w-40"
                    >
                      {#each [0.75, 1.0, 1.25, 1.5, 2.0] as rate}
                        <DropdownMenu.Item
                          onclick={() => player.setPlaybackRate(rate)}
                          class="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium hover:bg-accent cursor-pointer"
                        >
                          <span
                            >{rate === 1.0 ? "Normal (1.0x)" : `${rate}x`}</span
                          >
                          {#if player.playbackRate === rate}
                            <CheckIcon class="size-4 text-primary" />
                          {/if}
                        </DropdownMenu.Item>
                      {/each}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Sub>

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
                    onclick={() => (showAboutModal = true)}
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
              >
                <Glow />
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
                class="rounded-full bg-background/50 backdrop-blur-sm  border border-border h-10 items-center flex gap-1 p-1 shadow-glass hover:shadow-glass-hover transition-shadow overflow-hidden"
                style="app-region: no-drag;"
              >
                <Glow />
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
                <div class="w-[2px] h-4 my-auto bg-border"></div>
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
        <Resizable.Pane
          minSize={rightSideWidth * 0.5}
          defaultSize={rightSideWidth * 0.7}
          maxSize={rightSideWidth}
        >
          <div class="size-full overflow-hidden relative">
            {#if activeSidebar === "queue"}
              <h2 class="text-lg font-bold absolute pt-4 px-2 z-10">Queue</h2>
              <div
                class="w-full h-12 absolute top-0 bg-linear-to-b from-background to-transparent z-5 pointer-events-none"
              ></div>
              <div
                class="w-full h-12 absolute bottom-0 bg-linear-to-t from-background to-transparent z-5 pointer-events-none"
              ></div>
              <ScrollArea class="flex-1 min-h-0 pr-2 h-full">
                <div class="h-12"></div>
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
              <Lyrics />
            {/if}
          </div>
        </Resizable.Pane>
      {/if}
    </Resizable.PaneGroup>
  {/if}
  {#if showAboutModal}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-200 bg-background/80 backdrop-blur-md flex items-center justify-center"
      onclick={() => (showAboutModal = false)}
    >
      <div
        class="bg-card border border-border p-6 rounded-3xl w-80 shadow-glass flex flex-col gap-4 relative animate-in fade-in-0 zoom-in-95"
        onclick={(e) => e.stopPropagation()}
      >
        <img src="icon.png" alt="Tutti" class="size-32 mx-auto" />
        <p class="text-sm text-center text-muted-foreground">
          Tutti is a beautifully designed desktop client for YouTube Music
        </p>

        <div
          class="flex flex-col gap-1 text-xs text-muted-foreground border-t border-border/50 pt-3"
        >
          <div>Version: 1.0.0</div>
          <div>Electron: {versions.electron || "N/A"}</div>
          <div>Chrome: {versions.chrome || "N/A"}</div>
          <div>Node: {versions.node || "N/A"}</div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onclick={() => (showAboutModal = false)}
          class="w-full mt-2 rounded-2xl"
        >
          Close
        </Button>
      </div>
    </div>
  {/if}
</section>
