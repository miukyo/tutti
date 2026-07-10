import crypto from 'node:crypto';
import { nav, traverse, traverseList, traverseString } from './jsonTraverse.js';
import { Constants, PageType, LibraryOrderParams } from './constants.js';
import { getSearchParams } from './parsers/searchParams.js';
import * as parser from './parsers/parser.js';
import * as searchParser from './parsers/searchParser.js';
import * as songParser from './parsers/songParser.js';
import * as videoParser from './parsers/videoParser.js';
import * as artistParser from './parsers/artistParser.js';
import * as playlistParser from './parsers/playlistParser.js';
import * as albumParser from './parsers/albumParser.js';
import * as streamParser from './parsers/streamParser.js';
import { parseLrc, parseTtml, parseLyricsPlus } from './parsers/lyricsParser.js';
import {
  Thumbnail,
  ArtistBasic,
  AlbumBasic,
  SearchResult,
  SongDetailed,
  VideoDetailed,
  ArtistDetailed,
  AlbumDetailed,
  PlaylistDetailed,
  EpisodeDetailed,
  SongFull,
  VideoFull,
  UpNextsDetails,
  ArtistFull,
  AlbumFull,
  PlaylistFull,
  HomeSection,
  LikeStatus,
  LibraryOrder,
  SearchFilter,
  SearchScope,
  MoodCategory,
  ExploreResult,
  UserInfo,
  UserContentSection,
  AccountInfo,
  HistoryItem,
  ChannelFull,
  ChannelContentSection,
  PodcastFull,
  StreamManifest,
  LyricLine,
  LyricResult,
  LyricWord
} from './types.js';
import NodeFetchCache, { FileSystemCache } from 'node-fetch-cache';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const tuttiPath = path.join(app.getPath('appData'), 'tutti');
const cacheDir = path.join(tuttiPath, 'cache');

export const userPlaylistIds = new Set<string>();

const cachedFetch = NodeFetchCache.create({
  cache: new FileSystemCache({
    cacheDirectory: cacheDir,
    ttl: 60 * 60 * 1000 // 1 hour TTL
  }),
  calculateCacheKey: async (url, init) => {
    const body = init?.body || '';
    const hash = crypto.createHash('md5');
    hash.update(typeof url === 'string' ? url : (url as any).url || '');
    hash.update(typeof body === 'string' ? body : JSON.stringify(body));
    return hash.digest('hex');
  }
});

const lyricsCachedFetch = NodeFetchCache.create({
  cache: new FileSystemCache({
    cacheDirectory: path.join(cacheDir, 'lyrics')
    // no ttl parameter = cache forever
  }),
  calculateCacheKey: async (url, init) => {
    const body = init?.body || '';
    const hash = crypto.createHash('md5');
    hash.update(typeof url === 'string' ? url : (url as any).url || '');
    hash.update(typeof body === 'string' ? body : JSON.stringify(body));
    return hash.digest('hex');
  }
});

function shouldCacheYTRequest(endpoint: string, body: any, urlStr: string = ''): boolean {
  // 1. Search
  if (endpoint === 'search' || endpoint === 'music/get_search_suggestions') {
    return true;
  }

  // 2. Lyrics / Recommendations
  if (endpoint === 'next') {
    return true;
  }

  // 3. Browse (Home, Explore, Artists, Albums, Playlists)
  if (endpoint === 'browse') {
    let browseId = body?.browseId || '';
    if (!browseId && urlStr) {
      const match = /[?&]browseId=([^&]+)/.exec(urlStr);
      if (match) {
        browseId = decodeURIComponent(match[1]);
      }
    }
    if (!browseId) return false;
    // Home
    if (browseId === Constants.FeMusicHome) {
      return true;
    }

    // Explore
    if (
      browseId === Constants.FeMusicExplore ||
      browseId === Constants.FeMusicMoodsAndGenres ||
      browseId.startsWith(Constants.FeMusicMoodsAndGenresCategory)
    ) {
      return true;
    }

    // Lyrics text
    if (browseId.startsWith('FEmusic_lyrics')) {
      return true;
    }

    // Artists (starts with UC)
    if (browseId.startsWith('UC')) {
      return true;
    }

    // Albums (starts with MPREb_ or OLAK5uy_)
    if (browseId.startsWith('MPREb_') || browseId.startsWith('OLAK5uy_')) {
      return true;
    }

    // Playlists
    // Exclude Liked Songs (LM) and Saved Episodes (SE)
    // Exclude user-specific library playlists in userPlaylistIds
    if (browseId.startsWith('VL') || browseId.startsWith('PL') || browseId.startsWith('RD')) {
      const playlistId = browseId.startsWith('VL') ? browseId.substring(2) : browseId;
      if (playlistId === 'LM' || playlistId === 'SE') {
        return false;
      }
      if (userPlaylistIds.has(playlistId)) {
        return false;
      }
      return true;
    }
  }

  return false;
}

const fetch = async (url: any, init?: any): Promise<any> => {
  const urlStr = typeof url === 'string' ? url : (url as any).url || '';

  // Check if it's Unison or LRCLib lyrics
  if (urlStr.includes('unison.boidu.dev') || urlStr.includes('lrclib.net')) {
    return lyricsCachedFetch(url, init);
  }

  // For YouTube Music requests (POST requests)
  if (init?.method === 'POST' && urlStr.includes('/youtubei/')) {
    const match = /\/youtubei\/v[0-9]+\/([^?]+)/.exec(urlStr);
    if (match) {
      const endpoint = match[1];
      let body: any = {};
      try {
        body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body || {};
      } catch { }

      const browseId = body?.browseId || '';
      if (endpoint === 'browse' && browseId.startsWith('FEmusic_lyrics')) {
        return lyricsCachedFetch(url, init);
      }

      if (shouldCacheYTRequest(endpoint, body, urlStr)) {
        return cachedFetch(url, init);
      }
    }
    return globalThis.fetch(url, init);
  }

  // Fallback: bypass cache
  return globalThis.fetch(url, init);
};

function getSapisidAuthHeader(sapisid: string, origin: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const auth = `${timestamp} ${sapisid} ${origin}`;
  const hash = crypto.createHash('sha1').update(auth).digest('hex');
  return `SAPISIDHASH ${timestamp}_${hash}`;
}

let unisonKeyId: string | null = null;
function getOrCreateKeyId(): string {
  if (unisonKeyId) return unisonKeyId;
  const idPath = path.join(tuttiPath, 'identity.json');
  try {
    if (fs.existsSync(idPath)) {
      const data = JSON.parse(fs.readFileSync(idPath, 'utf8'));
      if (data && typeof data.keyId === 'string') {
        unisonKeyId = data.keyId;
        return unisonKeyId!;
      }
    }
  } catch (e) {
    console.error("Failed to read identity:", e);
  }

  unisonKeyId = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(idPath), { recursive: true });
    fs.writeFileSync(idPath, JSON.stringify({ keyId: unisonKeyId }), 'utf8');
  } catch (e) {
    console.error("Failed to save identity:", e);
  }
  return unisonKeyId;
}



export class YTMusic {
  private cookieString: string = '';
  private config: Record<string, any> = {};
  private sapisid: string | null = null;
  private origin: string | null = null;
  private authUser: string = '0';

  constructor() { }

  async login(): Promise<boolean> {
    // Handled in the main process IPC layer
    return false;
  }

  async logout(): Promise<boolean> {
    // Handled in the main process IPC layer
    return false;
  }

