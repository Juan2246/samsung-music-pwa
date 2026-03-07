// API Route: /api/album-parser
// Parses Spotify and YouTube Music Album/Playlist URLs and returns a tracklist.

import SpotifyWebApi from 'spotify-web-api-node';
import fetchNode from 'node-fetch';
const { getPreview, getTracks } = require('spotify-url-info')(fetchNode);
import { Innertube, UniversalCache } from 'youtubei.js';

// 1. Initialize Spotify API
// Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local
const spotifyApi = new SpotifyWebApi({
  clientId: (process.env.SPOTIFY_CLIENT_ID || '').trim(),
  clientSecret: (process.env.SPOTIFY_CLIENT_SECRET || '').trim(),
});

let spotifyTokenTime = 0;

async function getSpotifyToken() {
  if (!process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID.trim() === '') return false;
  
  if (Date.now() > spotifyTokenTime) {
    try {
      const data = await spotifyApi.clientCredentialsGrant();
      spotifyApi.setAccessToken(data.body['access_token']);
      // Token expires in 3600 seconds. Set refresh time to 3500 just to be safe.
      spotifyTokenTime = Date.now() + (data.body['expires_in'] - 100) * 1000;
      return true;
    } catch (err) {
      console.error('Spotify Auth Error:', err.message);
      return false;
    }
  }
  return true;
}

