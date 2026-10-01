// API Route: /api/album-parser
// Parses Spotify and YouTube Music Album/Playlist URLs and returns a tracklist.

import SpotifyWebApi from 'spotify-web-api-node';
import spotifyUrlInfo from 'spotify-url-info';
import { Innertube, UniversalCache } from 'youtubei.js';
import { jsonError } from '@/lib/server/http';

// Node 18+ trae fetch nativo: no hace falta node-fetch.
const { getPreview, getTracks } = spotifyUrlInfo(globalThis.fetch);

const MAX_URL_LENGTH = 500;
const SPOTIFY_HOSTS = new Set(['open.spotify.com', 'play.spotify.com']);
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const YOUTUBE_LIST_ID = /^[A-Za-z0-9_-]{10,100}$/;
// Tope de páginas de continuación de YouTube (~100 pistas por página).
const MAX_YT_PAGES = 50;

// 1. Initialize Spotify API
// Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local
const spotifyApi = new SpotifyWebApi({
  clientId: (process.env.SPOTIFY_CLIENT_ID || '').trim(),
  clientSecret: (process.env.SPOTIFY_CLIENT_SECRET || '').trim(),
});

let spotifyTokenTime = 0;

async function getSpotifyToken() {
  const hasKeys = (process.env.SPOTIFY_CLIENT_ID || '').trim() && (process.env.SPOTIFY_CLIENT_SECRET || '').trim();
  if (!hasKeys) return false;

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
let ytPromise = null;
function getYT() {
  // Se guarda la promesa para que dos peticiones simultáneas no creen dos clientes.
  if (!ytPromise) {
    ytPromise = Innertube.create({ cache: new UniversalCache(true) }).catch((err) => {
      ytPromise = null;
      throw err;
    });
  }
  return ytPromise;
}

/**
 * Valida la URL y extrae lo necesario. Devuelve { error } si no es un enlace soportado.
 */
function parseSourceUrl(raw) {
  if (!raw || raw.length > MAX_URL_LENGTH) return { error: 'Pega el enlace de un álbum o playlist' };

  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: 'El enlace no es una URL válida' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'El enlace no es una URL válida' };

  const host = url.hostname.toLowerCase();

  if (SPOTIFY_HOSTS.has(host)) {
    // Admite /album/ID, /playlist/ID y variantes como /intl-es/album/ID
    const parts = url.pathname.split('/').filter(Boolean);
    const kindIndex = parts.findIndex((p) => p === 'album' || p === 'playlist');
    const id = kindIndex >= 0 ? parts[kindIndex + 1] : null;
    if (!id || !SPOTIFY_ID.test(id)) {
      return { error: 'Solo se admiten enlaces de álbumes o playlists de Spotify' };
    }
    return { provider: 'spotify', kind: parts[kindIndex], id, href: `https://open.spotify.com/${parts[kindIndex]}/${id}` };
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const playlistId = url.searchParams.get('list');
    if (!playlistId) return { error: 'La URL no contiene un ID de playlist (?list=...)' };
    if (!YOUTUBE_LIST_ID.test(playlistId)) return { error: 'El ID de playlist de YouTube no es válido' };
    return { provider: 'youtube', playlistId, isYTMusic: host === 'music.youtube.com' };
  }

  return { error: 'Enlace no soportado. Usa un álbum/playlist de Spotify, YouTube o YouTube Music.' };
}

// ─────────────────────────────────────────────────────────
// SPOTIFY PARSER
// ─────────────────────────────────────────────────────────

// ---- METHOD A: OFFICIAL API ----
async function parseSpotifyAlbum(id) {
  const { body: album } = await spotifyApi.getAlbum(id);

  const albumMetadata = {
    title: album.name,
    artist: album.artists.map(a => a.name).join(', '),
    coverUrl: album.images?.[0]?.url || null,
    totalTracks: album.total_tracks,
  };

  let trackItems = album.tracks.items;
  let offset = trackItems.length;
  while (offset < album.tracks.total) {
    const { body: moreTracks } = await spotifyApi.getAlbumTracks(id, { offset, limit: 50 });
    if (moreTracks.items.length === 0) break; // evita un bucle infinito si la API devuelve menos de lo anunciado
    trackItems = trackItems.concat(moreTracks.items);
    offset += moreTracks.items.length;
  }

  const tracks = trackItems.map(track => ({
    id: track.id,
    title: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: albumMetadata.title,
    coverUrl: albumMetadata.coverUrl,
    duration: track.duration_ms,
  }));

  return { albumMetadata, tracks };
}

