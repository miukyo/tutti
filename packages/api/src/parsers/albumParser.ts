import { traverseString, traverseList, traverse } from '../jsonTraverse.js';
import { Filters, parseThumbnails, parseArtists } from './parser.js';
import * as songParser from './songParser.js';
import { AlbumFull, AlbumDetailed, ArtistBasic, AlbumBasic, Thumbnail } from '../types.js';

export function parse(data: any, albumId: string): AlbumFull {
  const albumBasic: AlbumBasic = {
    albumId,
    name: traverseString(data, 'tabs', 'title', 'text')
  };

  const artistData = traverse(data, 'tabs', 'straplineTextOne', 'runs');
  const artistId = traverseString(artistData, 'browseId');
  const artistBasic: ArtistBasic = {
    artistId: artistId || null,
    name: traverseString(artistData, 'text')
  };

  const thumbnails = parseThumbnails(data, 'background', 'thumbnails');

  const subtitleList = traverseList(data, 'tabs', 'subtitle', 'text');
  const lastSubtitle = subtitleList.length > 0 ? String(subtitleList[subtitleList.length - 1]) : null;

  const songs = [];
  for (const item of traverseList(data, 'musicResponsiveListItemRenderer')) {
    songs.push(songParser.parseAlbumSong(item, artistBasic, albumBasic, thumbnails));
  }

  return {
    type: 'ALBUM',
    albumId: albumBasic.albumId,
    playlistId: traverseString(data, 'musicPlayButtonRenderer', 'playlistId'),
    name: albumBasic.name,
    artists: [artistBasic],
    year: processYear(lastSubtitle),
    thumbnails,
    songs
  };
}

export function parseSearchResult(item: any): AlbumDetailed {
  const columns = traverseList(item, 'flexColumns', 'runs');

  const title = columns.length > 0 ? columns[0] : null;
  const artist = columns.find(Filters.isArtist) || (columns.length > 3 ? columns[3] : null);
  let playlistId = traverseString(item, 'overlay', 'playlistId');
  if (!playlistId) {
    playlistId = traverseString(item, 'thumbnailOverlay', 'playlistId');
  }

  const browseIdList = traverseList(item, 'browseId');
  const albumId = browseIdList.length > 0 ? String(browseIdList[browseIdList.length - 1]) : '';

  const lastCol = columns.length > 0 ? columns[columns.length - 1] : null;
  const lastText = lastCol ? traverseString(lastCol, 'text') : null;
  const artistId = traverseString(artist, 'browseId');
  const artists = parseArtists(columns);
  if (artists.length === 0 && artist) {
    artists.push({
      name: traverseString(artist, 'text'),
      artistId: artistId || null
    });
  }

  return {
    type: 'ALBUM',
    albumId,
    playlistId,
    artists,
    year: processYear(lastText),
    name: traverseString(title, 'text'),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseArtistAlbum(item: any, artistBasic: ArtistBasic): AlbumDetailed {
  const browseIdList = traverseList(item, 'browseId');
  const albumId = browseIdList.length > 0 ? String(browseIdList[browseIdList.length - 1]) : '';

  const subtitleList = traverseList(item, 'subtitle', 'text');
  const lastSubtitle = subtitleList.length > 0 ? String(subtitleList[subtitleList.length - 1]) : null;

  return {
    type: 'ALBUM',
    albumId,
    playlistId: traverseString(item, 'thumbnailOverlay', 'playlistId'),
    name: traverseString(item, 'title', 'text'),
    artists: [artistBasic],
    year: processYear(lastSubtitle),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseArtistTopAlbum(item: any, artistBasic: ArtistBasic): AlbumDetailed {
  const browseIdList = traverseList(item, 'browseId');
  const albumId = browseIdList.length > 0 ? String(browseIdList[browseIdList.length - 1]) : '';

  const subtitleList = traverseList(item, 'subtitle', 'text');
  const lastSubtitle = subtitleList.length > 0 ? String(subtitleList[subtitleList.length - 1]) : null;

  return {
    type: 'ALBUM',
    albumId,
    playlistId: traverseString(item, 'musicPlayButtonRenderer', 'playlistId'),
    name: traverseString(item, 'title', 'text'),
    artists: [artistBasic],
    year: processYear(lastSubtitle),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseExploreAlbum(item: any): AlbumDetailed | null {
  const title = traverseString(item, 'musicTwoRowItemRenderer', 'title', 'runs', 'text');
  if (!title) return null;

  const subtitleRuns = traverseList(item, 'musicTwoRowItemRenderer', 'subtitle', 'runs');
  const artistName = subtitleRuns.length > 0 ? traverseString(subtitleRuns[0], 'text') : '';

  return {
    type: 'ALBUM',
    albumId: traverseString(item, 'musicTwoRowItemRenderer', 'navigationEndpoint', 'browseEndpoint', 'browseId'),
    playlistId: traverseString(item, 'musicTwoRowItemRenderer', 'thumbnailOverlay', 'musicItemThumbnailOverlayRenderer', 'content', 'musicPlayButtonRenderer', 'playNavigationEndpoint', 'watchPlaylistEndpoint', 'playlistId'),
    name: title,
    artists: [{
      name: artistName,
      artistId: subtitleRuns.length > 0 ? traverseString(subtitleRuns[0], 'browseId') : null
    }],
    thumbnails: parseThumbnails(item, 'musicTwoRowItemRenderer', 'thumbnailRenderer', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
  };
}

export function parseLibraryAlbum(item: any): AlbumDetailed | null {
  const title = traverseString(item, 'musicTwoRowItemRenderer', 'title', 'runs', 'text');
  if (!title) return null;

  const subtitleRuns = traverseList(item, 'musicTwoRowItemRenderer', 'subtitle', 'runs');
  const artistName = subtitleRuns.length > 0 ? traverseString(subtitleRuns[0], 'text') : '';

  return {
    type: 'ALBUM',
    albumId: traverseString(item, 'musicTwoRowItemRenderer', 'navigationEndpoint', 'browseEndpoint', 'browseId'),
    playlistId: traverseString(item, 'musicTwoRowItemRenderer', 'thumbnailOverlay', 'musicItemThumbnailOverlayRenderer', 'content', 'musicPlayButtonRenderer', 'playNavigationEndpoint', 'watchPlaylistEndpoint', 'playlistId'),
    name: title,
    artists: [{
      name: artistName,
      artistId: subtitleRuns.length > 0 ? traverseString(subtitleRuns[0], 'browseId') : null
    }],
    thumbnails: parseThumbnails(item, 'musicTwoRowItemRenderer', 'thumbnailRenderer', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
  };
}

function processYear(year: string | null): number | null {
  if (!year) return null;
  const match = /^\d{4}$/.exec(year.trim());
  if (match) {
    const result = parseInt(match[0], 10);
    if (!isNaN(result)) return result;
  }
  return null;
}
