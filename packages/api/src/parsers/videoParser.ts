import { traverseString, traverseList } from '../jsonTraverse.js';
import { Filters, parseDuration, parseThumbnails } from './parser.js';
import { VideoFull, VideoDetailed, ArtistBasic } from '../types.js';

export function parse(data: any): VideoFull {
  const duration = parseFloat(traverseString(data, 'videoDetails', 'lengthSeconds')) || 0;
  const unlisted = traverseString(data, 'unlisted') === 'true';
  const familySafe = traverseString(data, 'familySafe') === 'true';
  const paid = traverseString(data, 'paid') === 'true';

  const tags: string[] = [];
  for (const t of traverseList(data, 'tags')) {
    const val = t ? String(t) : '';
    if (val) tags.push(val);
  }

  return {
    type: 'VIDEO',
    videoId: traverseString(data, 'videoDetails', 'videoId'),
    name: traverseString(data, 'videoDetails', 'title'),
    artist: {
      artistId: traverseString(data, 'videoDetails', 'channelId') || null,
      name: traverseString(data, 'author')
    },
    duration,
    thumbnails: parseThumbnails(data, 'videoDetails', 'thumbnails'),
    unlisted,
    familySafe,
    paid,
    tags
  };
}

export function parseSearchResult(item: any): VideoDetailed {
  const columns = traverseList(item, 'flexColumns', 'runs');

  const title = columns.find(Filters.isTitle);
  const artist = columns.find(Filters.isArtist) || (columns.length > 1 ? columns[1] : null);
  const durationNode = columns.find(Filters.isDuration);

  const durationText = durationNode ? traverseString(durationNode, 'text') : null;
  const artistId = traverseString(artist, 'browseId');

  return {
    type: 'VIDEO',
    videoId: traverseString(item, 'playNavigationEndpoint', 'videoId'),
    name: traverseString(title, 'text'),
    artist: {
      artistId: artistId || null,
      name: traverseString(artist, 'text')
    },
    duration: parseDuration(durationText),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseArtistTopVideo(item: any, artistBasic: ArtistBasic): VideoDetailed {
  return {
    type: 'VIDEO',
    videoId: traverseString(item, 'videoId'),
    name: traverseString(item, 'runs', 'text'),
    artist: artistBasic,
    duration: null,
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parsePlaylistVideo(item: any): VideoDetailed | null {
  const flexColumns = traverseList(item, 'flexColumns', 'runs');
  const fixedColumns = traverseList(item, 'fixedColumns', 'runs');

  const title = flexColumns.find(Filters.isTitle) || (flexColumns.length > 0 ? flexColumns[0] : null);
  const artist = flexColumns.find(Filters.isArtist) || (flexColumns.length > 1 ? flexColumns[1] : null);
  const durationNode = fixedColumns.find(Filters.isDuration);

  const videoId1 = traverseString(item, 'playNavigationEndpoint', 'videoId');

  const thumbnails = parseThumbnails(item, 'thumbnails');
  let videoId2: string | null = null;
  if (thumbnails.length > 0 && thumbnails[0].url) {
    const match = /https:\/\/i\.ytimg\.com\/vi\/(.+?)\//.exec(thumbnails[0].url);
    if (match) {
      videoId2 = match[1];
    }
  }

  if (!videoId1 && !videoId2) {
    return null;
  }

  const artistId = traverseString(artist, 'browseId');

  return {
    type: 'VIDEO',
    videoId: videoId1 || videoId2!,
    name: traverseString(title, 'text'),
    artist: {
      name: traverseString(artist, 'text'),
      artistId: artistId || null
    },
    duration: parseDuration(durationNode ? traverseString(durationNode, 'text') : null),
    thumbnails
  };
}
