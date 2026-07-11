import { traverseString, traverseList } from '../jsonTraverse.js';
import { Filters, parseDuration, parseThumbnails } from './parser.js';
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
    artist: {
      name: traverseString(data, 'author'),
      artistId: traverseString(data, 'videoDetails', 'channelId') || null
    },
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
  const artistRun = subtitleRuns.find(run => run && run.navigationEndpoint);
  const targetRun = artistRun || (subtitleRuns.length > 0 ? subtitleRuns[0] : null);
  const artistName = targetRun ? traverseString(targetRun, 'text') : '';
  const artistId = targetRun ? traverseString(targetRun, 'browseId') : null;

  if (artistName === "Song") return null;

  if (type === 'MUSIC_VIDEO_TYPE_ATV') {
    return {
      type: 'SONG',
      videoId: traverseString(item, 'playlistItemData', 'videoId'),
      name: traverseString(title, 'text'),
      artist: {
        name: artistName,
        artistId: artistId || null
      },
      album: albumBasic,
      duration: parseDuration(durationText),
      thumbnails: parseThumbnails(item, 'thumbnails')
    } as SongDetailed;
  } else {
    return {
      type: 'VIDEO',
      videoId: traverseString(item, 'playlistItemData', 'videoId'),
      name: traverseString(title, 'text'),
      artist: {
        name: artistName,
        artistId: artistId || null
      },
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

  return {
    type: 'SONG',
    videoId: traverseString(item, 'playlistItemData', 'videoId'),
    name: traverseString(title, 'text'),
    artist: artistBasic,
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

  return {
    type: 'SONG',
    videoId: traverseString(item, 'playlistItemData', 'videoId'),
    name: traverseString(title, 'text'),
    artist: artistBasic,
    album: albumBasic,
    duration: null,
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseAlbumSong(item: any, artistBasic: ArtistBasic, albumBasic: AlbumBasic, thumbnails: Thumbnail[]): SongDetailed {
  const title = traverseList(item, 'flexColumns', 'runs').find(Filters.isTitle);
  const durationNode = traverseList(item, 'fixedColumns', 'runs').find(Filters.isDuration);

  const durationText = durationNode ? traverseString(durationNode, 'text') : null;

  return {
    type: 'SONG',
    videoId: traverseString(item, 'playlistItemData', 'videoId'),
    name: traverseString(title, 'text'),
    artist: artistBasic,
    album: albumBasic,
    duration: parseDuration(durationText),
    thumbnails: thumbnails
  };
}

export function parseLibrarySong(item: any): SongDetailed | null {
  const columns = traverseList(item, 'flexColumns', 'runs');

  const title = columns.length > 0 ? columns[0] : null;
  const artist = columns.find(Filters.isArtist) || (columns.length > 3 ? columns[3] : null);
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

  if (traverseString(title, 'text').startsWith('Shuffle')) return null;

  const artistId = traverseString(artist, 'browseId');

  return {
    type: 'SONG',
    videoId: traverseString(item, 'playlistItemData', 'videoId'),
    name: traverseString(title, 'text'),
    artist: {
      name: traverseString(artist, 'text'),
      artistId: artistId || null
    },
    album: albumBasic,
    duration: parseDuration(durationText),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}
