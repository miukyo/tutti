import { sha256sum } from './nodeCrypto.js';
import { versions, platform } from './versions.js';
import { ipcRenderer } from 'electron';
import type { YTMusic } from '@app/api';

function send(channel: string, message: string) {
  return ipcRenderer.invoke(channel, message);
}

const ytmusicMethods = [
  'getSearchSuggestions',
  'search',
  'searchSongs',
  'searchVideos',
  'searchArtists',
  'searchAlbums',
  'searchPlaylists',
  'getStreamManifest',
  'getSong',
  'getPlayerResponse',
  'getUpNexts',
  'getVideo',
  'getLyrics',
  'getArtist',
  'getArtistSongs',
  'getArtistAlbums',
  'getAlbum',
  'getPlaylist',
  'getPlaylistVideos',
  'getLikedSongs',
  'getSavedEpisodes',
  'createPlaylist',
  'deletePlaylist',
  'editPlaylist',
  'addPlaylistItems',
  'removePlaylistItems',
  'getHomeSections',
  'getMoodCategories',
  'getMoodPlaylists',
  'getMoodSections',
  'getExplore',
  'getUser',
  'getUserPlaylists',
  'getLibraryPlaylists',
  'getLibrarySongs',
  'getLibraryAlbums',
  'getLibraryArtists',
  'getLibrarySubscriptions',
  'getLibraryPodcasts',
  'getLibraryChannels',
  'getHistory',
  'rateSong',
  'ratePlaylist',
  'subscribeArtists',
  'unsubscribeArtists',
  'getAccountInfo',
  'addHistoryItem',
  'removeHistoryItems',
  'editSongLibraryStatus',
  'getChannel',
  'getChannelEpisodes',
  'getPodcast',
  'getEpisode',
  'getEpisodesPlaylist',
  'login',
  'logout',
  'clearCache',
  'deleteCache'
] as const;

const ytmusicObj: any = {};
for (const method of ytmusicMethods) {
  ytmusicObj[method] = (...args: any[]) => ipcRenderer.invoke('ytmusic', method, ...args);
}

const ytmusic = ytmusicObj as {
  [K in typeof ytmusicMethods[number]]: YTMusic[K];
};

function checkForUpdates(): Promise<{ status: 'available' | 'not-available' | 'error'; version?: string; message?: string }> {
  return ipcRenderer.invoke('check-for-updates');
}

function getAppVersion(): Promise<string> {
  return ipcRenderer.invoke('get-app-version');
}

function clearCache(): Promise<void> {
  return ipcRenderer.invoke('clear-cache');
}

function restartAndInstall(): Promise<void> {
  return ipcRenderer.invoke('restart-and-install');
}

function onUpdateDownloaded(callback: (info: any) => void): () => void {
  const listener = (_event: any, info: any) => callback(info);
  ipcRenderer.on('update-downloaded', listener);
  return () => {
    ipcRenderer.off('update-downloaded', listener);
  };
}

function updateDiscordPresence(presence: any): Promise<void> {
  return ipcRenderer.invoke('update-discord-presence', presence);
}

function getPendingDeepLink(): Promise<string | null> {
  return ipcRenderer.invoke('get-pending-deep-link');
}

function onDeepLink(callback: (url: string) => void): () => void {
  const listener = (_event: any, url: string) => callback(url);
  ipcRenderer.on('deep-link', listener);
  return () => {
    ipcRenderer.off('deep-link', listener);
  };
}

function toggleFloatingLyrics(): Promise<boolean> {
  return ipcRenderer.invoke('toggle-floating-lyrics');
}

function isFloatingLyricsOpen(): Promise<boolean> {
  return ipcRenderer.invoke('is-floating-lyrics-open');
}

function onFloatingLyricsStatus(callback: (isOpen: boolean) => void): () => void {
  const listener = (_event: any, isOpen: boolean) => callback(isOpen);
  ipcRenderer.on('floating-lyrics-status', listener);
  return () => {
    ipcRenderer.off('floating-lyrics-status', listener);
  };
}

function setIgnoreMouseEvents(ignore: boolean, options?: { forward: boolean }): void {
  ipcRenderer.send('set-ignore-mouse-events', ignore, options);
}

function toggleFloatingLyricsLock(): Promise<boolean> {
  return ipcRenderer.invoke('toggle-floating-lyrics-lock');
}

function isFloatingLyricsLocked(): Promise<boolean> {
  return ipcRenderer.invoke('is-floating-lyrics-locked');
}

function onFloatingLyricsLockStatus(callback: (isLocked: boolean) => void): () => void {
  const listener = (_event: any, isLocked: boolean) => callback(isLocked);
  ipcRenderer.on('floating-lyrics-lock-status', listener);
  return () => {
    ipcRenderer.off('floating-lyrics-lock-status', listener);
  };
}

export {
  sha256sum,
  versions,
  platform,
  send,
  ytmusic,
  checkForUpdates,
  getAppVersion,
  clearCache,
  restartAndInstall,
  onUpdateDownloaded,
  updateDiscordPresence,
  getPendingDeepLink,
  onDeepLink,
  toggleFloatingLyrics,
  isFloatingLyricsOpen,
  onFloatingLyricsStatus,
  setIgnoreMouseEvents,
  toggleFloatingLyricsLock,
  isFloatingLyricsLocked,
  onFloatingLyricsLockStatus,
};

function updatePlayerState(state: any): void {
  ipcRenderer.send('update-player-state', state);
}

function onPlayerStateUpdated(callback: (state: any) => void): () => void {
  const listener = (_event: any, state: any) => callback(state);
  ipcRenderer.on('player-state-updated', listener);
  return () => {
    ipcRenderer.off('player-state-updated', listener);
  };
}

function requestPlayerState(): void {
  ipcRenderer.send('request-player-state');
}

function onRequestPlayerState(callback: () => void): () => void {
  const listener = () => callback();
  ipcRenderer.on('request-player-state', listener);
  return () => {
    ipcRenderer.off('request-player-state', listener);
  };
}

export {
  updatePlayerState,
  onPlayerStateUpdated,
  requestPlayerState,
  onRequestPlayerState,
};