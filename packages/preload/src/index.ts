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
  'logout'
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

export {
  sha256sum,
  versions,
  platform,
  send,
  ytmusic,
  checkForUpdates,
  getAppVersion,
  restartAndInstall,
  onUpdateDownloaded,
  updateDiscordPresence,
  getPendingDeepLink,
  onDeepLink,
};