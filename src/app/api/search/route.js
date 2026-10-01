// API Route: /api/search
// Searches iTunes Search API for songs - free, no API key required, no CORS issues
import { fetchWithTimeout, jsonError, readText } from '@/lib/server/http';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw) {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = readText(searchParams, 'q');
  const limit = parseLimit(searchParams.get('limit'));

  if (!query) {
    return jsonError('Escribe qué quieres buscar (máximo 200 caracteres)', 400);
  }

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=US`;
    const res = await fetchWithTimeout(url, {
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!res.ok) throw new Error(`iTunes API error: ${res.status}`);
    const data = await res.json();

    const results = (data.results || []).map((track) => ({
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      genre: track.primaryGenreName,
      releaseYear: track.releaseDate ? new Date(track.releaseDate).getFullYear() : null,
      duration: track.trackTimeMillis ? Math.floor(track.trackTimeMillis / 1000) : null,
      coverUrl: track.artworkUrl100
        ? track.artworkUrl100.replace('100x100bb', '600x600bb')
        : null,
      coverThumb: track.artworkUrl100 || null,
      itunesUrl: track.trackViewUrl || null,
    }));

    return Response.json({ results });
  } catch (err) {
    console.error('Search error:', err.message);
    return jsonError('La búsqueda falló. Revisa tu conexión e intenta de nuevo.', 502);
  }
}
