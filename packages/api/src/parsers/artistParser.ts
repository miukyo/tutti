import { traverseString, traverseList } from '../jsonTraverse.js';
import { parseThumbnails } from './parser.js';
import * as songParser from './songParser.js';
import * as albumParser from './albumParser.js';
import * as videoParser from './videoParser.js';
import * as playlistParser from './playlistParser.js';
import { ArtistFull, ArtistDetailed, ArtistBasic } from '../types.js';

export function parse(data: any, artistId: string): ArtistFull {
  const artistBasic: ArtistBasic = {
    artistId,
    name: traverseString(data, 'header', 'title', 'text')
  };

  const carouselShelves = traverseList(data, 'musicCarouselShelfRenderer');

  const topSongs = [];
  for (const item of traverseList(data, 'musicShelfRenderer', 'contents')) {
    topSongs.push(songParser.parseArtistTopSong(item, artistBasic));
  }

  const topAlbums = [];
  const topSingles = [];
  const topVideos = [];
  const playlists = [];
  const featuredOn = [];
  const similarArtists = [];

  for (const shelf of carouselShelves) {
    const title = traverseString(shelf, 'header', 'musicCarouselShelfBasicHeaderRenderer', 'title', 'runs', 'text');
    for (const item of traverseList(shelf, 'contents')) {
      switch (title) {
        case 'Albums':
          topAlbums.push(albumParser.parseArtistTopAlbum(item, artistBasic));
          break;
        case 'Singles & EPs':
          topSingles.push(albumParser.parseArtistTopAlbum(item, artistBasic));
          break;
        case 'Videos':
          topVideos.push(videoParser.parseArtistTopVideo(item, artistBasic));
          break;
        case 'Playlists':
          playlists.push(playlistParser.parseArtistFeaturedOn(item, artistBasic));
          break;
        case 'Featured on':
          featuredOn.push(playlistParser.parseArtistFeaturedOn(item, artistBasic));
          break;
        case 'Fans might also like':
          similarArtists.push(parseSimilarArtists(item));
          break;
      }
    }
  }

  const description: string[] = [];

  traverseList(data, 'header', 'description', 'runs').forEach((item: any) => {
    if (item.text) {
      description.push(item.text);
    }
  });

  return {
    artistId: artistBasic.artistId!,
    name: artistBasic.name,
    description: description.join(''),
    type: 'ARTIST',
    thumbnails: parseThumbnails(data, 'header', 'thumbnails'),
    topSongs,
    topAlbums,
    topSingles,
    topVideos,
    playlists,
    featuredOn,
    similarArtists
  };
}

export function parseSearchResult(item: any): ArtistDetailed {
  const columns = traverseList(item, 'flexColumns', 'runs');
  const title = columns.length > 0 ? columns[0] : null;

  return {
    type: 'ARTIST',
    artistId: traverseString(item, 'browseId'),
    name: traverseString(title, 'text'),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseSimilarArtists(item: any): ArtistDetailed {
  return {
    type: 'ARTIST',
    artistId: traverseString(item, 'browseId'),
    name: traverseString(item, 'runs', 'text'),
    thumbnails: parseThumbnails(item, 'thumbnails')
  };
}

export function parseLibraryArtist(item: any): ArtistDetailed | null {
  const columns = traverseList(item, 'musicResponsiveListItemRenderer', 'flexColumns');
  const title = traverseString(columns[0], 'runs', 'text');
  if (!title) return null;

  return {
    type: 'ARTIST',
    artistId: traverseString(item, 'musicResponsiveListItemRenderer', 'navigationEndpoint', 'browseEndpoint', 'browseId'),
    name: title,
    thumbnails: parseThumbnails(item, 'musicResponsiveListItemRenderer', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
  };
}
