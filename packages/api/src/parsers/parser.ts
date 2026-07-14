import { traverseString, traverseList } from '../jsonTraverse.js';
import * as songParser from './songParser.js';
import {
  HomeSection,
  SearchResult,
  Thumbnail,
  AlbumDetailed,
  PlaylistDetailed,
  ArtistDetailed,
  SongDetailed,
  VideoDetailed,
  ArtistBasic
} from '../types.js';

export const Filters = {
  isTitle(data: any): boolean {
    return traverseString(data, 'musicVideoType').startsWith('MUSIC_VIDEO_TYPE_');
  },

  isArtist(data: any): boolean {
    const pageType = traverseString(data, 'pageType');
    return pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL' || pageType === 'MUSIC_PAGE_TYPE_ARTIST';
  },

  isAlbum(data: any): boolean {
    return traverseString(data, 'pageType') === 'MUSIC_PAGE_TYPE_ALBUM';
  },

  isDuration(data: any): boolean {
    const text = traverseString(data, 'text');
    return /(\d{1,2}:)?\d{1,2}:\d{1,2}/.test(text);
  }
};

export function parseDuration(time: string | null | undefined): number | null {
  if (!time) return null;

  const parts = time.split(':');
  let seconds = 0, minutes = 0, hours = 0;

  if (parts.length === 1) {
    seconds = parseInt(parts[0], 10) || 0;
  } else if (parts.length === 2) {
    seconds = parseInt(parts[1], 10) || 0;
    minutes = parseInt(parts[0], 10) || 0;
  } else if (parts.length >= 3) {
    seconds = parseInt(parts[parts.length - 1], 10) || 0;
    minutes = parseInt(parts[parts.length - 2], 10) || 0;
    hours = parseInt(parts[parts.length - 3], 10) || 0;
  }

  return seconds + minutes * 60 + hours * 60 * 60;
}

export function parseNumber(str: string | null | undefined): number {
  if (!str) return 0;

  str = str.trim();
  const lastChar = str[str.length - 1];
  if (/[a-zA-Z]/.test(lastChar)) {
    const number = parseFloat(str.substring(0, str.length - 1));
    if (!isNaN(number)) {
      switch (lastChar.toUpperCase()) {
        case 'K': return number * 1000;
        case 'M': return number * 1000000;
        case 'B': return number * 1000000000;
        case 'T': return number * 1000000000000;
      }
    }
    return NaN;
  }

  const res = parseFloat(str);
  return isNaN(res) ? 0 : res;
}

export function parseHomeSection(data: any): HomeSection {
  if (!data) return { title: '', contents: [] };

  const keys = Object.keys(data);
  if (keys.length === 0) return { title: '', contents: [] };
  const rendererType = keys[0];
  const renderer = data[rendererType];

  if (rendererType === 'musicDescriptionShelfRenderer') {
    return {
      title: traverseString(renderer, 'header', 'runs', 'text'),
      contents: []
    };
  }

  let title = '';
  if (rendererType === 'musicCarouselShelfRenderer') {
    title = traverseString(renderer, 'header', 'musicCarouselShelfBasicHeaderRenderer', 'title', 'runs', 'text');
  } else {
    title = traverseString(renderer, 'title', 'runs', 'text');
  }

  const contents: SearchResult[] = [];
  for (const item of traverseList(renderer, 'contents')) {
    const parsed = parseHomeItem(item);
    if (parsed) contents.push(parsed);
  }

  return {
    title,
    contents
  };
}

function parseHomeItem(item: any): SearchResult | null {
  if (!item) return null;
  const keys = Object.keys(item);
  if (keys.length === 0) return null;
  const rendererType = keys[0];

  if (rendererType === 'musicTwoRowItemRenderer') {
    return parseMusicTwoRowItem(item[rendererType]);
  }

  if (rendererType === 'musicResponsiveListItemRenderer') {
    return songParser.parseSearchResult(item);
  }

  return null;
}

