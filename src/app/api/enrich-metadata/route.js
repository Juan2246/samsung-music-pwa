export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const artist = searchParams.get('artist');

  if (!title || !artist) {
    return Response.json({ error: 'Title and artist are required' }, { status: 400 });
  }

  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=3`);
    if (!res.ok) throw new Error('iTunes fetch failed');
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
    return Response.json({ error: err.message }, { status: 500 });
  }
}