// 2. Initialize YT Music API (Innertube)
let yt = null;
let ytInited = false;
async function initYT() {
  if (!ytInited) {
    yt = await Innertube.create({ cache: new UniversalCache(true) });
    ytInited = true;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return Response.json({ error: 'url parameter is required' }, { status: 400 });
  }

  try {
    const isSpotify = url.includes('spotify.com');
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.youtube.com');

    let tracks = [];
    let albumMetadata = {
      title: 'Unknown Playlist',
      artist: 'Unknown Artist',
      coverUrl: null,
      totalTracks: 0,
    };

    // ─────────────────────────────────────────────────────────
    // SPOTIFY PARSER
    // ─────────────────────────────────────────────────────────
    if (isSpotify) {
      const hasAuth = await getSpotifyToken();
      
      const isAlbum = url.includes('/album/');
      const isPlaylist = url.includes('/playlist/');

      if (hasAuth) {
        // ---- METHOD A: OFFICIAL API ----
        if (isAlbum) {
          const id = url.split('/album/')[1].split('?')[0];
          const { body: album } = await spotifyApi.getAlbum(id);
          
          albumMetadata = {
            title: album.name,
            artist: album.artists.map(a => a.name).join(', '),
            coverUrl: album.images?.[0]?.url || null,
            totalTracks: album.total_tracks,
          };

          let trackItems = album.tracks.items;
          let offset = trackItems.length;
          while (offset < album.tracks.total) {
            const { body: moreTracks } = await spotifyApi.getAlbumTracks(id, { offset, limit: 50 });
            trackItems = trackItems.concat(moreTracks.items);
            offset += moreTracks.items.length;
          }

          tracks = trackItems.map(track => ({
            id: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: albumMetadata.title,
            coverUrl: albumMetadata.coverUrl,
            duration: track.duration_ms,
          }));
        } else if (isPlaylist) {
          const id = url.split('/playlist/')[1].split('?')[0];
          const { body: playlist } = await spotifyApi.getPlaylist(id);

          albumMetadata = {
            title: playlist.name,
            artist: playlist.owner.display_name,
            coverUrl: playlist.images?.[0]?.url || null,
            totalTracks: playlist.tracks.total,
          };

          let trackItems = playlist.tracks.items.filter(item => item.track);
          let offset = playlist.tracks.items.length;
          while (offset < playlist.tracks.total) {
            const { body: moreTracks } = await spotifyApi.getPlaylistTracks(id, { offset, limit: 100 });
            const validItems = moreTracks.items.filter(item => item.track);
            trackItems = trackItems.concat(validItems);
            offset += moreTracks.items.length; // Spotify API uses total requested size for pagination step
          }

          tracks = trackItems.map(item => ({
            id: item.track.id,
            title: item.track.name,
            artist: item.track.artists.map(a => a.name).join(', '),
            album: item.track.album.name,
            coverUrl: item.track.album.images?.[0]?.url || albumMetadata.coverUrl,
            duration: item.track.duration_ms,
          }));
        } else {
          return Response.json({ error: 'Unsupported Spotify URL format for Official API' }, { status: 400 });
        }
      } else {
        // ---- METHOD B: ANONYMOUS SCRAPER (spotify-url-info) ----
        try {
          const preview = await getPreview(url);
          const rawTracks = await getTracks(url);

          albumMetadata = {
            title: preview.title || 'Spotify Playlist/Album',
            artist: preview.artist || 'Spotify',
            coverUrl: preview.image || null,
            totalTracks: rawTracks ? rawTracks.length : 0,
          };

          if (!rawTracks || rawTracks.length === 0) {
            return Response.json({ error: 'No se encontraron las canciones. Intenta de nuevo más tarde o revisa si el enlace es público.' }, { status: 404 });
          }

          tracks = rawTracks.map(track => ({
            id: track.id || track.uri || track.name,
            title: track.name,
            artist: track.artist || albumMetadata.artist, // spotify-url-info exposes 'artist' as string, not array
            album: albumMetadata.title,
            coverUrl: albumMetadata.coverUrl,
            duration: track.duration || 0,
          }));
          
          if (tracks.length >= 100) {
              albumMetadata.isTruncated = true; // Flagear a la UI
          }

        } catch (scrapingErr) {
          console.error("Anonymous Spotify scraping failed:", scrapingErr);
          return Response.json(
            { error: 'Spotify restringió el análisis público en este enlace. Por favor añade tus claves en .env.local, o usa un enlace de YouTube Music.' }, 
            { status: 403 }
          );
        }
      }
    } 
    // ─────────────────────────────────────────────────────────
    // YOUTUBE MUSIC / YOUTUBE PARSER
    // ─────────────────────────────────────────────────────────
    else if (isYouTube) {
      const playlistId = new URL(url).searchParams.get('list');

      if (!playlistId) {
        return Response.json({ error: 'La URL no contiene un ID de playlist (?list=...)' }, { status: 400 });
      }

      await initYT();

      try {
        const isYTMusic = url.includes('music.youtube.com');
        // Fetch playlist using correct inner module depending on URL
        let list;
        try {
          // If it's a YT Music designated playlist or album ID (OLAK5uy_)
          if (isYTMusic || playlistId.startsWith('OLAK')) {
            list = await yt.music.getPlaylist(playlistId);
          } else {
            // General YouTube Playlist
            list = await yt.getPlaylist(playlistId);
          }
        } catch(fallbackErr) {
          // Fallback to general getPlaylist if music fails, or vice versa
          list = await yt.getPlaylist(playlistId);
        }

        if (!list || !list.items) {
           return Response.json({ error: 'No se encontraron las canciones de esta Playlist/Álbum' }, { status: 404 });
        }

        albumMetadata = {
          title: list.header?.title?.text || list.info?.title || 'YouTube Playlist',
          artist: list.header?.author?.name || list.info?.author?.name || 'YouTube',
          coverUrl: list.header?.thumbnails?.[list.header.thumbnails.length - 1]?.url 
                   || list.info?.thumbnails?.[list.info.thumbnails.length - 1]?.url || null,
          totalTracks: list.info?.total_items || list.items.length,
        };

        let rawItems = list.items;
        let hasMore = list.has_continuation;
        let currentList = list;

        // Bucle infinito: Paginación para extraer miles de canciones sin cortes de 100-en-100
        while (hasMore) {
          try {
            currentList = await currentList.getContinuation();
            rawItems = rawItems.concat(currentList.items);
            hasMore = currentList.has_continuation;
          } catch(e) {
            console.warn('YT Continuation ended or failed:', e.message);
            break;
          }
        }

        tracks = rawItems.filter(v => v.type === 'Video' || v.type === 'MusicTrack' || v.id).map((video, index) => {
          let parsedArtist = albumMetadata.artist;
          let parsedTitle = video.title?.text || video.title || 'Unknown';

          if (parsedTitle.includes(' - ')) {
            const parts = parsedTitle.split(' - ');
            parsedArtist = parts[0].trim();
            parsedTitle = parts.slice(1).join(' - ').trim();
          } else if (video.author?.name || video.authors?.[0]?.name) {
            parsedArtist = video.author?.name || video.authors?.[0]?.name;
          }

          // Force ID uniqueness to prevent React keys collision ("Encountered two children with the same key")
          return {
            id: `${video.id}-${index}`, 
            title: parsedTitle,
            artist: parsedArtist,
            album: video.album?.name || albumMetadata.title,
            coverUrl: video.thumbnails?.[video.thumbnails.length - 1]?.url || albumMetadata.coverUrl,
            videoId: video.id,
            duration: video.duration?.seconds ? (video.duration.seconds * 1000) : 0, 
          };
        });

      } catch(ytErr) {
          console.error('YouTube Parser failed:', ytErr);
          return Response.json({ error: 'Fallo al extraer YouTube: ' + ytErr.message }, { status: 500 });
      }
    } else {
      return Response.json({ error: 'Unsupported URL provider. Use Spotify or YouTube.' }, { status: 400 });
    }

    if (tracks.length === 0) {
      return Response.json({ error: 'No tracks found in the provided URL' }, { status: 404 });
    }

    return Response.json({ album: albumMetadata, tracks });

  } catch (err) {
    console.error('Album Parser Error:', err);
    return Response.json({ error: `Parsing failed: ${err.message}` }, { status: 500 });
  }
}
