import { traverseString, traverseList, traverse } from '../jsonTraverse.js';
import { Filters, parseThumbnails } from './parser.js';
import { PlaylistFull, PlaylistDetailed, ArtistBasic } from '../types.js';

export function parse(data: any, playlistId: string): PlaylistFull {
  const artistNode = traverse(data, 'tabs', 'straplineTextOne');
  const artistId = traverseString(artistNode, 'browseId');

  const secondSubtitleList = traverseList(data, 'tabs', 'secondSubtitle', 'text');
  let videoCount = 0;
  if (secondSubtitleList.length > 2 && secondSubtitleList[2] !== null) {
    const text = String(secondSubtitleList[2]);
    const split = text.split(' ');
    if (split.length > 0) {
      const countStr = split[0].replace(/,/g, '');
      videoCount = parseInt(countStr, 10) || 0;
    }
  }

  return {
    type: 'PLAYLIST',
    playlistId,
    name: traverseString(data, 'tabs', 'title', 'text'),
    artist: {
      name: traverseString(artistNode, 'text'),
      artistId: artistId || null
    },
    videoCount,
    thumbnails: parseThumbnails(data, 'tabs', 'thumbnails')
  };
}

export function parseSearchResult(item: any): PlaylistDetailed {
  const columns = traverseList(item, 'flexColumns', 'runs');
  const title = columns.length > 0 ? columns[0] : null;
  const artist = columns.find(Filters.isArtist) || (columns.length > 3 ? columns[3] : null);

  const artistId = traverseString(artist, 'browseId');

  return {
    type: 'PLAYLIST',
    playlistId: traverseString(item, 'overlay', 'playlistId'),
    name: traverseString(title, 'text'),
    artist: {
      name: traverseString(artist, 'text'),
      artistId: artistId || null
    },
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseArtistFeaturedOn(item: any, artistBasic: ArtistBasic): PlaylistDetailed {
  return {
    type: 'PLAYLIST',
    playlistId: traverseString(item, 'navigationEndpoint', 'browseId'),
    name: traverseString(item, 'runs', 'text'),
    artist: artistBasic,
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseMoodPlaylist(item: any): PlaylistDetailed | null {
  const title = item ? traverseString(item, 'musicTwoRowItemRenderer', 'title', 'runs', 'text') : null;
  if (!title) return null;

  return {
    type: 'PLAYLIST',
    playlistId: traverseString(item, 'musicTwoRowItemRenderer', 'navigationEndpoint', 'browseEndpoint', 'browseId'),
    name: title,
    artist: { name: '', artistId: null },
    thumbnails: parseThumbnails(item, 'musicTwoRowItemRenderer', 'thumbnailRenderer', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
  };
}

export function parseLibraryPlaylist(item: any): PlaylistDetailed | null {
  const title = item ? traverseString(item, 'musicTwoRowItemRenderer', 'title', 'runs', 'text') : null;
  if (!title) return null;

  return {
    type: 'PLAYLIST',
    playlistId: traverseString(item, 'musicTwoRowItemRenderer', 'navigationEndpoint', 'browseEndpoint', 'browseId'),
    name: title,
    artist: { name: '', artistId: null },
    thumbnails: parseThumbnails(item, 'musicTwoRowItemRenderer', 'thumbnailRenderer', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
  };
}

export function parseLibraryPodcast(item: any): PlaylistDetailed | null {
  const title = item ? traverseString(item, 'musicTwoRowItemRenderer', 'title', 'runs', 'text') : null;
  if (!title) return null;

  return {
    type: 'PLAYLIST',
    playlistId: traverseString(item, 'musicTwoRowItemRenderer', 'navigationEndpoint', 'browseEndpoint', 'browseId'),
    name: title,
    artist: {
      name: traverseString(item, 'musicTwoRowItemRenderer', 'subtitle', 'runs', 'text'),
      artistId: null
    },
    thumbnails: parseThumbnails(item, 'musicTwoRowItemRenderer', 'thumbnailRenderer', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
  };
}
