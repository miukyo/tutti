import { traverseString, traverseList } from '../jsonTraverse.js';
import { Filters, parseDuration, parseThumbnails, parseArtists } from './parser.js';
import * as streamParser from './streamParser.js';
import {
  SongFull,
  SearchResult,
  SongDetailed,
  VideoDetailed,
  ArtistBasic,
  AlbumBasic,
  Thumbnail
} from '../types.js';

export function parse(data: any): SongFull {
  const durationStr = traverseString(data, 'videoDetails', 'lengthSeconds');
  const duration = parseFloat(durationStr) || 0;

  let streamManifest = null;
  try {
    streamManifest = streamParser.parse(data);
  } catch (e) {
    // Song metadata may still be useful when streams are unavailable.
  }

  return {
    type: 'SONG',
    videoId: traverseString(data, 'videoDetails', 'videoId'),
    name: traverseString(data, 'videoDetails', 'title'),
    artists: [{
      name: traverseString(data, 'author'),
      artistId: traverseString(data, 'videoDetails', 'channelId') || null
    }],
    duration,
    thumbnails: parseThumbnails(data, 'videoDetails', 'thumbnails'),
    streamManifest
  };
}

export function parseSearchResult(item: any): SearchResult | null {
  const columns = traverseList(item, 'flexColumns');

  const title = columns.length > 0 ? traverseList(columns[0], 'runs')[0] : null;
  const album = columns.find(Filters.isAlbum);
  const durationNode = columns.find(Filters.isDuration);

  const durationText = durationNode ? traverseString(durationNode, 'text') : null;
  const type = traverseString(item, 'navigationEndpoint', 'watchEndpoint', 'musicVideoType');

  let albumBasic: AlbumBasic | null = null;
  if (album) {
    albumBasic = {
      name: traverseString(album, 'text'),
      albumId: traverseString(album, 'browseId')
    };
  }

  const subtitleRuns = traverseList(columns[1], 'runs');
  const artists = parseArtists(subtitleRuns);
  const primaryArtist = artists[0] || { name: 'Unknown Artist', artistId: null };

  if (primaryArtist.name === "Song") return null;

  if (type === 'MUSIC_VIDEO_TYPE_ATV') {
    return {
      type: 'SONG',
      videoId: traverseString(item, 'playlistItemData', 'videoId'),
      name: traverseString(title, 'text'),
      artists,
      album: albumBasic,
      duration: parseDuration(durationText),
      thumbnails: parseThumbnails(item, 'thumbnails')
    } as SongDetailed;
  } else {
    return {
      type: 'VIDEO',
      videoId: traverseString(item, 'playlistItemData', 'videoId'),
      name: traverseString(title, 'text'),
      artists,
      duration: parseDuration(durationText),
      thumbnails: parseThumbnails(item, 'thumbnails')
    } as VideoDetailed;
  }
}

export function parseArtistSong(item: any, artistBasic: ArtistBasic): SongDetailed {
  const columns = traverseList(item, 'flexColumns', 'runs');

  const title = columns.find(Filters.isTitle);
  const album = columns.find(Filters.isAlbum);
  const durationNode = columns.find(Filters.isDuration);

  const durationText = durationNode ? traverseString(durationNode, 'text') : null;

  let albumBasic: AlbumBasic | null = null;
  if (album) {
    albumBasic = {
      name: traverseString(album, 'text'),
      albumId: traverseString(album, 'browseId')
    };
  }

  const parsedArtists = parseArtists(columns);
  const artists = parsedArtists.length > 0 ? parsedArtists : [artistBasic];

  return {
    type: 'SONG',
    videoId: traverseString(item, 'playlistItemData', 'videoId'),
    name: traverseString(title, 'text'),
    artists,
    album: albumBasic,
    duration: parseDuration(durationText),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseArtistTopSong(item: any, artistBasic: ArtistBasic): SongDetailed {
  const columns = traverseList(item, 'flexColumns', 'runs');

  const title = columns.find(Filters.isTitle);
  const album = columns.find(Filters.isAlbum);

  let albumBasic: AlbumBasic | null = null;
  if (album) {
    albumBasic = {
      name: traverseString(album, 'text'),
      albumId: traverseString(album, 'browseId')
    };
  }

  const parsedArtists = parseArtists(columns);
  const artists = parsedArtists.length > 0 ? parsedArtists : [artistBasic];

  return {
    type: 'SONG',
    videoId: traverseString(item, 'playlistItemData', 'videoId'),
    name: traverseString(title, 'text'),
    artists,
    album: albumBasic,
    duration: null,
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseAlbumSong(item: any, artistBasic: ArtistBasic, albumBasic: AlbumBasic, thumbnails: Thumbnail[]): SongDetailed {
  const runs = traverseList(item, 'flexColumns', 'runs');
  const title = runs.find(Filters.isTitle);
  const durationNode = traverseList(item, 'fixedColumns', 'runs').find(Filters.isDuration);

  const durationText = durationNode ? traverseString(durationNode, 'text') : null;

  const parsedArtists = parseArtists(runs);
  const artists = parsedArtists.length > 0 ? parsedArtists : [artistBasic];

  return {
    type: 'SONG',
    videoId: traverseString(item, 'playlistItemData', 'videoId'),
    name: traverseString(title, 'text'),
    artists,
    album: albumBasic,
    duration: parseDuration(durationText),
    thumbnails: thumbnails
  };
}

export function parseLibrarySong(item: any): SongDetailed | null {
  const flexCols = traverseList(item, 'flexColumns');
  if (flexCols.length === 0) return null;

  const columns = traverseList(item, 'flexColumns', 'runs');
  const title = columns.length > 0 ? columns[0] : null;

  if (traverseString(title, 'text').startsWith('Shuffle')) return null;

  const artistColumn = flexCols.find(Filters.isArtist) || (flexCols.length > 1 ? flexCols[1] : null);
  const artistRuns = artistColumn ? traverseList(artistColumn, 'runs') : [];
  const artists = parseArtists(artistRuns);
  const primaryArtist = artists[0] || { name: 'Unknown Artist', artistId: null };

  const album = columns.find(Filters.isAlbum);
  const durationNode = columns.find(Filters.isDuration);

  const durationText = durationNode ? traverseString(durationNode, 'text') : null;

  let albumBasic: AlbumBasic | null = null;
  if (album) {
    albumBasic = {
      name: traverseString(album, 'text'),
      albumId: traverseString(album, 'browseId')
    };
  }

  return {
    type: 'SONG',
    videoId: traverseString(item, 'playlistItemData', 'videoId'),
    name: traverseString(title, 'text'),
    artists,
    album: albumBasic,
    duration: parseDuration(durationText),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}
