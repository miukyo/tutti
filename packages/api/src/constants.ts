export const Constants = {
  FeMusicHome: 'FEmusic_home',
  FeMusicExplore: 'FEmusic_explore',
  FeMusicLibrary: 'FEmusic_library_landing',
  FeMusicMoodsAndGenres: 'FEmusic_moods_and_genres',
  FeMusicMoodsAndGenresCategory: 'FEmusic_moods_and_genres_category',
  FeMusicLikedPlaylists: 'FEmusic_liked_playlists',
  FeMusicLikedVideos: 'FEmusic_liked_videos',
  FeMusicLikedAlbums: 'FEmusic_liked_albums',
  FeMusicLibraryTrackArtists: 'FEmusic_library_corpus_track_artists',
  FeMusicLibraryArtists: 'FEmusic_library_corpus_artists',
  FeMusicLibraryNonMusicAudioList: 'FEmusic_library_non_music_audio_list',
  FeMusicLibraryNonMusicAudioChannels: 'FEmusic_library_non_music_audio_channels_list',
  FeMusicHistory: 'FEmusic_history',
  FeMusicTastebuilder: 'FEmusic_tastebuilder',
} as const;

export const PageType = {
  MusicPageTypeAlbum: 'MUSIC_PAGE_TYPE_ALBUM',
  MusicPageTypePlaylist: 'MUSIC_PAGE_TYPE_PLAYLIST',
  MusicVideoTypeOmv: 'MUSIC_VIDEO_TYPE_OMV',
} as const;

export const LibraryOrderParams = {
  AtoZ: 'ggMGKgQIARAA',
  ZtoA: 'ggMGKgQIARAB',
  RecentlyAdded: 'ggMGKgQIABAB',
} as const;
