# @app/api Reference (Node.js/TypeScript)

## Setup

```typescript
import { YTMusic } from '@app/api';

const yt = new YTMusic();
await yt.initialize();
// Optional: cookies, gl, hl
// await yt.initialize(cookies, 'US', 'en');
```

---

## Search

### `getSearchSuggestions(query: string) => Promise<string[]>`

```json
["oasis wonderwall", "oasis", "oasis live"]
```

### `search(query: string, filter?: SearchFilter, scope?: SearchScope, limit?: number, ignoreSpelling?: boolean) => Promise<SearchResult[]>`

Unified search method. Returns mixed results — each item has `type` one of: `"SONG"`, `"VIDEO"`, `"ARTIST"`, `"ALBUM"`, `"PLAYLIST"`, `"EPISODE"`. Items also carry a `category` field (e.g. `"Top result"`, `"Songs"`, `"Albums"`) indicating which shelf they appeared in.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `query` | `string` | required | Search text |
| `filter` | `SearchFilter` | `null` | Restrict to a result category (see below) |
| `scope` | `SearchScope` | `null` | `"Library"` or `"Uploads"` |
| `limit` | `number` | `20` | Max results (applied per shelf when filtered) |
| `ignoreSpelling` | `boolean` | `false` | Disable "Did you mean?" corrections |

**Validation:**
- `Uploads` scope + any filter → throws Error
- `Library` scope + `CommunityPlaylists` or `FeaturedPlaylists` → throws Error

**Mixed results (no filter):**

```json
[
  { "type": "SONG", "name": "Wonderwall", "videoId": "hpSrLjc5SMs",
    "category": "Top result",
    "thumbnails": [{ "url": "...", "width": 60, "height": 60 }],
    "artist": { "artistId": "UC...", "name": "Oasis" },
    "album": { "albumId": "MPRE...", "name": "(What's the Story) Morning Glory?" },
    "duration": 258 },
  { "type": "ARTIST", "name": "Oasis", "category": "Artists",
    "artistId": "UCmMUZbaYdNH4bDm9K1B3KJw" }
]
```

### `SearchFilter`

One of: `'Songs' | 'Videos' | 'Albums' | 'Artists' | 'Playlists' | 'CommunityPlaylists' | 'FeaturedPlaylists' | 'Profiles' | 'Podcasts' | 'Episodes'`

### `SearchScope`

One of: `'Library' | 'Uploads'`

---

**Deprecated / Helper wrappers:**

*   `searchSongs(query: string) => Promise<SongDetailed[]>`
*   `searchVideos(query: string) => Promise<VideoDetailed[]>`
*   `searchArtists(query: string) => Promise<ArtistDetailed[]>`
*   `searchAlbums(query: string) => Promise<AlbumDetailed[]>`
*   `searchPlaylists(query: string) => Promise<PlaylistDetailed[]>`

---

## Song / Video / Stream

### `getSong(videoId: string) => Promise<SongFull>`

```json
{ "type": "SONG", "videoId": "hpSrLjc5SMs", "name": "Wonderwall",
  "artist": { "artistId": "UC...", "name": "Oasis" },
  "duration": 258,
  "thumbnails": [{ "url": "...", "width": 120, "height": 120 }],
  "streamManifest": { "streams": [...] } }
```

### `getVideo(videoId: string) => Promise<VideoFull>`

```json
{ "type": "VIDEO", "videoId": "hpSrLjc5SMs", "name": "Wonderwall (Official Video)",
  "artist": { "artistId": "UC...", "name": "Oasis" },
  "duration": 282, "unlisted": false, "familySafe": true, "paid": false,
  "tags": ["music", "oasis"],
  "thumbnails": [...] }
```

### `getStreamManifest(videoId: string) => Promise<StreamManifest>`

```json
{ "streams": [
    { "type": "audio", "url": "https://...", "container": "mp4",
      "size": 4194304, "bitrate": 128000, "audioCodec": "mp4a.40.2" },
    { "type": "video", "url": "https://...", "container": "webm",
      "size": 15728640, "bitrate": 2000000, "videoCodec": "vp9",
      "videoQuality": "720p", "videoResolution": { "width": 1280, "height": 720 },
      "isVideoUpscaled": false }
  ]}
```

### `getUpNexts(videoId: string) => Promise<UpNextsDetails[]>`

```json
[{ "type": "SONG", "videoId": "abc123def45", "title": "Champagne Supernova",
   "artists": "Oasis", "duration": "7:27", "thumbnail": "https://..." }]
```

### `getLyrics(videoId: string) => Promise<string[] | null>`

```json
["Today is gonna be the day", "That they're gonna throw it back to you"]
```

---

## Artist

### `getArtist(artistId: string) => Promise<ArtistFull>`

