// API Route: /api/search
// Searches iTunes Search API for songs - free, no API key required, no CORS issues
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = searchParams.get('limit') || '20';

  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 });
  }

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=US`;
    const res = await fetch(url, {
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!res.ok) throw new Error(`iTunes API error: ${res.status}`);
    const data = await res.json();

    const results = data.results.map((track) => ({
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
      previewUrl: track.previewUrl || null, // 30s AAC preview
      itunesUrl: track.trackViewUrl || null,
    }));

    return Response.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