async function parseSpotifyPlaylist(id) {
  const { body: playlist } = await spotifyApi.getPlaylist(id);

  const albumMetadata = {
    title: playlist.name,
    artist: playlist.owner.display_name,
    coverUrl: playlist.images?.[0]?.url || null,
    totalTracks: playlist.tracks.total,
  };

  let trackItems = playlist.tracks.items.filter(item => item.track);
  let offset = playlist.tracks.items.length;
  while (offset < playlist.tracks.total) {
    const { body: moreTracks } = await spotifyApi.getPlaylistTracks(id, { offset, limit: 100 });
    if (moreTracks.items.length === 0) break; // evita un bucle infinito
    const validItems = moreTracks.items.filter(item => item.track);
    trackItems = trackItems.concat(validItems);
    offset += moreTracks.items.length; // Spotify API uses total requested size for pagination step
  }

  const tracks = trackItems.map((item, index) => ({
    id: `${item.track.id}-${index}`, // una playlist puede repetir canciones: id único para React
    title: item.track.name,
    artist: item.track.artists.map(a => a.name).join(', '),
    album: item.track.album.name,
    coverUrl: item.track.album.images?.[0]?.url || albumMetadata.coverUrl,
    duration: item.track.duration_ms,
  }));

  return { albumMetadata, tracks };
}

// ---- METHOD B: ANONYMOUS SCRAPER (spotify-url-info) ----
async function parseSpotifyAnonymous(href) {
  const preview = await getPreview(href);
  const rawTracks = await getTracks(href);

  const albumMetadata = {
    title: preview.title || 'Spotify Playlist/Album',
    artist: preview.artist || 'Spotify',
    coverUrl: preview.image || null,
    totalTracks: rawTracks ? rawTracks.length : 0,
  };

  const tracks = (rawTracks || []).map((track, index) => ({
    id: `${track.id || track.uri || track.name}-${index}`,
    title: track.name,
    artist: track.artist || albumMetadata.artist, // spotify-url-info exposes 'artist' as string, not array
    album: albumMetadata.title,
    coverUrl: albumMetadata.coverUrl,
    duration: track.duration || 0,
  }));

  if (tracks.length >= 100) {
    albumMetadata.isTruncated = true; // Flagear a la UI
  }

  return { albumMetadata, tracks };
}

function spotifyStatus(err) {
  return err?.statusCode || err?.body?.error?.status;
}

function spotifyErrorResponse(err) {
  const status = spotifyStatus(err);
  console.error('Spotify API error:', status, JSON.stringify(err?.body?.error ?? err?.body ?? err?.message));
  if (status === 404) {
    return jsonError(
      'Spotify no encontró ese álbum o playlist. Puede ser privada, o una playlist editorial/algorítmica de Spotify, que la API ya no entrega a apps nuevas.',
      404
    );
  }
  if (status === 401 || status === 403) {
    return jsonError('Spotify rechazó la petición a la API oficial. Revisa tus claves en .env.local y que la cuenta dueña de la app tenga Premium activo (requisito de Spotify desde 2026).', 502);
  }
  if (status === 429) {
    return jsonError('Spotify está limitando las peticiones. Espera un momento e intenta de nuevo.', 429);
  }
  return jsonError('No se pudo leer el enlace de Spotify. Intenta de nuevo más tarde.', 502);
}

async function handleSpotify(source) {
  const hasAuth = await getSpotifyToken();

  if (hasAuth) {
    try {
      return source.kind === 'album'
        ? await parseSpotifyAlbum(source.id)
        : await parseSpotifyPlaylist(source.id);
    } catch (err) {
      // 403 "Active premium subscription required for the owner of the app":
      // desde 2026 Spotify exige Premium al dueño de la app en modo desarrollo.
      // En ese caso (o con claves inválidas) se intenta el método sin claves.
      const status = spotifyStatus(err);
      if (status !== 401 && status !== 403) {
        return { response: spotifyErrorResponse(err) };
      }
      console.warn(`Spotify API oficial respondió ${status}; se usa el método sin claves (máx. 100 pistas).`);
    }
  }

  try {
    const result = await parseSpotifyAnonymous(source.href);
    if (result.tracks.length === 0) {
      return { response: jsonError('No se encontraron las canciones. Intenta de nuevo más tarde o revisa si el enlace es público.', 404) };
    }
    return result;
  } catch (scrapingErr) {
    console.error('Anonymous Spotify scraping failed:', scrapingErr.message);
    return {
      response: jsonError('Spotify restringió el análisis público en este enlace. Por favor añade tus claves en .env.local, o usa un enlace de YouTube Music.', 403),
    };
  }
}

// ─────────────────────────────────────────────────────────
// YOUTUBE MUSIC / YOUTUBE PARSER
// ─────────────────────────────────────────────────────────

