import { traverseString, traverseList, traverse } from '../jsonTraverse.js';
import { parseThumbnails } from './parser.js';
import * as songParser from './songParser.js';
import * as videoParser from './videoParser.js';
import * as artistParser from './artistParser.js';
import * as albumParser from './albumParser.js';
import * as playlistParser from './playlistParser.js';
import { SearchResult, ArtistDetailed, SongDetailed, VideoDetailed, AlbumDetailed, PlaylistDetailed } from '../types.js';

export function parse(item: any): SearchResult | null {
  const flexColumns = traverseList(item, 'flexColumns');
  if (flexColumns.length < 2) return null;

  const typeList = traverseList(flexColumns[1], 'runs', 'text');
  if (typeList.length === 0 || typeList[0] === null || typeList[0] === undefined) return null;

  const type = String(typeList[0]);

  switch (type) {
    case 'Song':
      return songParser.parseSearchResult(item);
    case 'Video':
      return videoParser.parseSearchResult(item);
    case 'Artist':
      return artistParser.parseSearchResult(item);
    case 'EP':
    case 'Single':
    case 'Album':
      return albumParser.parseSearchResult(item);
    case 'Playlist':
      return playlistParser.parseSearchResult(item);
    default:
      return null;
  }
}

export function parseTopResult(shelf: any): SearchResult | null {
  if (!shelf) return null;

  let subtitle = traverseString(shelf, 'subtitle', 'runs', 'text');
  let category = traverseString(shelf, 'header', 'musicCardShelfHeaderBasicRenderer', 'title', 'runs', 'text');
  if (!category) category = 'Top result';

  const resultType = mapResultType(subtitle);
  const thumbnails = parseThumbnails(shelf, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails');

  const onTap = traverse(shelf, 'onTap');

  switch (resultType) {
    case 'artist': {
      const title = traverseString(shelf, 'title', 'runs', 'text');
      return {
        category,
        type: 'ARTIST',
        name: title,
        artistId: traverseString(shelf, 'navigationEndpoint', 'browseEndpoint', 'browseId'),
        thumbnails
      } as ArtistDetailed;
    }

    case 'song':
    case 'video': {
      const title = traverseString(shelf, 'title', 'runs', 'text');
      const videoId = traverseString(onTap, 'watchEndpoint', 'videoId');

      if (resultType === 'song') {
        const runs = traverseList(shelf, 'subtitle', 'runs');
        const artist = runs.length > 0 ? traverseString(runs[0], 'text') : null;
        const artistId = runs.length > 0 ? traverseString(runs[0], 'browseId') : null;
        const album = runs.length > 2 ? traverseString(runs[2], 'text') : null;
        const albumId = runs.length > 2 ? traverseString(runs[2], 'browseId') : null;

        return {
          category,
          type: 'SONG',
          name: title,
          videoId,
          artists: [{ name: artist ?? '', artistId: artistId || null }],
          album: album ? { name: album, albumId: albumId ?? '' } : null,
          thumbnails
        } as SongDetailed;
      }

      return {
        category,
        type: 'VIDEO',
        name: title,
        videoId,
        artists: [],
        thumbnails
      } as VideoDetailed;
    }

    case 'album': {
      const title = traverseString(shelf, 'title', 'runs', 'text');
      const browseId = traverseString(shelf, 'title', 'runs', 'navigationEndpoint', 'browseEndpoint', 'browseId');
      const buttonCommand = traverse(shelf, 'buttons', 'buttonRenderer', 'command');
      const playlistId = buttonCommand
        ? (traverseString(buttonCommand, 'watchPlaylistEndpoint', 'playlistId') ||
          traverseString(buttonCommand, 'watchEndpoint', 'playlistId'))
        : null;
      const runs = traverseList(shelf, 'subtitle', 'runs');
      const artist = runs.length > 2 ? traverseString(runs[2], 'text') : null;
      const artistId = runs.length > 2 ? traverseString(runs[2], 'browseId') : null;

      return {
        category,
        type: 'ALBUM',
        name: title,
        albumId: browseId ?? '',
        playlistId: playlistId ?? '',
        artists: [{ name: artist ?? '', artistId: artistId || null }],
        thumbnails
      } as AlbumDetailed;
    }

    case 'playlist': {
      const playlistId = traverseString(shelf, 'menu', 'menuRenderer', 'items', 'menuNavigationItemRenderer', 'navigationEndpoint', 'watchPlaylistEndpoint', 'playlistId');
      const title = traverseString(shelf, 'title', 'runs', 'text');
      const runs = traverseList(shelf, 'subtitle', 'runs');
      const artist = runs.length > 2 ? traverseString(runs[2], 'text') : null;
      const artistId = runs.length > 2 ? traverseString(runs[2], 'browseId') : null;

      return {
        category,
        type: 'PLAYLIST',
        name: title,
        playlistId: playlistId ?? '',
        artists: [{ name: artist ?? '', artistId: artistId || null }],
        thumbnails
      } as PlaylistDetailed;
    }

    default: {
      const title = traverseString(shelf, 'title', 'runs', 'text');
      return {
        category,
        type: resultType ? resultType.toUpperCase() : '',
        name: title ?? '',
        thumbnails
      } as any;
    }
  }
}

export function parseSearchResults(items: any[], resultType: string | null, category: string | null): SearchResult[] {
  const results: SearchResult[] = [];
  for (const item of items) {
    const rendered = traverse(item, 'musicResponsiveListItemRenderer');
    if (!rendered) continue;

    const parsed = parseItemByType(rendered, resultType, category);
    if (parsed) results.push(parsed);
  }
  return results;
}

function parseItemByType(item: any, resultType: string | null, category: string | null): SearchResult | null {
  if (!item) return null;

  if (resultType) {
    let parsed: SearchResult | null = null;
    switch (resultType) {
      case 'song':
        parsed = songParser.parseSearchResult(item);
        break;
      case 'video':
        parsed = videoParser.parseSearchResult(item);
        break;
      case 'album':
        parsed = albumParser.parseSearchResult(item);
        break;
      case 'artist':
        parsed = artistParser.parseSearchResult(item);
        break;
      case 'playlist':
        parsed = playlistParser.parseSearchResult(item);
        break;
      case 'upload':
        parsed = parseUploadResult(item);
        break;
    }
    if (parsed) parsed.category = category;
    return parsed;
  }

  const flexColumns = traverseList(item, 'flexColumns');
  if (flexColumns.length >= 2) {
    const typeList = traverseList(flexColumns[1], 'runs', 'text');
    if (typeList.length > 0 && typeList[0] !== null && typeList[0] !== undefined) {
      const type = String(typeList[0]);
      let parsed: SearchResult | null = null;
      switch (type) {
        case 'Song':
          parsed = songParser.parseSearchResult(item);
          break;
        case 'Video':
          parsed = videoParser.parseSearchResult(item);
          break;
        case 'Artist':
          parsed = artistParser.parseSearchResult(item);
          break;
        case 'EP':
        case 'Single':
        case 'Album':
          parsed = albumParser.parseSearchResult(item);
          break;
        case 'Playlist':
          parsed = playlistParser.parseSearchResult(item);
          break;
      }
      if (parsed) parsed.category = category;
      return parsed;
    }
  }

  const detected = detectResultType(item);
  if (detected) {
    let parsed: SearchResult | null = null;
    switch (detected) {
      case 'song':
        parsed = songParser.parseSearchResult(item);
        break;
      case 'video':
        parsed = videoParser.parseSearchResult(item);
        break;
      case 'album':
        parsed = albumParser.parseSearchResult(item);
        break;
      case 'artist':
        parsed = artistParser.parseSearchResult(item);
        break;
      case 'playlist':
        parsed = playlistParser.parseSearchResult(item);
        break;
    }
    if (parsed) parsed.category = category;
    return parsed;
  }

  return null;
}

function detectResultType(item: any): string | null {
  const browseId = traverseString(item, 'navigationEndpoint', 'browseEndpoint', 'browseId');
  if (browseId) {
    if (browseId.startsWith('MPRE')) return 'album';
    if (browseId.startsWith('UC') || browseId.startsWith('MPLA')) return 'artist';
    if (browseId.startsWith('VL') || browseId.startsWith('RD') || browseId.startsWith('VM')) return 'playlist';
    if (browseId.startsWith('MPSP')) return 'podcast';
    if (browseId.startsWith('MPED')) return 'episode';
  }

  const videoType = traverseString(item, 'playNavigationEndpoint', 'watchEndpoint', 'watchEndpointMusicSupportedConfigs', 'watchEndpointMusicConfig', 'musicVideoType');
  if (videoType) {
    if (videoType === 'MUSIC_VIDEO_TYPE_ATV') return 'song';
    if (videoType === 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE') return 'episode';
    return 'video';
  }

  const playlistItemVideoId = traverseString(item, 'playlistItemData', 'videoId');
  if (playlistItemVideoId) return 'song';

  return null;
}

function mapResultType(typeLocal: string | null): string | null {
  if (!typeLocal) return null;
  switch (typeLocal.toLowerCase()) {
    case 'song':
      return 'song';
    case 'video':
      return 'video';
    case 'album':
    case 'single':
    case 'ep':
      return 'album';
    case 'artist':
      return 'artist';
    case 'playlist':
      return 'playlist';
    case 'station':
      return 'station';
    case 'profile':
      return 'profile';
    case 'podcast':
      return 'podcast';
    case 'episode':
      return 'episode';
    default:
      return 'album';
  }
}

function parseUploadResult(item: any): SearchResult | null {
  const browseId = traverseString(item, 'navigationEndpoint', 'browseEndpoint', 'browseId');
  if (!browseId) {
    const flexItems0 = traverseList(item, 'flexColumns', 'runs');
    const videoId = flexItems0.length > 0
      ? traverseString(flexItems0[0], 'navigationEndpoint', 'watchEndpoint', 'videoId')
      : null;

    return {
      category: 'Uploads',
      type: 'SONG',
      videoId: videoId ?? '',
      name: traverseString(item, 'flexColumns', 'runs', 'text'),
      thumbnails: parseThumbnails(item, 'thumbnails')
    } as SongDetailed;
  }

  return {
    category: 'Uploads',
    type: browseId.includes('artist') ? 'ARTIST' : 'ALBUM',
    name: '',
    thumbnails: parseThumbnails(item, 'thumbnails')
  } as any;
}
