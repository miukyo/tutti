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

export { sha256sum, versions, platform, send, ytmusic };