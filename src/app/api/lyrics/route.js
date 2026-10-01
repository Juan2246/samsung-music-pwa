// API Route: /api/lyrics
// Ultra Lyrics Engine: LRCLIB (Primary) -> Lyrics.ovh (Fallback)
// Cleans synced lyrics (LRC) timestamps to plain text for USLT compatibility.
import { fetchWithTimeout, jsonError, readText } from '@/lib/server/http';

// LRCLIB pide un User-Agent que identifique la app y su repositorio.
const USER_AGENT = 'SamsungMusicPWA/1.0.0 (https://github.com/Juan2246/samsung-music-pwa)';
const LYRICS_TIMEOUT_MS = 8_000;

function toPlainLyrics(match) {
  if (match.plainLyrics) return match.plainLyrics;
  if (match.syncedLyrics) {
    // If only synced lyrics exist, strip the [mm:ss.xx] timestamps
    return match.syncedLyrics
      .split('\n')
      .map((line) => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim())
      .join('\n');
  }
  return null;
}

async function fromLrclib(artist, title) {
  const url = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } }, LYRICS_TIMEOUT_MS);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  // El primer resultado puede ser instrumental (sin letra): se usa el primero que tenga texto.
  for (const match of data) {
    const lyrics = toPlainLyrics(match);
    if (lyrics) return lyrics;
  }
  return null;
}

async function fromLyricsOvh(artist, title) {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  const res = await fetchWithTimeout(url, {}, LYRICS_TIMEOUT_MS);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.lyrics) return null;
  // Remove the standard lyrics.ovh exact phrase disclaimer if present
  return data.lyrics.replace(/Paroles de la chanson.*\n/i, '').trim();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const artist = readText(searchParams, 'artist');
  const title = readText(searchParams, 'title');

  if (!artist || !title) {
    return jsonError('Faltan artista y título (máximo 200 caracteres cada uno)', 400);
  }

  // 1. Primary Engine: LRCLIB
  try {
    const lyrics = await fromLrclib(artist, title);
    if (lyrics) return Response.json({ lyrics, source: 'LRCLIB' });
  } catch (err) {
    console.warn('LRCLIB failed:', err.message);
  }

  // 2. Fallback Engine: Lyrics.ovh
  try {
    const lyrics = await fromLyricsOvh(artist, title);
    if (lyrics) return Response.json({ lyrics, source: 'Lyrics.ovh' });
  } catch (err) {
    console.warn('Lyrics.ovh failed:', err.message);
  }

  // Both engines failed
  return jsonError('No se encontró la letra', 404);
}