  async initialize(cookies: string | null = null, gl: string | null = null, hl: string | null = null): Promise<YTMusic> {
    this.cookieString = 'SOCS=CAI';
    this.authUser = '0';

    if (cookies) {
      let cookieToUse = cookies;
      if (cookies.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(cookies);
          cookieToUse = parsed.cookie || parsed.Cookie || '';
          this.authUser = parsed['x-goog-authuser'] || parsed['X-Goog-AuthUser'] || '0';
        } catch (e) {
          console.error("Failed to parse auth JSON in YTMusic initialize:", e);
        }
      }

      this.cookieString += '; ' + cookieToUse;

      const sapisidMatch = /(__Secure-3PAPISID|SAPISID)=([^;]+)/.exec(cookieToUse);
      if (sapisidMatch) {
        this.sapisid = sapisidMatch[2];
        this.origin = 'https://music.youtube.com';
      }
    }

    try {
      const res = await fetch('https://music.youtube.com/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cookie': this.cookieString
        }
      });
      const html = await res.text();
      const matches = html.matchAll(/ytcfg\.set\((.*?)\);/g);
      for (const match of matches) {
        const jsonStr = match[1];
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && typeof parsed === 'object') {
            Object.assign(this.config, parsed);
          }
        } catch (e) { }
      }
    } catch (e) { }

    if (gl) this.config['GL'] = gl;
    if (hl) this.config['HL'] = hl;

    return this;
  }

  private getConfigString(key: string): string {
    const val = this.config[key];
    if (val !== undefined && val !== null) {
      if (typeof val === 'object') {
        return JSON.stringify(val);
      }
      return String(val);
    }
    return '';
  }

  private buildDefaultContext(): Record<string, any> {
    return {
      capabilities: {},
      client: {
        clientName: this.getConfigString('INNERTUBE_CLIENT_NAME'),
        clientVersion: this.getConfigString('INNERTUBE_CLIENT_VERSION'),
        experimentIds: [],
        experimentsToken: '',
        gl: this.getConfigString('GL'),
        hl: this.getConfigString('HL'),
        locationInfo: {
          locationPermissionAuthorizationStatus: 'LOCATION_PERMISSION_AUTHORIZATION_STATUS_UNSUPPORTED'
        },
        musicAppInfo: {
          musicActivityMasterSwitch: 'MUSIC_ACTIVITY_MASTER_SWITCH_INDETERMINATE',
          musicLocationMasterSwitch: 'MUSIC_LOCATION_MASTER_SWITCH_INDETERMINATE',
          pwaInstallabilityStatus: 'PWA_INSTALLABILITY_STATUS_UNKNOWN'
        },
        utcOffsetMinutes: new Date().getTimezoneOffset()
      },
      request: {
        internalExperimentFlags: [
          { key: 'force_music_enable_outertube_tastebuilder_browse', value: 'true' },
          { key: 'force_music_enable_outertube_playlist_detail_browse', value: 'true' },
          { key: 'force_music_enable_outertube_search_suggestions', value: 'true' }
        ],
        sessionIndex: {}
      },
      user: {
        enableSafetyMode: false
      }
    };
  }

  private async constructRequest(
    endpoint: string,
    body: Record<string, any> | null = null,
    query: Record<string, string> | null = null
  ): Promise<any> {
    if (Object.keys(this.config).length === 0) {
      throw new Error('API not initialized. Make sure to call initialize() first.');
    }

    const reqBody = {
      context: this.buildDefaultContext(),
      ...body
    };

    const queryDict: Record<string, string> = {
      alt: 'json',
      key: this.getConfigString('INNERTUBE_API_KEY'),
      ...query
    };

    const searchParams = new URLSearchParams(queryDict);
    const apiVersion = this.getConfigString('INNERTUBE_API_VERSION') || 'v1';
    const url = `https://music.youtube.com/youtubei/${apiVersion}/${endpoint}?${searchParams.toString()}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'https://music.youtube.com',
      'X-Goog-Visitor-Id': this.getConfigString('VISITOR_DATA'),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36',
      'X-YouTube-Client-Name': this.getConfigString('INNERTUBE_CONTEXT_CLIENT_NAME'),
      'X-YouTube-Client-Version': this.getConfigString('INNERTUBE_CLIENT_VERSION'),
      'X-YouTube-Device': this.getConfigString('DEVICE'),
      'X-YouTube-Page-CL': this.getConfigString('PAGE_CL'),
      'X-YouTube-Page-Label': this.getConfigString('PAGE_BUILD_LABEL'),
      'X-YouTube-Utc-Offset': String(new Date().getTimezoneOffset()),
      'Cookie': this.cookieString,
      'X-Goog-AuthUser': this.authUser,
    };

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        headers['X-YouTube-Time-Zone'] = tz;
      }
    } catch (e) { }

    if (this.sapisid) {
      headers['Authorization'] = getSapisidAuthHeader(this.sapisid, this.origin || 'https://music.youtube.com');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody)
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return await res.json();
  }

  private async constructPlayerRequest(videoId: string, defaultClient = false): Promise<any> {
    if (Object.keys(this.config).length === 0) {
      throw new Error('API not initialized. Make sure to call initialize() first.');
    }

    const reqBody: Record<string, any> = {
      videoId,
      contentCheckOk: true,
      context: defaultClient
        ? this.buildDefaultContext()
        : {
          client: {
            clientName: 'ANDROID_VR',
            clientVersion: '1.60.19',
            deviceMake: 'Oculus',
            deviceModel: 'Quest 3',
            osName: 'Android',
            osVersion: '12L',
            platform: 'MOBILE',
            visitorData: this.getConfigString('VISITOR_DATA'),
            hl: this.getConfigString('HL'),
            gl: this.getConfigString('GL'),
            utcOffsetMinutes: new Date().getTimezoneOffset()
          }
        }
    };

    const apiVersion = this.getConfigString('INNERTUBE_API_VERSION') || 'v1';
    const apiKey = this.getConfigString('INNERTUBE_API_KEY');
    const url = `https://music.youtube.com/youtubei/${apiVersion}/player?alt=json&key=${encodeURIComponent(apiKey)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'https://music.youtube.com',
      'X-Goog-Visitor-Id': this.getConfigString('VISITOR_DATA'),
      'Cookie': this.cookieString,
      'X-Goog-AuthUser': this.authUser,
    };

    if (!defaultClient) {
      headers['User-Agent'] = 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; Quest 3 Build/SQ3A.220605.009.A1) gzip';
    } else {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36';
      headers['X-YouTube-Client-Name'] = this.getConfigString('INNERTUBE_CONTEXT_CLIENT_NAME');
      headers['X-YouTube-Client-Version'] = this.getConfigString('INNERTUBE_CLIENT_VERSION');
      headers['X-YouTube-Device'] = this.getConfigString('DEVICE');
      headers['X-YouTube-Page-CL'] = this.getConfigString('PAGE_CL');
      headers['X-YouTube-Page-Label'] = this.getConfigString('PAGE_BUILD_LABEL');
      headers['X-YouTube-Utc-Offset'] = String(new Date().getTimezoneOffset());
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
          headers['X-YouTube-Time-Zone'] = tz;
        }
      } catch (e) { }

      if (this.sapisid) {
        headers['Authorization'] = getSapisidAuthHeader(this.sapisid, this.origin || 'https://music.youtube.com');
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody)
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return await res.json();
  }

  // --- Parsing Helpers ---
  private static getSectionContents(data: any): any[] {
    const sections = nav(data, 'contents', 'singleColumnBrowseResultsRenderer', 'tabs', 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents');
    if (Array.isArray(sections)) {
      return sections.filter((s: any) => s !== null && s !== undefined);
    }
    return [];
  }

  private static getRendererItems(section: any, rendererKeys: string[]): any[] {
    let items = section ? traverseList(section, ...rendererKeys) : [];
    if (items.length > 0) return items;
    const wrappedKeys = ['itemSectionRenderer', 'contents', ...rendererKeys];
    return section ? traverseList(section, ...wrappedKeys) : [];
  }

  private static getSearchSections(data: any, scope: SearchScope | null, filter: SearchFilter | null): any[] | null {
    if (!data) return null;

    const tabbed = traverse(data, 'contents', 'tabbedSearchResultsRenderer');
    if (tabbed) {
      const tabs = traverseList(tabbed, 'tabs');
      let tabIndex = 0;
      if (scope !== null || filter !== null) {
        if (scope === 'Library') tabIndex = 1;
        else if (scope === 'Uploads') tabIndex = 2;
      }
      if (tabIndex >= tabs.length) return null;

      const tabContent = traverse(tabs[tabIndex], 'tabRenderer', 'content');
      return traverseList(tabContent, 'sectionListRenderer', 'contents');
    }

    const sectionList = traverseList(data, 'contents', 'sectionListRenderer', 'contents');
    if (sectionList.length > 0) {
      return sectionList;
    }

    return null;
  }

  private async getContinuations(
    shelfRenderer: any,
    continuationType: string,
    body: Record<string, any>,
    limit: number,
    resultType: string | null,
    category: string | null
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    let current = shelfRenderer;

    while (current && results.length < limit) {
      const ctoken = traverseString(current, 'continuations', 'nextContinuationData', 'continuation');
      if (!ctoken) break;

      const contData = await this.constructRequest('search', body, {
        ctoken,
        continuation: ctoken
      });

      if (!contData) break;

      const contContents = traverse(contData, 'continuationContents', continuationType);
      if (!contContents) break;

      const items = traverseList(contContents, 'contents');
      if (items.length === 0) break;

      const parsed = searchParser.parseSearchResults(items, resultType, category);
      results.push(...parsed);

      current = contContents;
    }

    return results;
  }

  private static parsePlaylistItems(data: any): any[] {
    let shelf = nav(data, 'contents', 'twoColumnBrowseResultsRenderer', 'tabs', 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents', 0, 'musicPlaylistShelfRenderer', 'contents');

    if (!shelf)
      shelf = nav(data, 'contents', 'singleColumnBrowseResultsRenderer', 'tabs', 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents', 0, 'musicPlaylistShelfRenderer', 'contents');

    if (!shelf)
      shelf = nav(data, 'contents', 'twoColumnBrowseResultsRenderer', 'secondaryContents', 'sectionListRenderer', 'contents', 0, 'musicPlaylistShelfRenderer', 'contents');

    if (Array.isArray(shelf)) {
      return shelf.filter((s: any) => s !== null && s !== undefined);
    }
    return [];
  }

  private static getContinuationToken(node: any): string | null {
    const token = nav(node, 'continuations', 0, 'nextContinuationData', 'continuation');
    return token ? String(token) : null;
  }

  // --- API Methods ---

  // Search
  async getSearchSuggestions(query: string): Promise<string[]> {
    const data = await this.constructRequest('music/get_search_suggestions', {
      input: query
    });

    const resultList: string[] = [];
    for (const item of traverseList(data, 'query')) {
      if (item) resultList.push(String(item));
    }
    return resultList;
  }

  async search(
    query: string,
    filter: SearchFilter | null = null,
    scope: SearchScope | null = null,
    limit: number = 20,
    ignoreSpelling: boolean = false
  ): Promise<SearchResult[]> {
    if (scope === 'Uploads' && filter !== null) {
      throw new Error('No filter can be set when searching uploads.');
    }

    if (scope === 'Library' && filter !== null && (filter === 'CommunityPlaylists' || filter === 'FeaturedPlaylists')) {
      throw new Error(`${filter} cannot be set when searching library.`);
    }

    const body: Record<string, any> = { query };
    const paramsStr = getSearchParams(filter, scope, ignoreSpelling);
    if (paramsStr) body['params'] = paramsStr;

    const data = await this.constructRequest('search', body);
    const results: SearchResult[] = [];

    if (!data) return results;

    const sections = YTMusic.getSearchSections(data, scope, filter);
    if (!sections || sections.length === 0) return results;

    let internalFilter: string | null = null;
    if (filter !== null) {
      if (filter === 'CommunityPlaylists' || filter === 'FeaturedPlaylists') {
        internalFilter = 'playlists';
      } else {
        internalFilter = filter.toLowerCase();
      }
    } else if (scope === 'Uploads') {
      internalFilter = 'uploads';
    }

    for (const section of sections) {
      const cardShelf = traverse(section, 'musicCardShelfRenderer');
      if (cardShelf) {
        const topResult = searchParser.parseTopResult(cardShelf);
        if (topResult) results.push(topResult);

        const cardContents = traverseList(cardShelf, 'contents');
        if (cardContents.length > 0) {
          const msgText = traverseString(cardContents[0], 'messageRenderer', 'text', 'runs', 'text');
          if (msgText) {
            cardContents.shift();
          }
        }
        if (cardContents.length > 0) {
          const category = traverseString(cardShelf, 'header', 'musicCardShelfHeaderBasicRenderer', 'title', 'runs', 'text');
          results.push(...searchParser.parseSearchResults(cardContents, null, category));
        }
        continue;
      }

      const musicShelf = traverse(section, 'musicShelfRenderer');
      if (musicShelf) {
        const shelfContents = traverseList(musicShelf, 'contents');
        const category = traverseString(musicShelf, 'title', 'runs', 'text');

        let resultType: string | null = null;
        if (internalFilter !== null && scope !== 'Uploads') {
          resultType = internalFilter.replace(/s$/, ''); // TrimEnd 's'
        }

        results.push(...searchParser.parseSearchResults(shelfContents, resultType, category));

        if (internalFilter !== null && results.length < limit) {
          results.push(...(await this.getContinuations(
            musicShelf,
            'musicShelfContinuation',
            body,
            limit - results.length,
            resultType,
            category
          )));
        }
        continue;
      }

      const itemSection = traverse(section, 'itemSectionRenderer');
      if (itemSection) {
        const itemContents = traverseList(itemSection, 'contents');
        if (itemContents.length > 0) {
          results.push(...searchParser.parseSearchResults(itemContents, null, null));
        }
      }
    }

    return results;
  }

  async searchSongs(query: string): Promise<SongDetailed[]> {
    const results = await this.search(query, 'Songs', null, 20, false);
    return results.filter((r): r is SongDetailed => r.type === 'SONG');
  }

  async searchVideos(query: string): Promise<VideoDetailed[]> {
    const results = await this.search(query, 'Videos', null, 20, false);
    return results.filter((r): r is VideoDetailed => r.type === 'VIDEO');
  }

  async searchArtists(query: string): Promise<ArtistDetailed[]> {
    const results = await this.search(query, 'Artists', null, 20, false);
    return results.filter((r): r is ArtistDetailed => r.type === 'ARTIST');
  }

  async searchAlbums(query: string): Promise<AlbumDetailed[]> {
    const results = await this.search(query, 'Albums', null, 20, false);
    return results.filter((r): r is AlbumDetailed => r.type === 'ALBUM');
  }

  async searchPlaylists(query: string): Promise<PlaylistDetailed[]> {
    const results = await this.search(query, 'Playlists', null, 20, false);
    return results.filter((r): r is PlaylistDetailed => r.type === 'PLAYLIST');
  }

  // Song / Video / Stream / Player
  async getStreamManifest(videoId: string): Promise<StreamManifest> {
    if (!/^[a-zA-Z0-9-_]{11}$/.test(videoId)) {
      throw new Error('Invalid videoId: must be 11 characters.');
    }
    const data = await this.constructPlayerRequest(videoId);
    return streamParser.parse(data);
  }

  async getSong(videoId: string): Promise<SongFull> {
    if (!/^[a-zA-Z0-9-_]{11}$/.test(videoId)) {
      throw new Error('Invalid videoId: must be 11 characters.');
    }
    const data = await this.constructPlayerRequest(videoId);
    const song = songParser.parse(data);
    if (song.videoId !== videoId) {
      throw new Error('Invalid videoId returned from server');
    }
    return song;
  }

  async getPlayerResponse(videoId: string): Promise<any> {
    if (!/^[a-zA-Z0-9-_]{11}$/.test(videoId)) {
      throw new Error('Invalid videoId: must be 11 characters.');
    }
    return await this.constructPlayerRequest(videoId);
  }

  async getUpNexts(videoId: string): Promise<UpNextsDetails[]> {
    if (!/^[a-zA-Z0-9-_]{11}$/.test(videoId)) {
      throw new Error('Invalid videoId: must be 11 characters.');
    }

    const data = await this.constructRequest('next', {
      videoId,
      playlistId: `RDAMVM${videoId}`,
      isAudioOnly: true
    });

    const tabs = traverseList(
      data,
      'contents',
      'singleColumnMusicWatchNextResultsRenderer',
      'tabbedRenderer',
      'watchNextTabbedResultsRenderer',
      'tabs'
    );

    if (tabs.length === 0) throw new Error('Invalid response structure');

    const playlistPanelContents = traverseList(
      tabs[0],
      'tabRenderer',
      'content',
      'musicQueueRenderer',
      'content',
      'playlistPanelRenderer',
      'contents'
    );

    const result: UpNextsDetails[] = [];
    if (playlistPanelContents.length <= 1) return result;

    for (const item of playlistPanelContents.slice(1)) {
      const videoRenderer = traverse(item, 'playlistPanelVideoRenderer');
      if (!videoRenderer) continue;

      const vId = traverseString(videoRenderer, 'videoId');

      const titleNode = traverse(videoRenderer, 'title', 'runs');
      const titleText = Array.isArray(titleNode) && titleNode.length > 0 ? traverseString(titleNode[0], 'text') : 'Unknown';

      const bylineNode = traverse(videoRenderer, 'shortBylineText', 'runs');
      const bylineText = Array.isArray(bylineNode) && bylineNode.length > 0 ? traverseString(bylineNode[0], 'text') : 'Unknown';

      const lengthNode = traverse(videoRenderer, 'lengthText', 'runs');
      const lengthText = Array.isArray(lengthNode) && lengthNode.length > 0 ? traverseString(lengthNode[0], 'text') : 'Unknown';

      const thList = traverseList(videoRenderer, 'thumbnail', 'thumbnails');
      const thUrl = thList.length > 0 ? traverseString(thList[thList.length - 1], 'url') : 'Unknown';

      result.push({
        type: 'SONG',
        videoId: vId,
        title: titleText,
        artists: bylineText,
        duration: lengthText,
        thumbnail: thUrl
      });
    }

    return result;
  }

  async getVideo(videoId: string): Promise<VideoFull> {
    if (!/^[a-zA-Z0-9-_]{11}$/.test(videoId)) {
      throw new Error('Invalid videoId: must be 11 characters.');
    }
    const data = await this.constructPlayerRequest(videoId);
    const video = videoParser.parse(data);
    if (video.videoId !== videoId) {
      throw new Error('Invalid videoId returned from server');
    }
    return video;
  }

  async getLyrics(videoId: string, title?: string, artist?: string, duration?: number): Promise<LyricResult | null> {
    if (!/^[a-zA-Z0-9-_]{11}$/.test(videoId)) {
      throw new Error('Invalid videoId: must be 11 characters.');
    }

    let songTitle = title || '';
    let songArtist = artist || '';
    let songDuration = duration || 0;

    if (!songTitle || !songArtist) {
      try {
        const video = await this.getVideo(videoId);
        songTitle = songTitle || video.name;
        songArtist = songArtist || (video.artist?.name || '');
        songDuration = songDuration || video.duration;
      } catch (e) {
        console.warn("Failed to fetch video metadata for lyrics:", e);
      }
    }



    // 1. Try Unison
    try {
      const keyId = getOrCreateKeyId();
      const unisonUrl = new URL('https://unison.boidu.dev/lyrics');
      unisonUrl.searchParams.append('v', videoId);
      if (songTitle) unisonUrl.searchParams.append('song', songTitle);
      if (songArtist) unisonUrl.searchParams.append('artist', songArtist);
      if (songDuration) unisonUrl.searchParams.append('duration', String(Math.round(songDuration)));

      const response = await fetch(unisonUrl.toString(), {
        headers: { 'x-key-id': keyId }
      });
      if (response.ok) {
        const json = await response.json() as any;
        const data = json.data;
        if (data && data.lyrics && data.format) {
          if (data.format === 'lrc') {
            const lines = parseLrc(data.lyrics);
            if (lines.length > 0) {
              return { synced: true, lines, source: 'Unison' };
            }
          } else if (data.format === 'ttml') {
            const lines = parseTtml(data.lyrics);
            if (lines.length > 0) {
              return { synced: true, lines, source: 'Unison (TTML)' };
            }
          } else if (data.format === 'plain') {
            const lines = data.lyrics.split('\n').map((l: string) => ({ text: l.trim() })).filter((l: any) => l.text);
            return { synced: false, lines, source: 'Unison' };
          }
        }
      }
    } catch (e) {
      console.warn("Unison lyrics fetch failed:", e);
    }

    // 2. Try LyricsPlus (binimum)
    if (songTitle && songArtist) {
      try {
        const url = new URL('https://lyricsplus.binimum.org/v2/lyrics/get');
        url.searchParams.append('title', songTitle);
        url.searchParams.append('artist', songArtist);
        if (songDuration) {
          url.searchParams.append('duration', String(Math.round(songDuration)));
        }

        const response = await fetch(url.toString());
        if (response.ok) {
          const json = await response.json() as any;
          if (json) {
            const lines = parseLyricsPlus(json);
            if (lines && lines.length > 0) {
              const sourceLabel = json.metadata?.source || json.metadata?.provider || 'LyricsPlus';
              const isUnsynced = lines.every((line) => !line.startTimeMs && !line.endTimeMs);
              return { synced: !isUnsynced, lines, source: sourceLabel };
            }
          }
        }
      } catch (e) {
        console.warn("LyricsPlus lyrics fetch failed:", e);
      }
    }

    // 3. Try LRCLib
    if (songTitle && songArtist) {
      try {
        const lrcUrl = new URL('https://lrclib.net/api/get');
        lrcUrl.searchParams.append('artist_name', songArtist);
        lrcUrl.searchParams.append('track_name', songTitle);
        if (songDuration) {
          lrcUrl.searchParams.append('duration', String(Math.round(songDuration)));
        }

        const response = await fetch(lrcUrl.toString());
        if (response.ok) {
          const data = await response.json() as any;
          if (data.syncedLyrics) {
            const lines = parseLrc(data.syncedLyrics);
            if (lines.length > 0) {
              return { synced: true, lines, source: 'LRCLib' };
            }
          }
          if (data.plainLyrics) {
            const lines = data.plainLyrics.split('\n').map((l: string) => ({ text: l.trim() })).filter((l: any) => l.text);
            return { synced: false, lines, source: 'LRCLib' };
          }
        }
      } catch (e) {
        console.warn("LRCLib lyrics fetch failed:", e);
      }
    }

    // 4. Fallback to YouTube Music plain text scraper
    try {
      const data = await this.constructRequest('next', { videoId });
      const tabs = traverseList(data, 'tabs', 'tabRenderer');
      if (tabs.length >= 2) {
        const browseId = traverseString(tabs[1], 'browseId');
        if (browseId) {
          const lyricsData = await this.constructRequest('browse', { browseId });
          const lyrics = traverseString(lyricsData, 'description', 'runs', 'text');
          if (lyrics) {
            const lines = lyrics
              .replace(/\r/g, '')
              .split('\n')
              .map((l: string) => ({ text: l.trim() }))
              .filter((l: any) => l.text);
            return { synced: false, lines, source: 'YouTube Music' };
          }
        }
      }
    } catch (e) {
      console.warn("YouTube Music lyrics fetch failed:", e);
    }

    return null;
  }

  // Artist
  async getArtist(artistId: string): Promise<ArtistFull> {
    const data = await this.constructRequest('browse', {
      browseId: artistId.replace(/^MPLA/, '')
    });
    return artistParser.parse(data, artistId);
  }

  async getArtistSongs(artistId: string): Promise<SongDetailed[]> {
    const artistData = await this.constructRequest('browse', {
      browseId: artistId.replace(/^MPLA/, '')
    });

    const browseToken = traverseString(artistData, 'musicShelfRenderer', 'title', 'browseId');
    if (!browseToken) return [];

    const songsData = await this.constructRequest('browse', {
      browseId: browseToken
    });

    const continueToken = traverseString(songsData, 'continuation');
    let moreSongsData: any = null;
    if (continueToken) {
      moreSongsData = await this.constructRequest('browse', {}, {
        continuation: continueToken,
        browseId: browseToken
      });
    }

    const songsList: any[] = [];
    songsList.push(...traverseList(songsData, 'musicResponsiveListItemRenderer'));
    if (moreSongsData) {
      songsList.push(...traverseList(moreSongsData, 'musicResponsiveListItemRenderer'));
    }

    const artistName = traverseString(artistData, 'header', 'title', 'text');
    const artistBasic: ArtistBasic = {
      artistId,
      name: artistName
    };

    return songsList.map(s => songParser.parseArtistSong(s, artistBasic));
  }

  async getArtistAlbums(artistId: string): Promise<AlbumDetailed[]> {
    const artistData = await this.constructRequest('browse', {
      browseId: artistId.replace(/^MPLA/, '')
    });

    const carousels = traverseList(artistData, 'musicCarouselShelfRenderer');
    if (carousels.length === 0) return [];

    const browseBodyNode = traverse(carousels[0], 'moreContentButton', 'browseEndpoint');
    if (!browseBodyNode) return [];

    const albumsData = await this.constructRequest('browse', browseBodyNode);

    const artistName = traverseString(albumsData, 'header', 'runs', 'text');
    const artistBasic: ArtistBasic = {
      artistId,
      name: artistName
    };

    const results: AlbumDetailed[] = [];
    for (const item of traverseList(albumsData, 'musicTwoRowItemRenderer')) {
      results.push(albumParser.parseArtistAlbum(item, artistBasic));
    }
    return results;
  }

  // Album
  async getAlbum(albumId: string): Promise<AlbumFull> {
    const data = await this.constructRequest('browse', {
      browseId: albumId
    });
    return albumParser.parse(data, albumId);
  }

  // Playlist
  async getPlaylist(playlistId: string): Promise<PlaylistFull> {
    let finalId = playlistId;
    if (playlistId.startsWith('PL') || playlistId.startsWith('RD')) {
      finalId = 'VL' + playlistId;
    }

    const data = await this.constructRequest('browse', {
      browseId: finalId
    });

    return playlistParser.parse(data, finalId);
  }

  async getPlaylistVideos(playlistId: string): Promise<VideoDetailed[]> {
    let finalId = playlistId;
    if (playlistId.startsWith('PL') || playlistId.startsWith('RD')) {
      finalId = 'VL' + playlistId;
    }

    const playlistData = await this.constructRequest('browse', {
      browseId: finalId
    });

    const results: VideoDetailed[] = [];
    for (const item of YTMusic.parsePlaylistItems(playlistData)) {
      const parsed = videoParser.parsePlaylistVideo(item);
      if (parsed) results.push(parsed);
    }

    return results;
  }

  async getLikedSongs(): Promise<PlaylistFull> {
    return await this.getPlaylist('LM');
  }

  async getSavedEpisodes(): Promise<PlaylistFull> {
    return await this.getPlaylist('SE');
  }

  // Playlist CRUD
  async createPlaylist(title: string, description: string, privacyStatus: string = 'PRIVATE', videoIds: string[] | null = null): Promise<string> {
    const body: Record<string, any> = {
      title,
      description,
      privacyStatus
    };

    if (videoIds && videoIds.length > 0) {
      body['videoIds'] = videoIds;
    }

    const data = await this.constructRequest('playlist/create', body);
    const playlistId = traverseString(data, 'playlistId');
    if (playlistId) {
      userPlaylistIds.add(playlistId);
    }
    return playlistId;
  }

  async deletePlaylist(playlistId: string): Promise<any> {
    return await this.constructRequest('playlist/delete', {
      playlistId
    });
  }

  async editPlaylist(playlistId: string, title: string | null = null, description: string | null = null, privacyStatus: string | null = null): Promise<any> {
    const actions: any[] = [];

    if (title !== null) {
      actions.push({
        action: 'ACTION_SET_PLAYLIST_NAME',
        playlistName: title
      });
    }

    if (description !== null) {
      actions.push({
        action: 'ACTION_SET_PLAYLIST_DESCRIPTION',
        playlistDescription: description
      });
    }

    if (privacyStatus !== null) {
      actions.push({
        action: 'ACTION_SET_PLAYLIST_PRIVACY',
        privacyStatus: privacyStatus
      });
    }

    return await this.constructRequest('browse/edit_playlist', {
      playlistId,
      actions
    });
  }

  async addPlaylistItems(playlistId: string, videoIds: string[], sourcePlaylist: string | null = null, duplicates: boolean = false): Promise<any> {
    const actions: any[] = [];

    for (const videoId of videoIds) {
      actions.push({
        action: 'ACTION_ADD_VIDEO',
        addedVideoId: videoId,
        dedupeOption: duplicates ? 'DEDUPE_OPTION_SKIP' : ''
      });
    }

    if (sourcePlaylist !== null) {
      actions.push({
        action: 'ACTION_ADD_PLAYLIST',
        addedFullListId: sourcePlaylist
      });
    }

    return await this.constructRequest('browse/edit_playlist', {
      playlistId,
      actions
    });
  }

  async removePlaylistItems(playlistId: string, videos: { setVideoId: string; removedVideoId: string }[]): Promise<any> {
    const actions: any[] = [];

    for (const video of videos) {
      actions.push({
        action: 'ACTION_REMOVE_VIDEO',
        setVideoId: video.setVideoId,
        removedVideoId: video.removedVideoId
      });
    }

    return await this.constructRequest('browse/edit_playlist', {
      playlistId,
      actions
    });
  }

  // Home / Explore
  async getHomeSections(): Promise<HomeSection[]> {
    const data = await this.constructRequest('browse', {
      browseId: Constants.FeMusicHome
    });

    const sections: any[] = [];
    sections.push(...YTMusic.getSectionContents(data));

    let continuation = traverseString(data, 'continuation');
    while (continuation) {
      const contData = await this.constructRequest('browse', {}, {
        continuation,
        browseId: Constants.FeMusicHome
      });

      sections.push(...traverseList(contData, 'sectionListContinuation', 'contents'));
      continuation = traverseString(contData, 'continuation');
    }

    const results: HomeSection[] = [];
    for (const section of sections) {
      results.push(parser.parseHomeSection(section));
    }
    return results;
  }

  async getMoodCategories(): Promise<MoodCategory[]> {
    const data = await this.constructRequest('browse', {
      browseId: Constants.FeMusicMoodsAndGenres
    });

    const categories: MoodCategory[] = [];
    for (const section of YTMusic.getSectionContents(data)) {
      const gridItems = traverseList(section, 'gridRenderer', 'items');
      if (gridItems.length === 0) continue;

      for (const item of gridItems) {
        categories.push({
          title: traverseString(item, 'buttonText', 'runs', 'text'),
          params: traverseString(item, 'clickCommand', 'browseEndpoint', 'params')
        });
      }
    }

    return categories;
  }

  async getMoodPlaylists(moodParams: string): Promise<PlaylistDetailed[]> {
    const data = await this.constructRequest('browse', {
      browseId: Constants.FeMusicMoodsAndGenresCategory,
      params: moodParams
    });

    const results: PlaylistDetailed[] = [];
    for (const section of YTMusic.getSectionContents(data)) {
      const contents: any[] = [];
      contents.push(...traverseList(section, 'gridRenderer', 'items'));
      if (contents.length === 0) {
        contents.push(...traverseList(section, 'musicCarouselShelfRenderer', 'contents'));
      }

      for (const item of contents) {
        const parsed = playlistParser.parseMoodPlaylist(item);
        if (parsed) results.push(parsed);
      }
    }

    return results;
  }

  async getMoodSections(moodParams: string): Promise<HomeSection[]> {
    const data = await this.constructRequest('browse', {
      browseId: Constants.FeMusicMoodsAndGenresCategory,
      params: moodParams
    });

    const sections: any[] = [];
    sections.push(...YTMusic.getSectionContents(data));

    const results: HomeSection[] = [];
    for (const section of sections) {
      results.push(parser.parseHomeSection(section));
    }
    return results;
  }

  async getExplore(): Promise<ExploreResult> {
    const data = await this.constructRequest('browse', {
      browseId: Constants.FeMusicExplore
    });

    const result: ExploreResult = {
      newReleases: [],
      moodsAndGenres: [],
      trending: [],
      newMusicVideos: []
    };

    const sections = YTMusic.getSectionContents(data);

    for (const section of sections) {
      const browseId = traverseString(section, 'musicCarouselShelfRenderer', 'header',
        'musicCarouselShelfBasicHeaderRenderer', 'title', 'navigationEndpoint', 'browseEndpoint', 'browseId');

      const pageType = traverseString(section, 'musicCarouselShelfRenderer', 'header',
        'musicCarouselShelfBasicHeaderRenderer', 'title', 'navigationEndpoint', 'browseEndpoint', 'pageType');

      const contents = traverseList(section, 'musicCarouselShelfRenderer', 'contents');

      if (browseId.startsWith('FEmusic_new_releases_albums')) {
        for (const item of contents) {
          const parsed = albumParser.parseExploreAlbum(item);
          if (parsed) result.newReleases.push(parsed);
        }
      } else if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') {
        for (const item of contents) {
          const parsed = videoParser.parsePlaylistVideo(item);
          if (parsed) result.trending.push(parsed);
        }
      } else if (browseId.startsWith('FEmusic_new_releases_videos')) {
        for (const item of contents) {
          const subtitleRuns = traverseList(item, 'subtitle', 'runs');
          const artist = subtitleRuns.length > 0 ? subtitleRuns[0] : null;
          const parsed = videoParser.parseArtistTopVideo(item, {
            artistId: artist ? traverseString(artist, 'navigationEndpoint', 'browseEndpoint', 'browseId') : null,
            name: artist ? traverseString(artist, 'text') : ''
          });
          if (parsed) result.newMusicVideos.push(parsed);
        }
      }
    }

    return result;
  }

  // User
  async getUser(channelId: string): Promise<UserInfo> {
    const data = await this.constructRequest('browse', {
      browseId: channelId
    });

    const info: UserInfo = {
      name: traverseString(data, 'header', 'musicVisualHeaderRenderer', 'title', 'runs', 'text'),
      videos: null,
      playlists: null
    };

    let sectionIndex = 0;
    for (const section of YTMusic.getSectionContents(data)) {
      const browseId = traverseString(section, 'musicCarouselShelfRenderer', 'header',
        'musicCarouselShelfBasicHeaderRenderer', 'title', 'navigationEndpoint', 'browseEndpoint', 'browseId');
      const paramsVal = traverseString(section, 'musicCarouselShelfRenderer', 'header',
        'musicCarouselShelfBasicHeaderRenderer', 'title', 'navigationEndpoint', 'browseEndpoint', 'params');

      const userSection: UserContentSection = {
        browseId,
        params: paramsVal,
        results: []
      };

      for (const item of traverseList(section, 'musicCarouselShelfRenderer', 'contents')) {
        const parsed = videoParser.parseArtistTopVideo(item, { name: info.name, artistId: null });
        if (parsed) userSection.results.push(parsed);
      }

      if (sectionIndex === 0) info.videos = userSection;
      else info.playlists = userSection;
      sectionIndex++;
    }

    return info;
  }

  async getUserPlaylists(channelId: string, paramsVal: string): Promise<PlaylistDetailed[]> {
    const data = await this.constructRequest('browse', {
      browseId: channelId,
      params: paramsVal
    });

    const results: PlaylistDetailed[] = [];
    const sections = YTMusic.getSectionContents(data);
    const firstSection = sections.length > 0 ? sections[0] : null;
    if (firstSection) {
      for (const item of YTMusic.getRendererItems(firstSection, ['gridRenderer', 'items'])) {
        const parsed = playlistParser.parseMoodPlaylist(item);
        if (parsed) results.push(parsed);
      }
    }

    return results;
  }

  // Library
  async getLibraryPlaylists(limit: number = 100): Promise<PlaylistDetailed[]> {
    const body = {
      browseId: Constants.FeMusicLikedPlaylists
    };

    const data = await this.constructRequest('browse', body);

    const results: PlaylistDetailed[] = [];
    const sections = YTMusic.getSectionContents(data);
    if (sections.length === 0) return results;

    const grid = nav(sections[0], 'gridRenderer');
    let items = grid ? YTMusic.getRendererItems(grid, ['items']) : [];
    if (items.length > 0) {
      items = items.slice(1);
    }

    for (const item of items) {
      if (results.length >= limit) break;
      const parsed = playlistParser.parseLibraryPlaylist(item);
      if (parsed) {
        results.push(parsed);
        if (parsed.playlistId) {
          userPlaylistIds.add(parsed.playlistId);
        }
      }
    }

    if (results.length < limit && grid) {
      let continuation = YTMusic.getContinuationToken(grid);
      while (continuation && results.length < limit) {
        const contData = await this.constructRequest('browse', {
          continuation
        });

        const contGrid = nav(contData, 'continuationContents', 'gridContinuation');
        const contItems = contGrid ? YTMusic.getRendererItems(contGrid, ['items']) : [];
        for (const item of contItems) {
          if (results.length >= limit) break;
          const parsed = playlistParser.parseLibraryPlaylist(item);
          if (parsed) {
            results.push(parsed);
            if (parsed.playlistId) {
              userPlaylistIds.add(parsed.playlistId);
            }
          }
        }

        continuation = YTMusic.getContinuationToken(contGrid);
      }
    }

    return results;
  }

  async getLibrarySongs(limit: number = 100, order: LibraryOrder | null = null): Promise<SongDetailed[]> {
    const body: Record<string, any> = {
      browseId: Constants.FeMusicLikedVideos
    };

    if (order) {
      body['params'] = LibraryOrderParams[order] || '';
    }

    const data = await this.constructRequest('browse', body);

    const results: SongDetailed[] = [];
    const sections = YTMusic.getSectionContents(data);
    if (sections.length === 0) return results;

    const shelf = nav(sections[0], 'musicShelfRenderer');
    for (const item of YTMusic.getRendererItems(shelf, ['contents'])) {
      if (results.length >= limit) break;
      const parsed = songParser.parseLibrarySong(item);
      if (parsed) results.push(parsed);
    }

    if (results.length < limit && shelf) {
      let continuation = YTMusic.getContinuationToken(shelf);
      while (continuation && results.length < limit) {
        const contData = await this.constructRequest('browse', {
          continuation
        });

        const contShelf = nav(contData, 'continuationContents', 'musicShelfContinuation');
        for (const item of YTMusic.getRendererItems(contShelf, ['contents'])) {
          if (results.length >= limit) break;
          const parsed = songParser.parseLibrarySong(item);
          if (parsed) results.push(parsed);
        }

        continuation = YTMusic.getContinuationToken(contShelf);
      }
    }

    return results;
  }

  async getLibraryAlbums(limit: number = 100, order: LibraryOrder | null = null): Promise<AlbumDetailed[]> {
    const body: Record<string, any> = {
      browseId: Constants.FeMusicLikedAlbums
    };

    if (order) {
      body['params'] = LibraryOrderParams[order] || '';
    }

    const data = await this.constructRequest('browse', body);

    const results: AlbumDetailed[] = [];
    const sections = YTMusic.getSectionContents(data);
    if (sections.length === 0) return results;

    const grid = nav(sections[0], 'gridRenderer');
    for (const item of YTMusic.getRendererItems(grid, ['items'])) {
      if (results.length >= limit) break;
      const parsed = albumParser.parseLibraryAlbum(item);
      if (parsed) results.push(parsed);
    }

    if (results.length < limit && grid) {
      let continuation = YTMusic.getContinuationToken(grid);
      while (continuation && results.length < limit) {
        const contData = await this.constructRequest('browse', {
          continuation
        });

        const contGrid = nav(contData, 'continuationContents', 'gridContinuation');
        for (const item of YTMusic.getRendererItems(contGrid, ['items'])) {
          if (results.length >= limit) break;
          const parsed = albumParser.parseLibraryAlbum(item);
          if (parsed) results.push(parsed);
        }

        continuation = YTMusic.getContinuationToken(contGrid);
      }
    }

    return results;
  }

  async getLibraryArtists(limit: number = 100, order: LibraryOrder | null = null): Promise<ArtistDetailed[]> {
    return await this.getLibraryArtistsInternal(Constants.FeMusicLibraryTrackArtists, limit, order);
  }

  async getLibrarySubscriptions(limit: number = 100, order: LibraryOrder | null = null): Promise<ArtistDetailed[]> {
    return await this.getLibraryArtistsInternal(Constants.FeMusicLibraryArtists, limit, order);
  }

  private async getLibraryArtistsInternal(browseId: string, limit: number = 100, order: LibraryOrder | null = null): Promise<ArtistDetailed[]> {
    const body: Record<string, any> = {
      browseId
    };

    if (order) {
      body['params'] = LibraryOrderParams[order] || '';
    }

    const data = await this.constructRequest('browse', body);

    const results: ArtistDetailed[] = [];
    const sections = YTMusic.getSectionContents(data);
    if (sections.length === 0) return results;

    const shelf = nav(sections[0], 'musicShelfRenderer');
    for (const item of YTMusic.getRendererItems(shelf, ['contents'])) {
      if (results.length >= limit) break;
      const parsed = artistParser.parseLibraryArtist(item);
      if (parsed) results.push(parsed);
    }

    if (results.length < limit && shelf) {
      let continuation = YTMusic.getContinuationToken(shelf);
      while (continuation && results.length < limit) {
        const contData = await this.constructRequest('browse', {
          continuation
        });

        const contShelf = nav(contData, 'continuationContents', 'musicShelfContinuation');
        for (const item of YTMusic.getRendererItems(contShelf, ['contents'])) {
          if (results.length >= limit) break;
          const parsed = artistParser.parseLibraryArtist(item);
          if (parsed) results.push(parsed);
        }

        continuation = YTMusic.getContinuationToken(contShelf);
      }
    }

    return results;
  }

  async getLibraryPodcasts(limit: number = 100, order: LibraryOrder | null = null): Promise<PlaylistDetailed[]> {
    const body: Record<string, any> = {
      browseId: Constants.FeMusicLibraryNonMusicAudioList
    };

    if (order) {
      body['params'] = LibraryOrderParams[order] || '';
    }

    const data = await this.constructRequest('browse', body);

    const results: PlaylistDetailed[] = [];
    const sections = YTMusic.getSectionContents(data);
    if (sections.length === 0) return results;

    const grid = nav(sections[0], 'gridRenderer');
    for (const item of YTMusic.getRendererItems(grid, ['items'])) {
      if (results.length >= limit) break;
      const parsed = playlistParser.parseLibraryPodcast(item);
      if (parsed) results.push(parsed);
    }

    if (results.length < limit && grid) {
      let continuation = YTMusic.getContinuationToken(grid);
      while (continuation && results.length < limit) {
        const contData = await this.constructRequest('browse', {
          continuation
        });

        const contGrid = nav(contData, 'continuationContents', 'gridContinuation');
        for (const item of YTMusic.getRendererItems(contGrid, ['items'])) {
          if (results.length >= limit) break;
          const parsed = playlistParser.parseLibraryPodcast(item);
          if (parsed) results.push(parsed);
        }

        continuation = YTMusic.getContinuationToken(contGrid);
      }
    }

    return results;
  }

  async getLibraryChannels(limit: number = 100, order: LibraryOrder | null = null): Promise<ArtistDetailed[]> {
    return await this.getLibraryArtistsInternal(Constants.FeMusicLibraryNonMusicAudioChannels, limit, order);
  }

  async getHistory(): Promise<HistoryItem[]> {
    const data = await this.constructRequest('browse', {
      browseId: Constants.FeMusicHistory
    });

    const results: HistoryItem[] = [];
    for (const section of YTMusic.getSectionContents(data)) {
      const played = traverseString(section, 'musicShelfRenderer', 'title', 'runs', 'text');

      for (const item of traverseList(section, 'musicShelfRenderer', 'contents')) {
        const historyItem: HistoryItem = {
          videoId: traverseString(item, 'playlistItemData', 'videoId'),
          title: traverseString(item, 'flexColumns', 'runs', 'text'),
          feedbackToken: traverseString(item, 'menu', 'menuRenderer', 'items', 'feedbackToken'),
          thumbnails: parser.parseThumbnails(item, 'thumbnail', 'thumbnails'),
          played,
          artists: []
        };

        const artistRuns: any[] = [];
        for (const col of traverseList(item, 'flexColumns')) {
          for (const run of traverseList(col, 'runs')) {
            const artistId = traverseString(run, 'browseId');
            const artistName = traverseString(run, 'text');
            if (artistId || artistName) {
              artistRuns.push(run);
            }
          }
        }

        for (const run of artistRuns) {
          historyItem.artists.push({
            artistId: traverseString(run, 'browseId') || null,
            name: traverseString(run, 'text')
          });
        }

        if (historyItem.videoId) {
          results.push(historyItem);
        }
      }
    }

    return results;
  }

  // Social
  async rateSong(videoId: string, rating: LikeStatus): Promise<any> {
    const endpoint = rating === 'Like' ? 'like/like' : rating === 'Dislike' ? 'like/dislike' : 'like/removelike';
    return await this.constructRequest(endpoint, {
      target: {
        videoId
      }
    });
  }

  async ratePlaylist(playlistId: string, rating: LikeStatus): Promise<any> {
    const endpoint = rating === 'Like' ? 'like/like' : rating === 'Dislike' ? 'like/dislike' : 'like/removelike';
    return await this.constructRequest(endpoint, {
      target: {
        playlistId
      }
    });
  }

  async subscribeArtists(channelIds: string[]): Promise<any> {
    return await this.constructRequest('subscription/subscribe', {
      channelIds
    });
  }

  async unsubscribeArtists(channelIds: string[]): Promise<any> {
    return await this.constructRequest('subscription/unsubscribe', {
      channelIds
    });
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const data = await this.constructRequest('account/account_menu', {});

    const header = traverse(data, 'actions', 'openPopupAction', 'popup',
      'multiPageMenuRenderer', 'header', 'activeAccountHeaderRenderer');

    let channelId = traverseString(header, 'channelId');
    if (!channelId) {
      channelId = traverseString(header, 'navigationEndpoint', 'browseEndpoint', 'browseId');
    }

    return {
      accountName: traverseString(header, 'accountName', 'runs', 'text'),
      channelHandle: traverseString(header, 'channelHandle', 'runs', 'text') || null,
      channelId: channelId || null,
      accountPhotoUrl: traverseString(header, 'accountPhoto', 'thumbnails', 'url')
    };
  }

  async addHistoryItem(videoId: string): Promise<boolean> {
    const response = await this.constructPlayerRequest(videoId, true);
    if (!response) return false;
    const baseUrl = traverseString(response, 'playbackTracking', 'videostatsPlaybackUrl', 'baseUrl');
    if (!baseUrl) return false;

    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    let cpn = '';
    for (let i = 0; i < 16; i++) {
      cpn += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${separator}ver=2&c=WEB_REMIX&cpn=${cpn}`;

    const headers: Record<string, string> = {
      'Origin': 'https://music.youtube.com',
      'Cookie': this.cookieString
    };

    const res = await fetch(url, {
      method: 'GET',
      headers
    });

    return res.status === 204;
  }

  async removeHistoryItems(feedbackTokens: string[]): Promise<any> {
    return await this.constructRequest('feedback', {
      feedbackTokens
    });
  }

  async editSongLibraryStatus(feedbackTokens: string[] | null = null): Promise<any> {
    return await this.constructRequest('feedback', {
      feedbackTokens: feedbackTokens || []
    });
  }

  // Channel
  async getChannel(channelId: string): Promise<ChannelFull> {
    const data = await this.constructRequest('browse', {
      browseId: channelId
    });

    const channel: ChannelFull = {
      title: traverseString(data, 'header', 'musicVisualHeaderRenderer', 'title', 'runs', 'text'),
      thumbnails: parser.parseThumbnails(data, 'header', 'musicVisualHeaderRenderer', 'thumbnail', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails'),
      episodes: null,
      podcasts: null
    };

    for (const section of YTMusic.getSectionContents(data)) {
      const browseId = traverseString(section, 'musicCarouselShelfRenderer', 'header',
        'musicCarouselShelfBasicHeaderRenderer', 'title', 'navigationEndpoint', 'browseEndpoint', 'browseId');
      const paramsVal = traverseString(section, 'musicCarouselShelfRenderer', 'header',
        'musicCarouselShelfBasicHeaderRenderer', 'title', 'navigationEndpoint', 'browseEndpoint', 'params');

      const contentSection: ChannelContentSection = {
        browseId,
        params: paramsVal,
        results: []
      };

      for (const item of traverseList(section, 'musicCarouselShelfRenderer', 'contents')) {
        const parsed = videoParser.parseArtistTopVideo(item, { name: '', artistId: null });
        if (parsed) contentSection.results.push(parsed);
      }

      if (!channel.episodes) {
        channel.episodes = contentSection;
      } else {
        channel.podcasts = contentSection;
      }
    }

    return channel;
  }

  async getChannelEpisodes(channelId: string, paramsVal: string): Promise<EpisodeDetailed[]> {
    const data = await this.constructRequest('browse', {
      browseId: channelId,
      params: paramsVal
    });

    const results: EpisodeDetailed[] = [];
    const sections = YTMusic.getSectionContents(data);
    const firstSection = sections.length > 0 ? sections[0] : null;
    const items = firstSection ? YTMusic.getRendererItems(firstSection, ['gridRenderer', 'items']) : [];
    for (const item of items) {
      results.push({
        type: 'EPISODE',
        videoId: traverseString(item, 'musicMultiRowListItemRenderer', 'playNavigationEndpoint', 'videoId'),
        name: traverseString(item, 'musicMultiRowListItemRenderer', 'title', 'runs', 'text'),
        description: traverseString(item, 'musicMultiRowListItemRenderer', 'description', 'runs', 'text'),
        duration: parser.parseDuration(traverseString(item, 'musicMultiRowListItemRenderer', 'timeDescription', 'runs', 'text')),
        date: traverseString(item, 'musicMultiRowListItemRenderer', 'timeDescription', 'runs', 'text'),
        thumbnails: parser.parseThumbnails(item, 'musicMultiRowListItemRenderer', 'thumbnail', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
      });
    }

    return results;
  }

  async getPodcast(playlistId: string, limit: number = 100): Promise<PodcastFull> {
    let finalId = playlistId;
    if (!playlistId.startsWith('MPSP')) {
      finalId = 'MPSP' + playlistId;
    }

    const data = await this.constructRequest('browse', {
      browseId: finalId
    });

    const header = traverse(data, 'twoColumnBrowseResultsRenderer', 'tabs',
      'tabRenderer', 'content', 'sectionListRenderer', 'contents', 'musicResponsiveHeaderRenderer');

    const podcast: PodcastFull = {
      author: traverseString(header, 'straplineTextOne', 'runs', 'text'),
      title: traverseString(header, 'title', 'runs', 'text'),
      description: traverseString(header, 'description', 'runs', 'text'),
      thumbnails: parser.parseThumbnails(header, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails'),
      episodes: []
    };

    const episodes = traverseList(data, 'twoColumnBrowseResultsRenderer', 'secondaryContents',
      'sectionListRenderer', 'contents', 'musicShelfRenderer', 'contents');

    for (const item of episodes) {
      if (podcast.episodes.length >= limit) break;
      podcast.episodes.push({
        type: 'EPISODE',
        videoId: traverseString(item, 'musicMultiRowListItemRenderer', 'playNavigationEndpoint', 'videoId'),
        name: traverseString(item, 'musicMultiRowListItemRenderer', 'title', 'runs', 'text'),
        description: traverseString(item, 'musicMultiRowListItemRenderer', 'description', 'runs', 'text'),
        duration: parser.parseDuration(traverseString(item, 'musicMultiRowListItemRenderer', 'timeDescription', 'runs', 'text')),
        date: traverseString(item, 'musicMultiRowListItemRenderer', 'timeDescription', 'runs', 'text'),
        thumbnails: parser.parseThumbnails(item, 'musicMultiRowListItemRenderer', 'thumbnail', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
      });
    }

    return podcast;
  }

  async getEpisode(videoId: string): Promise<EpisodeDetailed> {
    let finalId = videoId;
    if (!videoId.startsWith('MPED')) {
      finalId = 'MPED' + videoId;
    }

    const data = await this.constructRequest('browse', {
      browseId: finalId
    });

    const header = traverse(data, 'twoColumnBrowseResultsRenderer', 'tabs',
      'tabRenderer', 'content', 'sectionListRenderer', 'contents', 'musicResponsiveHeaderRenderer');

    return {
      type: 'EPISODE',
      videoId: videoId.startsWith('MPED') ? videoId.substring(4) : videoId,
      name: traverseString(header, 'title', 'runs', 'text'),
      description: traverseString(data, 'twoColumnBrowseResultsRenderer', 'secondaryContents',
        'sectionListRenderer', 'contents', 'musicDescriptionShelfRenderer', 'description', 'runs', 'text'),
      duration: parser.parseDuration(traverseString(header, 'subtitle', 'runs', 'text')),
      date: traverseString(header, 'subtitle', 'runs', 'text'),
      thumbnails: parser.parseThumbnails(header, 'thumbnail', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
    };
  }

  async getEpisodesPlaylist(playlistId: string = 'RDPN'): Promise<PodcastFull> {
    let finalId = playlistId;
    if (!playlistId.startsWith('VL')) {
      finalId = 'VL' + playlistId;
    }

    return await this.getPodcast(finalId);
  }
}