export function parseMusicTwoRowItem(r: any): SearchResult | null {
  if (!r) return null;

  const pageType = traverseString(r, 'title', 'runs', 'navigationEndpoint', 'browseEndpoint', 'pageType');
  const browseId = traverseString(r, 'title', 'runs', 'navigationEndpoint', 'browseEndpoint', 'browseId');
  const videoId = traverseString(r, 'navigationEndpoint', 'watchEndpoint', 'videoId');
  let watchPlaylistId = traverseString(r, 'navigationEndpoint', 'watchPlaylistEndpoint', 'playlistId');
  if (!watchPlaylistId) {
    watchPlaylistId = traverseString(r, 'thumbnailOverlay', 'musicItemThumbnailOverlayRenderer', 'content', 'musicPlayButtonRenderer', 'playNavigationEndpoint', 'watchPlaylistEndpoint', 'playlistId');
  }

  const title = traverseString(r, 'title', 'runs', 'text');
  const subtitleRuns = traverseList(r, 'subtitle', 'runs');
  const artistName = subtitleRuns.length > 0 ? traverseString(subtitleRuns[0], 'text') : '';
  const artistId = subtitleRuns.length > 0 ? traverseString(subtitleRuns[0], 'browseId') : null;
  const thumbnails = parseThumbnails(r, 'thumbnailRenderer', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails');

  switch (pageType) {
    case 'MUSIC_PAGE_TYPE_ALBUM':
    case 'MUSIC_PAGE_TYPE_AUDIOBOOK':
      return {
        type: 'ALBUM',
        albumId: browseId,
        playlistId: watchPlaylistId,
        name: title,
        artists: [{
          name: artistName,
          artistId: artistId || null
        }],
        thumbnails
      } as AlbumDetailed;

    case 'MUSIC_PAGE_TYPE_PLAYLIST':
      return {
        type: 'PLAYLIST',
        playlistId: browseId,
        name: title,
        artists: [{
          name: artistName,
          artistId: artistId || null
        }],
        thumbnails
      } as PlaylistDetailed;

    case 'MUSIC_PAGE_TYPE_ARTIST':
    case 'MUSIC_PAGE_TYPE_USER_CHANNEL':
      return {
        type: 'ARTIST',
        artistId: browseId,
        name: title,
        thumbnails
      } as ArtistDetailed;

    case 'MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE':
      return {
        type: 'PLAYLIST',
        playlistId: browseId,
        name: title,
        artists: [{
          name: artistName,
          artistId: artistId || null
        }],
        thumbnails
      } as PlaylistDetailed;

    default: {
      let unknownType = traverseString(r, 'navigationEndpoint', 'watchEndpoint', 'musicVideoType');
      let finalArtistName = artistName;
      let finalArtistId = artistId;
      if (artistName === 'Song') {
        finalArtistName = traverseString(subtitleRuns[2], 'text');
        finalArtistId = traverseString(subtitleRuns[2], 'browseId');
      }
      if (unknownType === 'MUSIC_VIDEO_TYPE_ATV') {
        return {
          type: 'SONG',
          videoId: videoId,
          name: title,
          artists: [{
            name: finalArtistName,
            artistId: finalArtistId || null
          }],
          thumbnails
        } as SongDetailed;
      }

      if (videoId) {
        return {
          type: 'VIDEO',
          videoId: videoId,
          name: title,
          artists: [{
            name: finalArtistName,
            artistId: finalArtistId || null
          }],
          thumbnails
        } as VideoDetailed;
      }

      return null;
    }
  }
}

export function parseThumbnails(data: any, ...keys: string[]): Thumbnail[] {
  const list: Thumbnail[] = [];
  for (const node of traverseList(data, ...keys)) {
    if (!node) continue;
    const url = traverseString(node, 'url');
    const width = parseInt(traverseString(node, 'width'), 10) || 0;
    const height = parseInt(traverseString(node, 'height'), 10) || 0;
    if (url) {
      list.push({ url, width, height });
    }
  }
  return list;
}

export function parseArtists(runs: any[]): ArtistBasic[] {
  if (runs.length >= 2) {
    const firstText = traverseString(runs[0], 'text').trim();
    const secondText = traverseString(runs[1], 'text').trim();
    const isTypePrefix = ['song', 'video', 'artist', 'album', 'single', 'ep', 'playlist', 'podcast', 'episode'].includes(firstText.toLowerCase());
    const isSeparator = secondText === '•' || secondText === '|' || secondText === '·';
    if (isTypePrefix && isSeparator) {
      runs = runs.slice(2);
    }
  }

  const artists: ArtistBasic[] = [];
  const artistParts: any[] = [];

  for (const run of runs) {
    if (!run) continue;
    const text = traverseString(run, 'text').trim();
    if (text === '•' || text === '|' || text === '·') break;
    if (Filters.isDuration(run) || Filters.isAlbum(run)) break;
    artistParts.push(run);
  }

  for (const run of artistParts) {
    const text = traverseString(run, 'text').trim();
    if (!text || text === '&' || text === ',' || text === 'and' || text === 'feat.' || text === 'ft.') continue;

    const lowerText = text.toLowerCase();
    if (lowerText.includes('play') || lowerText.includes('view') || lowerText.includes('stream')) continue;
    if (/^\d+[\d.,]*[kmb]?$/i.test(text)) continue;
    if (/^\d{4}$/.test(text)) continue;

    const artistId = traverseString(run, 'browseId');
    if (artistId && !artistId.startsWith('UC')) continue;
    artists.push({
      artistId,
      name: text
    });
  }

  return artists;
}
