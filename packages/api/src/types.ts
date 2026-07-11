export interface BaseSearchResult {
  type: string;
  name: string;
  thumbnails: Thumbnail[];
  category?: string | null;
}

export interface Thumbnail {
  url: string;
  width: number;
  height: number;
}

export interface ArtistBasic {
  artistId: string | null;
  name: string;
}

export interface AlbumBasic {
  albumId: string;
  name: string;
}

export interface SongDetailed extends BaseSearchResult {
  type: 'SONG';
  videoId: string;
  artist: ArtistBasic;
  album?: AlbumBasic | null;
  duration?: number | null;
}

export interface VideoDetailed extends BaseSearchResult {
  type: 'VIDEO';
  videoId: string;
  artist: ArtistBasic;
  duration?: number | null;
  setVideoId?: string | null;
}

export interface ArtistDetailed extends BaseSearchResult {
  type: 'ARTIST';
  artistId: string;
}

export interface AlbumDetailed extends BaseSearchResult {
  type: 'ALBUM';
  albumId: string;
  playlistId: string;
  artist: ArtistBasic;
  year?: number | null;
}

export interface PlaylistDetailed extends BaseSearchResult {
  type: 'PLAYLIST';
  playlistId: string;
  artist: ArtistBasic;
  editable?: boolean;
}

export interface EpisodeDetailed extends BaseSearchResult {
  type: 'EPISODE';
  videoId: string;
  description: string;
  duration?: number | null;
  date?: string | null;
}

export type SearchResult =
  | SongDetailed
  | VideoDetailed
  | ArtistDetailed
  | AlbumDetailed
  | PlaylistDetailed
  | EpisodeDetailed;

export interface SongFull {
  type: 'SONG';
  videoId: string;
  name: string;
  artist: ArtistBasic;
  duration: number;
  thumbnails: Thumbnail[];
  streamManifest?: StreamManifest | null;
}

export interface VideoFull {
  type: 'VIDEO';
  videoId: string;
  name: string;
  artist: ArtistBasic;
  duration: number;
  thumbnails: Thumbnail[];
  unlisted: boolean;
  familySafe: boolean;
  paid: boolean;
  tags: string[];
}

export interface UpNextsDetails {
  type: 'SONG';
  videoId: string;
  title: string;
  artists: string;
  duration: string;
  thumbnail: string;
}

export interface ArtistFull {
  artistId: string;
  name: string;
  type: 'ARTIST';
  description: string;
  thumbnails: Thumbnail[];
  topSongs: SongDetailed[];
  topAlbums: AlbumDetailed[];
  topSingles: AlbumDetailed[];
  topVideos: VideoDetailed[];
  playlists: PlaylistDetailed[];
  featuredOn: PlaylistDetailed[];
  similarArtists: ArtistDetailed[];
}

export interface AlbumFull {
  type: 'ALBUM';
  albumId: string;
  playlistId: string;
  name: string;
  artist: ArtistBasic;
  year?: number | null;
  thumbnails: Thumbnail[];
  songs: SongDetailed[];
}

export interface PlaylistFull {
  type: 'PLAYLIST';
  playlistId: string;
  name: string;
  artist: ArtistBasic;
  videoCount: number;
  thumbnails: Thumbnail[];
  editable?: boolean;
}

export interface HomeSection {
  title: string;
  contents: SearchResult[];
}

export type LikeStatus = 'Indifferent' | 'Like' | 'Dislike';

export type LibraryOrder = 'AtoZ' | 'ZtoA' | 'RecentlyAdded';

export type SearchFilter =
  | 'Songs'
  | 'Videos'
  | 'Albums'
  | 'Artists'
  | 'Playlists'
  | 'CommunityPlaylists'
  | 'FeaturedPlaylists'
  | 'Profiles'
  | 'Podcasts'
  | 'Episodes';

export type SearchScope = 'Library' | 'Uploads';

export interface MoodCategory {
  title: string;
  params: string;
}

export interface ExploreResult {
  newReleases: AlbumDetailed[];
  moodsAndGenres: MoodCategory[];
  trending: SearchResult[];
  newMusicVideos: VideoDetailed[];
}

export interface UserInfo {
  name: string;
  videos?: UserContentSection | null;
  playlists?: UserContentSection | null;
}

export interface UserContentSection {
  browseId: string;
  params: string;
  results: SearchResult[];
}

export interface AccountInfo {
  accountName: string;
  channelHandle?: string | null;
  channelId?: string | null;
  accountPhotoUrl: string;
}

export interface HistoryItem {
  videoId: string;
  title: string;
  artists: ArtistBasic[];
  thumbnails: Thumbnail[];
  feedbackToken?: string | null;
  played?: string | null;
}

export interface ChannelFull {
  title: string;
  thumbnails: Thumbnail[];
  episodes?: ChannelContentSection | null;
  podcasts?: ChannelContentSection | null;
}

export interface ChannelContentSection {
  browseId: string;
  params: string;
  results: SearchResult[];
}

export interface PodcastFull {
  author: string;
  title: string;
  description: string;
  thumbnails: Thumbnail[];
  episodes: EpisodeDetailed[];
}

export interface IStreamInfo {
  type: 'audio' | 'video' | 'muxed';
  url: string;
  container: string;
  size: number;
  bitrate: number;
}

export interface IAudioStreamInfo extends IStreamInfo {
  audioCodec: string;
  audioLanguage?: Language | null;
  isAudioLanguageDefault?: boolean | null;
}

export interface IVideoStreamInfo extends IStreamInfo {
  videoCodec: string;
  videoQuality: string;
  videoResolution: Resolution;
  isVideoUpscaled: boolean;
}

export interface Language {
  code: string;
  name: string;
}

export interface Resolution {
  width: number;
  height: number;
}

export class StreamManifest {
  streams: IStreamInfo[];

  constructor(streams: IStreamInfo[]) {
    this.streams = streams;
  }

  getAudioStreams(): IAudioStreamInfo[] {
    return this.streams.filter(
      (s): s is IAudioStreamInfo => s.type === 'audio' || s.type === 'muxed'
    );
  }

  getVideoStreams(): IVideoStreamInfo[] {
    return this.streams.filter(
      (s): s is IVideoStreamInfo => s.type === 'video' || s.type === 'muxed'
    );
  }

  getMuxedStreams(): IAudioStreamInfo[] {
    return this.streams.filter(
      (s): s is IAudioStreamInfo => s.type === 'muxed'
    );
  }

  getAudioOnlyStreams(): IAudioStreamInfo[] {
    return this.streams.filter(
      (s): s is IAudioStreamInfo => s.type === 'audio'
    );
  }

  getVideoOnlyStreams(): IVideoStreamInfo[] {
    return this.streams.filter(
      (s): s is IVideoStreamInfo => s.type === 'video'
    );
  }
}

export interface LyricWord {
  startTimeMs: number;
  text: string;
  durationMs?: number;
  isBackground?: boolean;
}

export interface LyricLine {
  startTimeMs?: number;
  endTimeMs?: number;
  durationMs?: number;
  text: string;
  words?: LyricWord[];
  isBackground?: boolean;
  isInstrumental?: boolean;
  isFaked?: boolean;
  romanizedText?: string;
}

export interface LyricResult {
  synced: boolean;
  lines: LyricLine[];
  source: string;
  wordSynced?: boolean;
}