async function fetchYouTubeList(yt, { playlistId, isYTMusic }) {
  try {
    // If it's a YT Music designated playlist or album ID (OLAK5uy_)
    if (isYTMusic || playlistId.startsWith('OLAK')) {
      return await yt.music.getPlaylist(playlistId);
    }
    // General YouTube Playlist
    return await yt.getPlaylist(playlistId);
  } catch {
    // Fallback to general getPlaylist if music fails
    return yt.getPlaylist(playlistId);
  }
}

// YouTube Music entrega miniaturas de 60–120 px; su CDN acepta otro tamaño en la URL.
function largeThumbnail(url) {
  if (!url) return null;
  return url.replace(/=w\d+-h\d+/, '=w600-h600');
}

function artistNames(video) {
  return (video.artists || []).map((a) => a.name).filter(Boolean).join(', ');
}

function toYouTubeTrack(video, index, albumMetadata) {
  let parsedArtist = albumMetadata.artist;
  let parsedTitle = video.title?.text || video.title || 'Unknown';

  if (artistNames(video)) {
    // Las pistas de YouTube Music traen los artistas como dato aparte:
    // no hace falta (y sería un error) partir el título por " - ".
    parsedArtist = artistNames(video);
  } else if (parsedTitle.includes(' - ')) {
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
    coverUrl: largeThumbnail(video.thumbnails?.[0]?.url) || albumMetadata.coverUrl,
    videoId: video.id,
    duration: video.duration?.seconds ? (video.duration.seconds * 1000) : 0,
  };
}

// youtubei.js 18 devuelve las playlists normales de YouTube como nodos LockupView
// (sin .id ni .title directos): se adaptan al formato que espera toYouTubeTrack.
function normalizeYouTubeItem(item) {
  if (item?.type !== 'LockupView') return item;
  if (item.content_type !== 'VIDEO' || !item.content_id) return {};
  const channel = item.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.text;
  return {
    id: item.content_id,
    title: item.metadata?.title?.text,
    author: channel ? { name: channel } : undefined,
    thumbnails: [{ url: `https://i.ytimg.com/vi/${item.content_id}/hqdefault.jpg` }],
  };
}

// Paginación para extraer listas largas sin cortes de 100 en 100 (con tope de seguridad)
async function collectYouTubeItems(list) {
  let rawItems = list.items;
  let currentList = list;
  for (let page = 0; currentList.has_continuation && page < MAX_YT_PAGES; page++) {
    try {
      currentList = await currentList.getContinuation();
      rawItems = rawItems.concat(currentList.items);
    } catch (e) {
      console.warn('YT Continuation ended or failed:', e.message);
      break;
    }
  }
  // descarta separadores y elementos de continuación sin ID
  return rawItems.map(normalizeYouTubeItem).filter((v) => v?.id);
}

// En los álbumes de YouTube Music (OLAK5uy_…) youtubei.js no siempre trae
// cabecera: se completa con los datos de la primera pista.
function youTubeAlbumMetadata(list, first) {
  return {
    title: list.header?.title?.text || list.info?.title || first.album?.name || 'YouTube Playlist',
    artist: list.header?.author?.name || list.info?.author?.name || artistNames(first) || 'YouTube',
    coverUrl: list.header?.thumbnails?.[0]?.url
             || list.info?.thumbnails?.[0]?.url
             || largeThumbnail(first.thumbnails?.[0]?.url) || null,
  };
}

async function handleYouTube(source) {
  try {
    const yt = await getYT();
    const list = await fetchYouTubeList(yt, source);

    if (!list || !list.items) {
      return { response: jsonError('No se encontraron las canciones de esta Playlist/Álbum', 404) };
    }

    const items = await collectYouTubeItems(list);
    const albumMetadata = {
      ...youTubeAlbumMetadata(list, items[0] || {}),
      totalTracks: items.length, // info.total_items llega como texto ("100 videos")
    };
    const tracks = items.map((video, index) => toYouTubeTrack(video, index, albumMetadata));

    return { albumMetadata, tracks };
  } catch (ytErr) {
    console.error('YouTube Parser failed:', ytErr.message);
    return { response: jsonError('No se pudo leer la playlist de YouTube. Revisa que sea pública o intenta más tarde.', 502) };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const source = parseSourceUrl(searchParams.get('url'));

  if (source.error) {
    return jsonError(source.error, 400);
  }

  const result = source.provider === 'spotify'
    ? await handleSpotify(source)
    : await handleYouTube(source);

  if (result.response) return result.response;

  if (result.tracks.length === 0) {
    return jsonError('No se encontraron canciones en ese enlace', 404);
  }

  return Response.json({ album: result.albumMetadata, tracks: result.tracks });
}
