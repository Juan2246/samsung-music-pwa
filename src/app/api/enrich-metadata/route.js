// API Route: /api/enrich-metadata
// Completa portada, género y año de una pista (p. ej. las del CSV de Exportify) con iTunes Search.
import { fetchWithTimeout, jsonError, readText } from '@/lib/server/http';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = readText(searchParams, 'title');
  const artist = readText(searchParams, 'artist');

  if (!title || !artist) {
    return jsonError('Faltan título y artista (máximo 200 caracteres cada uno)', 400);
  }

  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    const res = await fetchWithTimeout(`https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=3`);
    if (!res.ok) throw new Error(`iTunes fetch failed: ${res.status}`);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      // Tomamos el primer resultado que suele ser el más preciso
      const track = data.results[0];

      const coverUrl = track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : null;
      const genre = track.primaryGenreName || '';
      const year = track.releaseDate ? track.releaseDate.substring(0, 4) : '';

      return Response.json({
        coverUrl,
        genre,
        year
      });
    }

    return Response.json({ coverUrl: null, genre: '', year: '' });
  } catch (err) {
    console.error('Enrich metadata error:', err.message);
    return jsonError('No se pudieron completar los metadatos', 502);
  }
}