```json
{ "artistId": "UCmMUZ...", "name": "Oasis", "type": "ARTIST",
  "thumbnails": [...],
  "topSongs": [{ "type": "SONG", "name": "Wonderwall", ... }],
  "topAlbums": [{ "type": "ALBUM", "name": "(What's the Story) Morning Glory?", ... }],
  "topSingles": [{ "type": "ALBUM", "name": "Some Might Say", ... }],
  "topVideos": [{ "type": "VIDEO", "name": "Wonderwall (Official Video)", ... }],
  "featuredOn": [{ "type": "PLAYLIST", "name": "90s Anthems", ... }],
  "similarArtists": [{ "type": "ARTIST", "name": "Blur", "artistId": "UC..." }] }
```

### `getArtistSongs(artistId: string) => Promise<SongDetailed[]>`
### `getArtistAlbums(artistId: string) => Promise<AlbumDetailed[]>`

---

## Album

### `getAlbum(albumId: string) => Promise<AlbumFull>`

```json
{ "type": "ALBUM", "albumId": "MPREb_4pL8gzRtw1p", "playlistId": "OLAK5uy_...",
  "name": "(What's the Story) Morning Glory?",
  "artist": { "artistId": "UC...", "name": "Oasis" },
  "year": 1995,
  "thumbnails": [{ "url": "...", "width": 300, "height": 300 }],
  "songs": [{ "type": "SONG", "name": "Hello", "videoId": "...",
              "duration": 261, "thumbnails": [...] }] }
```

---

## Playlist

### `getPlaylist(playlistId: string) => Promise<PlaylistFull>`
### `getPlaylistVideos(playlistId: string) => Promise<VideoDetailed[]>`
### `getLikedSongs() => Promise<PlaylistFull>`
### `getSavedEpisodes() => Promise<PlaylistFull>`

---

## Home / Explore

### `getHomeSections() => Promise<HomeSection[]>`
### `getMoodCategories() => Promise<MoodCategory[]>`
### `getMoodPlaylists(moodParams: string) => Promise<PlaylistDetailed[]>`
### `getExplore() => Promise<ExploreResult>`

---

## User

### `getUser(channelId: string) => Promise<UserInfo>`
### `getUserPlaylists(channelId: string, paramsVal: string) => Promise<PlaylistDetailed[]>`

---

## Library

### `getLibraryPlaylists(limit?: number) => Promise<PlaylistDetailed[]>`
### `getLibrarySongs(limit?: number, order?: LibraryOrder) => Promise<SongDetailed[]>`
### `getLibraryAlbums(limit?: number, order?: LibraryOrder) => Promise<AlbumDetailed[]>`
### `getLibraryArtists(limit?: number, order?: LibraryOrder) => Promise<ArtistDetailed[]>`
### `getLibrarySubscriptions(limit?: number, order?: LibraryOrder) => Promise<ArtistDetailed[]>`
### `getLibraryPodcasts(limit?: number, order?: LibraryOrder) => Promise<PlaylistDetailed[]>`
### `getLibraryChannels(limit?: number, order?: LibraryOrder) => Promise<ArtistDetailed[]>`

### `LibraryOrder`

One of: `'AtoZ' | 'ZtoA' | 'RecentlyAdded'`

---

## History

### `addHistoryItem(videoId: string) => Promise<boolean>`
### `removeHistoryItems(feedbackTokens: string[]) => Promise<any>`
### `editSongLibraryStatus(feedbackTokens?: string[] | null) => Promise<any>`
### `getHistory() => Promise<HistoryItem[]>`

---

## Ratings

### `rateSong(videoId: string, rating: LikeStatus) => Promise<any>`
### `ratePlaylist(playlistId: string, rating: LikeStatus) => Promise<any>`

### `LikeStatus`

One of: `'Like' | 'Dislike' | 'Indifferent'`

---

## Subscriptions

### `subscribeArtists(channelIds: string[]) => Promise<any>`
### `unsubscribeArtists(channelIds: string[]) => Promise<any>`

---

## Account

### `getAccountInfo() => Promise<AccountInfo>`

---

## Playlist CRUD

### `createPlaylist(title: string, description: string, privacyStatus?: string, videoIds?: string[] | null) => Promise<string>`
### `deletePlaylist(playlistId: string) => Promise<any>`
### `editPlaylist(playlistId: string, title?: string | null, description?: string | null, privacyStatus?: string | null) => Promise<any>`
### `addPlaylistItems(playlistId: string, videoIds: string[], sourcePlaylist?: string | null, duplicates?: boolean) => Promise<any>`
### `removePlaylistItems(playlistId: string, videos: { setVideoId: string; removedVideoId: string }[]) => Promise<any>`

---

## Podcasts

### `getChannel(channelId: string) => Promise<ChannelFull>`
### `getChannelEpisodes(channelId: string, paramsVal: string) => Promise<EpisodeDetailed[]>`
### `getPodcast(playlistId: string, limit?: number) => Promise<PodcastFull>`
### `getEpisode(videoId: string) => Promise<EpisodeDetailed>`
### `getEpisodesPlaylist(playlistId?: string) => Promise<PodcastFull>`
